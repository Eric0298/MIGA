using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Miga.Infrastructure.Auth;
using Miga.Infrastructure.Security;
using Shouldly;

namespace Miga.UnitTests.Auth;

public sealed class BrevoApiAccountEmailSenderTests
{
    private const string ApiKey = "xkeysib-unit-tests-key-do-not-leak";
    private const string From = "no-reply@ericmancebo.com";
    private const string FromName = "MIGA";
    private const string Recipient = "user@example.com";
    private static readonly Uri ConfirmationUrl = new("https://miga.example/verificar-email#userId=abc&token=xyz");
    private static readonly Uri ResetUrl = new("https://miga.example/restablecer#email=user%40example.com&token=xyz");

    [Fact]
    public async Task SendConfirmation_PostsToBrevoApiWithExpectedShape()
    {
        HttpRequestMessage? captured = null;
        var handler = new StubHttpMessageHandler(async (request, cancellationToken) =>
        {
            captured = await CloneRequestAsync(request, cancellationToken);
            return new HttpResponseMessage(HttpStatusCode.Created)
            {
                Content = JsonContent.Create(new { messageId = "<abc-123>" })
            };
        });
        var sender = CreateSender(handler);

        await sender.SendEmailConfirmationAsync(Recipient, ConfirmationUrl, CancellationToken.None);

        captured.ShouldNotBeNull();
        captured!.Method.ShouldBe(HttpMethod.Post);
        captured.RequestUri.ShouldNotBeNull();
        captured.RequestUri!.Host.ShouldBe("api.brevo.com");
        captured.RequestUri.Scheme.ShouldBe("https");
        captured.RequestUri.AbsolutePath.ShouldBe("/v3/smtp/email");
        captured.Headers.Contains("api-key").ShouldBeTrue();
        captured.Headers.GetValues("api-key").Single().ShouldBe(ApiKey);
        captured.Headers.Accept.ToString().ShouldContain("application/json");

        var payload = JsonNode.Parse(await captured.Content!.ReadAsStringAsync())!.AsObject();
        payload["sender"]!["name"]!.GetValue<string>().ShouldBe(FromName);
        payload["sender"]!["email"]!.GetValue<string>().ShouldBe(From);
        payload["to"]!.AsArray().Single()!["email"]!.GetValue<string>().ShouldBe(Recipient);
        payload["subject"]!.GetValue<string>().ShouldBe("Confirma tu cuenta de MIGA");
        payload["textContent"]!.GetValue<string>().ShouldContain(ConfirmationUrl.AbsoluteUri);
    }

    [Fact]
    public async Task SendPasswordReset_UsesResetSubjectAndUrl()
    {
        HttpRequestMessage? captured = null;
        var handler = new StubHttpMessageHandler(async (request, cancellationToken) =>
        {
            captured = await CloneRequestAsync(request, cancellationToken);
            return new HttpResponseMessage(HttpStatusCode.Created)
            {
                Content = JsonContent.Create(new { messageId = "<def-456>" })
            };
        });
        var sender = CreateSender(handler);

        await sender.SendPasswordResetAsync(Recipient, ResetUrl, CancellationToken.None);

        captured.ShouldNotBeNull();
        var payload = JsonNode.Parse(await captured!.Content!.ReadAsStringAsync())!.AsObject();
        payload["subject"]!.GetValue<string>().ShouldBe("Restablece tu contraseña de MIGA");
        payload["textContent"]!.GetValue<string>().ShouldContain(ResetUrl.AbsoluteUri);
    }

    [Fact]
    public async Task ClientDoesNotFollowRedirects()
    {
        // The sender's transport-level handler is configured with
        // AllowAutoRedirect=false; treat any 302 as a hard failure.
        var handler = new StubHttpMessageHandler((_, _) =>
            Task.FromResult(new HttpResponseMessage(HttpStatusCode.Redirect)
            {
                Headers = { Location = new Uri("https://evil.example/steal") }
            }));
        var sender = CreateSender(handler, allowAutoRedirect: false);

        var exception = await Should.ThrowAsync<BrevoDeliveryException>(
            () => sender.SendEmailConfirmationAsync(Recipient, ConfirmationUrl, CancellationToken.None));
        exception.Message.ShouldNotContain(ApiKey);
        exception.Message.ShouldNotContain(Recipient);
    }

    [Fact]
    public async Task Timeout_ThrowsSafeExceptionWithoutSecrets()
    {
        var handler = new StubHttpMessageHandler(async (_, cancellationToken) =>
        {
            await Task.Delay(TimeSpan.FromSeconds(30), cancellationToken);
            return new HttpResponseMessage(HttpStatusCode.Created);
        });
        var sender = CreateSender(handler, timeout: TimeSpan.FromMilliseconds(100));

        var exception = await Should.ThrowAsync<BrevoDeliveryException>(
            () => sender.SendEmailConfirmationAsync(Recipient, ConfirmationUrl, CancellationToken.None));
        exception.Message.ShouldContain("timed out", Case.Insensitive);
        exception.Message.ShouldNotContain(ApiKey);
        exception.Message.ShouldNotContain(Recipient);
        exception.Message.ShouldNotContain(ConfirmationUrl.AbsoluteUri);
    }

