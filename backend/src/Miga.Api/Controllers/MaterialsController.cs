using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Miga.Api.Security;
using Miga.Application.Materials;
using Miga.Contracts.Materials;
using Miga.Infrastructure.Auth;

namespace Miga.Api.Controllers;

[ApiController]
[Authorize(Policy = MigaAuthenticationConstants.RegisteredPolicy)]
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
    [EnableRateLimiting(ApiSecurityConstants.YouTubeMetadataRatePolicy)]
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

            YouTubeMetadataResult.Failure { Code: YouTubeMetadataErrorCode.InvalidUrl } =>
                BadRequest(new YouTubeMetadataErrorResponse("invalid_url", "Invalid YouTube URL")),

            YouTubeMetadataResult.Failure { Code: YouTubeMetadataErrorCode.VideoNotFound } =>
                NotFound(new YouTubeMetadataErrorResponse("video_not_found", "Video not found")),

            YouTubeMetadataResult.Failure { Code: YouTubeMetadataErrorCode.QuotaExceeded } =>
                StatusCode(
                    StatusCodes.Status503ServiceUnavailable,
                    new YouTubeMetadataErrorResponse("quota_exceeded", "Metadata service is unavailable")),

            YouTubeMetadataResult.Failure { Code: YouTubeMetadataErrorCode.ConfigurationError } =>
                StatusCode(
                    StatusCodes.Status503ServiceUnavailable,
                    new YouTubeMetadataErrorResponse("service_unavailable", "Metadata service is unavailable")),

            YouTubeMetadataResult.Failure =>
                StatusCode(
                    StatusCodes.Status502BadGateway,
                    new YouTubeMetadataErrorResponse("upstream_error", "Metadata service failed")),

            _ => StatusCode(
                StatusCodes.Status500InternalServerError,
                new YouTubeMetadataErrorResponse("unknown", "Unexpected error"))
        };
    }
}
