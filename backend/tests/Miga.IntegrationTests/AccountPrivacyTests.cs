using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Miga.Infrastructure.Persistence;
using Miga.IntegrationTests.Infrastructure;
using Shouldly;

namespace Miga.IntegrationTests;

public sealed class AccountPrivacyTests
{
    [Fact]
    public async Task Export_ShouldRequireRecentAuthentication_AndExcludeCredentialMaterial()
    {
        using var factory = new MigaWebApplicationFactory();
        using var client = factory.CreateClient();
        var email = UniqueEmail();
        using var register = await client.RegisterAsync(email);
        register.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        var preReauthenticationCookie = register.Headers.GetValues("Set-Cookie")
            .Single(value => value.StartsWith("Miga.Auth=", StringComparison.Ordinal))
            .Split(';', 2)[0];

        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<MigaDbContext>();
            var session = await db.UserSessions.SingleAsync();
            session.LastReauthenticatedAtUtc = DateTimeOffset.UtcNow.AddHours(-1);
            await db.SaveChangesAsync();
        }

        using var staleExport = await client.GetAsync("/api/account/export");
        staleExport.StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        (await staleExport.Content.ReadAsStringAsync()).ShouldContain("reauthentication_required");

        using var reauthenticate = await client.PostWithCsrfAsync(
            "/api/auth/reauthenticate",
            new { currentPassword = ApiClientExtensions.ValidPassword });
        reauthenticate.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        using var export = await client.GetAsync("/api/account/export");
        export.StatusCode.ShouldBe(HttpStatusCode.OK);
        export.Headers.CacheControl.ShouldNotBeNull();
        export.Headers.CacheControl!.NoStore.ShouldBeTrue();
        var exportBody = await export.Content.ReadAsStringAsync();
        exportBody.ShouldContain(email);
        exportBody.ShouldContain("\"version\":7");
        exportBody.ShouldNotContain("passwordHash", Case.Insensitive);
        exportBody.ShouldNotContain("securityStamp", Case.Insensitive);
        exportBody.ShouldNotContain("token", Case.Insensitive);

        using var replayClient = factory.CreateClient(
            new Microsoft.AspNetCore.Mvc.Testing.WebApplicationFactoryClientOptions
            {
                HandleCookies = false
            });
        replayClient.DefaultRequestHeaders.Add("Cookie", preReauthenticationCookie);
        var replayedSession =
            await replayClient.GetFromJsonAsync<Miga.Contracts.Auth.SessionResponse>(
                "/api/auth/session");
        replayedSession!.Authenticated.ShouldBeFalse();
    }

    [Fact]
    public async Task Delete_ShouldRemoveAccountData_ButRetainMinimalAuditEvent()
    {
        using var factory = new MigaWebApplicationFactory();
        using var client = factory.CreateClient();
        using var register = await client.RegisterAsync(UniqueEmail());
        register.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        var oldCookie = register.Headers.GetValues("Set-Cookie")
            .Single(value => value.StartsWith("Miga.Auth=", StringComparison.Ordinal))
            .Split(';', 2)[0];

        using var rejected = await client.DeleteWithCsrfAsync(
            "/api/account",
            new
            {
                currentPassword = ApiClientExtensions.ValidPassword,
                confirmation = "delete"
            });
        rejected.StatusCode.ShouldBe(HttpStatusCode.BadRequest);

        using var deleted = await client.DeleteWithCsrfAsync(
            "/api/account",
            new
            {
                currentPassword = ApiClientExtensions.ValidPassword,
                confirmation = "DELETE"
            });
        deleted.StatusCode.ShouldBe(HttpStatusCode.NoContent);

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<MigaDbContext>();
        (await db.Users.CountAsync()).ShouldBe(0);
        (await db.Workspaces.CountAsync()).ShouldBe(0);
        (await db.UserSessions.CountAsync()).ShouldBe(0);
        var audit = await db.SecurityAuditEvents
            .SingleAsync(x => x.EventType == "account.deleted");
        audit.ActorId.ShouldNotBeNull();
        audit.ActorType.ShouldBe("registered");

        using var replayClient = factory.CreateClient(
            new Microsoft.AspNetCore.Mvc.Testing.WebApplicationFactoryClientOptions
            {
                HandleCookies = false
            });
        replayClient.DefaultRequestHeaders.Add("Cookie", oldCookie);
        var replayedSession =
            await replayClient.GetFromJsonAsync<Miga.Contracts.Auth.SessionResponse>(
                "/api/auth/session");
        replayedSession!.Authenticated.ShouldBeFalse();
    }

    [Fact]
    public async Task Delete_WithWrongPassword_ShouldBeAuditedAndRateLimitedPerSession()
    {
        using var factory = new MigaWebApplicationFactory();
        using var client = factory.CreateClient();
        using var register = await client.RegisterAsync(UniqueEmail());
        register.StatusCode.ShouldBe(HttpStatusCode.NoContent);

        HttpResponseMessage? response = null;
        for (var attempt = 0; attempt < 11; attempt++)
        {
            response?.Dispose();
            response = await client.DeleteWithCsrfAsync(
                "/api/account",
                new
                {
                    currentPassword = "Wrong-but-long-password-1459",
                    confirmation = "DELETE"
                });
        }

        using (response)
        {
            response.ShouldNotBeNull();
            response!.StatusCode.ShouldBe(HttpStatusCode.TooManyRequests);
            (await response.Content.ReadAsStringAsync()).ShouldContain("rate_limited");
            response.Headers.CacheControl.ShouldNotBeNull();
            response.Headers.CacheControl!.NoStore.ShouldBeTrue();
        }

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<MigaDbContext>();
        (await db.SecurityAuditEvents.CountAsync(audit =>
                audit.EventType == "account.delete" &&
                audit.Outcome == "failure"))
            .ShouldBe(10);
        (await db.Users.CountAsync()).ShouldBe(1);
    }

    private static string UniqueEmail() =>
        $"privacy-{Guid.NewGuid():N}@example.test";
}
