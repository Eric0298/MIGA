namespace Miga.Api.Security;

public sealed class MigaCorsOptions
{
    public const string SectionName = "Cors";

    public string[] AllowedOrigins { get; init; } = [];
}

public sealed class TrustedProxyOptions
{
    public const string SectionName = "TrustedProxies";

    public string[] Addresses { get; init; } = [];

    public string[] Networks { get; init; } = [];

    public int ForwardLimit { get; init; } = 1;
}
