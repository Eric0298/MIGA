using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Miga.Contracts.Auth;
using Miga.IntegrationTests.Infrastructure;
using Shouldly;

namespace Miga.IntegrationTests.Auth;

// Reproduces the /api/auth/csrf 500 the owner observed on Railway when the
// forwarded proxy is not trusted, and demonstrates the exact scenario that
// makes it disappear. See fix(security): trust Railway proxy for forwarded HTTPS.
public sealed class CsrfProxyTrustTests
{
    [Fact]
    public async Task Csrf_InProduction_WithoutTrustedProxy_Returns500_ThrowsInvalidOperationException()
    {
        await using var factory = new MigaProductionWebApplicationFactory();
        var client = factory.CreateClient();
        // Header would upgrade Scheme to https if the middleware trusted us,
        // but no trusted proxies are configured for this scenario.
        client.DefaultRequestHeaders.Add("X-Forwarded-Proto", "https");

        var response = await client.GetAsync("/api/auth/csrf");

        response.StatusCode.ShouldBe(HttpStatusCode.InternalServerError);

        // The redacted ApiExceptionHandler never leaks the message, but the
        // captured exception proves the failure mode is the antiforgery cookie
        // refusing to emit a Secure __Host-* cookie over an HTTP request.
        var captured = factory.Exceptions.Captured;
        captured.ShouldNotBeEmpty();
        var invalidOperation = captured
            .OfType<InvalidOperationException>()
            .FirstOrDefault();
        invalidOperation.ShouldNotBeNull();
        var message = invalidOperation!.Message;
        message.ShouldNotBeNullOrEmpty();
        // Assert on the recognisable substring rather than the exact wording,
        // which is a framework string and could vary across .NET patch releases.
        (message.Contains("HTTPS", StringComparison.OrdinalIgnoreCase) ||
         message.Contains("Secure", StringComparison.OrdinalIgnoreCase))
            .ShouldBeTrue($"Unexpected InvalidOperationException message: {message}");
    }

    [Fact]
    public async Task Csrf_InProduction_WithTrustedProxy_Returns200_IssuesSecureHostCookie()
    {
        await using var factory = new MigaProductionWebApplicationFactory(
            trustedProxyNetworks: new[] { "127.0.0.0/8", "::1/128" });
        var client = factory.CreateClient();
        client.DefaultRequestHeaders.Add("X-Forwarded-Proto", "https");

        var response = await client.GetAsync("/api/auth/csrf");
        if (response.StatusCode != HttpStatusCode.OK)
        {
            var captured = factory.Exceptions.Captured;
            var messages = string.Join(
                " | ",
                captured.Select(e => $"{e.GetType().Name}: {e.Message}"));
            throw new Xunit.Sdk.XunitException(
                $"Expected 200 but got {(int)response.StatusCode}. Captured: {messages}");
        }
        response.StatusCode.ShouldBe(HttpStatusCode.OK);

        var body = await response.Content.ReadFromJsonAsync<CsrfTokenResponse>();
        body.ShouldNotBeNull();
        body!.RequestToken.ShouldNotBeNullOrWhiteSpace();

        // __Host- prefix cookie MUST be Secure, HttpOnly, Path=/, no Domain.
        response.Headers.TryGetValues("Set-Cookie", out var setCookies).ShouldBeTrue();
        var antiforgeryCookie = setCookies!
            .FirstOrDefault(c => c.StartsWith("__Host-Miga.Antiforgery=", StringComparison.Ordinal));
        antiforgeryCookie.ShouldNotBeNullOrWhiteSpace();
        antiforgeryCookie!.ShouldContain("secure", Case.Insensitive);
        antiforgeryCookie.ShouldContain("httponly", Case.Insensitive);
        antiforgeryCookie.ShouldContain("path=/", Case.Insensitive);
        antiforgeryCookie.ShouldNotContain("domain=", Case.Insensitive);

        factory.Exceptions.Captured.ShouldBeEmpty();
    }

