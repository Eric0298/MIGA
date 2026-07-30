using System.Net.Mail;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Options;

namespace Miga.Infrastructure.Security;

public sealed class AuthenticationSecurityOptionsValidator
    : IValidateOptions<AuthenticationSecurityOptions>
{
    private readonly IHostEnvironment _environment;

    public AuthenticationSecurityOptionsValidator(IHostEnvironment environment)
    {
        _environment = environment;
    }

    public ValidateOptionsResult Validate(string? name, AuthenticationSecurityOptions options)
    {
        if (_environment.IsProduction() && !options.RequireConfirmedEmail)
        {
            return ValidateOptionsResult.Fail(
                "Authentication:RequireConfirmedEmail must be true in production.");
        }

        if (options.PublicBaseUrl.Contains('\\') ||
            !Uri.TryCreate(options.PublicBaseUrl, UriKind.Absolute, out var publicBaseUri) ||
            string.IsNullOrWhiteSpace(publicBaseUri.Host) ||
            publicBaseUri.HostNameType == UriHostNameType.Unknown ||
            !string.IsNullOrEmpty(publicBaseUri.UserInfo) ||
            !string.IsNullOrEmpty(publicBaseUri.Query) ||
            !string.IsNullOrEmpty(publicBaseUri.Fragment) ||
            (publicBaseUri.Scheme != Uri.UriSchemeHttps &&
             !(_environment.IsDevelopment() &&
               publicBaseUri.Scheme == Uri.UriSchemeHttp &&
               publicBaseUri.IsLoopback)))
        {
            return ValidateOptionsResult.Fail(
                "Authentication:PublicBaseUrl must be an absolute HTTPS origin/base path " +
                "without credentials, query, fragment, or backslashes. Development HTTP " +
                "is restricted to loopback.");
        }

        if (string.IsNullOrWhiteSpace(options.PrivacyPolicyVersion) ||
            options.PrivacyPolicyVersion.Length > 32)
        {
            return ValidateOptionsResult.Fail(
                "Authentication:PrivacyPolicyVersion is required and must be at most 32 characters.");
        }

        if (options.UserIdleTimeout <= TimeSpan.Zero ||
            options.UserAbsoluteTimeout < options.UserIdleTimeout ||
            options.DemoIdleTimeout <= TimeSpan.Zero ||
            options.DemoAbsoluteTimeout < options.DemoIdleTimeout ||
            options.RecentAuthenticationWindow <= TimeSpan.Zero ||
            options.UserIdleTimeout > TimeSpan.FromHours(24) ||
            options.UserAbsoluteTimeout > TimeSpan.FromDays(7) ||
            options.DemoIdleTimeout > TimeSpan.FromHours(2) ||
            options.DemoAbsoluteTimeout > TimeSpan.FromHours(24) ||
            options.RecentAuthenticationWindow > TimeSpan.FromHours(1) ||
            options.RecentAuthenticationWindow > options.UserAbsoluteTimeout ||
            options.UnconfirmedAccountLifetime < TimeSpan.FromHours(1) ||
            options.UnconfirmedAccountLifetime > TimeSpan.FromDays(30))
        {
            return ValidateOptionsResult.Fail("Authentication timeout values are invalid.");
        }

        return ValidateOptionsResult.Success;
    }
}

public sealed class SmtpOptionsValidator : IValidateOptions<SmtpOptions>
{
    private readonly IHostEnvironment _environment;
    private readonly IConfiguration _configuration;

    public SmtpOptionsValidator(
        IHostEnvironment environment,
        IConfiguration configuration)
    {
        _environment = environment;
        _configuration = configuration;
    }

    public ValidateOptionsResult Validate(string? name, SmtpOptions options)
    {
        var requireConfirmedEmail = _configuration.GetValue<bool>(
            $"{AuthenticationSecurityOptions.SectionName}:RequireConfirmedEmail");

        if (_environment.IsProduction() && requireConfirmedEmail && !options.Enabled)
        {
            return ValidateOptionsResult.Fail(
                "SMTP must be configured when confirmed email is required in production.");
        }

        if (!options.Enabled)
        {
            return ValidateOptionsResult.Success;
        }

        if (string.IsNullOrWhiteSpace(options.Host) ||
            options.Port is < 1 or > 65535 ||
            Uri.CheckHostName(options.Host) == UriHostNameType.Unknown ||
            !IsValidMailbox(options.FromAddress) ||
            (_environment.IsProduction() && !options.UseSsl))
        {
            return ValidateOptionsResult.Fail(
                "SMTP configuration is incomplete or insecure.");
        }

        return ValidateOptionsResult.Success;
    }

    private static bool IsValidMailbox(string value)
    {
        if (string.IsNullOrWhiteSpace(value) ||
            value.Contains('\r') ||
            value.Contains('\n'))
        {
            return false;
        }

        try
        {
            var address = new MailAddress(value);
            return !string.IsNullOrWhiteSpace(address.Host) &&
                   Uri.CheckHostName(address.Host) != UriHostNameType.Unknown &&
                   string.Equals(
                       address.Address,
                       value.Trim(),
                       StringComparison.OrdinalIgnoreCase);
        }
        catch (FormatException)
        {
            return false;
        }
    }
}

public sealed class DataProtectionSecurityOptionsValidator
    : IValidateOptions<DataProtectionSecurityOptions>
{
    private readonly IHostEnvironment _environment;

    public DataProtectionSecurityOptionsValidator(IHostEnvironment environment)
    {
        _environment = environment;
    }

    public ValidateOptionsResult Validate(string? name, DataProtectionSecurityOptions options)
    {
        if (!_environment.IsProduction())
        {
            return ValidateOptionsResult.Success;
        }

        if (string.IsNullOrWhiteSpace(options.CertificatePath) ||
            !File.Exists(options.CertificatePath))
        {
            return ValidateOptionsResult.Fail(
                "A Data Protection certificate is required in production.");
        }

        return ValidateOptionsResult.Success;
    }
}

public sealed class DemoSecurityOptionsValidator : IValidateOptions<DemoSecurityOptions>
{
    public ValidateOptionsResult Validate(string? name, DemoSecurityOptions options)
    {
        if (options.MaximumSnapshotBytes is < 16 * 1024 or > 1024 * 1024 ||
            options.RegisteredMaximumSnapshotBytes is < 1024 * 1024 or > 16 * 1024 * 1024 ||
            options.MaximumSnapshotBytes >= options.RegisteredMaximumSnapshotBytes ||
            options.CleanupInterval < TimeSpan.FromMinutes(1) ||
            options.CleanupInterval > TimeSpan.FromHours(24))
        {
            return ValidateOptionsResult.Fail("Demo limits are outside the accepted range.");
        }

        return ValidateOptionsResult.Success;
    }
}
