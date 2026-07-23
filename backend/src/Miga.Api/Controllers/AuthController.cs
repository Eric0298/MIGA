using System.Diagnostics;
using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Miga.Api.Security;
using Miga.Application.Auth;
using Miga.Application.Common.Security;
using Miga.Application.Demo;
using Miga.Contracts.Auth;
using Miga.Domain.Entities;
using Miga.Domain.Enums;
using Miga.Infrastructure.Auth;
using Miga.Infrastructure.Demo;
using Miga.Infrastructure.Persistence;
using Miga.Infrastructure.Security;
using Npgsql;

namespace Miga.Api.Controllers;

[ApiController]
[Route("api/auth")]
public sealed class AuthController : ApiControllerBase
{
    private static readonly TimeSpan GenericResponseFloor = TimeSpan.FromMilliseconds(500);

    private readonly IAntiforgery _antiforgery;
    private readonly UserManager<MigaUser> _userManager;
    private readonly SignInManager<MigaUser> _signInManager;
    private readonly IPasswordHasher<MigaUser> _passwordHasher;
    private readonly IPasswordPolicy _passwordPolicy;
    private readonly IAccountEmailSender _emailSender;
    private readonly IDemoWorkspaceConsumptionService _demoWorkspaceConsumption;
    private readonly ICurrentActorAccessor _currentActorAccessor;
    private readonly ISecurityAuditService _auditService;
    private readonly MigaDbContext _dbContext;
    private readonly AuthenticationSecurityOptions _authenticationOptions;
    private readonly ILogger<AuthController> _logger;

    public AuthController(
        IAntiforgery antiforgery,
        UserManager<MigaUser> userManager,
        SignInManager<MigaUser> signInManager,
        IPasswordHasher<MigaUser> passwordHasher,
        IPasswordPolicy passwordPolicy,
        IAccountEmailSender emailSender,
        IDemoWorkspaceConsumptionService demoWorkspaceConsumption,
        ICurrentActorAccessor currentActorAccessor,
        ISecurityAuditService auditService,
        MigaDbContext dbContext,
        IOptions<AuthenticationSecurityOptions> authenticationOptions,
        ILogger<AuthController> logger)
    {
        _antiforgery = antiforgery;
        _userManager = userManager;
        _signInManager = signInManager;
        _passwordHasher = passwordHasher;
        _passwordPolicy = passwordPolicy;
        _emailSender = emailSender;
        _demoWorkspaceConsumption = demoWorkspaceConsumption;
        _currentActorAccessor = currentActorAccessor;
        _auditService = auditService;
        _dbContext = dbContext;
        _authenticationOptions = authenticationOptions.Value;
        _logger = logger;
    }

    [AllowAnonymous]
    [HttpGet("csrf")]
    [ProducesResponseType<CsrfTokenResponse>(StatusCodes.Status200OK)]
    public async Task<ActionResult<CsrfTokenResponse>> GetCsrfToken()
    {
        // The application's default scheme is the registered cookie. Resolve
        // the separate demo scheme explicitly so antiforgery binds the token
        // to the same principal the workspace policy will authorize.
        var registered =
            await HttpContext.AuthenticateAsync(MigaAuthenticationConstants.RegisteredScheme);
        if (registered.Succeeded && registered.Principal is not null)
        {
            HttpContext.User = registered.Principal;
        }
        else
        {
            var demo = await HttpContext.AuthenticateAsync(MigaAuthenticationConstants.DemoScheme);
            if (demo.Succeeded && demo.Principal is not null)
            {
                HttpContext.User = demo.Principal;
            }
        }

        var tokens = _antiforgery.GetAndStoreTokens(HttpContext);
        if (string.IsNullOrEmpty(tokens.RequestToken))
        {
            return ApiProblem(
                StatusCodes.Status500InternalServerError,
                "csrf_unavailable",
                "Request validation is unavailable.");
        }

        return Ok(new CsrfTokenResponse(tokens.RequestToken));
    }

