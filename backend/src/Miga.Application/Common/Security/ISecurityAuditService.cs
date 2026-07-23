namespace Miga.Application.Common.Security;

public interface ISecurityAuditService
{
    Task RecordAsync(
        string eventType,
        string outcome,
        ActorType? actorType,
        Guid? actorId,
        CancellationToken cancellationToken = default);
}
