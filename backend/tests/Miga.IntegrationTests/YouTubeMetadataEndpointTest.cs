using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Miga.Application.Materials;
using Miga.Contracts.Materials;
using Miga.IntegrationTests.Infrastructure;
using Shouldly;

namespace Miga.IntegrationTests;

public sealed class YouTubeMetadataEndpointTest : IClassFixture<MigaWebApplicationFactory>
{
    private readonly MigaWebApplicationFactory _factory;

    public YouTubeMetadataEndpointTest(MigaWebApplicationFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task GetYouTubeMetadata_ShouldReturn400_WhenUrlMissing()
    {
        using var owned = await CreateClientAsync(new FakeMetadataService(_ =>
            throw new InvalidOperationException("no service call expected")));
        var client = owned.Client;

        var response = await client.GetAsync("/api/materials/youtube-metadata");

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task GetYouTubeMetadata_ShouldReturn400_WhenServiceReportsInvalidUrl()
    {
        using var owned = await CreateClientAsync(new FakeMetadataService(_ =>
            new YouTubeMetadataResult.Failure(YouTubeMetadataErrorCode.InvalidUrl, "invalid_url")));
        var client = owned.Client;

        var response = await client.GetAsync("/api/materials/youtube-metadata?url=not-a-url");

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        var body = await response.Content.ReadFromJsonAsync<YouTubeMetadataErrorResponse>();
        body.ShouldNotBeNull();
        body!.Code.ShouldBe("invalid_url");
    }

    [Fact]
    public async Task GetYouTubeMetadata_ShouldReturn200_WithMetadata_OnSuccess()
    {
        var dto = new YouTubeMetadataResponse(
            Provider: "youtube",
            VideoId: "dQw4w9WgXcQ",
            Title: "Never Gonna Give You Up",
            Author: "Rick Astley",
            ThumbnailUrl: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
            DurationSeconds: 212);

        using var owned = await CreateClientAsync(
            new FakeMetadataService(_ => new YouTubeMetadataResult.Success(dto)));
        var client = owned.Client;

        var response = await client.GetAsync(
            "/api/materials/youtube-metadata?url=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3DdQw4w9WgXcQ");

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<YouTubeMetadataResponse>();
        body.ShouldNotBeNull();
        body!.VideoId.ShouldBe("dQw4w9WgXcQ");
        body.Title.ShouldBe("Never Gonna Give You Up");
        body.DurationSeconds.ShouldBe(212);
    }

    [Fact]
    public async Task GetYouTubeMetadata_ShouldReturn404_WhenServiceReportsNotFound()
    {
        using var owned = await CreateClientAsync(new FakeMetadataService(_ =>
            new YouTubeMetadataResult.Failure(YouTubeMetadataErrorCode.VideoNotFound, "video_not_found")));
        var client = owned.Client;

        var response = await client.GetAsync(
            "/api/materials/youtube-metadata?url=https%3A%2F%2Fyoutu.be%2FdQw4w9WgXcQ");

        response.StatusCode.ShouldBe(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task GetYouTubeMetadata_ShouldReturn503_WhenQuotaExceeded()
    {
        using var owned = await CreateClientAsync(new FakeMetadataService(_ =>
            new YouTubeMetadataResult.Failure(YouTubeMetadataErrorCode.QuotaExceeded, "quota_exceeded")));
        var client = owned.Client;

        var response = await client.GetAsync(
            "/api/materials/youtube-metadata?url=https%3A%2F%2Fyoutu.be%2FdQw4w9WgXcQ");

        response.StatusCode.ShouldBe(HttpStatusCode.ServiceUnavailable);
    }

    [Fact]
    public async Task Response_ShouldIncludeSecurityHeaders()
    {
        var dto = new YouTubeMetadataResponse("youtube", "dQw4w9WgXcQ", "t", "a", "url", 0);
        using var owned = await CreateClientAsync(
            new FakeMetadataService(_ => new YouTubeMetadataResult.Success(dto)));
        var client = owned.Client;

        var response = await client.GetAsync(
            "/api/materials/youtube-metadata?url=https%3A%2F%2Fyoutu.be%2FdQw4w9WgXcQ");

        response.Headers.TryGetValues("X-Content-Type-Options", out var xcto).ShouldBeTrue();
        xcto!.ShouldContain("nosniff");

        response.Headers.TryGetValues("X-Frame-Options", out var xfo).ShouldBeTrue();
        xfo!.ShouldContain("DENY");

        response.Headers.TryGetValues("Referrer-Policy", out _).ShouldBeTrue();
        response.Headers.CacheControl.ShouldNotBeNull();
        response.Headers.CacheControl!.NoStore.ShouldBeTrue();
    }

    private async Task<OwnedClient> CreateClientAsync(IYouTubeMetadataService fakeService)
    {
        var factory = _factory.WithWebHostBuilder(builder =>
        {
            builder.ConfigureServices(services =>
            {
                services.RemoveAll<IYouTubeMetadataService>();
                services.AddSingleton(fakeService);
            });
        });
        var client = factory.CreateClient();
        var registration = await client.RegisterAsync(
            $"youtube-{Guid.NewGuid():N}@example.test");
        registration.EnsureSuccessStatusCode();
        registration.Dispose();
        return new OwnedClient(factory, client);
    }

    private sealed class FakeMetadataService : IYouTubeMetadataService
    {
        private readonly Func<string, YouTubeMetadataResult> _responder;

        public FakeMetadataService(Func<string, YouTubeMetadataResult> responder)
        {
            _responder = responder;
        }

        public Task<YouTubeMetadataResult> GetMetadataAsync(string url, CancellationToken cancellationToken)
        {
            return Task.FromResult(_responder(url));
        }
    }

    private sealed class OwnedClient : IDisposable
    {
        private readonly WebApplicationFactory<Program> _factory;

        public OwnedClient(WebApplicationFactory<Program> factory, HttpClient client)
        {
            _factory = factory;
            Client = client;
        }

        public HttpClient Client { get; }

        public void Dispose()
        {
            Client.Dispose();
            _factory.Dispose();
        }
    }
}
