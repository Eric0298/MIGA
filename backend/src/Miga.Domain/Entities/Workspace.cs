using Miga.Domain.Enums;

namespace Miga.Domain.Entities;

public sealed class Workspace
{
    public Guid Id { get; set; }

    public WorkspaceKind Kind { get; set; }

    public Guid? OwnerUserId { get; set; }

    public DateTimeOffset CreatedAtUtc { get; set; }

    public DateTimeOffset? ExpiresAtUtc { get; set; }

    public WorkspaceSnapshot? Snapshot { get; set; }

    public DemoSession? DemoSession { get; set; }
}
