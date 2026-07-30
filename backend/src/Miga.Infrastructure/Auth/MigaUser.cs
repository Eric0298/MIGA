using Microsoft.AspNetCore.Identity;

namespace Miga.Infrastructure.Auth;

public sealed class MigaUser : IdentityUser<Guid>
{
    public DateTimeOffset CreatedAtUtc { get; set; }

    public string? PrivacyPolicyVersion { get; set; }

    public DateTimeOffset? PrivacyPolicyAcceptedAtUtc { get; set; }

    public Guid? PendingDemoWorkspaceId { get; set; }

    public Guid? PendingDemoSessionId { get; set; }

    public DateTimeOffset? PendingDemoExpiresAtUtc { get; set; }
}
