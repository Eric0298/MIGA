using System.Net;
using Miga.IntegrationTests.Infrastructure;
using Shouldly;

namespace Miga.IntegrationTests;

public sealed class CorsAndDatabaseHealthSecurityTests
{
    [Fact]
    public async Task CorsPreflight_ShouldAllowOnlyConfiguredOrigin()
    {
        using var factory = new MigaWebApplicationFactory();
        using var client = factory.CreateClient();

        using var allowedRequest = Preflight("http://localhost:5173");
        using var allowed = await client.SendAsync(allowedRequest);
        allowed.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        allowed.Headers.GetValues("Access-Control-Allow-Origin")
            .ShouldBe(["http://localhost:5173"]);
        allowed.Headers.GetValues("Access-Control-Allow-Credentials")
            .ShouldBe(["true"]);

        using var rejectedRequest = Preflight("https://attacker.example");
        using var rejected = await client.SendAsync(rejectedRequest);
        rejected.Headers.Contains("Access-Control-Allow-Origin").ShouldBeFalse();
        rejected.Headers.Contains("Access-Control-Allow-Credentials").ShouldBeFalse();
    }

    [Fact]
    public async Task DatabaseHealth_ShouldBeHiddenByDefault()
    {
        using var factory = new MigaWebApplicationFactory();
        using var client = factory.CreateClient();

        using var response = await client.GetAsync("/api/health/db");

        response.StatusCode.ShouldBe(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task DatabaseHealth_WhenExplicitlyEnabled_ShouldReportConnectivity()
    {
        using var factory = new MigaWebApplicationFactory(
            requireConfirmedEmail: false,
            exposeDatabaseHealth: true);
        using var client = factory.CreateClient();

        using var response = await client.GetAsync("/api/health/db");

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        (await response.Content.ReadAsStringAsync()).ShouldContain("\"canConnect\":true");
    }

    [Fact]
    public async Task DatabaseHealth_WhenDependencyIsUnavailable_ShouldReturnServiceUnavailable()
    {
        using var factory = new MigaWebApplicationFactory(
            requireConfirmedEmail: false,
            exposeDatabaseHealth: true);
        using var client = factory.CreateClient();
        factory.MakeDatabaseUnavailable();

        using var response = await client.GetAsync("/api/health/db");

        response.StatusCode.ShouldBe(HttpStatusCode.ServiceUnavailable);
        var body = await response.Content.ReadAsStringAsync();
        body.ShouldContain("\"status\":\"unhealthy\"");
        body.ShouldContain("\"canConnect\":false");
    }

    private static HttpRequestMessage Preflight(string origin)
    {
        var request = new HttpRequestMessage(HttpMethod.Options, "/api/health");
        request.Headers.Add("Origin", origin);
        request.Headers.Add("Access-Control-Request-Method", "GET");
        return request;
    }
}
