using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Options;
using Miga.Application.Auth;
using Miga.Application.Common.Security;
using Miga.Application.Data;
using Miga.Application.Demo;
using Miga.Application.Materials;
using Miga.Infrastructure.Auth;
using Miga.Infrastructure.Demo;
using Miga.Infrastructure.Materials;
using Miga.Infrastructure.Persistence;
using Miga.Infrastructure.Security;

namespace Miga.Infrastructure.DependencyInjection;

public static class InfrastructureServiceCollectionExtensions
{
    public static IServiceCollection AddInfrastructure(
        this IServiceCollection services,
        IConfiguration configuration,
        IHostEnvironment environment)
    {
        var connectionString = configuration.GetConnectionString("MigaDatabase");

        if (string.IsNullOrWhiteSpace(connectionString))
        {
            throw new InvalidOperationException(
                "Connection string 'MigaDatabase' is not configured.");
        }

        if (environment.IsProduction())
        {
            DatabaseConnectionSecurityValidator.ValidateProduction(connectionString);
        }

        services.AddDbContext<MigaDbContext>(options =>
        {
            options.UseNpgsql(connectionString, npgsql =>
            {
                npgsql.CommandTimeout(15);
                npgsql.MigrationsHistoryTable("__EFMigrationsHistory", "infra");
            });
        });

        services.AddHttpContextAccessor();
        services.AddMemoryCache(options => options.SizeLimit = 5_000);

        services
            .AddOptions<YouTubeApiOptions>()
            .Bind(configuration.GetSection(YouTubeApiOptions.SectionName))
            .ValidateOnStart();
        services.AddSingleton<IValidateOptions<YouTubeApiOptions>, YouTubeApiOptionsValidator>();

        services
            .AddOptions<AuthenticationSecurityOptions>()
            .Bind(configuration.GetSection(AuthenticationSecurityOptions.SectionName))
            .ValidateOnStart();
        services.AddSingleton<
            IValidateOptions<AuthenticationSecurityOptions>,
            AuthenticationSecurityOptionsValidator>();

        services
            .AddOptions<EmailDeliveryOptions>()
            .Bind(configuration.GetSection(EmailDeliveryOptions.SectionName))
            .ValidateOnStart();
        services.AddSingleton<
            IValidateOptions<EmailDeliveryOptions>,
            EmailDeliveryOptionsValidator>();

        services
            .AddOptions<SmtpOptions>()
            .Bind(configuration.GetSection(SmtpOptions.SectionName))
            .ValidateOnStart();
        services.AddSingleton<IValidateOptions<SmtpOptions>, SmtpOptionsValidator>();

        services
            .AddOptions<BrevoOptions>()
            .Bind(configuration.GetSection(BrevoOptions.SectionName))
            .ValidateOnStart();
        services.AddSingleton<IValidateOptions<BrevoOptions>, BrevoOptionsValidator>();

        services
            .AddOptions<DataProtectionSecurityOptions>()
            .Bind(configuration.GetSection(DataProtectionSecurityOptions.SectionName))
            .ValidateOnStart();
        services.AddSingleton<
            IValidateOptions<DataProtectionSecurityOptions>,
            DataProtectionSecurityOptionsValidator>();

        services
            .AddOptions<DemoSecurityOptions>()
            .Bind(configuration.GetSection(DemoSecurityOptions.SectionName))
            .ValidateOnStart();
        services.AddSingleton<IValidateOptions<DemoSecurityOptions>, DemoSecurityOptionsValidator>();

        services
            .AddOptions<DatabaseHealthOptions>()
            .Bind(configuration.GetSection(DatabaseHealthOptions.SectionName))
            .ValidateOnStart();

        var authenticationSection =
            configuration.GetSection(AuthenticationSecurityOptions.SectionName);
        services
            .AddIdentityCore<MigaUser>(options =>
            {
                options.User.RequireUniqueEmail = true;
                options.SignIn.RequireConfirmedEmail =
                    authenticationSection.GetValue<bool>("RequireConfirmedEmail");
                options.Password.RequiredLength = 12;
                options.Password.RequiredUniqueChars = 1;
                options.Password.RequireDigit = false;
                options.Password.RequireLowercase = false;
                options.Password.RequireUppercase = false;
                options.Password.RequireNonAlphanumeric = false;
                options.Lockout.AllowedForNewUsers = true;
                options.Lockout.MaxFailedAccessAttempts = 5;
                options.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(15);
            })
            .AddRoles<IdentityRole<Guid>>()
            .AddEntityFrameworkStores<MigaDbContext>()
            .AddSignInManager()
            .AddDefaultTokenProviders();

        services.Configure<PasswordHasherOptions>(options =>
        {
            options.CompatibilityMode = PasswordHasherCompatibilityMode.IdentityV3;
            options.IterationCount = 210_000;
        });
        services.Configure<DataProtectionTokenProviderOptions>(options =>
        {
            options.TokenLifespan = TimeSpan.FromMinutes(30);
        });

        var dataProtection = services
            .AddDataProtection()
            .SetApplicationName("Miga")
            .PersistKeysToDbContext<MigaDbContext>();
        var dataProtectionOptions = new DataProtectionSecurityOptions
        {
            CertificatePath = configuration[
                $"{DataProtectionSecurityOptions.SectionName}:CertificatePath"] ?? string.Empty,
            CertificateBase64 = configuration[
                $"{DataProtectionSecurityOptions.SectionName}:CertificateBase64"] ?? string.Empty,
            CertificatePassword = configuration[
                $"{DataProtectionSecurityOptions.SectionName}:CertificatePassword"] ?? string.Empty
        };
        var certificateSource =
            DataProtectionCertificateLoader.ResolveSource(dataProtectionOptions);
        if (certificateSource is DataProtectionCertificateLoader.SourceKind.File
            or DataProtectionCertificateLoader.SourceKind.Base64)
        {
            var certificate = DataProtectionCertificateLoader.Load(dataProtectionOptions);
            dataProtection.ProtectKeysWithCertificate(certificate);
        }

        services.AddScoped<IPasswordPolicy, CommonPasswordPolicy>();
        services.AddSingleton<IDataSnapshotValidator, DataSnapshotValidator>();
        services.AddScoped<IDemoWorkspaceConsumptionService, DemoWorkspaceConsumptionService>();
        services.AddScoped<ICurrentActorAccessor, CurrentActorAccessor>();
        services.AddScoped<ISecurityAuditService, SecurityAuditService>();
        services.AddScoped<RegisteredCookieEvents>();
        services.AddScoped<DemoCookieEvents>();

        var providerRaw = configuration.GetValue<string>(
            $"{EmailDeliveryOptions.SectionName}:Provider");
        var provider = Enum.TryParse<EmailDeliveryProvider>(
            providerRaw,
            ignoreCase: true,
            out var parsedProvider)
            ? parsedProvider
            : EmailDeliveryProvider.Disabled;

        switch (provider)
        {
            case EmailDeliveryProvider.BrevoApi:
                services
                    .AddHttpClient<BrevoApiAccountEmailSender>(client =>
                    {
                        client.BaseAddress = BrevoOptions.BaseAddress;
                        client.Timeout = TimeSpan.FromSeconds(15);
                        client.DefaultRequestHeaders.Accept.Clear();
                        client.DefaultRequestHeaders.Accept.ParseAdd("application/json");
                        client.DefaultRequestHeaders.UserAgent.ParseAdd("Miga-Backend/1.0");
                    })
                    .ConfigurePrimaryHttpMessageHandler(() => new HttpClientHandler
                    {
                        AllowAutoRedirect = false
                    });
                services.AddScoped<IAccountEmailSender>(
                    sp => sp.GetRequiredService<BrevoApiAccountEmailSender>());
                break;
            case EmailDeliveryProvider.Smtp:
                services.AddScoped<IAccountEmailSender, SmtpAccountEmailSender>();
                break;
            default:
                services.AddScoped<IAccountEmailSender, UnconfiguredAccountEmailSender>();
                break;
        }

        services.AddSingleton<AccountEmailQueue>();
        services.AddSingleton<IAccountEmailQueue>(
            provider => provider.GetRequiredService<AccountEmailQueue>());
        services.AddHostedService(
            provider => provider.GetRequiredService<AccountEmailQueue>());

        services.AddSingleton<UnconfirmedAccountCleanupService>();
        services.AddHostedService(
            provider => provider.GetRequiredService<UnconfirmedAccountCleanupService>());

        services.AddSingleton<DemoCleanupService>();
        services.AddSingleton<IDemoCleanupService>(
            provider => provider.GetRequiredService<DemoCleanupService>());
        services.AddHostedService(
            provider => provider.GetRequiredService<DemoCleanupService>());

        services.AddHttpClient<IYouTubeMetadataService, YouTubeMetadataService>(client =>
        {
            client.Timeout = TimeSpan.FromSeconds(5);
            client.DefaultRequestHeaders.Add("User-Agent", "Miga-Backend/1.0");
            client.DefaultRequestHeaders.Add("Accept", "application/json");
        })
        .ConfigurePrimaryHttpMessageHandler(() => new HttpClientHandler
        {
            // Never forward the API-key header to a redirect target.
            AllowAutoRedirect = false
        });

        return services;
    }
}
