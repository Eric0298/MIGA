using System.Net;
using Microsoft.AspNetCore.Mvc.Testing;
using Shouldly;

namespace Miga.IntegrationTests;

public sealed class HealthEndpointTest : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly HttpClient _client;

    public HealthEndpointTest(WebApplicationFactory<Program> factory)
    {
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task GetHealth_ShouldReturnHealthyResponse()
    {
        var response = await _client.GetAsync("/api/health");

        response.StatusCode.ShouldBe(HttpStatusCode.OK);

        var content = await response.Content.ReadAsStringAsync();

        content.ShouldContain("healthy");
        content.ShouldContain("Miga.Api");
    }
}