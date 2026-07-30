using System.Text.Json;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Miga.Api.Security;
using Miga.Application.Common.Security;
using Miga.Contracts.Account;
using Miga.Domain.Entities;
using Miga.Infrastructure.Auth;
using Miga.Infrastructure.Persistence;
using Miga.Infrastructure.Security;

namespace Miga.Api.Controllers;

[ApiController]
[Authorize(Policy = MigaAuthenticationConstants.RegisteredPolicy)]
[Route("api/account")]
[RequestSizeLimit(ApiSecurityConstants.SensitiveRequestBodyLimit)]
public sealed class AccountController : ApiControllerBase
{
    private readonly ICurrentActorAccessor _currentActorAccessor;
    private readonly ISecurityAuditService _auditService;
    private readonly UserManager<MigaUser> _userManager;
    private readonly MigaDbContext _dbContext;
    private readonly AuthenticationSecurityOptions _options;

    public AccountController(
        ICurrentActorAccessor currentActorAccessor,
        ISecurityAuditService auditService,
        UserManager<MigaUser> userManager,
        MigaDbContext dbContext,
        IOptions<AuthenticationSecurityOptions> options)
    {
        _currentActorAccessor = currentActorAccessor;
        _auditService = auditService;
        _userManager = userManager;
        _dbContext = dbContext;
        _options = options.Value;
    }

    [HttpGet("sessions")]
    [EnableRateLimiting(ApiSecurityConstants.PasswordMutationRatePolicy)]
    [ProducesResponseType<IReadOnlyList<AccountSessionResponse>>(StatusCodes.Status200OK)]
    public async Task<IActionResult> ListSessions(CancellationToken cancellationToken)
    {
        var context = await GetRecentUserContextAsync(cancellationToken);
        if (context is null)
        {
            return ReauthenticationRequired();
        }

        var now = DateTimeOffset.UtcNow;
        await PurgeExpiredAndRevokedUserSessionsAsync(now, cancellationToken);
        List<UserSession> activeSessions;
        if (string.Equals(
                _dbContext.Database.ProviderName,
                "Microsoft.EntityFrameworkCore.Sqlite",
                StringComparison.Ordinal))
        {
            // SQLite cannot translate DateTimeOffset ordering. Integration and
            // supported SQLite deployments still keep expiration in SQL.
            activeSessions = await _dbContext.UserSessions
                .FromSqlInterpolated(
                    $"""
                     SELECT *
                     FROM "user_sessions"
                     WHERE "UserId" = {context.User.Id}
                       AND "RevokedAtUtc" IS NULL
                       AND julianday("IdleExpiresAtUtc") > julianday({now})
                       AND julianday("AbsoluteExpiresAtUtc") > julianday({now})
                     """)
                .AsNoTracking()
                .ToListAsync(cancellationToken);
        }
        else
        {
            activeSessions = await _dbContext.UserSessions
                .AsNoTracking()
                .Where(session =>
                    session.UserId == context.User.Id &&
                    session.RevokedAtUtc == null &&
                    session.IdleExpiresAtUtc > now &&
                    session.AbsoluteExpiresAtUtc > now)
                .ToListAsync(cancellationToken);
        }

        var sessions = activeSessions
            .OrderByDescending(session => session.LastSeenAtUtc)
            .Select(session => new AccountSessionResponse(
                session.Id,
                session.CreatedAtUtc,
                session.LastSeenAtUtc,
                session.IdleExpiresAtUtc <= session.AbsoluteExpiresAtUtc
                    ? session.IdleExpiresAtUtc
                    : session.AbsoluteExpiresAtUtc,
                session.Id == context.Actor.SessionId))
            .ToList();

        return Ok(sessions);
    }

