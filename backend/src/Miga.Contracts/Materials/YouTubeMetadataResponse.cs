namespace Miga.Contracts.Materials;

/// <summary>
/// Successful response for /api/materials/youtube-metadata.
/// </summary>
public sealed record YouTubeMetadataResponse(
    string Provider,
    string VideoId,
    string Title,
    string Author,
    string ThumbnailUrl,
    int DurationSeconds
);

/// <summary>
/// Error response envelope for the same endpoint.
/// Codes are stable strings for clients to switch on.
/// </summary>
public sealed record YouTubeMetadataErrorResponse(
    string Code,
    string Message
);