    [Theory]
    [InlineData(HttpStatusCode.BadRequest)]
    [InlineData(HttpStatusCode.Unauthorized)]
    [InlineData(HttpStatusCode.Forbidden)]
    [InlineData(HttpStatusCode.TooManyRequests)]
    [InlineData(HttpStatusCode.InternalServerError)]
    public async Task NonCreatedStatus_ThrowsSafeException(HttpStatusCode statusCode)
    {
        var handler = new StubHttpMessageHandler((_, _) =>
            Task.FromResult(new HttpResponseMessage(statusCode)
            {
                Content = new StringContent(
                    $$"""{"message":"body should not be logged","apiKey":"{{ApiKey}}"}""",
                    System.Text.Encoding.UTF8,
                    "application/json")
            }));
        var sender = CreateSender(handler);

        var exception = await Should.ThrowAsync<BrevoDeliveryException>(
            () => sender.SendEmailConfirmationAsync(Recipient, ConfirmationUrl, CancellationToken.None));
        exception.Message.ShouldContain(((int)statusCode).ToString());
        exception.Message.ShouldNotContain(ApiKey);
        exception.Message.ShouldNotContain(Recipient);
    }

    [Fact]
    public async Task Created_WithoutMessageId_ThrowsSafeException()
    {
        var handler = new StubHttpMessageHandler((_, _) =>
            Task.FromResult(new HttpResponseMessage(HttpStatusCode.Created)
            {
                Content = JsonContent.Create(new { other = "value" })
            }));
        var sender = CreateSender(handler);

        var exception = await Should.ThrowAsync<BrevoDeliveryException>(
            () => sender.SendEmailConfirmationAsync(Recipient, ConfirmationUrl, CancellationToken.None));
        exception.Message.ShouldContain("messageId");
    }

    [Fact]
    public async Task Created_WithInvalidJson_ThrowsSafeException()
    {
        var handler = new StubHttpMessageHandler((_, _) =>
            Task.FromResult(new HttpResponseMessage(HttpStatusCode.Created)
            {
                Content = new StringContent(
                    "this is not JSON",
                    System.Text.Encoding.UTF8,
                    "application/json")
            }));
        var sender = CreateSender(handler);

        var exception = await Should.ThrowAsync<BrevoDeliveryException>(
            () => sender.SendEmailConfirmationAsync(Recipient, ConfirmationUrl, CancellationToken.None));
        exception.Message.ShouldContain("JSON");
    }

    private static BrevoApiAccountEmailSender CreateSender(
        HttpMessageHandler handler,
        TimeSpan? timeout = null,
        bool allowAutoRedirect = false)
    {
        _ = allowAutoRedirect;
        var httpClient = new HttpClient(handler, disposeHandler: false)
        {
            BaseAddress = BrevoOptions.BaseAddress,
            Timeout = timeout ?? TimeSpan.FromSeconds(15)
        };
        var options = Options.Create(new BrevoOptions
        {
            ApiKey = ApiKey,
            FromAddress = From,
            FromName = FromName
        });
        return new BrevoApiAccountEmailSender(
            httpClient,
            options,
            NullLogger<BrevoApiAccountEmailSender>.Instance);
    }

    private static async Task<HttpRequestMessage> CloneRequestAsync(
        HttpRequestMessage request,
        CancellationToken cancellationToken)
    {
        var clone = new HttpRequestMessage(request.Method, request.RequestUri);
        foreach (var header in request.Headers)
        {
            clone.Headers.TryAddWithoutValidation(header.Key, header.Value);
        }

        if (request.Content is not null)
        {
            var body = await request.Content.ReadAsStringAsync(cancellationToken);
            clone.Content = new StringContent(
                body,
                System.Text.Encoding.UTF8,
                request.Content.Headers.ContentType?.MediaType ?? "application/json");
            foreach (var header in request.Content.Headers)
            {
                clone.Content.Headers.TryAddWithoutValidation(header.Key, header.Value);
            }
        }

        return clone;
    }

    private sealed class StubHttpMessageHandler : HttpMessageHandler
    {
        private readonly Func<HttpRequestMessage, CancellationToken, Task<HttpResponseMessage>> _handler;

        public StubHttpMessageHandler(
            Func<HttpRequestMessage, CancellationToken, Task<HttpResponseMessage>> handler)
        {
            _handler = handler;
        }

        protected override Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request,
            CancellationToken cancellationToken) =>
            _handler(request, cancellationToken);
    }
}
