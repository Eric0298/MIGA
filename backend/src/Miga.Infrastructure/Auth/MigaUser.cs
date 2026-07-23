using Microsoft.AspNetCore.Identity;

namespace Miga.Infrastructure.Auth;

public sealed class MigaUser : IdentityUser<Guid>
{
    public DateTimeOffset CreatedAtUtc { get; set; }

    public string PrivacyPolicyVersion { get; set; } = string.Empty;

    public DateTimeOffset PrivacyPolicyAcceptedAtUtc { get; set; }
}
