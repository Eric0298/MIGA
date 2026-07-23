using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Miga.Infrastructure.Persistence;
using Miga.Infrastructure.Security;

namespace Miga.Infrastructure.Auth;

public sealed class RegisteredCookieEvents : CookieAuthenticationEvents
{
    private static readonly TimeSpan LastSeenWriteInterval = TimeSpan.FromMinutes(2);

    private readonly MigaDbContext _dbContext;
    private readonly AuthenticationSecurityOptions _options;

    public RegisteredCookieEvents(
        MigaDbContext dbContext,
        IOptions<AuthenticationSecurityOptions> options)
    {
        _dbContext = dbContext;
        _options = options.Value;
    }

    public override async Task ValidatePrincipal(CookieValidatePrincipalContext context)
    {
        var userIdValue = context.Principal?.FindFirstValue(ClaimTypes.NameIdentifier);
        var sessionIdValue = context.Principal?.FindFirstValue(MigaAuthenticationConstants.SessionIdClaim);

        if (!Guid.TryParse(userIdValue, out var userId) ||
            !Guid.TryParse(sessionIdValue, out var sessionId))
        {
            await RejectAsync(context);
            return;
        }

        var now = DateTimeOffset.UtcNow;
        var session = await _dbContext.UserSessions
            .SingleOrDefaultAsync(x => x.Id == sessionId && x.UserId == userId, context.HttpContext.RequestAborted);
        var user = await _dbContext.Users
            .AsNoTracking()
            .SingleOrDefaultAsync(x => x.Id == userId, context.HttpContext.RequestAborted);

        if (session is null ||
            user is null ||
            session.RevokedAtUtc is not null ||
            session.IdleExpiresAtUtc <= now ||
            session.AbsoluteExpiresAtUtc <= now ||
            !string.Equals(
                session.SecurityStampAtIssue,
                user.SecurityStamp,
                StringComparison.Ordinal))
        {
            await RejectAsync(context);
            return;
        }

        if (now - session.LastSeenAtUtc >= LastSeenWriteInterval)
        {
            session.LastSeenAtUtc = now;
            session.IdleExpiresAtUtc = Min(now + _options.UserIdleTimeout, session.AbsoluteExpiresAtUtc);
            await _dbContext.SaveChangesAsync(context.HttpContext.RequestAborted);
        }
    }

    public override Task RedirectToLogin(RedirectContext<CookieAuthenticationOptions> context)
    {
        context.Response.StatusCode = StatusCodes.Status401Unauthorized;
        return Task.CompletedTask;
    }

    public override Task RedirectToAccessDenied(RedirectContext<CookieAuthenticationOptions> context)
    {
        context.Response.StatusCode = StatusCodes.Status403Forbidden;
        return Task.CompletedTask;
    }

    private static DateTimeOffset Min(DateTimeOffset left, DateTimeOffset right) =>
        left <= right ? left : right;

    private static async Task RejectAsync(CookieValidatePrincipalContext context)
    {
        context.RejectPrincipal();
        await context.HttpContext.SignOutAsync(MigaAuthenticationConstants.RegisteredScheme);
    }
}
