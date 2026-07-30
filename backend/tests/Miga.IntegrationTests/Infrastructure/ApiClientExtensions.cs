using System.Net.Http.Json;
using Miga.Contracts.Auth;

namespace Miga.IntegrationTests.Infrastructure;

internal static class ApiClientExtensions
{
    internal const string ValidPassword = "Miga!Long-Unique-Passphrase-7429";

    public static async Task<HttpResponseMessage> SendWithCsrfAsync(
        this HttpClient client,
        HttpMethod method,
        string requestUri,
        object? body = null)
    {
        using var csrfResponse = await client.GetAsync("/api/auth/csrf");
        csrfResponse.EnsureSuccessStatusCode();
        var csrf = await csrfResponse.Content.ReadFromJsonAsync<CsrfTokenResponse>();
        if (string.IsNullOrEmpty(csrf?.RequestToken))
        {
            throw new InvalidOperationException("The test server did not issue a CSRF token.");
        }

        using var request = new HttpRequestMessage(method, requestUri);
        request.Headers.Add("X-XSRF-TOKEN", csrf.RequestToken);
        if (body is not null)
        {
            request.Content = JsonContent.Create(body);
        }

        return await client.SendAsync(request);
    }

    public static Task<HttpResponseMessage> PostWithCsrfAsync(
        this HttpClient client,
        string requestUri,
        object? body = null) =>
        client.SendWithCsrfAsync(HttpMethod.Post, requestUri, body);

    public static Task<HttpResponseMessage> DeleteWithCsrfAsync(
        this HttpClient client,
        string requestUri,
        object? body = null) =>
        client.SendWithCsrfAsync(HttpMethod.Delete, requestUri, body);

    public static Task<HttpResponseMessage> RegisterAsync(
        this HttpClient client,
        string email,
        bool importDemoData = false) =>
        client.PostWithCsrfAsync(
            "/api/auth/register",
            new
            {
                email,
                password = ValidPassword,
                privacyPolicyVersion = "2026-07-23",
                importDemoData
            });

    public static IReadOnlyDictionary<string, string> ParseFragment(Uri uri) =>
        uri.Fragment
            .TrimStart('#')
            .Split('&', StringSplitOptions.RemoveEmptyEntries)
            .Select(pair => pair.Split('=', 2))
            .ToDictionary(
                pair => Uri.UnescapeDataString(pair[0]),
                pair => Uri.UnescapeDataString(pair[1]),
                StringComparer.Ordinal);
}
