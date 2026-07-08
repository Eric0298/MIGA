using Miga.Contracts.Materials;

namespace Miga.Application.Materials;

/// <summary>
/// Discriminated union between success (with DTO) and failure (with typed error code).
/// Consumers pattern-match to map to HTTP responses.
/// </summary>
public abstract record YouTubeMetadataResult
{
    private YouTubeMetadataResult() { }

    public sealed record Success(YouTubeMetadataResponse Data) : YouTubeMetadataResult;

    public sealed record Failure(YouTubeMetadataErrorCode Code, string Message) : YouTubeMetadataResult;
}
