namespace Miga.Application.Materials;

public interface IYouTubeMetadataService
{
    Task<YouTubeMetadataResult> GetMetadataAsync(string url, CancellationToken cancellationToken);
}
