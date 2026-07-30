using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Miga.Infrastructure.Persistence;
using Miga.Infrastructure.Security;

namespace Miga.Infrastructure.Auth;

public sealed class UnconfirmedAccountCleanupService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly AuthenticationSecurityOptions _authenticationOptions;
    private readonly DemoSecurityOptions _demoOptions;
    private readonly ILogger<UnconfirmedAccountCleanupService> _logger;
    private readonly SemaphoreSlim _cleanupLock = new(1, 1);

    public UnconfirmedAccountCleanupService(
        IServiceScopeFactory scopeFactory,
        IOptions<AuthenticationSecurityOptions> authenticationOptions,
        IOptions<DemoSecurityOptions> demoOptions,
        ILogger<UnconfirmedAccountCleanupService> logger)
    {
        _scopeFactory = scopeFactory;
        _authenticationOptions = authenticationOptions.Value;
        _demoOptions = demoOptions.Value;
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
            var createdBefore = now - _authenticationOptions.UnconfirmedAccountLifetime;

            if (!string.Equals(
                    dbContext.Database.ProviderName,
                    "Microsoft.EntityFrameworkCore.Sqlite",
                    StringComparison.Ordinal))
            {
                return await dbContext.Users
                    .Where(user =>
                        !user.EmailConfirmed &&
                        (user.CreatedAtUtc <= createdBefore ||
                         user.PendingDemoExpiresAtUtc <= now))
                    .ExecuteDeleteAsync(cancellationToken);
            }

            // SQLite cannot order DateTimeOffset values. Revalidate every
            // candidate atomically against its original state before deletion.
            var candidates = (await dbContext.Users
                    .AsNoTracking()
                    .Where(user => !user.EmailConfirmed)
                    .Select(user => new
                    {
                        user.Id,
                        user.CreatedAtUtc,
                        user.PendingDemoExpiresAtUtc
                    })
                    .ToListAsync(cancellationToken))
                .Where(user =>
                    user.CreatedAtUtc <= createdBefore ||
                    user.PendingDemoExpiresAtUtc <= now)
                .ToList();

            var removed = 0;
            foreach (var candidate in candidates)
            {
                removed += await dbContext.Users
                    .Where(user =>
                        user.Id == candidate.Id &&
                        !user.EmailConfirmed &&
                        user.CreatedAtUtc == candidate.CreatedAtUtc &&
                        user.PendingDemoExpiresAtUtc ==
                            candidate.PendingDemoExpiresAtUtc)
                    .ExecuteDeleteAsync(cancellationToken);
            }

            return removed;
        }
        finally
        {
            _cleanupLock.Release();
        }
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(_demoOptions.CleanupInterval);
        try
        {
            while (await timer.WaitForNextTickAsync(stoppingToken))
            {
                try
                {
                    var removed = await CleanupExpiredAsync(
                        DateTimeOffset.UtcNow,
                        stoppingToken);
                    if (removed > 0)
                    {
                        _logger.LogInformation(
                            "Removed {UnconfirmedAccountCount} expired unconfirmed accounts",
                            removed);
                    }
                }
                catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
                {
                    break;
                }
                catch (Exception exception)
                {
                    _logger.LogError(exception, "Unconfirmed account cleanup failed");
                }
            }
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
        {
            // Normal host shutdown.
        }
    }
}
