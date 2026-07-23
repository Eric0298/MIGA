using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Miga.Application.Common.Security;
using Miga.Domain.Enums;
using Miga.Infrastructure.Persistence;

namespace Miga.Infrastructure.Auth;

public sealed class CurrentActorAccessor : ICurrentActorAccessor
{
    private readonly IHttpContextAccessor _httpContextAccessor;
    private readonly MigaDbContext _dbContext;

    public CurrentActorAccessor(
        IHttpContextAccessor httpContextAccessor,
        MigaDbContext dbContext)
    {
        _httpContextAccessor = httpContextAccessor;
        _dbContext = dbContext;
    }

    public async Task<CurrentActor?> GetCurrentAsync(CancellationToken cancellationToken = default) =>
        await GetRegisteredAsync(cancellationToken) ?? await GetDemoAsync(cancellationToken);

    public async Task<CurrentActor?> GetRegisteredAsync(CancellationToken cancellationToken = default)
    {
        var httpContext = _httpContextAccessor.HttpContext;
        if (httpContext is null)
        {
            return null;
        }

        var result = await httpContext.AuthenticateAsync(MigaAuthenticationConstants.RegisteredScheme);
        var userIdValue = result.Principal?.FindFirstValue(ClaimTypes.NameIdentifier);
        var sessionIdValue = result.Principal?.FindFirstValue(MigaAuthenticationConstants.SessionIdClaim);
        if (!result.Succeeded ||
            !Guid.TryParse(userIdValue, out var userId) ||
            !Guid.TryParse(sessionIdValue, out var sessionId))
        {
            return null;
        }

        var now = DateTimeOffset.UtcNow;
        var session = await _dbContext.UserSessions
            .AsNoTracking()
            .SingleOrDefaultAsync(
                candidate =>
                    candidate.Id == sessionId &&
                    candidate.UserId == userId &&
                    candidate.RevokedAtUtc == null,
                cancellationToken);
        if (session is null ||
            session.IdleExpiresAtUtc <= now ||
            session.AbsoluteExpiresAtUtc <= now)
        {
            return null;
        }

        var workspaceId = await _dbContext.Workspaces
            .AsNoTracking()
            .Where(workspace =>
                workspace.OwnerUserId == userId &&
                workspace.Kind == WorkspaceKind.Registered)
            .Select(workspace => (Guid?)workspace.Id)
            .SingleOrDefaultAsync(cancellationToken);

        return workspaceId is null
            ? null
            : new CurrentActor(
                ActorType.Registered,
                session.Id,
                workspaceId.Value,
                session.UserId,
                Min(session.IdleExpiresAtUtc, session.AbsoluteExpiresAtUtc));
    }

    public async Task<CurrentActor?> GetDemoAsync(CancellationToken cancellationToken = default)
    {
        var httpContext = _httpContextAccessor.HttpContext;
        if (httpContext is null)
        {
            return null;
        }

        var result = await httpContext.AuthenticateAsync(MigaAuthenticationConstants.DemoScheme);
        var sessionIdValue = result.Principal?.FindFirstValue(MigaAuthenticationConstants.SessionIdClaim);
        if (!result.Succeeded || !Guid.TryParse(sessionIdValue, out var sessionId))
        {
            return null;
        }

        var now = DateTimeOffset.UtcNow;
        var session = await _dbContext.DemoSessions
            .AsNoTracking()
            .Include(x => x.Workspace)
            .SingleOrDefaultAsync(
                x => x.Id == sessionId &&
                     x.RevokedAtUtc == null &&
                     x.Workspace.Kind == WorkspaceKind.Demo,
                cancellationToken);

        return session is null ||
               session.IdleExpiresAtUtc <= now ||
               session.AbsoluteExpiresAtUtc <= now ||
               session.Workspace.ExpiresAtUtc is null ||
               session.Workspace.ExpiresAtUtc <= now
            ? null
            : new CurrentActor(
                ActorType.Demo,
                session.Id,
                session.WorkspaceId,
                null,
                Min(session.IdleExpiresAtUtc, session.AbsoluteExpiresAtUtc));
    }

    private static DateTimeOffset Min(DateTimeOffset left, DateTimeOffset right) =>
        left <= right ? left : right;
}
