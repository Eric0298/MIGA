using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Miga.Application.Common.Security;
using Miga.Application.Materials;
using Miga.Contracts.Materials;

namespace Miga.Infrastructure.Materials;

public sealed class YouTubeMetadataService : IYouTubeMetadataService
{
    private const string Provider = "youtube";
    private const string CacheKeyPrefix = "yt-meta:";
    private const string BaseAddress = "https://www.googleapis.com/youtube/v3/";
    private const int MaxResponseBytes = 256 * 1024;
    private const int MaxTitleLength = 500;
    private const int MaxAuthorLength = 200;
    private const int MaxDurationSeconds = 60 * 60 * 24 * 365;

    private static readonly Regex DurationRegex = new(
        "^P(?:(?<days>[0-9]+)D)?T(?:(?<hours>[0-9]+)H)?" +
        "(?:(?<minutes>[0-9]+)M)?(?:(?<seconds>[0-9]+)S)?$",
        RegexOptions.Compiled |
        RegexOptions.CultureInvariant |
        RegexOptions.NonBacktracking);

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

        // videoId is already validated to match ^[A-Za-z0-9_-]{11}$ upstream, but
        // logs never receive the raw identifier: we correlate via a non-reversible
        // fingerprint so no user-controlled bytes reach a log sink and no
        // watch-history leaks through operational logs.
        var videoFingerprint = LogSanitizer.Fingerprint(videoId);

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
                _logger.LogWarning(
                    "YouTube API returned 403 for {VideoFingerprint}",
                    videoFingerprint);
                return new YouTubeMetadataResult.Failure(
                    YouTubeMetadataErrorCode.QuotaExceeded,
                    "quota_exceeded");
            }

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning(
                    "YouTube API returned {StatusCode} for {VideoFingerprint}",
                    (int)response.StatusCode,
                    videoFingerprint);
                return new YouTubeMetadataResult.Failure(
                    YouTubeMetadataErrorCode.UpstreamError,
                    "upstream_error");
            }

            if (response.Content.Headers.ContentLength > MaxResponseBytes)
            {
                _logger.LogWarning(
                    "YouTube API response exceeded the allowed size for {VideoFingerprint}",
                    videoFingerprint);
                return new YouTubeMetadataResult.Failure(
                    YouTubeMetadataErrorCode.UpstreamError,
                    "upstream_response_too_large");
            }

            await response.Content.LoadIntoBufferAsync(MaxResponseBytes, cancellationToken);
            var payload = await response.Content.ReadFromJsonAsync<YouTubeVideoListPayload>(
                cancellationToken: cancellationToken);

            if (payload?.Items is null)
            {
                return InvalidUpstreamResponse();
            }

            var items = payload.Items;
            if (items.Count == 0)
            {
                return new YouTubeMetadataResult.Failure(
                    YouTubeMetadataErrorCode.VideoNotFound,
                    "video_not_found");
            }

            if (items.Count != 1 ||
                items[0] is not { } item ||
                !string.Equals(item.Id, videoId, StringComparison.Ordinal))
            {
                return InvalidUpstreamResponse();
            }

            var title = item.Snippet?.Title?.Trim();
            var author = item.Snippet?.ChannelTitle?.Trim() ?? string.Empty;
            if (string.IsNullOrWhiteSpace(title) ||
                title.Length > MaxTitleLength ||
                author.Length > MaxAuthorLength)
            {
                return InvalidUpstreamResponse();
            }

            if (!TryParseDurationSeconds(
                    item.ContentDetails?.Duration,
                    out var duration))
            {
                return InvalidUpstreamResponse();
            }

            var metadata = new YouTubeMetadataResponse(
                Provider: Provider,
                VideoId: videoId,
                Title: title,
                Author: author,
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
            // We do not attach the exception object because its message can echo
            // arbitrary bytes from the upstream response; only the type is safe.
            _logger.LogWarning(
                "Network error fetching metadata for {VideoFingerprint}. ExceptionType={ExceptionType}",
                videoFingerprint,
                ex.GetType().FullName);
            return new YouTubeMetadataResult.Failure(
                YouTubeMetadataErrorCode.UpstreamError,
                "network_error");
        }
        catch (TaskCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            _logger.LogWarning(
                "Timeout fetching metadata for {VideoFingerprint}",
                videoFingerprint);
            return new YouTubeMetadataResult.Failure(
                YouTubeMetadataErrorCode.UpstreamError,
                "timeout");
        }
        catch (JsonException ex)
        {
            _logger.LogWarning(
                "Invalid YouTube API payload for {VideoFingerprint}. ExceptionType={ExceptionType}",
                videoFingerprint,
                ex.GetType().FullName);
            return new YouTubeMetadataResult.Failure(
                YouTubeMetadataErrorCode.UpstreamError,
                "invalid_upstream_response");
        }
        catch (OverflowException ex)
        {
            _logger.LogWarning(
                "Invalid YouTube duration for {VideoFingerprint}. ExceptionType={ExceptionType}",
                videoFingerprint,
                ex.GetType().FullName);
            return new YouTubeMetadataResult.Failure(
                YouTubeMetadataErrorCode.UpstreamError,
                "invalid_upstream_response");
        }
        catch (FormatException ex)
        {
            _logger.LogWarning(
                "Invalid YouTube duration for {VideoFingerprint}. ExceptionType={ExceptionType}",
                videoFingerprint,
                ex.GetType().FullName);
            return new YouTubeMetadataResult.Failure(
                YouTubeMetadataErrorCode.UpstreamError,
                "invalid_upstream_response");
        }
    }

    private sealed record YouTubeVideoListPayload(
        [property: JsonPropertyName("items")] IReadOnlyList<YouTubeVideoItem?>? Items);

    private sealed record YouTubeVideoItem(
        [property: JsonPropertyName("id")] string? Id,
        [property: JsonPropertyName("snippet")] YouTubeVideoSnippet? Snippet,
        [property: JsonPropertyName("contentDetails")] YouTubeVideoContentDetails? ContentDetails);

    private sealed record YouTubeVideoSnippet(
        [property: JsonPropertyName("title")] string? Title,
        [property: JsonPropertyName("channelTitle")] string? ChannelTitle);

    private sealed record YouTubeVideoContentDetails(
        [property: JsonPropertyName("duration")] string? Duration);

    private static YouTubeMetadataResult.Failure InvalidUpstreamResponse() =>
        new(
            YouTubeMetadataErrorCode.UpstreamError,
            "invalid_upstream_response");

    private static bool TryParseDurationSeconds(string? value, out int seconds)
    {
        seconds = 0;
        if (string.IsNullOrWhiteSpace(value))
        {
            return false;
        }

        var match = DurationRegex.Match(value);
        if (!match.Success ||
            !HasDurationComponent(match) ||
            !TryParseComponent(match.Groups["days"], out var days) ||
            !TryParseComponent(match.Groups["hours"], out var hours) ||
            !TryParseComponent(match.Groups["minutes"], out var minutes) ||
            !TryParseComponent(match.Groups["seconds"], out var remainingSeconds))
        {
            return false;
        }

        try
        {
            var totalSeconds = checked(
                days * 24 * 60 * 60 +
                hours * 60 * 60 +
                minutes * 60 +
                remainingSeconds);
            if (totalSeconds > MaxDurationSeconds)
            {
                return false;
            }

            seconds = (int)totalSeconds;
            return true;
        }
        catch (OverflowException)
        {
            return false;
        }
    }

    private static bool HasDurationComponent(Match match) =>
        match.Groups["days"].Success ||
        match.Groups["hours"].Success ||
        match.Groups["minutes"].Success ||
        match.Groups["seconds"].Success;

    private static bool TryParseComponent(Group group, out long value)
    {
        if (!group.Success)
        {
            value = 0;
            return true;
        }

        return long.TryParse(group.Value, out value);
    }
}
