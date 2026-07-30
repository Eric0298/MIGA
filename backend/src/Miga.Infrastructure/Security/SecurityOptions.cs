namespace Miga.Infrastructure.Security;

public sealed class AuthenticationSecurityOptions
{
    public const string SectionName = "Authentication";

    public bool RequireConfirmedEmail { get; init; } = true;

    public string PublicBaseUrl { get; init; } = string.Empty;

    public string PrivacyPolicyVersion { get; init; } = "2026-07-23";

    public TimeSpan UserIdleTimeout { get; init; } = TimeSpan.FromMinutes(30);

    public TimeSpan UserAbsoluteTimeout { get; init; } = TimeSpan.FromHours(24);

    public TimeSpan DemoIdleTimeout { get; init; } = TimeSpan.FromMinutes(30);

    public TimeSpan DemoAbsoluteTimeout { get; init; } = TimeSpan.FromHours(2);

    public TimeSpan RecentAuthenticationWindow { get; init; } = TimeSpan.FromMinutes(10);

    public TimeSpan UnconfirmedAccountLifetime { get; init; } = TimeSpan.FromDays(7);
}

public sealed class SmtpOptions
{
    public const string SectionName = "Smtp";

    public bool Enabled { get; init; }

    public string Host { get; init; } = string.Empty;

    public int Port { get; init; } = 587;

    public bool UseSsl { get; init; } = true;

    public string Username { get; init; } = string.Empty;

    public string Password { get; init; } = string.Empty;

    public string FromAddress { get; init; } = string.Empty;
}

public sealed class DataProtectionSecurityOptions
{
    public const string SectionName = "DataProtection";

    public string CertificatePath { get; init; } = string.Empty;

    public string CertificatePassword { get; init; } = string.Empty;
}

public sealed class DemoSecurityOptions
{
    public const string SectionName = "Demo";

    public int MaximumSnapshotBytes { get; init; } = 256 * 1024;

    public int RegisteredMaximumSnapshotBytes { get; init; } = 5 * 1024 * 1024;

    public TimeSpan CleanupInterval { get; init; } = TimeSpan.FromMinutes(15);
}

public sealed class DatabaseHealthOptions
{
    public const string SectionName = "Health";

    public bool ExposeDatabaseEndpoint { get; init; }
}
