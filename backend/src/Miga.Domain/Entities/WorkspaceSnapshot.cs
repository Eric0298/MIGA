namespace Miga.Domain.Entities;

public sealed class WorkspaceSnapshot
{
    public Guid WorkspaceId { get; set; }

    public long Revision { get; set; }

    public string DataJson { get; set; } = "{}";

    public DateTimeOffset UpdatedAtUtc { get; set; }

    public Workspace Workspace { get; set; } = null!;
}
