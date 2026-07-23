namespace Miga.Application.Demo;

public interface IDemoCleanupService
{
    Task<int> CleanupExpiredAsync(
        DateTimeOffset now,
        CancellationToken cancellationToken = default);
}
