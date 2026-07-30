namespace Miga.Domain.Entities;

public sealed class SecurityAuditEvent
{
    public long Id { get; set; }

    public string EventType { get; set; } = string.Empty;

    public string Outcome { get; set; } = string.Empty;

    public string? ActorType { get; set; }

    public Guid? ActorId { get; set; }

    public string CorrelationId { get; set; } = string.Empty;

    public DateTimeOffset OccurredAtUtc { get; set; }
}