    [AllowAnonymous]
    [HttpGet("session")]
    [ProducesResponseType<SessionResponse>(StatusCodes.Status200OK)]
    public async Task<ActionResult<SessionResponse>> GetSession(CancellationToken cancellationToken)
    {
        var registered = await _currentActorAccessor.GetRegisteredAsync(cancellationToken);
        if (registered?.UserId is Guid userId)
        {
            var user = await _userManager.FindByIdAsync(userId.ToString());
            if (user is not null)
            {
                return Ok(new SessionResponse(
                    true,
                    MigaAuthenticationConstants.RegisteredActor,
                    registered.WorkspaceId,
                    user.Id,
                    user.Email,
                    registered.ExpiresAtUtc,
                    _authenticationOptions.RequireConfirmedEmail
                        ? user.EmailConfirmed
                        : null));
            }
        }

        var demo = await _currentActorAccessor.GetDemoAsync(cancellationToken);
        if (demo is not null)
        {
            return Ok(new SessionResponse(
                true,
                MigaAuthenticationConstants.DemoActor,
                demo.WorkspaceId,
                null,
                null,
                demo.ExpiresAtUtc,
                null));
        }

        return Ok(new SessionResponse(false, null, null, null, null, null, null));
    }

    [AllowAnonymous]
    [HttpPost("demo")]
    [EnableRateLimiting(ApiSecurityConstants.DemoCreationRatePolicy)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> CreateDemo(CancellationToken cancellationToken)
    {
        if (await _currentActorAccessor.GetRegisteredAsync(cancellationToken) is not null)
        {
            return ApiProblem(
                StatusCodes.Status409Conflict,
                "registered_session_active",
                "A registered session is already active.");
        }

        var existingDemo = await _currentActorAccessor.GetDemoAsync(cancellationToken);
        if (existingDemo is not null)
        {
            var oldSession = await _dbContext.DemoSessions
                .SingleOrDefaultAsync(x => x.Id == existingDemo.SessionId, cancellationToken);
            if (oldSession is not null)
            {
                oldSession.RevokedAtUtc = DateTimeOffset.UtcNow;
                await _dbContext.SaveChangesAsync(cancellationToken);
            }

            await HttpContext.SignOutAsync(MigaAuthenticationConstants.DemoScheme);
        }

        var now = DateTimeOffset.UtcNow;
        var absoluteExpiry = now + _authenticationOptions.DemoAbsoluteTimeout;
        var workspace = new Workspace
        {
            Id = Guid.CreateVersion7(),
            Kind = WorkspaceKind.Demo,
            CreatedAtUtc = now,
            ExpiresAtUtc = absoluteExpiry
        };
        var demoSession = new DemoSession
        {
            Id = Guid.CreateVersion7(),
            WorkspaceId = workspace.Id,
            CreatedAtUtc = now,
            LastSeenAtUtc = now,
            IdleExpiresAtUtc = Min(now + _authenticationOptions.DemoIdleTimeout, absoluteExpiry),
            AbsoluteExpiresAtUtc = absoluteExpiry
        };
        workspace.Snapshot = new WorkspaceSnapshot
        {
            WorkspaceId = workspace.Id,
            Revision = 0,
            DataJson = SnapshotSeedFactory.CreateDemo(now),
            UpdatedAtUtc = now
        };
        workspace.DemoSession = demoSession;

        _dbContext.Workspaces.Add(workspace);
        await _dbContext.SaveChangesAsync(cancellationToken);
        await SignInDemoAsync(demoSession);
        await _auditService.RecordAsync(
            "demo.created",
            "success",
            ActorType.Demo,
            demoSession.Id,
            cancellationToken);

        return NoContent();
    }

    [AllowAnonymous]
    [HttpPost("register")]
    [EnableRateLimiting(ApiSecurityConstants.RegistrationRatePolicy)]
    [ProducesResponseType(StatusCodes.Status202Accepted)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> Register(
        RegisterRequest request,
        CancellationToken cancellationToken)
    {
        var genericResponseStarted = Stopwatch.GetTimestamp();
        if (!string.Equals(
                request.PrivacyPolicyVersion,
                _authenticationOptions.PrivacyPolicyVersion,
                StringComparison.Ordinal))
        {
            return ApiProblem(
                StatusCodes.Status400BadRequest,
                "privacy_policy_version_invalid",
                "The current privacy policy must be accepted.");
        }

        var passwordResult = _passwordPolicy.Validate(request.Password);
        if (!passwordResult.IsValid)
        {
            return ApiProblem(
                StatusCodes.Status400BadRequest,
                passwordResult.ErrorCode!,
                "The password does not meet the security policy.");
        }

        var email = request.Email.Trim();
        var existing = await _userManager.FindByEmailAsync(email);
        if (existing is not null)
        {
            await TrySendConfirmationAsync(existing, cancellationToken);
            await EnforceGenericResponseFloorAsync(genericResponseStarted, cancellationToken);
            return Accepted();
        }

        var demoActor = request.ImportDemoData
            ? await _currentActorAccessor.GetDemoAsync(cancellationToken)
            : null;
        if (request.ImportDemoData && demoActor is null)
        {
            return ApiProblem(
                StatusCodes.Status400BadRequest,
                "demo_session_required",
                "An active demo session is required to import demo data.");
        }

        WorkspaceSnapshot? demoSnapshot = null;
        Workspace? demoWorkspace = null;
        if (demoActor is not null)
        {
            demoWorkspace = await _dbContext.Workspaces
                .Include(x => x.Snapshot)
                .SingleOrDefaultAsync(
                    x => x.Id == demoActor.WorkspaceId && x.Kind == WorkspaceKind.Demo,
                    cancellationToken);
            demoSnapshot = demoWorkspace?.Snapshot;
            if (demoWorkspace is null || demoSnapshot is null)
            {
                return ApiProblem(
                    StatusCodes.Status400BadRequest,
                    "demo_session_invalid",
                    "The demo session cannot be imported.");
            }
        }

        var now = DateTimeOffset.UtcNow;
        var user = new MigaUser
        {
            Id = Guid.CreateVersion7(),
            Email = email,
            UserName = email,
            CreatedAtUtc = now,
            PrivacyPolicyVersion = request.PrivacyPolicyVersion,
            PrivacyPolicyAcceptedAtUtc = now,
            SecurityStamp = Guid.NewGuid().ToString("N")
        };

        await using var transaction = await _dbContext.Database.BeginTransactionAsync(cancellationToken);
        IdentityResult createResult;
        try
        {
            createResult = await _userManager.CreateAsync(user, request.Password);
        }
        catch (DbUpdateException exception)
            when (exception.InnerException is PostgresException
            {
                SqlState: PostgresErrorCodes.UniqueViolation
            })
        {
            // A concurrent registration can win after the pre-check. Keep the
            // externally observable response identical to an existing account.
            await transaction.RollbackAsync(cancellationToken);
            await EnforceGenericResponseFloorAsync(genericResponseStarted, cancellationToken);
            return Accepted();
        }

        if (!createResult.Succeeded)
        {
            await transaction.RollbackAsync(cancellationToken);
            if (createResult.Errors.Any(error =>
                    error.Code.Contains("Duplicate", StringComparison.OrdinalIgnoreCase)))
            {
                await EnforceGenericResponseFloorAsync(genericResponseStarted, cancellationToken);
                return Accepted();
            }

            return ApiProblem(
                StatusCodes.Status400BadRequest,
                "registration_failed",
                "The account could not be created.");
        }

        if (demoWorkspace is not null)
        {
            var converted = await _demoWorkspaceConsumption.TryConvertAsync(
                demoWorkspace.Id,
                demoActor!.SessionId,
                demoSnapshot!.Revision,
                user.Id,
                now,
                cancellationToken);
            if (!converted)
            {
                await transaction.RollbackAsync(cancellationToken);
                return ApiProblem(
                    StatusCodes.Status409Conflict,
                    "demo_snapshot_changed",
                    "The demo workspace changed during conversion. Retry the operation.");
            }
        }
        else
        {
            var workspace = new Workspace
            {
                Id = Guid.CreateVersion7(),
                Kind = WorkspaceKind.Registered,
                OwnerUserId = user.Id,
                CreatedAtUtc = now
            };
            workspace.Snapshot = new WorkspaceSnapshot
            {
                WorkspaceId = workspace.Id,
                Revision = 0,
                DataJson = SnapshotSeedFactory.CreateEmpty(now),
                UpdatedAtUtc = now
            };
            _dbContext.Workspaces.Add(workspace);
            await _dbContext.SaveChangesAsync(cancellationToken);
        }

        await transaction.CommitAsync(cancellationToken);

        if (demoActor is not null)
        {
            await HttpContext.SignOutAsync(MigaAuthenticationConstants.DemoScheme);
        }

        await _auditService.RecordAsync(
            "account.registered",
            "success",
            ActorType.Registered,
            user.Id,
            cancellationToken);

        if (_authenticationOptions.RequireConfirmedEmail)
        {
            await TrySendConfirmationAsync(user, cancellationToken);
            await EnforceGenericResponseFloorAsync(genericResponseStarted, cancellationToken);
            return Accepted();
        }

        await IssueRegisteredSessionAsync(user, cancellationToken);
        return NoContent();
    }

    [AllowAnonymous]
    [HttpPost("login")]
    [EnableRateLimiting(ApiSecurityConstants.LoginRatePolicy)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> Login(LoginRequest request, CancellationToken cancellationToken)
    {
        var user = await _userManager.FindByEmailAsync(request.Email.Trim());
        if (user is null)
        {
            _ = _passwordHasher.HashPassword(new MigaUser(), request.Password);
            await _auditService.RecordAsync(
                "auth.login",
                "failure",
                null,
                null,
                cancellationToken);
            return InvalidCredentials();
        }

        var result = await _signInManager.CheckPasswordSignInAsync(
            user,
            request.Password,
            lockoutOnFailure: true);
        if (!result.Succeeded ||
            (_authenticationOptions.RequireConfirmedEmail && !user.EmailConfirmed))
        {
            await _auditService.RecordAsync(
                "auth.login",
                "failure",
                ActorType.Registered,
                user.Id,
                cancellationToken);
            return InvalidCredentials();
        }

        await RevokeCurrentSessionsAsync(cancellationToken);
        await IssueRegisteredSessionAsync(user, cancellationToken);
        await _auditService.RecordAsync(
            "auth.login",
            "success",
            ActorType.Registered,
            user.Id,
            cancellationToken);
        return NoContent();
    }

    [AllowAnonymous]
    [HttpPost("logout")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> Logout(CancellationToken cancellationToken)
    {
        var registered = await _currentActorAccessor.GetRegisteredAsync(cancellationToken);
        var demo = await _currentActorAccessor.GetDemoAsync(cancellationToken);
        var now = DateTimeOffset.UtcNow;

        if (registered is not null)
        {
            var session = await _dbContext.UserSessions
                .SingleOrDefaultAsync(x => x.Id == registered.SessionId, cancellationToken);
            if (session is not null)
            {
                session.RevokedAtUtc = now;
            }
        }

        if (demo is not null)
        {
            var session = await _dbContext.DemoSessions
                .SingleOrDefaultAsync(x => x.Id == demo.SessionId, cancellationToken);
            if (session is not null)
            {
                session.RevokedAtUtc = now;
            }
        }

        await _dbContext.SaveChangesAsync(cancellationToken);
        await HttpContext.SignOutAsync(MigaAuthenticationConstants.RegisteredScheme);
        await HttpContext.SignOutAsync(MigaAuthenticationConstants.DemoScheme);
        await _auditService.RecordAsync(
            "auth.logout",
            "success",
            registered?.Type ?? demo?.Type,
            registered?.UserId ?? demo?.SessionId,
            cancellationToken);
        return NoContent();
    }

    [AllowAnonymous]
    [HttpPost("forgot-password")]
    [EnableRateLimiting(ApiSecurityConstants.RecoveryRatePolicy)]
    [ProducesResponseType(StatusCodes.Status202Accepted)]
    public async Task<IActionResult> ForgotPassword(
        EmailRequest request,
        CancellationToken cancellationToken)
    {
        var genericResponseStarted = Stopwatch.GetTimestamp();
        var user = await _userManager.FindByEmailAsync(request.Email.Trim());
        if (user is not null && user.EmailConfirmed && _emailSender.IsConfigured)
        {
            var token = await _userManager.GeneratePasswordResetTokenAsync(user);
            var resetUrl = BuildFragmentUrl(
                "restablecer",
                ("email", user.Email!),
                ("token", token));
            try
            {
                await _emailSender.SendPasswordResetAsync(
                    user.Email!,
                    resetUrl,
                    cancellationToken);
            }
            catch (Exception exception)
            {
                _logger.LogError(
                    exception,
                    "Password reset delivery failed for user {UserId}",
                    user.Id);
            }
        }

        await _auditService.RecordAsync(
            "password.reset_requested",
            "accepted",
            user is null ? null : ActorType.Registered,
            user?.Id,
            cancellationToken);
        await EnforceGenericResponseFloorAsync(genericResponseStarted, cancellationToken);
        return Accepted();
    }

    [AllowAnonymous]
    [HttpPost("reset-password")]
    [EnableRateLimiting(ApiSecurityConstants.PasswordMutationRatePolicy)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> ResetPassword(
        ResetPasswordRequest request,
        CancellationToken cancellationToken)
    {
        var passwordResult = _passwordPolicy.Validate(request.NewPassword);
        if (!passwordResult.IsValid)
        {
            return ApiProblem(
                StatusCodes.Status400BadRequest,
                passwordResult.ErrorCode!,
                "The password does not meet the security policy.");
        }

        var user = await _userManager.FindByEmailAsync(request.Email.Trim());
        if (user is null)
        {
            return InvalidToken();
        }

        var result = await _userManager.ResetPasswordAsync(
            user,
            request.Token,
            request.NewPassword);
        if (!result.Succeeded)
        {
            return InvalidToken();
        }

        await RevokeAllUserSessionsAsync(user.Id, cancellationToken);
        await _auditService.RecordAsync(
            "password.reset",
            "success",
            ActorType.Registered,
            user.Id,
            cancellationToken);
        return NoContent();
    }

    [AllowAnonymous]
    [HttpPost("confirm-email")]
    [EnableRateLimiting(ApiSecurityConstants.RecoveryRatePolicy)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> ConfirmEmail(
        ConfirmEmailRequest request,
        CancellationToken cancellationToken)
    {
        var user = await _userManager.FindByIdAsync(request.UserId.ToString());
        if (user is null || user.EmailConfirmed)
        {
            return InvalidToken();
        }

        var result = await _userManager.ConfirmEmailAsync(user, request.Token);
        if (!result.Succeeded)
        {
            return InvalidToken();
        }

        // Make every outstanding confirmation token unusable after the first
        // successful confirmation. There is no authenticated session yet.
        await _userManager.UpdateSecurityStampAsync(user);
        await _auditService.RecordAsync(
            "email.confirmed",
            "success",
            ActorType.Registered,
            user.Id,
            cancellationToken);
        return NoContent();
    }

    [AllowAnonymous]
    [HttpPost("resend-confirmation")]
    [EnableRateLimiting(ApiSecurityConstants.RecoveryRatePolicy)]
    [ProducesResponseType(StatusCodes.Status202Accepted)]
    public async Task<IActionResult> ResendConfirmation(
        EmailRequest request,
        CancellationToken cancellationToken)
    {
        var genericResponseStarted = Stopwatch.GetTimestamp();
        var user = await _userManager.FindByEmailAsync(request.Email.Trim());
        if (user is not null && !user.EmailConfirmed)
        {
            await TrySendConfirmationAsync(user, cancellationToken);
        }

        await EnforceGenericResponseFloorAsync(genericResponseStarted, cancellationToken);
        return Accepted();
    }

    [Authorize(Policy = MigaAuthenticationConstants.RegisteredPolicy)]
    [HttpPost("change-password")]
    [EnableRateLimiting(ApiSecurityConstants.PasswordMutationRatePolicy)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> ChangePassword(
        ChangePasswordRequest request,
        CancellationToken cancellationToken)
    {
        var actor = await _currentActorAccessor.GetRegisteredAsync(cancellationToken);
        if (actor?.UserId is not Guid userId)
        {
            return Unauthorized();
        }

        var passwordResult = _passwordPolicy.Validate(request.NewPassword);
        if (!passwordResult.IsValid)
        {
            return ApiProblem(
                StatusCodes.Status400BadRequest,
                passwordResult.ErrorCode!,
                "The password does not meet the security policy.");
        }

        var user = await _userManager.FindByIdAsync(userId.ToString());
        if (user is null)
        {
            return Unauthorized();
        }

        var result = await _userManager.ChangePasswordAsync(
            user,
            request.CurrentPassword,
            request.NewPassword);
        if (!result.Succeeded)
        {
            return InvalidCredentials();
        }

        await RevokeAllUserSessionsAsync(user.Id, cancellationToken);
        await IssueRegisteredSessionAsync(user, cancellationToken);
        await _auditService.RecordAsync(
            "password.changed",
            "success",
            ActorType.Registered,
            user.Id,
            cancellationToken);
        return NoContent();
    }

    [Authorize(Policy = MigaAuthenticationConstants.RegisteredPolicy)]
    [HttpPost("reauthenticate")]
    [EnableRateLimiting(ApiSecurityConstants.PasswordMutationRatePolicy)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> Reauthenticate(
        ReauthenticateRequest request,
        CancellationToken cancellationToken)
    {
        var actor = await _currentActorAccessor.GetRegisteredAsync(cancellationToken);
        if (actor?.UserId is not Guid userId)
        {
            return Unauthorized();
        }

        var user = await _userManager.FindByIdAsync(userId.ToString());
        if (user is null || !await _userManager.CheckPasswordAsync(user, request.CurrentPassword))
        {
            await _auditService.RecordAsync(
                "auth.reauthenticate",
                "failure",
                ActorType.Registered,
                userId,
                cancellationToken);
            return InvalidCredentials();
        }

        var session = await _dbContext.UserSessions
            .SingleAsync(x => x.Id == actor.SessionId && x.UserId == userId, cancellationToken);
        session.RevokedAtUtc = DateTimeOffset.UtcNow;
        await _dbContext.SaveChangesAsync(cancellationToken);
        await IssueRegisteredSessionAsync(user, cancellationToken);
        await _auditService.RecordAsync(
            "auth.reauthenticate",
            "success",
            ActorType.Registered,
            userId,
            cancellationToken);
        return NoContent();
    }

    private async Task IssueRegisteredSessionAsync(
        MigaUser user,
        CancellationToken cancellationToken)
    {
        var now = DateTimeOffset.UtcNow;
        var absoluteExpiry = now + _authenticationOptions.UserAbsoluteTimeout;
        var session = new UserSession
        {
            Id = Guid.CreateVersion7(),
            UserId = user.Id,
            SecurityStampAtIssue = user.SecurityStamp!,
            CreatedAtUtc = now,
            LastSeenAtUtc = now,
            IdleExpiresAtUtc = Min(now + _authenticationOptions.UserIdleTimeout, absoluteExpiry),
            AbsoluteExpiresAtUtc = absoluteExpiry,
            LastReauthenticatedAtUtc = now
        };
        _dbContext.UserSessions.Add(session);
        await _dbContext.SaveChangesAsync(cancellationToken);
        await SignInRegisteredAsync(user, session.Id, absoluteExpiry);
    }

    private Task SignInRegisteredAsync(
        MigaUser user,
        Guid sessionId,
        DateTimeOffset absoluteExpiry) =>
        _signInManager.SignInWithClaimsAsync(
            user,
            new AuthenticationProperties
            {
                IsPersistent = false,
                AllowRefresh = false,
                ExpiresUtc = absoluteExpiry
            },
            [
                new Claim(
                    MigaAuthenticationConstants.SessionIdClaim,
                    sessionId.ToString()),
                new Claim(
                    MigaAuthenticationConstants.ActorTypeClaim,
                    MigaAuthenticationConstants.RegisteredActor)
            ]);

    private Task SignInDemoAsync(DemoSession session)
    {
        var identity = new ClaimsIdentity(
            [
                new Claim(
                    MigaAuthenticationConstants.SessionIdClaim,
                    session.Id.ToString()),
                new Claim(
                    MigaAuthenticationConstants.ActorTypeClaim,
                    MigaAuthenticationConstants.DemoActor)
            ],
            MigaAuthenticationConstants.DemoScheme);
        return HttpContext.SignInAsync(
            MigaAuthenticationConstants.DemoScheme,
            new ClaimsPrincipal(identity),
            new AuthenticationProperties
            {
                IsPersistent = false,
                AllowRefresh = false,
                ExpiresUtc = session.AbsoluteExpiresAtUtc
            });
    }

    private async Task RevokeCurrentSessionsAsync(CancellationToken cancellationToken)
    {
        var registered = await _currentActorAccessor.GetRegisteredAsync(cancellationToken);
        var demo = await _currentActorAccessor.GetDemoAsync(cancellationToken);
        var now = DateTimeOffset.UtcNow;

        if (registered is not null)
        {
            var session = await _dbContext.UserSessions
                .SingleOrDefaultAsync(x => x.Id == registered.SessionId, cancellationToken);
            if (session is not null)
            {
                session.RevokedAtUtc = now;
            }
        }

        if (demo is not null)
        {
            var session = await _dbContext.DemoSessions
                .SingleOrDefaultAsync(x => x.Id == demo.SessionId, cancellationToken);
            if (session is not null)
            {
                session.RevokedAtUtc = now;
            }

            await HttpContext.SignOutAsync(MigaAuthenticationConstants.DemoScheme);
        }

        await _dbContext.SaveChangesAsync(cancellationToken);
    }

    private async Task RevokeAllUserSessionsAsync(
        Guid userId,
        CancellationToken cancellationToken)
    {
        var now = DateTimeOffset.UtcNow;
        var sessions = await _dbContext.UserSessions
            .Where(x => x.UserId == userId && x.RevokedAtUtc == null)
            .ToListAsync(cancellationToken);
        foreach (var session in sessions)
        {
            session.RevokedAtUtc = now;
        }

        await _dbContext.SaveChangesAsync(cancellationToken);
    }

    private async Task TrySendConfirmationAsync(
        MigaUser user,
        CancellationToken cancellationToken)
    {
        if (!_emailSender.IsConfigured || user.EmailConfirmed || string.IsNullOrEmpty(user.Email))
        {
            return;
        }

        var token = await _userManager.GenerateEmailConfirmationTokenAsync(user);
        var confirmationUrl = BuildFragmentUrl(
            "verificar-email",
            ("userId", user.Id.ToString()),
            ("token", token));
        try
        {
            await _emailSender.SendEmailConfirmationAsync(
                user.Email,
                confirmationUrl,
                cancellationToken);
        }
        catch (Exception exception)
        {
            _logger.LogError(
                exception,
                "Email confirmation delivery failed for user {UserId}",
                user.Id);
        }
    }

    private Uri BuildFragmentUrl(string relativePath, params (string Key, string Value)[] values)
    {
        var baseUri = new Uri(_authenticationOptions.PublicBaseUrl.TrimEnd('/') + "/");
        var destination = new Uri(baseUri, relativePath);
        var fragment = string.Join(
            "&",
            values.Select(value =>
                $"{Uri.EscapeDataString(value.Key)}={Uri.EscapeDataString(value.Value)}"));
        return new UriBuilder(destination) { Fragment = fragment }.Uri;
    }

    private IActionResult InvalidCredentials() =>
        ApiProblem(
            StatusCodes.Status401Unauthorized,
            "invalid_credentials",
            "The credentials are invalid.");

    private IActionResult InvalidToken() =>
        ApiProblem(
            StatusCodes.Status400BadRequest,
            "invalid_or_expired_token",
            "The token is invalid or expired.");

    private static DateTimeOffset Min(DateTimeOffset left, DateTimeOffset right) =>
        left <= right ? left : right;

    private static async Task EnforceGenericResponseFloorAsync(
        long startedTimestamp,
        CancellationToken cancellationToken)
    {
        var remaining = GenericResponseFloor - Stopwatch.GetElapsedTime(startedTimestamp);
        if (remaining > TimeSpan.Zero)
        {
            await Task.Delay(remaining, cancellationToken);
        }
    }
}
