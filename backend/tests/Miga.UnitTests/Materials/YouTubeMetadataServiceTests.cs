using System.Net;
using System.Text;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Miga.Application.Materials;
using Miga.Infrastructure.Materials;
using Shouldly;

namespace Miga.UnitTests.Materials;

public sealed class YouTubeMetadataServiceTests
{
    private const string ValidUrl = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
    private const string ValidVideoId = "dQw4w9WgXcQ";

    [Fact]
    public async Task GetMetadataAsync_ShouldReturnInvalidUrl_ForBadUrl()
    {
        var handler = new StubHttpMessageHandler(_ => throw new InvalidOperationException("no HTTP call expected"));
        var service = CreateService(handler);

        var result = await service.GetMetadataAsync("not a url", CancellationToken.None);

        var failure = result.ShouldBeOfType<YouTubeMetadataResult.Failure>();
        failure.Code.ShouldBe(YouTubeMetadataErrorCode.InvalidUrl);
    }

    [Fact]
    public async Task GetMetadataAsync_ShouldReturnConfigurationError_WhenApiKeyMissing()
    {
        var handler = new StubHttpMessageHandler(_ => throw new InvalidOperationException("no HTTP call expected"));
        var service = CreateService(handler, apiKey: "");

        var result = await service.GetMetadataAsync(ValidUrl, CancellationToken.None);

        var failure = result.ShouldBeOfType<YouTubeMetadataResult.Failure>();
        failure.Code.ShouldBe(YouTubeMetadataErrorCode.ConfigurationError);
    }

    [Fact]
    public async Task GetMetadataAsync_ShouldReturnSuccess_ForValidResponse()
    {
        var payload = BuildOkResponse(
            title: "Never Gonna Give You Up",
            channel: "Rick Astley",
            duration: "PT3M32S");
        var handler = new StubHttpMessageHandler(_ => Ok(payload));
        var service = CreateService(handler);

        var result = await service.GetMetadataAsync(ValidUrl, CancellationToken.None);

        var success = result.ShouldBeOfType<YouTubeMetadataResult.Success>();
        success.Data.VideoId.ShouldBe(ValidVideoId);
        success.Data.Title.ShouldBe("Never Gonna Give You Up");
        success.Data.Author.ShouldBe("Rick Astley");
        success.Data.DurationSeconds.ShouldBe(3 * 60 + 32);
        success.Data.ThumbnailUrl.ShouldContain(ValidVideoId);
        success.Data.Provider.ShouldBe("youtube");
    }

    [Fact]
    public async Task GetMetadataAsync_ShouldCacheSuccessfulResponse()
    {
        var callCount = 0;
        var handler = new StubHttpMessageHandler(_ =>
        {
            callCount++;
            return Ok(BuildOkResponse("Title", "Author", "PT10M"));
        });
        var service = CreateService(handler);

        await service.GetMetadataAsync(ValidUrl, CancellationToken.None);
        await service.GetMetadataAsync(ValidUrl, CancellationToken.None);

        callCount.ShouldBe(1);
    }

    [Fact]
    public async Task GetMetadataAsync_ShouldReturnVideoNotFound_ForEmptyItems()
    {
        var handler = new StubHttpMessageHandler(_ => Ok("{\"items\":[]}"));
        var service = CreateService(handler);

        var result = await service.GetMetadataAsync(ValidUrl, CancellationToken.None);

        var failure = result.ShouldBeOfType<YouTubeMetadataResult.Failure>();
        failure.Code.ShouldBe(YouTubeMetadataErrorCode.VideoNotFound);
    }

    [Fact]
    public async Task GetMetadataAsync_ShouldReturnQuotaExceeded_On403()
    {
        var handler = new StubHttpMessageHandler(_ => new HttpResponseMessage(HttpStatusCode.Forbidden));
        var service = CreateService(handler);

        var result = await service.GetMetadataAsync(ValidUrl, CancellationToken.None);

        var failure = result.ShouldBeOfType<YouTubeMetadataResult.Failure>();
        failure.Code.ShouldBe(YouTubeMetadataErrorCode.QuotaExceeded);
    }

    [Fact]
    public async Task GetMetadataAsync_ShouldReturnUpstreamError_On500()
    {
        var handler = new StubHttpMessageHandler(_ =>
            new HttpResponseMessage(HttpStatusCode.InternalServerError));
        var service = CreateService(handler);

        var result = await service.GetMetadataAsync(ValidUrl, CancellationToken.None);

        var failure = result.ShouldBeOfType<YouTubeMetadataResult.Failure>();
        failure.Code.ShouldBe(YouTubeMetadataErrorCode.UpstreamError);
    }

    [Fact]
    public async Task GetMetadataAsync_ShouldReturnUpstreamError_OnNetworkError()
    {
        var handler = new StubHttpMessageHandler(_ => throw new HttpRequestException("network down"));
        var service = CreateService(handler);

        var result = await service.GetMetadataAsync(ValidUrl, CancellationToken.None);

        var failure = result.ShouldBeOfType<YouTubeMetadataResult.Failure>();
        failure.Code.ShouldBe(YouTubeMetadataErrorCode.UpstreamError);
    }

    private static YouTubeMetadataService CreateService(
        StubHttpMessageHandler handler,
        string apiKey = "test-key")
    {
        var httpClient = new HttpClient(handler)
        {
            BaseAddress = new Uri("https://www.googleapis.com/youtube/v3/")
        };
        var cache = new MemoryCache(new MemoryCacheOptions());
        var options = Options.Create(new YouTubeApiOptions { ApiKey = apiKey });
        var logger = NullLogger<YouTubeMetadataService>.Instance;
        return new YouTubeMetadataService(httpClient, cache, options, logger);
    }

    private static HttpResponseMessage Ok(string json) => new(HttpStatusCode.OK)
    {
        Content = new StringContent(json, Encoding.UTF8, "application/json")
    };

    private static string BuildOkResponse(string title, string channel, string duration)
    {
        return $$"""
        {
            "items": [
                {
                    "snippet": {
                        "title": "{{title}}",
                        "channelTitle": "{{channel}}"
                    },
                    "contentDetails": {
                        "duration": "{{duration}}"
                    }
                }
            ]
        }
        """;
    }

    private sealed class StubHttpMessageHandler : HttpMessageHandler
    {
        private readonly Func<HttpRequestMessage, HttpResponseMessage> _responder;

        public StubHttpMessageHandler(Func<HttpRequestMessage, HttpResponseMessage> responder)
        {
            _responder = responder;
        }

        protected override Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request,
            CancellationToken cancellationToken)
        {
            return Task.FromResult(_responder(request));
        }
    }
}
