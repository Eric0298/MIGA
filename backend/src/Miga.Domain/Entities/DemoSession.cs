namespace Miga.Domain.Entities;

public sealed class DemoSession
{
    public Guid Id { get; set; }

    public Guid WorkspaceId { get; set; }

    public DateTimeOffset CreatedAtUtc { get; set; }

    public DateTimeOffset LastSeenAtUtc { get; set; }

    public DateTimeOffset IdleExpiresAtUtc { get; set; }

    public DateTimeOffset AbsoluteExpiresAtUtc { get; set; }

    public DateTimeOffset? RevokedAtUtc { get; set; }

    public Workspace Workspace { get; set; } = null!;
}
