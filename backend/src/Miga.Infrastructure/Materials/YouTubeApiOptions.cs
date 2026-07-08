namespace Miga.Infrastructure.Materials;

public sealed class YouTubeApiOptions
{
    public const string SectionName = "YouTubeApi";

    /// <summary>
    /// Google Cloud API key for YouTube Data API v3.
    /// Never commit. Provide via user-secrets in Development or the
    /// YOUTUBEAPI__APIKEY environment variable in Production.
    /// </summary>
    public string ApiKey { get; init; } = string.Empty;

    /// <summary>
    /// TTL for successful metadata lookups. Defaults to 24h to minimise quota usage.
    /// </summary>
    public TimeSpan CacheTtl { get; init; } = TimeSpan.FromHours(24);
}
