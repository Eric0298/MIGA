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
[RequestSizeLimit(ApiSecurityConstants.SensitiveRequestBodyLimit)]
public sealed class AuthController : ApiControllerBase
{
    private static readonly TimeSpan GenericResponseFloor = TimeSpan.FromMilliseconds(500);

    private readonly IAntiforgery _antiforgery;
    private readonly UserManager<MigaUser> _userManager;
    private readonly SignInManager<MigaUser> _signInManager;
    private readonly IPasswordHasher<MigaUser> _passwordHasher;
    private readonly IPasswordPolicy _passwordPolicy;
    private readonly IAccountEmailQueue _emailQueue;
    private readonly IDemoWorkspaceConsumptionService _demoWorkspaceConsumption;
    private readonly ICurrentActorAccessor _currentActorAccessor;
    private readonly ISecurityAuditService _auditService;
    private readonly MigaDbContext _dbContext;
    private readonly AuthenticationSecurityOptions _authenticationOptions;

    public AuthController(
        IAntiforgery antiforgery,
        UserManager<MigaUser> userManager,
        SignInManager<MigaUser> signInManager,
        IPasswordHasher<MigaUser> passwordHasher,
        IPasswordPolicy passwordPolicy,
        IAccountEmailQueue emailQueue,
        IDemoWorkspaceConsumptionService demoWorkspaceConsumption,
        ICurrentActorAccessor currentActorAccessor,
        ISecurityAuditService auditService,
        MigaDbContext dbContext,
        IOptions<AuthenticationSecurityOptions> authenticationOptions)
    {
        _antiforgery = antiforgery;
        _userManager = userManager;
        _signInManager = signInManager;
        _passwordHasher = passwordHasher;
        _passwordPolicy = passwordPolicy;
        _emailQueue = emailQueue;
        _demoWorkspaceConsumption = demoWorkspaceConsumption;
        _currentActorAccessor = currentActorAccessor;
        _auditService = auditService;
        _dbContext = dbContext;
        _authenticationOptions = authenticationOptions.Value;
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
        if (await _currentActorAccessor.GetRegisteredAsync(cancellationToken) is not null)
        {
            return ApiProblem(
                StatusCodes.Status409Conflict,
                "registered_session_active",
                "A registered session is already active.");
        }

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

        var email = request.Email.Trim();
        var existing = await _userManager.FindByEmailAsync(email);
        if (existing is not null)
        {
            if (!existing.EmailConfirmed)
            {
                _ = _emailQueue.TryQueueEmailConfirmation(existing.Id);
            }

            await EnforceGenericResponseFloorAsync(genericResponseStarted, cancellationToken);
            return Accepted();
        }

        var now = DateTimeOffset.UtcNow;
        var confirmationRequired = _authenticationOptions.RequireConfirmedEmail;
        // The password and privacy consent are collected once at registration
        // and reused after confirmation, so both are persisted immediately even
        // for pending accounts. Confirmation only flips EmailConfirmed and
        // completes any deferred demo conversion.
        var user = new MigaUser
        {
            Id = Guid.CreateVersion7(),
            Email = email,
            UserName = email,
            CreatedAtUtc = now,
            PrivacyPolicyVersion = request.PrivacyPolicyVersion,
            PrivacyPolicyAcceptedAtUtc = now,
            PendingDemoWorkspaceId = confirmationRequired ? demoWorkspace?.Id : null,
            PendingDemoSessionId = confirmationRequired ? demoActor?.SessionId : null,
            PendingDemoExpiresAtUtc = confirmationRequired ? demoActor?.ExpiresAtUtc : null,
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

        if (demoWorkspace is not null && !confirmationRequired)
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
        else if (demoWorkspace is null)
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

        if (demoActor is not null && !confirmationRequired)
        {
            await HttpContext.SignOutAsync(MigaAuthenticationConstants.DemoScheme);
        }

        await _auditService.RecordAsync(
            "account.registered",
            "success",
            ActorType.Registered,
            user.Id,
            cancellationToken);

        if (confirmationRequired)
        {
            _ = _emailQueue.TryQueueEmailConfirmation(user.Id);
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
        var genericResponseStarted = Stopwatch.GetTimestamp();
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
            await EnforceGenericResponseFloorAsync(genericResponseStarted, cancellationToken);
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
                null,
                null,
                cancellationToken);
            await EnforceGenericResponseFloorAsync(genericResponseStarted, cancellationToken);
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
        if (user is not null && user.EmailConfirmed)
        {
            _ = _emailQueue.TryQueuePasswordReset(user.Id);
        }

        await _auditService.RecordAsync(
            "password.reset_requested",
            "accepted",
            null,
            null,
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
        var genericResponseStarted = Stopwatch.GetTimestamp();
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
            return await InvalidResetTokenAsync(
                genericResponseStarted,
                cancellationToken);
        }

        var result = await _userManager.ResetPasswordAsync(
            user,
            request.Token,
            request.NewPassword);
        if (!result.Succeeded)
        {
            return await InvalidResetTokenAsync(
                genericResponseStarted,
                cancellationToken);
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
        if (request.ImportDemoData && request.ContinueWithoutDemoData)
        {
            return ApiProblem(
                StatusCodes.Status400BadRequest,
                "demo_confirmation_options_invalid",
                "Demo data cannot be imported and skipped in the same request.");
        }

        var user = await _userManager.FindByIdAsync(request.UserId.ToString());
        if (user is null || user.EmailConfirmed)
        {
            return InvalidToken();
        }

        // Legacy accounts created before password-at-registration existed have
        // no PasswordHash. Refuse to confirm them so they cannot become active
        // without a credential; the cleanup job will remove them once expired
        // and the owner can re-register.
        if (string.IsNullOrEmpty(user.PasswordHash))
        {
            return ApiProblem(
                StatusCodes.Status409Conflict,
                "confirmation_password_missing",
                "This account cannot be confirmed. Please register again.");
        }

        var validToken = await _userManager.VerifyUserTokenAsync(
            user,
            _userManager.Options.Tokens.EmailConfirmationTokenProvider,
            UserManager<MigaUser>.ConfirmEmailTokenPurpose,
            request.Token);
        if (!validToken)
        {
            return InvalidToken();
        }

        var now = DateTimeOffset.UtcNow;
        await using var transaction =
            await _dbContext.Database.BeginTransactionAsync(cancellationToken);
        var claimedUserRows = await _dbContext.Users
            .Where(candidate =>
                candidate.Id == user.Id &&
                !candidate.EmailConfirmed &&
                candidate.SecurityStamp == user.SecurityStamp)
            .ExecuteUpdateAsync(
                setters => setters.SetProperty(
                    candidate => candidate.AccessFailedCount,
                    candidate => candidate.AccessFailedCount),
                cancellationToken);
        if (claimedUserRows != 1)
        {
            await transaction.RollbackAsync(cancellationToken);
            return InvalidToken();
        }

        await _dbContext.Entry(user).ReloadAsync(cancellationToken);
        var hasAnyPendingDemoLink =
            user.PendingDemoWorkspaceId is not null ||
            user.PendingDemoSessionId is not null ||
            user.PendingDemoExpiresAtUtc is not null;
        CurrentActor? activeDemo = null;
        if (!request.ContinueWithoutDemoData &&
            (request.ImportDemoData || hasAnyPendingDemoLink))
        {
            activeDemo = await _currentActorAccessor.GetDemoAsync(cancellationToken);
        }

        var activeDemoMatchesPending =
            activeDemo is not null &&
            user.PendingDemoWorkspaceId == activeDemo.WorkspaceId &&
            user.PendingDemoSessionId == activeDemo.SessionId &&
            user.PendingDemoExpiresAtUtc is DateTimeOffset pendingExpiry &&
            pendingExpiry > now;
        var shouldConvertDemo =
            !request.ContinueWithoutDemoData &&
            (request.ImportDemoData || activeDemoMatchesPending);
        if (!request.ContinueWithoutDemoData &&
            ((request.ImportDemoData && activeDemo is null) ||
             (!request.ImportDemoData &&
              hasAnyPendingDemoLink &&
              !activeDemoMatchesPending)))
        {
            await transaction.RollbackAsync(cancellationToken);
            return DemoConversionUnavailable();
        }

        var convertedDemo = false;
        if (shouldConvertDemo)
        {
            var demoToConvert = activeDemo!;
            var existingWorkspace = await _dbContext.Workspaces
                .AsNoTracking()
                .Where(workspace => workspace.OwnerUserId == user.Id)
                .Select(workspace => new
                {
                    workspace.Id,
                    workspace.Kind,
                    SnapshotRevision = workspace.Snapshot == null
                        ? (long?)null
                        : workspace.Snapshot.Revision
                })
                .SingleOrDefaultAsync(cancellationToken);
            if (existingWorkspace is not null)
            {
                if (existingWorkspace.Kind != WorkspaceKind.Registered ||
                    existingWorkspace.SnapshotRevision != 0)
                {
                    await transaction.RollbackAsync(cancellationToken);
                    return DemoConversionUnavailable();
                }

                var deletedSnapshotRows = await _dbContext.WorkspaceSnapshots
                    .Where(snapshot =>
                        snapshot.WorkspaceId == existingWorkspace.Id &&
                        snapshot.Revision == 0)
                    .ExecuteDeleteAsync(cancellationToken);
                var deletedWorkspaceRows = deletedSnapshotRows == 1
                    ? await _dbContext.Workspaces
                        .Where(workspace =>
                            workspace.Id == existingWorkspace.Id &&
                            workspace.OwnerUserId == user.Id &&
                            workspace.Kind == WorkspaceKind.Registered)
                        .ExecuteDeleteAsync(cancellationToken)
                    : 0;
                if (deletedSnapshotRows != 1 || deletedWorkspaceRows != 1)
                {
                    await transaction.RollbackAsync(cancellationToken);
                    return DemoConversionUnavailable();
                }
            }

            var demoRevision = await _dbContext.WorkspaceSnapshots
                .AsNoTracking()
                .Where(snapshot => snapshot.WorkspaceId == demoToConvert.WorkspaceId)
                .Select(snapshot => (long?)snapshot.Revision)
                .SingleOrDefaultAsync(cancellationToken);
            convertedDemo = demoRevision is not null &&
                await _demoWorkspaceConsumption.TryConvertAsync(
                    demoToConvert.WorkspaceId,
                    demoToConvert.SessionId,
                    demoRevision.Value,
                    user.Id,
                    now,
                    cancellationToken);
            if (!convertedDemo)
            {
                await transaction.RollbackAsync(cancellationToken);
                return DemoConversionUnavailable();
            }
        }
        else if (!await _dbContext.Workspaces.AnyAsync(
                     workspace => workspace.OwnerUserId == user.Id,
                     cancellationToken))
        {
            var workspace = new Workspace
            {
                Id = Guid.CreateVersion7(),
                Kind = WorkspaceKind.Registered,
                OwnerUserId = user.Id,
                CreatedAtUtc = now,
                Snapshot = new WorkspaceSnapshot
                {
                    Revision = 0,
                    DataJson = SnapshotSeedFactory.CreateEmpty(now),
                    UpdatedAtUtc = now
                }
            };
            workspace.Snapshot.WorkspaceId = workspace.Id;
            _dbContext.Workspaces.Add(workspace);
            await _dbContext.SaveChangesAsync(cancellationToken);
        }

        // The password was set atomically at registration; confirmation only
        // finalizes the account. Never rehash from the confirmation payload.
        user.EmailConfirmed = true;
        user.PendingDemoWorkspaceId = null;
        user.PendingDemoSessionId = null;
        user.PendingDemoExpiresAtUtc = null;
        user.AccessFailedCount = 0;
        user.LockoutEnd = null;
        user.SecurityStamp = Guid.NewGuid().ToString("N");

        var updateResult = await _userManager.UpdateAsync(user);
        if (!updateResult.Succeeded)
        {
            await transaction.RollbackAsync(cancellationToken);
            return InvalidToken();
        }

        await transaction.CommitAsync(cancellationToken);
        if (convertedDemo)
        {
            await HttpContext.SignOutAsync(MigaAuthenticationConstants.DemoScheme);
        }

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
            _ = _emailQueue.TryQueueEmailConfirmation(user.Id);
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

    private IActionResult DemoConversionUnavailable() =>
        ApiProblem(
            StatusCodes.Status409Conflict,
            "demo_conversion_unavailable",
            "Use the matching active demo session, or explicitly continue without demo data.");

    private async Task<IActionResult> InvalidResetTokenAsync(
        long genericResponseStarted,
        CancellationToken cancellationToken)
    {
        await _auditService.RecordAsync(
            "password.reset",
            "failure",
            null,
            null,
            cancellationToken);
        await EnforceGenericResponseFloorAsync(
            genericResponseStarted,
            cancellationToken);
        return InvalidToken();
    }

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
