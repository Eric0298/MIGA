namespace Miga.Application.Demo;

public interface IDemoWorkspaceConsumptionService
{
    /// <summary>
    /// Atomically promotes a demo workspace in place only while its snapshot
    /// remains at the revision observed by the conversion flow. Keeping the
    /// workspace identifier preserves browser-local binary references. The
    /// caller owns the transaction and must roll it back when this returns false.
    /// </summary>
    Task<bool> TryConvertAsync(
        Guid workspaceId,
        Guid demoSessionId,
        long expectedRevision,
        Guid ownerUserId,
        DateTimeOffset convertedAtUtc,
        CancellationToken cancellationToken = default);
}
