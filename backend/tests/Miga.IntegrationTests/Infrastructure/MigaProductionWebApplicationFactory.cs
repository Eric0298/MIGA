using System.Net;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Http;
using Miga.Application.Auth;
using Miga.Infrastructure.Persistence;

namespace Miga.IntegrationTests.Infrastructure;

// Header the test can set on the HttpClient to control the RemoteIpAddress
// that the pipeline sees. TestServer never fills this in on its own.
internal static class TestServerHeaders
{
    public const string RemoteIp = "X-Test-Remote-Ip";
}

// Runs the API in Production mode against an in-memory SQLite database with
// the minimum secret shape that all production validators require:
// - Data Protection PFX (ephemeral, in-memory) satisfies DataProtectionSecurityOptionsValidator
// - SMTP shape satisfies SmtpOptionsValidator when RequireConfirmedEmail=true
// - Trusted proxy networks are opt-in per test via `trustedProxyNetworks`.
public sealed class MigaProductionWebApplicationFactory : WebApplicationFactory<Program>
{
    private readonly SqliteConnection _connection = new("Data Source=:memory:");
    private readonly IReadOnlyList<string> _trustedProxyNetworks;
    private readonly IReadOnlyDictionary<string, string?> _configurationOverrides;
    private readonly Dictionary<string, string?> _originalEnvValues = new();

    public MigaProductionWebApplicationFactory(
        IReadOnlyList<string>? trustedProxyNetworks = null,
        IReadOnlyDictionary<string, string?>? configurationOverrides = null)
    {
        _trustedProxyNetworks = trustedProxyNetworks ?? Array.Empty<string>();
        _configurationOverrides = configurationOverrides ??
            new Dictionary<string, string?>();
        _connection.Open();
        using var dbContext = new MigaDbContext(
            new DbContextOptionsBuilder<MigaDbContext>()
                .UseSqlite(_connection)
                .Options);
        dbContext.Database.EnsureCreated();

        // WebApplication.CreateBuilder(args) reads env vars during Program.Main
        // BEFORE WebApplicationFactory can inject ConfigureAppConfiguration
        // providers. Program.cs consults trusted proxy config AND the connection
        // string via builder.Configuration directly at registration time, so
        // both must come from the environment rather than the AddInMemoryCollection
        // hook below.
        _originalEnvValues["ConnectionStrings__MigaDatabase"] =
            Environment.GetEnvironmentVariable("ConnectionStrings__MigaDatabase");
        Environment.SetEnvironmentVariable(
            "ConnectionStrings__MigaDatabase",
            "Host=integration-tests;Port=5432;Database=miga;Username=miga;" +
                "Password=integration-tests-only;SSL Mode=VerifyFull;" +
                "Trust Server Certificate=false");

        for (var i = 0; i < _trustedProxyNetworks.Count; i++)
        {
            var key = $"TrustedProxies__Networks__{i}";
            _originalEnvValues[key] = Environment.GetEnvironmentVariable(key);
            Environment.SetEnvironmentVariable(key, _trustedProxyNetworks[i]);
        }

        foreach (var (key, value) in _configurationOverrides)
        {
            var envKey = key.Replace(":", "__");
            _originalEnvValues[envKey] = Environment.GetEnvironmentVariable(envKey);
            Environment.SetEnvironmentVariable(envKey, value);
        }
    }

    public FakeAccountEmailSender EmailSender { get; } = new();

    // Captures the first unhandled exception observed downstream of
    // ApiExceptionHandler so tests can assert on the raw type/message
    // instead of only the redacted 500 payload.
    public ExceptionCapture Exceptions { get; } = new();

    // Optional hook so tests can replace the primary HttpMessageHandler of a
    // typed HttpClient (matched by name, which for typed clients is the type's
    // FullName). Used to intercept outbound Brevo API calls without hitting
    // the real network.
    public Action<HttpMessageHandlerBuilder>? HttpMessageHandlerBuilderOverride { get; set; }

