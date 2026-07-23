using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Miga.Application.Materials;
using Miga.Contracts.Materials;

namespace Miga.Infrastructure.Materials;

public sealed class YouTubeMetadataService : IYouTubeMetadataService
{
    private const string Provider = "youtube";
    private const string CacheKeyPrefix = "yt-meta:";
    private const string BaseAddress = "https://www.googleapis.com/youtube/v3/";
    private const int MaxResponseBytes = 256 * 1024;

    private readonly HttpClient _httpClient;
    private readonly IMemoryCache _cache;
    private readonly YouTubeApiOptions _options;
    private readonly ILogger<YouTubeMetadataService> _logger;

    public YouTubeMetadataService(
        HttpClient httpClient,
        IMemoryCache cache,
        IOptions<YouTubeApiOptions> options,
        ILogger<YouTubeMetadataService> logger)
    {
        _httpClient = httpClient;
        _cache = cache;
        _options = options.Value;
        _logger = logger;

        if (_httpClient.BaseAddress is null)
        {
            _httpClient.BaseAddress = new Uri(BaseAddress);
        }
    }

    public async Task<YouTubeMetadataResult> GetMetadataAsync(
        string url,
        CancellationToken cancellationToken)
    {
        if (!YouTubeUrlParser.TryParseVideoId(url, out var videoId) || videoId is null)
        {
            return new YouTubeMetadataResult.Failure(
                YouTubeMetadataErrorCode.InvalidUrl,
                "invalid_url");
        }

        var cacheKey = CacheKeyPrefix + videoId;
        if (_cache.TryGetValue<YouTubeMetadataResponse>(cacheKey, out var cached) && cached is not null)
        {
            return new YouTubeMetadataResult.Success(cached);
        }

        if (!_options.Enabled || string.IsNullOrWhiteSpace(_options.ApiKey))
        {
            _logger.LogError("YouTube API key is not configured");
            return new YouTubeMetadataResult.Failure(
                YouTubeMetadataErrorCode.ConfigurationError,
                "api_key_missing");
        }

        var requestUri =
            $"videos?id={Uri.EscapeDataString(videoId)}&part=snippet,contentDetails";

        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Get, requestUri);
            request.Headers.Add("X-Goog-Api-Key", _options.ApiKey);
            using var response = await _httpClient.SendAsync(
                request,
                HttpCompletionOption.ResponseHeadersRead,
                cancellationToken);

            if (response.StatusCode == HttpStatusCode.Forbidden)
            {
                _logger.LogWarning("YouTube API returned 403 for {VideoId}", videoId);
                return new YouTubeMetadataResult.Failure(
                    YouTubeMetadataErrorCode.QuotaExceeded,
                    "quota_exceeded");
            }

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning(
                    "YouTube API returned {StatusCode} for {VideoId}",
                    (int)response.StatusCode,
                    videoId);
                return new YouTubeMetadataResult.Failure(
                    YouTubeMetadataErrorCode.UpstreamError,
                    "upstream_error");
            }

            if (response.Content.Headers.ContentLength > MaxResponseBytes)
            {
                _logger.LogWarning("YouTube API response exceeded the allowed size for {VideoId}", videoId);
                return new YouTubeMetadataResult.Failure(
                    YouTubeMetadataErrorCode.UpstreamError,
                    "upstream_response_too_large");
            }

            await response.Content.LoadIntoBufferAsync(MaxResponseBytes, cancellationToken);
            var payload = await response.Content.ReadFromJsonAsync<YouTubeVideoListPayload>(
                cancellationToken: cancellationToken);

            var item = payload?.Items?.FirstOrDefault();
            if (item is null)
            {
                return new YouTubeMetadataResult.Failure(
                    YouTubeMetadataErrorCode.VideoNotFound,
                    "video_not_found");
            }

            var duration = YouTubeDurationParser.ToSeconds(item.ContentDetails?.Duration);
            var metadata = new YouTubeMetadataResponse(
                Provider: Provider,
                VideoId: videoId,
                Title: item.Snippet?.Title ?? string.Empty,
                Author: item.Snippet?.ChannelTitle ?? string.Empty,
                ThumbnailUrl: $"https://i.ytimg.com/vi/{videoId}/hqdefault.jpg",
                DurationSeconds: duration);

            _cache.Set(
                cacheKey,
                metadata,
                new MemoryCacheEntryOptions
                {
                    AbsoluteExpirationRelativeToNow = _options.CacheTtl,
                    Size = 1
                });
            return new YouTubeMetadataResult.Success(metadata);
        }
        catch (HttpRequestException ex)
        {
            _logger.LogWarning(ex, "Network error fetching metadata for {VideoId}", videoId);
            return new YouTubeMetadataResult.Failure(
                YouTubeMetadataErrorCode.UpstreamError,
                "network_error");
        }
        catch (TaskCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            _logger.LogWarning("Timeout fetching metadata for {VideoId}", videoId);
            return new YouTubeMetadataResult.Failure(
                YouTubeMetadataErrorCode.UpstreamError,
                "timeout");
        }
        catch (JsonException ex)
        {
            _logger.LogWarning(ex, "Invalid YouTube API payload for {VideoId}", videoId);
            return new YouTubeMetadataResult.Failure(
                YouTubeMetadataErrorCode.UpstreamError,
                "invalid_upstream_response");
        }
        catch (OverflowException ex)
        {
            _logger.LogWarning(ex, "Invalid YouTube duration for {VideoId}", videoId);
            return new YouTubeMetadataResult.Failure(
                YouTubeMetadataErrorCode.UpstreamError,
                "invalid_upstream_response");
        }
        catch (FormatException ex)
        {
            _logger.LogWarning(ex, "Invalid YouTube duration for {VideoId}", videoId);
            return new YouTubeMetadataResult.Failure(
                YouTubeMetadataErrorCode.UpstreamError,
                "invalid_upstream_response");
        }
    }

    private sealed record YouTubeVideoListPayload(
        [property: JsonPropertyName("items")] IReadOnlyList<YouTubeVideoItem>? Items);

    private sealed record YouTubeVideoItem(
        [property: JsonPropertyName("snippet")] YouTubeVideoSnippet? Snippet,
        [property: JsonPropertyName("contentDetails")] YouTubeVideoContentDetails? ContentDetails);

    private sealed record YouTubeVideoSnippet(
        [property: JsonPropertyName("title")] string? Title,
        [property: JsonPropertyName("channelTitle")] string? ChannelTitle);

    private sealed record YouTubeVideoContentDetails(
        [property: JsonPropertyName("duration")] string? Duration);
}
