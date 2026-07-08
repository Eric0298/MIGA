using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Miga.Application.Materials;
using Miga.Contracts.Materials;

namespace Miga.Api.Controllers;

[ApiController]
[Route("api/materials")]
public sealed class MaterialsController : ControllerBase
{
    private const int MaxUrlLength = 2048;

    private readonly IYouTubeMetadataService _metadataService;

    public MaterialsController(IYouTubeMetadataService metadataService)
    {
        _metadataService = metadataService;
    }

    [HttpGet("youtube-metadata")]
    [EnableRateLimiting("youtube-metadata")]
    [ProducesResponseType(typeof(YouTubeMetadataResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(YouTubeMetadataErrorResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(YouTubeMetadataErrorResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    [ProducesResponseType(typeof(YouTubeMetadataErrorResponse), StatusCodes.Status502BadGateway)]
    [ProducesResponseType(typeof(YouTubeMetadataErrorResponse), StatusCodes.Status503ServiceUnavailable)]
    public async Task<IActionResult> GetYouTubeMetadata(
        [FromQuery] string? url,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(url))
        {
            return BadRequest(new YouTubeMetadataErrorResponse("invalid_url", "URL is required"));
        }

        if (url.Length > MaxUrlLength)
        {
            return BadRequest(new YouTubeMetadataErrorResponse("invalid_url", "URL too long"));
        }

        var result = await _metadataService.GetMetadataAsync(url, cancellationToken);

        return result switch
        {
            YouTubeMetadataResult.Success success => Ok(success.Data),

            YouTubeMetadataResult.Failure { Code: YouTubeMetadataErrorCode.InvalidUrl } failure =>
                BadRequest(new YouTubeMetadataErrorResponse("invalid_url", failure.Message)),

            YouTubeMetadataResult.Failure { Code: YouTubeMetadataErrorCode.VideoNotFound } failure =>
                NotFound(new YouTubeMetadataErrorResponse("video_not_found", failure.Message)),

            YouTubeMetadataResult.Failure { Code: YouTubeMetadataErrorCode.QuotaExceeded } failure =>
                StatusCode(
                    StatusCodes.Status503ServiceUnavailable,
                    new YouTubeMetadataErrorResponse("quota_exceeded", failure.Message)),

            YouTubeMetadataResult.Failure { Code: YouTubeMetadataErrorCode.ConfigurationError } failure =>
                StatusCode(
                    StatusCodes.Status503ServiceUnavailable,
                    new YouTubeMetadataErrorResponse("configuration_error", failure.Message)),

            YouTubeMetadataResult.Failure failure =>
                StatusCode(
                    StatusCodes.Status502BadGateway,
                    new YouTubeMetadataErrorResponse("upstream_error", failure.Message)),

            _ => StatusCode(
                StatusCodes.Status500InternalServerError,
                new YouTubeMetadataErrorResponse("unknown", "Unexpected error"))
        };
    }
}