    // When true (default) the factory swaps the production IAccountEmailSender
    // for a FakeAccountEmailSender so security tests that assert delivery
    // shape can inspect captured messages. Tests that specifically want the
    // real DI wiring (e.g. Provider=BrevoApi round-trip) can opt out.
    public bool UseFakeAccountEmailSender { get; init; } = true;

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment(Environments.Production);
        builder.ConfigureAppConfiguration((_, configuration) =>
        {
            var overrides = new Dictionary<string, string?>
            {
                ["ConnectionStrings:MigaDatabase"] = "Data Source=:memory:",
                ["Authentication:RequireConfirmedEmail"] = "true",
                ["Authentication:PublicBaseUrl"] = "https://miga.example/",
                ["EmailDelivery:Provider"] = "Smtp",
                ["Smtp:Enabled"] = "true",
                ["Smtp:Host"] = "smtp.miga.example",
                ["Smtp:Port"] = "587",
                ["Smtp:UseSsl"] = "true",
                ["Smtp:Username"] = "test",
                ["Smtp:Password"] = "test",
                ["Smtp:FromAddress"] = "no-reply@miga.example",
                ["DataProtection:CertificateBase64"] = ProductionCertificateFixture.Base64,
                ["DataProtection:CertificatePassword"] = ProductionCertificateFixture.Password,
                ["AllowedHosts"] = "*",
                ["Health:ExposeDatabaseEndpoint"] = "false",
                ["YouTubeApi:Enabled"] = "false",
                ["Cors:AllowedOrigins:0"] = "https://miga.example"
            };
            for (var i = 0; i < _trustedProxyNetworks.Count; i++)
            {
                overrides[$"TrustedProxies:Networks:{i}"] = _trustedProxyNetworks[i];
            }
            foreach (var (key, value) in _configurationOverrides)
            {
                overrides[key] = value;
            }
            configuration.AddInMemoryCollection(overrides);
        });
        builder.ConfigureServices(services =>
        {
            services.RemoveAll<MigaDbContext>();
            services.RemoveAll<DbContextOptions<MigaDbContext>>();
            services.RemoveAll<IDbContextOptionsConfiguration<MigaDbContext>>();
            services.AddDbContext<MigaDbContext>(options => options.UseSqlite(_connection));

            if (UseFakeAccountEmailSender)
            {
                services.RemoveAll<IAccountEmailSender>();
                services.AddSingleton<IAccountEmailSender>(EmailSender);
            }

            services.AddSingleton(Exceptions);
            // Insert BEFORE ApiExceptionHandler so we observe the raw exception
            // and then delegate the response back to the production handler.
            services.Insert(
                0,
                ServiceDescriptor.Singleton<IExceptionHandler, CapturingExceptionHandler>());

            // TestServer doesn't populate HttpContext.Connection.RemoteIpAddress,
            // so ForwardedHeadersMiddleware would always skip. Register an
            // IStartupFilter that stamps it from an X-Test-Remote-Ip header
            // (defaulting to 127.0.0.1) BEFORE the app pipeline runs.
            services.AddTransient<IStartupFilter, RemoteIpStartupFilter>();

            services.AddSingleton<IHttpMessageHandlerBuilderFilter>(
                new HandlerOverrideFilter(this));
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
            foreach (var (key, original) in _originalEnvValues)
            {
                Environment.SetEnvironmentVariable(key, original);
            }
            _connection.Dispose();
        }
    }

    public sealed class ExceptionCapture
    {
        private readonly List<Exception> _exceptions = new();
        private readonly object _lock = new();

        public IReadOnlyList<Exception> Captured
        {
            get
            {
                lock (_lock)
                {
                    return _exceptions.ToArray();
                }
            }
        }

        internal void Add(Exception exception)
        {
            lock (_lock)
            {
                _exceptions.Add(exception);
            }
        }

        public void Reset()
        {
            lock (_lock)
            {
                _exceptions.Clear();
            }
        }
    }

    private sealed class CapturingExceptionHandler : IExceptionHandler
    {
        private readonly ExceptionCapture _capture;

        public CapturingExceptionHandler(ExceptionCapture capture)
        {
            _capture = capture;
        }

        public ValueTask<bool> TryHandleAsync(
            HttpContext httpContext,
            Exception exception,
            CancellationToken cancellationToken)
        {
            _capture.Add(exception);
            return ValueTask.FromResult(false);
        }
    }

    private sealed class HandlerOverrideFilter : IHttpMessageHandlerBuilderFilter
    {
        private readonly MigaProductionWebApplicationFactory _factory;

        public HandlerOverrideFilter(MigaProductionWebApplicationFactory factory)
        {
            _factory = factory;
        }

        public Action<HttpMessageHandlerBuilder> Configure(Action<HttpMessageHandlerBuilder> next)
        {
            return builder =>
            {
                next(builder);
                _factory.HttpMessageHandlerBuilderOverride?.Invoke(builder);
            };
        }
    }

    private sealed class RemoteIpStartupFilter : IStartupFilter
    {
        public Action<IApplicationBuilder> Configure(Action<IApplicationBuilder> next)
        {
            return app =>
            {
                app.Use(async (context, nextMiddleware) =>
                {
                    if (context.Request.Headers.TryGetValue(
                            TestServerHeaders.RemoteIp,
                            out var headerValue) &&
                        IPAddress.TryParse(headerValue.ToString(), out var ip))
                    {
                        context.Connection.RemoteIpAddress = ip;
                    }
                    else
                    {
                        context.Connection.RemoteIpAddress = IPAddress.Loopback;
                    }

                    await nextMiddleware();
                });
                next(app);
            };
        }
    }
}
