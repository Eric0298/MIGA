namespace Miga.Domain.Entities;

public sealed class UserSession
{
    public Guid Id { get; set; }

    public Guid UserId { get; set; }

    public string SecurityStampAtIssue { get; set; } = string.Empty;

    public DateTimeOffset CreatedAtUtc { get; set; }

    public DateTimeOffset LastSeenAtUtc { get; set; }

    public DateTimeOffset IdleExpiresAtUtc { get; set; }

    public DateTimeOffset AbsoluteExpiresAtUtc { get; set; }

    public DateTimeOffset LastReauthenticatedAtUtc { get; set; }

    public DateTimeOffset? RevokedAtUtc { get; set; }
}