    [Fact]
    public async Task Csrf_InProduction_WithTrustedProxy_ButForgedProtoValue_DoesNotElevateScheme()
    {
        // If the trusted proxy forwards an unexpected/garbage value in
        // X-Forwarded-Proto (e.g., because an untrusted upstream injected it
        // and the proxy passed it through), the middleware must not treat
        // the request as HTTPS. We assert failure mode: still 500 because
        // Secure cookie can't be issued.
        await using var factory = new MigaProductionWebApplicationFactory(
            trustedProxyNetworks: new[] { "127.0.0.0/8", "::1/128" });
        var client = factory.CreateClient();
        client.DefaultRequestHeaders.Add("X-Forwarded-Proto", "gopher");

        var response = await client.GetAsync("/api/auth/csrf");

        response.StatusCode.ShouldBe(HttpStatusCode.InternalServerError);
        factory.Exceptions.Captured
            .OfType<InvalidOperationException>()
            .ShouldNotBeEmpty();
    }

    [Fact]
    public async Task Csrf_InProduction_WithoutTrustedProxy_HttpsRequest_Returns200()
    {
        // Direct HTTPS request (no proxy in the chain) must still work: the
        // scheme reaches the app as https without needing forwarded headers.
        await using var factory = new MigaProductionWebApplicationFactory();
        var client = factory.CreateClient(new Microsoft.AspNetCore.Mvc.Testing.WebApplicationFactoryClientOptions
        {
            BaseAddress = new Uri("https://localhost/")
        });

        var response = await client.GetAsync("/api/auth/csrf");
        response.StatusCode.ShouldBe(HttpStatusCode.OK);

        var setCookies = response.Headers.GetValues("Set-Cookie").ToArray();
        setCookies.Any(c => c.StartsWith("__Host-Miga.Antiforgery=", StringComparison.Ordinal))
            .ShouldBeTrue();
    }

    [Fact]
    public async Task Csrf_InProduction_HttpsRequest_IssuesUsableTokenForDemoAndRegister()
    {
        // Uses a direct https:// BaseAddress so HttpClient's CookieContainer
        // will actually round-trip the Secure __Host- antiforgery cookie set
        // by GET /api/auth/csrf back on the subsequent POSTs. The trusted
        // proxy configuration is kept for realism even though X-Forwarded-Proto
        // is not needed when the request already appears as HTTPS.
        await using var factory = new MigaProductionWebApplicationFactory(
            trustedProxyNetworks: new[] { "127.0.0.0/8", "::1/128" });
        var client = factory.CreateClient(new Microsoft.AspNetCore.Mvc.Testing.WebApplicationFactoryClientOptions
        {
            BaseAddress = new Uri("https://localhost/")
        });

        // Demo creation is the shortest CSRF-gated round-trip: it fetches a
        // token via GET /api/auth/csrf, posts with X-XSRF-TOKEN, and returns
        // 204. Reaching 204 proves antiforgery accepted both the cookie
        // (Secure, HttpOnly, __Host- prefix) and the header.
        var demoResponse = await client.PostWithCsrfAsync("/api/auth/demo");
        demoResponse.StatusCode.ShouldBe(HttpStatusCode.NoContent);

        // The register endpoint also participates in CSRF: fetching the token
        // and forwarding it must at minimum reach the controller instead of
        // being rejected as csrf_invalid by ApiAntiforgeryFilter. We assert
        // the response is NOT the csrf_invalid ProblemDetails payload; any
        // 200/2xx or downstream validation error is acceptable here.
        var registerResponse = await client.RegisterAsync(
            $"csrf-proxy-{Guid.NewGuid():N}@miga.example");
        var registerBody = await registerResponse.Content.ReadAsStringAsync();
        registerBody.ShouldNotContain("csrf_invalid");
        registerResponse.StatusCode.ShouldNotBe(HttpStatusCode.InternalServerError);

        factory.Exceptions.Captured.ShouldBeEmpty();
    }
}
