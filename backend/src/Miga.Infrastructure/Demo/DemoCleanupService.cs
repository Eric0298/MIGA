using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Miga.Application.Demo;
using Miga.Domain.Enums;
using Miga.Infrastructure.Persistence;
using Miga.Infrastructure.Security;

namespace Miga.Infrastructure.Demo;

public sealed class DemoCleanupService : BackgroundService, IDemoCleanupService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly DemoSecurityOptions _options;
    private readonly ILogger<DemoCleanupService> _logger;
    private readonly SemaphoreSlim _cleanupLock = new(1, 1);

    public DemoCleanupService(
        IServiceScopeFactory scopeFactory,
        IOptions<DemoSecurityOptions> options,
        ILogger<DemoCleanupService> logger)
    {
        _scopeFactory = scopeFactory;
        _options = options.Value;
        _logger = logger;
    }

    public async Task<int> CleanupExpiredAsync(
        DateTimeOffset now,
        CancellationToken cancellationToken = default)
    {
        if (!await _cleanupLock.WaitAsync(0, cancellationToken))
        {
            return 0;
        }

        try
        {
            await using var scope = _scopeFactory.CreateAsyncScope();
            var dbContext = scope.ServiceProvider.GetRequiredService<MigaDbContext>();
            List<Domain.Entities.Workspace> expiredWorkspaces;
            if (string.Equals(
                    dbContext.Database.ProviderName,
                    "Microsoft.EntityFrameworkCore.Sqlite",
                    StringComparison.Ordinal))
            {
                // SQLite cannot translate DateTimeOffset ordering. This branch
                // exists for the isolated integration-test provider only.
                expiredWorkspaces = (await dbContext.DemoSessions
                        .Include(session => session.Workspace)
                        .Where(session => session.Workspace.Kind == WorkspaceKind.Demo)
                        .ToListAsync(cancellationToken))
                    .Where(session =>
                        session.RevokedAtUtc is not null ||
                        session.IdleExpiresAtUtc <= now ||
                        session.AbsoluteExpiresAtUtc <= now ||
                        session.Workspace.ExpiresAtUtc <= now)
                    .Select(session => session.Workspace)
                    .ToList();
            }
            else
            {
                expiredWorkspaces = await dbContext.DemoSessions
                    .Where(session =>
                        session.Workspace.Kind == WorkspaceKind.Demo &&
                        (session.RevokedAtUtc != null ||
                         session.IdleExpiresAtUtc <= now ||
                         session.AbsoluteExpiresAtUtc <= now ||
                         session.Workspace.ExpiresAtUtc <= now))
                    .Select(session => session.Workspace)
                    .ToListAsync(cancellationToken);
            }

            if (expiredWorkspaces.Count == 0)
            {
                return 0;
            }

            dbContext.Workspaces.RemoveRange(expiredWorkspaces);
            await dbContext.SaveChangesAsync(cancellationToken);
            return expiredWorkspaces.Count;
        }
        finally
        {
            _cleanupLock.Release();
        }
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(_options.CleanupInterval);
        try
        {
            while (await timer.WaitForNextTickAsync(stoppingToken))
            {
                try
                {
                    var removed = await CleanupExpiredAsync(DateTimeOffset.UtcNow, stoppingToken);
                    if (removed > 0)
                    {
                        _logger.LogInformation("Removed {DemoWorkspaceCount} expired demo workspaces", removed);
                    }
                }
                catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
                {
                    break;
                }
                catch (Exception exception)
                {
                    _logger.LogError(exception, "Demo cleanup failed");
                }
            }
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
        {
            // Normal host shutdown.
        }
    }
}
