using System.Collections.Concurrent;
using System.Net;
using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Http;
using Microsoft.Extensions.Options;
using Miga.Application.Auth;
using Miga.Infrastructure.Auth;
using Miga.IntegrationTests.Infrastructure;
using Shouldly;

namespace Miga.IntegrationTests.Auth;

// Exercises the Production DI wiring when EmailDelivery:Provider=BrevoApi:
//   * the resolved IAccountEmailSender is BrevoApiAccountEmailSender
//   * legacy SMTP variables can remain set without gating startup
//   * outbound calls are POST https://api.brevo.com/v3/smtp/email with the
//     api-key header, and expect an HTTP 201 with messageId
public sealed class BrevoApiProviderIntegrationTests
{
    private const string ApiKey = "xkeysib-integration-test-key";

    [Fact]
    public async Task BrevoApiProvider_Resolves_And_Posts_To_Brevo_Endpoint()
    {
        var handler = new RecordingHandler();
        await using var factory = new MigaProductionWebApplicationFactory(
            trustedProxyNetworks: new[] { "127.0.0.0/8", "::1/128" },
            configurationOverrides: new Dictionary<string, string?>
            {
                ["EmailDelivery:Provider"] = "BrevoApi",
                ["Brevo:ApiKey"] = ApiKey,
                ["Brevo:FromAddress"] = "no-reply@ericmancebo.com",
                ["Brevo:FromName"] = "MIGA",
                // Legacy SMTP variables intentionally left in place to prove
                // they do not gate startup when Provider=BrevoApi.
                ["Smtp:Enabled"] = "true",
                ["Smtp:Host"] = "smtp.legacy.example",
                ["Smtp:Port"] = "587",
                ["Smtp:UseSsl"] = "true",
                ["Smtp:Username"] = "user",
                ["Smtp:Password"] = "pass",
                ["Smtp:FromAddress"] = "no-reply@example.com"
            })
        {
            UseFakeAccountEmailSender = false
        };
        factory.HttpMessageHandlerBuilderOverride = builder =>
        {
            // AddHttpClient<T> uses TypeNameHelper.GetTypeDisplayName(T), which is
            // the un-namespaced C# type name. Match on Contains for resilience.
            if (builder.Name.Contains(nameof(BrevoApiAccountEmailSender), StringComparison.Ordinal))
            {
                builder.PrimaryHandler = handler;
                // Additional handlers can wrap PrimaryHandler; drop them so no
                // real network call slips through.
                builder.AdditionalHandlers.Clear();
            }
        };

        // Trigger the DI graph and grab the concrete sender.
        using var scope = factory.Services.CreateScope();
        var sender = scope.ServiceProvider.GetRequiredService<IAccountEmailSender>();
        sender.ShouldBeOfType<BrevoApiAccountEmailSender>();
        sender.IsConfigured.ShouldBeTrue();

        await sender.SendEmailConfirmationAsync(
            "user@example.com",
            new Uri("https://miga.example/verificar-email#userId=abc&token=xyz"),
            CancellationToken.None);

        handler.Requests.Count.ShouldBe(1);
        var request = handler.Requests[0];
        request.Method.ShouldBe(HttpMethod.Post);
        request.RequestUri!.Host.ShouldBe("api.brevo.com");
        request.RequestUri.Scheme.ShouldBe("https");
        request.RequestUri.AbsolutePath.ShouldBe("/v3/smtp/email");
        request.Headers["api-key"].Single().ShouldBe(ApiKey);

        var payload = JsonNode.Parse(request.Body)!.AsObject();
        payload["sender"]!["email"]!.GetValue<string>().ShouldBe("no-reply@ericmancebo.com");
        payload["to"]!.AsArray().Single()!["email"]!.GetValue<string>().ShouldBe("user@example.com");
        payload["subject"]!.GetValue<string>().ShouldBe("Confirma tu cuenta de MIGA");
        payload["textContent"]!.GetValue<string>().ShouldContain("verificar-email");
    }

    private sealed class RecordingHandler : HttpMessageHandler
    {
        public ConcurrentBag<RecordedRequest> _recorded = new();

        public IReadOnlyList<RecordedRequest> Requests => _recorded.ToArray();

        protected override async Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request,
            CancellationToken cancellationToken)
        {
            var body = request.Content is null
                ? string.Empty
                : await request.Content.ReadAsStringAsync(cancellationToken);
            _recorded.Add(new RecordedRequest(
                request.Method,
                request.RequestUri,
                request.Headers.ToDictionary(h => h.Key, h => h.Value.ToList()),
                body));
            var response = new HttpResponseMessage(HttpStatusCode.Created);
            response.Content = new StringContent(
                JsonSerializer.Serialize(new { messageId = "<accepted>" }),
                System.Text.Encoding.UTF8,
                "application/json");
            return response;
        }
    }

    private sealed record RecordedRequest(
        HttpMethod Method,
        Uri? RequestUri,
        Dictionary<string, List<string>> Headers,
        string Body);
}
