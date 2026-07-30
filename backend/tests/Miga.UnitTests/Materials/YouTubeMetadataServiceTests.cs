using System.Net;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;
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
    public async Task GetMetadataAsync_ShouldSendApiKeyInHeader_NotInRequestUri()
    {
        const string apiKey = "secret-test-key";
        Uri? capturedUri = null;
        string? capturedHeader = null;
        var handler = new StubHttpMessageHandler(request =>
        {
            capturedUri = request.RequestUri;
            capturedHeader = request.Headers.GetValues("X-Goog-Api-Key").Single();
            return Ok(BuildOkResponse("Title", "Author", "PT1M"));
        });
        var service = CreateService(handler, apiKey);

        await service.GetMetadataAsync(ValidUrl, CancellationToken.None);

        capturedUri.ShouldNotBeNull();
        capturedUri.Query.ShouldNotContain(apiKey);
        capturedUri.Query.ShouldNotContain("key=", Case.Insensitive);
        capturedHeader.ShouldBe(apiKey);
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
    public async Task GetMetadataAsync_ShouldRejectMissingItemsCollection()
    {
        var handler = new StubHttpMessageHandler(_ => Ok("{}"));
        var service = CreateService(handler);

        var result = await service.GetMetadataAsync(ValidUrl, CancellationToken.None);

        var failure = result.ShouldBeOfType<YouTubeMetadataResult.Failure>();
        failure.Code.ShouldBe(YouTubeMetadataErrorCode.UpstreamError);
    }

    [Fact]
    public async Task GetMetadataAsync_ShouldRejectNullItem()
    {
        var handler = new StubHttpMessageHandler(_ => Ok("{\"items\":[null]}"));
        var service = CreateService(handler);

        var result = await service.GetMetadataAsync(ValidUrl, CancellationToken.None);

        var failure = result.ShouldBeOfType<YouTubeMetadataResult.Failure>();
        failure.Code.ShouldBe(YouTubeMetadataErrorCode.UpstreamError);
    }

    [Fact]
    public async Task GetMetadataAsync_ShouldRejectMismatchedVideoId()
    {
        var handler = new StubHttpMessageHandler(_ =>
            Ok(BuildOkResponse("Title", "Author", "PT1M", "aaaaaaaaaaa")));
        var service = CreateService(handler);

        var result = await service.GetMetadataAsync(ValidUrl, CancellationToken.None);

        var failure = result.ShouldBeOfType<YouTubeMetadataResult.Failure>();
        failure.Code.ShouldBe(YouTubeMetadataErrorCode.UpstreamError);
    }

    [Fact]
    public async Task GetMetadataAsync_ShouldRejectMissingTitle()
    {
        var handler = new StubHttpMessageHandler(_ =>
            Ok(BuildOkResponse("", "Author", "PT1M")));
        var service = CreateService(handler);

        var result = await service.GetMetadataAsync(ValidUrl, CancellationToken.None);

        var failure = result.ShouldBeOfType<YouTubeMetadataResult.Failure>();
        failure.Code.ShouldBe(YouTubeMetadataErrorCode.UpstreamError);
    }

    [Fact]
    public async Task GetMetadataAsync_ShouldRejectOverlongAuthor()
    {
        var handler = new StubHttpMessageHandler(_ =>
            Ok(BuildOkResponse("Title", new string('a', 201), "PT1M")));
        var service = CreateService(handler);

        var result = await service.GetMetadataAsync(ValidUrl, CancellationToken.None);

        var failure = result.ShouldBeOfType<YouTubeMetadataResult.Failure>();
        failure.Code.ShouldBe(YouTubeMetadataErrorCode.UpstreamError);
    }

    [Fact]
    public async Task GetMetadataAsync_ShouldRejectOverlongTitle()
    {
        var handler = new StubHttpMessageHandler(_ =>
            Ok(BuildOkResponse(new string('t', 501), "Author", "PT1M")));
        var service = CreateService(handler);

        var result = await service.GetMetadataAsync(ValidUrl, CancellationToken.None);

        var failure = result.ShouldBeOfType<YouTubeMetadataResult.Failure>();
        failure.Code.ShouldBe(YouTubeMetadataErrorCode.UpstreamError);
    }

    [Fact]
    public async Task GetMetadataAsync_ShouldRejectMissingOrMalformedDuration()
    {
        var missingDuration = JsonSerializer.Serialize(new
        {
            items = new[]
            {
                new
                {
                    id = ValidVideoId,
                    snippet = new { title = "Title", channelTitle = "Author" },
                    contentDetails = new { }
                }
            }
        });
        var responses = new Queue<string>(
            [missingDuration, BuildOkResponse("Title", "Author", "invalid")]);
        var handler = new StubHttpMessageHandler(_ => Ok(responses.Dequeue()));
        var service = CreateService(handler);

        var missingResult =
            await service.GetMetadataAsync(ValidUrl, CancellationToken.None);
        var malformedResult =
            await service.GetMetadataAsync(ValidUrl, CancellationToken.None);

        missingResult.ShouldBeOfType<YouTubeMetadataResult.Failure>()
            .Code.ShouldBe(YouTubeMetadataErrorCode.UpstreamError);
        malformedResult.ShouldBeOfType<YouTubeMetadataResult.Failure>()
            .Code.ShouldBe(YouTubeMetadataErrorCode.UpstreamError);
    }

    [Fact]
    public async Task GetMetadataAsync_ShouldAcceptDocumentedDayDurationAtContractLimits()
    {
        var handler = new StubHttpMessageHandler(_ =>
            Ok(BuildOkResponse(
                new string('t', 500),
                new string('a', 200),
                "P365DT0S")));
        var service = CreateService(handler);

        var result = await service.GetMetadataAsync(ValidUrl, CancellationToken.None);

        var success = result.ShouldBeOfType<YouTubeMetadataResult.Success>();
        success.Data.Title.Length.ShouldBe(500);
        success.Data.Author.Length.ShouldBe(200);
        success.Data.DurationSeconds.ShouldBe(60 * 60 * 24 * 365);
    }

    [Fact]
    public async Task GetMetadataAsync_ShouldRejectDurationBeyondContractLimit()
    {
        var handler = new StubHttpMessageHandler(_ =>
            Ok(BuildOkResponse("Title", "Author", "P366DT0S")));
        var service = CreateService(handler);

        var result = await service.GetMetadataAsync(ValidUrl, CancellationToken.None);

        var failure = result.ShouldBeOfType<YouTubeMetadataResult.Failure>();
        failure.Code.ShouldBe(YouTubeMetadataErrorCode.UpstreamError);
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
    public async Task GetMetadataAsync_ShouldNotFollowRedirectResponse()
    {
        var callCount = 0;
        var handler = new StubHttpMessageHandler(_ =>
        {
            callCount++;
            return new HttpResponseMessage(HttpStatusCode.Redirect)
            {
                Headers = { Location = new Uri("https://attacker.example/") }
            };
        });
        var service = CreateService(handler);

        var result = await service.GetMetadataAsync(ValidUrl, CancellationToken.None);

        var failure = result.ShouldBeOfType<YouTubeMetadataResult.Failure>();
        failure.Code.ShouldBe(YouTubeMetadataErrorCode.UpstreamError);
        callCount.ShouldBe(1);
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

    // ---- Log injection regression tests ----

    [Fact]
    public async Task GetMetadataAsync_ShouldNeverLogRawVideoIdOrUrl()
    {
        var logger = new CapturingLogger<YouTubeMetadataService>();
        var handler = new StubHttpMessageHandler(_ =>
            new HttpResponseMessage(HttpStatusCode.InternalServerError));
        var service = CreateService(handler, logger: logger);

        var result = await service.GetMetadataAsync(ValidUrl, CancellationToken.None);

        result.ShouldBeOfType<YouTubeMetadataResult.Failure>();
        logger.Entries.ShouldNotBeEmpty();
        foreach (var rendered in logger.Entries)
        {
            rendered.ShouldNotContain(ValidVideoId);
            rendered.ShouldNotContain(ValidUrl);
        }
    }

    [Theory]
    [InlineData("network boom\r\n[FAKE] level=critical\r\n")]
    [InlineData("network boom\ntrailing")]
    [InlineData("network boom\rreturn")]
    [InlineData("network boom\ttabbed")]
    [InlineData("network boombell")]
    public async Task GetMetadataAsync_ShouldNotLeakControlCharacters_FromNetworkExceptionMessage(
        string maliciousMessage)
    {
        var logger = new CapturingLogger<YouTubeMetadataService>();
        var handler = new StubHttpMessageHandler(
            _ => throw new HttpRequestException(maliciousMessage));
        var service = CreateService(handler, logger: logger);

        await service.GetMetadataAsync(ValidUrl, CancellationToken.None);

        logger.Entries.ShouldNotBeEmpty();
        foreach (var rendered in logger.Entries)
        {
            rendered.ShouldNotContain('\r');
            rendered.ShouldNotContain('\n');
            rendered.ShouldNotContain(maliciousMessage);
        }
    }

    [Fact]
    public async Task GetMetadataAsync_ShouldRejectMaliciousChannelMetadata()
    {
        // Upstream cannot smuggle CRLF into logs: the payload is validated by
        // length and the videoId is never echoed verbatim.
        var maliciousChannel = "Rick\r\n[FAKE] admin=true";
        var payload = BuildOkResponse(
            title: "Never Gonna Give You Up",
            channel: maliciousChannel,
            duration: "PT3M32S");
        var logger = new CapturingLogger<YouTubeMetadataService>();
        var handler = new StubHttpMessageHandler(_ => Ok(payload));
        var service = CreateService(handler, logger: logger);

        var result = await service.GetMetadataAsync(ValidUrl, CancellationToken.None);

        // The metadata is returned as-is to the caller (that layer is responsible
        // for encoding) but nothing must have been logged with control chars.
        result.ShouldBeOfType<YouTubeMetadataResult.Success>();
        foreach (var rendered in logger.Entries)
        {
            rendered.ShouldNotContain('\r');
            rendered.ShouldNotContain('\n');
        }
    }

    [Fact]
    public async Task GetMetadataAsync_ShouldNotLogRawResponseBody_OnJsonParseFailure()
    {
        var maliciousBody = "not-json\r\n{\"items\":[\r\n\"crlf\"]}";
        var logger = new CapturingLogger<YouTubeMetadataService>();
        var handler = new StubHttpMessageHandler(_ => new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent(maliciousBody, Encoding.UTF8, "application/json")
        });
        var service = CreateService(handler, logger: logger);

        var result = await service.GetMetadataAsync(ValidUrl, CancellationToken.None);

        result.ShouldBeOfType<YouTubeMetadataResult.Failure>();
        foreach (var rendered in logger.Entries)
        {
            rendered.ShouldNotContain('\r');
            rendered.ShouldNotContain('\n');
            rendered.ShouldNotContain("not-json");
        }
    }

    private static YouTubeMetadataService CreateService(
        StubHttpMessageHandler handler,
        string apiKey = "test-key",
        ILogger<YouTubeMetadataService>? logger = null)
    {
        var httpClient = new HttpClient(handler)
        {
            BaseAddress = new Uri("https://www.googleapis.com/youtube/v3/")
        };
        var cache = new MemoryCache(new MemoryCacheOptions());
        var options = Options.Create(new YouTubeApiOptions
        {
            Enabled = true,
            ApiKey = apiKey
        });
        return new YouTubeMetadataService(
            httpClient,
            cache,
            options,
            logger ?? NullLogger<YouTubeMetadataService>.Instance);
    }

    private static HttpResponseMessage Ok(string json) => new(HttpStatusCode.OK)
    {
        Content = new StringContent(json, Encoding.UTF8, "application/json")
    };

    private static string BuildOkResponse(
        string title,
        string channel,
        string duration,
        string videoId = ValidVideoId) =>
        JsonSerializer.Serialize(new
        {
            items = new[]
            {
                new
                {
                    id = videoId,
                    snippet = new { title, channelTitle = channel },
                    contentDetails = new { duration }
                }
            }
        });

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

    private sealed class CapturingLogger<T> : ILogger<T>
    {
        public List<string> Entries { get; } = new();

        public IDisposable BeginScope<TState>(TState state) where TState : notnull =>
            NullScope.Instance;

        public bool IsEnabled(LogLevel logLevel) => true;

        public void Log<TState>(
            LogLevel logLevel,
            EventId eventId,
            TState state,
            Exception? exception,
            Func<TState, Exception?, string> formatter)
        {
            Entries.Add(formatter(state, exception));
        }

        private sealed class NullScope : IDisposable
        {
            public static readonly NullScope Instance = new();
            public void Dispose() { }
        }
    }
}
