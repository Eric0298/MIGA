using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Miga.Contracts.Account;
using Miga.Domain.Entities;
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

    [Fact]
    public async Task SessionManagement_ShouldRevokeOwnedSessionsAndRejectCookieReplay()
    {
        using var factory = new MigaWebApplicationFactory();
        using var primary = factory.CreateClient();
        using var secondary = factory.CreateClient();
        using var tertiary = factory.CreateClient();
        var email = UniqueEmail();
        using var register = await primary.RegisterAsync(email);
        register.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        using var secondaryLogin = await secondary.PostWithCsrfAsync(
            "/api/auth/login",
            new { email, password = ApiClientExtensions.ValidPassword });
        using var tertiaryLogin = await tertiary.PostWithCsrfAsync(
            "/api/auth/login",
            new { email, password = ApiClientExtensions.ValidPassword });
        secondaryLogin.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        tertiaryLogin.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        var secondaryCookie = secondaryLogin.Headers.GetValues("Set-Cookie")
            .Single(value => value.StartsWith("Miga.Auth=", StringComparison.Ordinal))
            .Split(';', 2)[0];

        var sessions = await primary.GetFromJsonAsync<List<AccountSessionResponse>>(
            "/api/account/sessions");
        sessions.ShouldNotBeNull();
        sessions.Count.ShouldBe(3);
        sessions.Count(session => session.Current).ShouldBe(1);
        var secondarySessionId = sessions
            .Where(session => !session.Current)
            .OrderBy(session => session.CreatedAtUtc)
            .First()
            .SessionId;

        using var missingCsrf = await primary.DeleteAsync(
            $"/api/account/sessions/{secondarySessionId}");
        missingCsrf.StatusCode.ShouldBe(HttpStatusCode.BadRequest);

        using var revoked = await primary.DeleteWithCsrfAsync(
            $"/api/account/sessions/{secondarySessionId}");
        revoked.StatusCode.ShouldBe(HttpStatusCode.NoContent);

        using var replay = factory.CreateClient(
            new Microsoft.AspNetCore.Mvc.Testing.WebApplicationFactoryClientOptions
            {
                HandleCookies = false
            });
        replay.DefaultRequestHeaders.Add("Cookie", secondaryCookie);
        var replayed = await replay.GetFromJsonAsync<Miga.Contracts.Auth.SessionResponse>(
            "/api/auth/session");
        replayed!.Authenticated.ShouldBeFalse();

        using var revokeOthers = await primary.DeleteWithCsrfAsync(
            "/api/account/sessions/others");
        revokeOthers.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        (await tertiary.GetFromJsonAsync<Miga.Contracts.Auth.SessionResponse>(
                "/api/auth/session"))!
            .Authenticated
            .ShouldBeFalse();
        (await primary.GetFromJsonAsync<Miga.Contracts.Auth.SessionResponse>(
                "/api/auth/session"))!
            .Authenticated
            .ShouldBeTrue();

        var remaining = await primary.GetFromJsonAsync<List<AccountSessionResponse>>(
            "/api/account/sessions");
        remaining!.Count.ShouldBe(1);
        remaining.Single().Current.ShouldBeTrue();
    }

    [Fact]
    public async Task SessionRevocation_ShouldNotRevealOrRevokeAnotherAccountsSession()
    {
        using var factory = new MigaWebApplicationFactory();
        using var first = factory.CreateClient();
        using var second = factory.CreateClient();
        using var firstRegistration = await first.RegisterAsync(UniqueEmail());
        using var secondRegistration = await second.RegisterAsync(UniqueEmail());
        firstRegistration.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        secondRegistration.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        var secondSessions = await second.GetFromJsonAsync<List<AccountSessionResponse>>(
            "/api/account/sessions");
        var secondSessionId = secondSessions!.Single().SessionId;

        using var rejected = await first.DeleteWithCsrfAsync(
            $"/api/account/sessions/{secondSessionId}");

        rejected.StatusCode.ShouldBe(HttpStatusCode.NotFound);
        (await second.GetFromJsonAsync<Miga.Contracts.Auth.SessionResponse>(
                "/api/auth/session"))!
            .Authenticated
            .ShouldBeTrue();
    }

    [Fact]
    public async Task SessionListing_ShouldPurgeOnlyExpiredOrRevokedRowsAndPreserveActiveSessions()
    {
        using var factory = new MigaWebApplicationFactory();
        using var primary = factory.CreateClient();
        using var other = factory.CreateClient();
        var primaryEmail = UniqueEmail();
        var otherEmail = UniqueEmail();
        using var primaryRegistration = await primary.RegisterAsync(primaryEmail);
        using var otherRegistration = await other.RegisterAsync(otherEmail);
        primaryRegistration.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        otherRegistration.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        Guid primaryActiveSessionId;
        Guid otherActiveSessionId;
        var expiredSessionId = Guid.CreateVersion7();
        var revokedSessionId = Guid.CreateVersion7();
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<MigaDbContext>();
            var primaryUser = await db.Users.SingleAsync(user => user.Email == primaryEmail);
            var otherUser = await db.Users.SingleAsync(user => user.Email == otherEmail);
            primaryActiveSessionId = await db.UserSessions
                .Where(session => session.UserId == primaryUser.Id)
                .Select(session => session.Id)
                .SingleAsync();
            otherActiveSessionId = await db.UserSessions
                .Where(session => session.UserId == otherUser.Id)
                .Select(session => session.Id)
                .SingleAsync();
            var now = DateTimeOffset.UtcNow;
            db.UserSessions.AddRange(
                new UserSession
                {
                    Id = expiredSessionId,
                    UserId = primaryUser.Id,
                    SecurityStampAtIssue = primaryUser.SecurityStamp!,
                    CreatedAtUtc = now.AddDays(-2),
                    LastSeenAtUtc = now.AddDays(-2),
                    IdleExpiresAtUtc = now.AddMinutes(-1),
                    AbsoluteExpiresAtUtc = now.AddDays(1),
                    LastReauthenticatedAtUtc = now.AddDays(-2)
                },
                new UserSession
                {
                    Id = revokedSessionId,
                    UserId = otherUser.Id,
                    SecurityStampAtIssue = otherUser.SecurityStamp!,
                    CreatedAtUtc = now.AddDays(-1),
                    LastSeenAtUtc = now.AddDays(-1),
                    IdleExpiresAtUtc = now.AddHours(1),
                    AbsoluteExpiresAtUtc = now.AddDays(1),
                    LastReauthenticatedAtUtc = now.AddDays(-1),
                    RevokedAtUtc = now.AddMinutes(-1)
                });
            await db.SaveChangesAsync();
        }

        var sessions = await primary.GetFromJsonAsync<List<AccountSessionResponse>>(
            "/api/account/sessions");

        sessions.ShouldNotBeNull();
        sessions.Count.ShouldBe(1);
        sessions.Single().SessionId.ShouldBe(primaryActiveSessionId);
        sessions.Single().Current.ShouldBeTrue();
        using var assertionScope = factory.Services.CreateScope();
        var assertionDb = assertionScope.ServiceProvider.GetRequiredService<MigaDbContext>();
        var survivingSessionIds = await assertionDb.UserSessions
            .AsNoTracking()
            .Select(session => session.Id)
            .ToListAsync();
        survivingSessionIds.Count.ShouldBe(2);
        survivingSessionIds.ShouldContain(primaryActiveSessionId);
        survivingSessionIds.ShouldContain(otherActiveSessionId);
        survivingSessionIds.ShouldNotContain(expiredSessionId);
        survivingSessionIds.ShouldNotContain(revokedSessionId);
    }

    [Fact]
    public async Task AccountController_ShouldRejectBodiesLargerThanSixteenKiB()
    {
        using var factory = new MigaWebApplicationFactory();
        using var client = factory.CreateClient();
        using var registration = await client.RegisterAsync(UniqueEmail());
        registration.StatusCode.ShouldBe(HttpStatusCode.NoContent);

        using var response = await client.DeleteWithCsrfAsync(
            "/api/account",
            new
            {
                currentPassword = new string('x', 17 * 1024),
                confirmation = "DELETE"
            });

        response.StatusCode.ShouldBe(HttpStatusCode.RequestEntityTooLarge);
    }

    private static string UniqueEmail() =>
        $"privacy-{Guid.NewGuid():N}@example.test";
}