    [HttpDelete("sessions/others")]
    [EnableRateLimiting(ApiSecurityConstants.PasswordMutationRatePolicy)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> RevokeOtherSessions(
        CancellationToken cancellationToken)
    {
        var context = await GetRecentUserContextAsync(cancellationToken);
        if (context is null)
        {
            return ReauthenticationRequired();
        }

        var now = DateTimeOffset.UtcNow;
        await PurgeExpiredAndRevokedUserSessionsAsync(now, cancellationToken);
        await _dbContext.UserSessions
            .Where(session =>
                session.UserId == context.User.Id &&
                session.Id != context.Actor.SessionId &&
                session.RevokedAtUtc == null)
            .ExecuteUpdateAsync(
                setters => setters.SetProperty(
                    session => session.RevokedAtUtc,
                    now),
                cancellationToken);
        await _auditService.RecordAsync(
            "sessions.others_revoked",
            "success",
            ActorType.Registered,
            context.User.Id,
            cancellationToken);
        return NoContent();
    }

    [HttpDelete("sessions/{sessionId:guid}")]
    [EnableRateLimiting(ApiSecurityConstants.PasswordMutationRatePolicy)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> RevokeSession(
        Guid sessionId,
        CancellationToken cancellationToken)
    {
        var context = await GetRecentUserContextAsync(cancellationToken);
        if (context is null)
        {
            return ReauthenticationRequired();
        }

        var session = await _dbContext.UserSessions
            .SingleOrDefaultAsync(
                candidate =>
                    candidate.Id == sessionId &&
                    candidate.UserId == context.User.Id &&
                    candidate.RevokedAtUtc == null,
                cancellationToken);
        if (session is null)
        {
            return ApiProblem(
                StatusCodes.Status404NotFound,
                "session_not_found",
                "The session was not found.");
        }

        session.RevokedAtUtc = DateTimeOffset.UtcNow;
        await _dbContext.SaveChangesAsync(cancellationToken);
        await _auditService.RecordAsync(
            "session.revoked",
            "success",
            ActorType.Registered,
            context.User.Id,
            cancellationToken);

        if (session.Id == context.Actor.SessionId)
        {
            await HttpContext.SignOutAsync(MigaAuthenticationConstants.RegisteredScheme);
        }

        return NoContent();
    }

    [HttpGet("export")]
    [EnableRateLimiting(ApiSecurityConstants.AccountExportRatePolicy)]
    [ProducesResponseType<AccountExportResponse>(StatusCodes.Status200OK)]
    public async Task<IActionResult> Export(CancellationToken cancellationToken)
    {
        var context = await GetRecentUserContextAsync(cancellationToken);
        if (context is null)
        {
            return ReauthenticationRequired();
        }

        var snapshot = await _dbContext.WorkspaceSnapshots
            .AsNoTracking()
            .SingleAsync(x => x.WorkspaceId == context.Actor.WorkspaceId, cancellationToken);
        using var document = JsonDocument.Parse(snapshot.DataJson);

        await _auditService.RecordAsync(
            "account.exported",
            "success",
            ActorType.Registered,
            context.User.Id,
            cancellationToken);

        return Ok(new AccountExportResponse(
            DateTimeOffset.UtcNow,
            new AccountExportIdentity(
                context.User.Id,
                context.User.Email!,
                context.User.EmailConfirmed,
                context.User.CreatedAtUtc,
                context.User.PrivacyPolicyVersion!,
                context.User.PrivacyPolicyAcceptedAtUtc!.Value),
            new AccountExportSnapshot(
                snapshot.Revision,
                snapshot.UpdatedAtUtc,
                document.RootElement.Clone())));
    }

    [HttpDelete]
    [EnableRateLimiting(ApiSecurityConstants.PasswordMutationRatePolicy)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> Delete(
        DeleteAccountRequest request,
        CancellationToken cancellationToken)
    {
        if (!string.Equals(request.Confirmation, "DELETE", StringComparison.Ordinal))
        {
            return ApiProblem(
                StatusCodes.Status400BadRequest,
                "confirmation_invalid",
                "Account deletion requires explicit confirmation.");
        }

        var context = await GetRecentUserContextAsync(cancellationToken);
        if (context is null)
        {
            return ReauthenticationRequired();
        }

        if (!await _userManager.CheckPasswordAsync(context.User, request.CurrentPassword))
        {
            await _auditService.RecordAsync(
                "account.delete",
                "failure",
                ActorType.Registered,
                context.User.Id,
                cancellationToken);
            return ApiProblem(
                StatusCodes.Status401Unauthorized,
                "invalid_credentials",
                "The credentials are invalid.");
        }

        await using var transaction = await _dbContext.Database.BeginTransactionAsync(cancellationToken);
        await _auditService.RecordAsync(
            "account.deleted",
            "success",
            ActorType.Registered,
            context.User.Id,
            cancellationToken);

        var workspace = await _dbContext.Workspaces
            .SingleAsync(x => x.Id == context.Actor.WorkspaceId, cancellationToken);
        _dbContext.Workspaces.Remove(workspace);
        await _dbContext.SaveChangesAsync(cancellationToken);

        var result = await _userManager.DeleteAsync(context.User);
        if (!result.Succeeded)
        {
            await transaction.RollbackAsync(cancellationToken);
            return ApiProblem(
                StatusCodes.Status409Conflict,
                "account_delete_failed",
                "The account could not be deleted.");
        }

        await transaction.CommitAsync(cancellationToken);
        await HttpContext.SignOutAsync(MigaAuthenticationConstants.RegisteredScheme);
        return NoContent();
    }

    private async Task<RecentUserContext?> GetRecentUserContextAsync(
        CancellationToken cancellationToken)
    {
        var actor = await _currentActorAccessor.GetRegisteredAsync(cancellationToken);
        if (actor?.UserId is not Guid userId)
        {
            return null;
        }

        var session = await _dbContext.UserSessions
            .AsNoTracking()
            .SingleOrDefaultAsync(
                x => x.Id == actor.SessionId &&
                     x.UserId == userId,
                cancellationToken);
        if (session is null ||
            session.LastReauthenticatedAtUtc + _options.RecentAuthenticationWindow <=
            DateTimeOffset.UtcNow)
        {
            return null;
        }

        var user = await _userManager.FindByIdAsync(userId.ToString());
        return user is null ? null : new RecentUserContext(actor, user);
    }

    private IActionResult ReauthenticationRequired() =>
        ApiProblem(
            StatusCodes.Status403Forbidden,
            "reauthentication_required",
            "Recent authentication is required.");

    private async Task PurgeExpiredAndRevokedUserSessionsAsync(
        DateTimeOffset now,
        CancellationToken cancellationToken)
    {
        if (string.Equals(
                _dbContext.Database.ProviderName,
                "Microsoft.EntityFrameworkCore.Sqlite",
                StringComparison.Ordinal))
        {
            await _dbContext.Database.ExecuteSqlInterpolatedAsync(
                $"""
                 DELETE FROM "user_sessions"
                 WHERE "RevokedAtUtc" IS NOT NULL
                    OR julianday("IdleExpiresAtUtc") <= julianday({now})
                    OR julianday("AbsoluteExpiresAtUtc") <= julianday({now})
                 """,
                cancellationToken);
            return;
        }

        await _dbContext.UserSessions
            .Where(session =>
                session.RevokedAtUtc != null ||
                session.IdleExpiresAtUtc <= now ||
                session.AbsoluteExpiresAtUtc <= now)
            .ExecuteDeleteAsync(cancellationToken);
    }

    private sealed record RecentUserContext(CurrentActor Actor, MigaUser User);
}
