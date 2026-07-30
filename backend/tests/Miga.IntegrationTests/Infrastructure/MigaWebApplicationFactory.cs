using System.Collections.Concurrent;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Hosting;
using Miga.Application.Auth;
using Miga.Infrastructure.Persistence;

namespace Miga.IntegrationTests.Infrastructure;

public sealed class MigaWebApplicationFactory : WebApplicationFactory<Program>
{
    private readonly SqliteConnection _connection = new("Data Source=:memory:");
    private readonly bool _requireConfirmedEmail;
    private readonly TimeSpan? _tokenLifespan;
    private readonly bool _exposeDatabaseHealth;

    public MigaWebApplicationFactory()
        : this(false, null, false)
    {
    }

    internal MigaWebApplicationFactory(
        bool requireConfirmedEmail,
        TimeSpan? tokenLifespan = null,
        bool exposeDatabaseHealth = false)
    {
        _requireConfirmedEmail = requireConfirmedEmail;
        _tokenLifespan = tokenLifespan;
        _exposeDatabaseHealth = exposeDatabaseHealth;
        _connection.Open();
        using var dbContext = new MigaDbContext(
            new DbContextOptionsBuilder<MigaDbContext>()
                .UseSqlite(_connection)
                .Options);
        dbContext.Database.EnsureCreated();
    }

    public FakeAccountEmailSender EmailSender { get; } = new();

    internal void MakeDatabaseUnavailable()
    {
        var missingDatabase = Path.Combine(
            Path.GetTempPath(),
            $"miga-missing-{Guid.NewGuid():N}",
            "database.sqlite");
        _connection.Close();
        _connection.ConnectionString = new SqliteConnectionStringBuilder
        {
            DataSource = missingDatabase,
            Mode = SqliteOpenMode.ReadOnly
        }.ToString();
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment(Environments.Development);
        builder.ConfigureAppConfiguration((_, configuration) =>
        {
            configuration.AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["ConnectionStrings:MigaDatabase"] = "Data Source=:memory:",
                ["Authentication:RequireConfirmedEmail"] =
                    _requireConfirmedEmail.ToString(),
                ["Authentication:PublicBaseUrl"] = "https://frontend.test/",
                ["Demo:CleanupInterval"] = "1.00:00:00",
                ["Health:ExposeDatabaseEndpoint"] =
                    _exposeDatabaseHealth.ToString(),
                ["YouTubeApi:Enabled"] = "false"
            });
        });
        builder.ConfigureServices(services =>
        {
            services.RemoveAll<MigaDbContext>();
            services.RemoveAll<DbContextOptions<MigaDbContext>>();
            services.RemoveAll<IDbContextOptionsConfiguration<MigaDbContext>>();
            services.AddDbContext<MigaDbContext>(options => options.UseSqlite(_connection));

            services.RemoveAll<IAccountEmailSender>();
            services.AddSingleton<IAccountEmailSender>(EmailSender);

            if (_tokenLifespan is { } tokenLifespan)
            {
                services.PostConfigure<DataProtectionTokenProviderOptions>(
                    options => options.TokenLifespan = tokenLifespan);
            }
        });
    }

    protected override IHost CreateHost(IHostBuilder builder)
    {
        var host = base.CreateHost(builder);
        using var scope = host.Services.CreateScope();
        scope.ServiceProvider
            .GetRequiredService<MigaDbContext>()
            .Database
            .EnsureCreated();
        return host;
    }

    protected override void Dispose(bool disposing)
    {
        base.Dispose(disposing);
        if (disposing)
        {
            _connection.Dispose();
        }
    }
}

public sealed class FakeAccountEmailSender : IAccountEmailSender
{
    private readonly ConcurrentQueue<CapturedEmail> _messages = new();

    public bool IsConfigured => true;

    public bool BlockDelivery { get; set; }

    public IReadOnlyList<CapturedEmail> Messages => _messages.ToArray();

    public async Task<CapturedEmail> WaitForMessageAsync(
        Func<CapturedEmail, bool> predicate,
        CancellationToken cancellationToken = default)
    {
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        timeout.CancelAfter(TimeSpan.FromSeconds(5));
        while (!timeout.IsCancellationRequested)
        {
            var message = _messages.FirstOrDefault(predicate);
            if (message is not null)
            {
                return message;
            }

            await Task.Delay(10, timeout.Token);
        }

        throw new TimeoutException("The expected account email was not queued.");
    }

    public async Task SendEmailConfirmationAsync(
        string email,
        Uri confirmationUrl,
        CancellationToken cancellationToken)
    {
        _messages.Enqueue(new CapturedEmail("confirmation", email, confirmationUrl));
        if (BlockDelivery)
        {
            await Task.Delay(Timeout.InfiniteTimeSpan, cancellationToken);
        }
    }

    public async Task SendPasswordResetAsync(
        string email,
        Uri resetUrl,
        CancellationToken cancellationToken)
    {
        _messages.Enqueue(new CapturedEmail("password-reset", email, resetUrl));
        if (BlockDelivery)
        {
            await Task.Delay(Timeout.InfiniteTimeSpan, cancellationToken);
        }
    }
}

public sealed record CapturedEmail(string Kind, string Email, Uri ActionUrl);
