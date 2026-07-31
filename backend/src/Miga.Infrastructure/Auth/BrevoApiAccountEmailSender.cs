using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Miga.Application.Auth;
using Miga.Infrastructure.Security;

namespace Miga.Infrastructure.Auth;

// Sends account emails through the Brevo transactional HTTPS API. Railway's
// Trial/Hobby plans block outbound SMTP (25/587/465/2525), so relying on
// System.Net.Mail hangs at connect. This sender keeps the same IAccountEmailSender
// contract used by AccountEmailQueue but posts JSON to https://api.brevo.com/v3/smtp/email.
//
// Safety notes:
//   * The API key is never written to logs, exception messages, or response caches.
//   * Response bodies are not logged; they can echo the request payload including
//     the recipient email and confirmation URL.
//   * The BaseAddress and endpoint are compiled constants — no configuration
//     override can redirect the request (SSRF hardening).
public sealed class BrevoApiAccountEmailSender : IAccountEmailSender
{
    private static readonly JsonSerializerOptions RequestOptions = new(JsonSerializerDefaults.Web)
    {
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
    };
    private static readonly JsonSerializerOptions ResponseOptions = new(JsonSerializerDefaults.Web);

    private readonly HttpClient _httpClient;
    private readonly BrevoOptions _options;
    private readonly ILogger<BrevoApiAccountEmailSender> _logger;

    public BrevoApiAccountEmailSender(
        HttpClient httpClient,
        IOptions<BrevoOptions> options,
        ILogger<BrevoApiAccountEmailSender> logger)
    {
        _httpClient = httpClient;
        _options = options.Value;
        _logger = logger;
    }

    public bool IsConfigured => !string.IsNullOrWhiteSpace(_options.ApiKey);

    public Task SendEmailConfirmationAsync(
        string email,
        Uri confirmationUrl,
        CancellationToken cancellationToken) =>
        SendAsync(
            email,
            "Confirma tu cuenta de MIGA",
            $"Confirma tu cuenta abriendo este enlace:\n\n{confirmationUrl.AbsoluteUri}\n\n" +
            "El enlace caduca en 30 minutos. Si no solicitaste la cuenta, ignora este mensaje.",
            "email_confirmation",
            cancellationToken);

    public Task SendPasswordResetAsync(
        string email,
        Uri resetUrl,
        CancellationToken cancellationToken) =>
        SendAsync(
            email,
            "Restablece tu contraseña de MIGA",
            $"Restablece tu contraseña abriendo este enlace:\n\n{resetUrl.AbsoluteUri}\n\n" +
            "El enlace caduca en 30 minutos. Si no lo solicitaste, ignora este mensaje.",
            "password_reset",
            cancellationToken);

    private async Task SendAsync(
        string destination,
        string subject,
        string textContent,
        string jobKind,
        CancellationToken cancellationToken)
    {
        if (!IsConfigured)
        {
            throw new InvalidOperationException("Brevo API delivery is not configured.");
        }

        using var request = new HttpRequestMessage(HttpMethod.Post, BrevoOptions.SendEmailPath);
        request.Headers.TryAddWithoutValidation("api-key", _options.ApiKey);
        request.Headers.TryAddWithoutValidation("Accept", "application/json");
        request.Content = JsonContent.Create(
            new BrevoSendEmailRequest(
                new BrevoContact(_options.FromName, _options.FromAddress),
                new[] { new BrevoContact(null, destination) },
                subject,
                textContent),
            options: RequestOptions);

        HttpResponseMessage response;
        try
        {
            response = await _httpClient.SendAsync(request, cancellationToken);
        }
        catch (TaskCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            _logger.LogError(
                "Brevo API delivery timed out. Provider={Provider} Job={Job}",
                nameof(BrevoApiAccountEmailSender),
                jobKind);
            throw new BrevoDeliveryException("Brevo API request timed out.");
        }
        catch (HttpRequestException)
        {
            _logger.LogError(
                "Brevo API delivery failed to reach the transport. Provider={Provider} Job={Job}",
                nameof(BrevoApiAccountEmailSender),
                jobKind);
            throw new BrevoDeliveryException("Brevo API request failed at the transport layer.");
        }

        using (response)
        {
            var requestId = TryExtractRequestId(response);

            if (response.StatusCode != HttpStatusCode.Created)
            {
                _logger.LogError(
                    "Brevo API delivery rejected. Provider={Provider} Job={Job} Status={Status} " +
                    "ProviderRequestId={RequestId}",
                    nameof(BrevoApiAccountEmailSender),
                    jobKind,
                    (int)response.StatusCode,
                    requestId ?? "unknown");
                throw new BrevoDeliveryException(
                    $"Brevo API returned an unexpected status code: {(int)response.StatusCode}.");
            }

            BrevoSendEmailResponse? payload;
            try
            {
                payload = await response.Content.ReadFromJsonAsync<BrevoSendEmailResponse>(
                    ResponseOptions,
                    cancellationToken);
            }
            catch (JsonException)
            {
                _logger.LogError(
                    "Brevo API returned an unparseable response body. Provider={Provider} Job={Job} " +
                    "Status={Status} ProviderRequestId={RequestId}",
                    nameof(BrevoApiAccountEmailSender),
                    jobKind,
                    (int)response.StatusCode,
                    requestId ?? "unknown");
                throw new BrevoDeliveryException("Brevo API response was not valid JSON.");
            }

            if (payload is null || string.IsNullOrWhiteSpace(payload.MessageId))
            {
                _logger.LogError(
                    "Brevo API accepted the request but did not return a messageId. " +
                    "Provider={Provider} Job={Job} ProviderRequestId={RequestId}",
                    nameof(BrevoApiAccountEmailSender),
                    jobKind,
                    requestId ?? "unknown");
                throw new BrevoDeliveryException("Brevo API response did not include a messageId.");
            }
        }
    }

    private static string? TryExtractRequestId(HttpResponseMessage response)
    {
        if (!response.Headers.TryGetValues("X-Request-Id", out var values))
        {
            return null;
        }

        var value = values.FirstOrDefault();
        if (string.IsNullOrWhiteSpace(value) || value.Length > 128)
        {
            return null;
        }

        // Log only when the value is a safe token: printable ASCII, no control chars.
        foreach (var character in value)
        {
            if (character < 0x20 || character > 0x7E)
            {
                return null;
            }
        }

        return value;
    }

    private sealed record BrevoContact(
        [property: JsonPropertyName("name")] string? Name,
        [property: JsonPropertyName("email")] string Email);

    private sealed record BrevoSendEmailRequest(
        [property: JsonPropertyName("sender")] BrevoContact Sender,
        [property: JsonPropertyName("to")] IReadOnlyList<BrevoContact> To,
        [property: JsonPropertyName("subject")] string Subject,
        [property: JsonPropertyName("textContent")] string TextContent);

    private sealed record BrevoSendEmailResponse(
        [property: JsonPropertyName("messageId")] string? MessageId);
}

// Distinct exception type so AccountEmailQueue can log a safe generic error
// path for Brevo-specific failures without pulling HttpRequestException.Message
// (which may echo request state) into logs.
public sealed class BrevoDeliveryException : Exception
{
    public BrevoDeliveryException(string message) : base(message)
    {
    }
}
