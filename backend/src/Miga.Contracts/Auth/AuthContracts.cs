using System.ComponentModel.DataAnnotations;

namespace Miga.Contracts.Auth;

public sealed record CsrfTokenResponse(string RequestToken);

public sealed record SessionResponse(
    bool Authenticated,
    string? AccountType,
    Guid? WorkspaceId,
    Guid? UserId,
    string? Email,
    DateTimeOffset? ExpiresAtUtc,
    bool? EmailConfirmed);

public sealed record RegisterRequest(
    [Required, EmailAddress, MaxLength(254)] string Email,
    [Required, MinLength(12), MaxLength(128)] string Password,
    [Required, MaxLength(32)] string PrivacyPolicyVersion,
    bool ImportDemoData);

public sealed record LoginRequest(
    [Required, EmailAddress, MaxLength(254)] string Email,
    [Required, MaxLength(128)] string Password);

public sealed record EmailRequest(
    [Required, EmailAddress, MaxLength(254)] string Email);

public sealed record ResetPasswordRequest(
    [Required, EmailAddress, MaxLength(254)] string Email,
    [Required, MaxLength(4096)] string Token,
    [Required, MinLength(12), MaxLength(128)] string NewPassword);

public sealed record ConfirmEmailRequest(
    Guid UserId,
    [Required, MaxLength(4096)] string Token);

public sealed record ChangePasswordRequest(
    [Required, MaxLength(128)] string CurrentPassword,
    [Required, MinLength(12), MaxLength(128)] string NewPassword);

public sealed record ReauthenticateRequest(
    [Required, MaxLength(128)] string CurrentPassword);
