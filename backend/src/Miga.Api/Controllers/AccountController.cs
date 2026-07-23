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
using Miga.Infrastructure.Auth;
using Miga.Infrastructure.Persistence;
using Miga.Infrastructure.Security;

namespace Miga.Api.Controllers;

[ApiController]
[Authorize(Policy = MigaAuthenticationConstants.RegisteredPolicy)]
[Route("api/account")]
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
                context.User.PrivacyPolicyVersion,
                context.User.PrivacyPolicyAcceptedAtUtc),
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

    private sealed record RecentUserContext(CurrentActor Actor, MigaUser User);
}
