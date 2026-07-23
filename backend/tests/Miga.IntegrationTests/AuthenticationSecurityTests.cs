using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Miga.Contracts.Auth;
using Miga.Infrastructure.Auth;
using Miga.Infrastructure.Persistence;
using Miga.IntegrationTests.Infrastructure;
using Shouldly;

namespace Miga.IntegrationTests;

public sealed class AuthenticationSecurityTests
{
    [Fact]
    public async Task Register_WhenConfirmationIsOptional_ShouldSignInWithoutClaimingConfirmation()
    {
        using var factory = new MigaWebApplicationFactory();
        using var client = factory.CreateClient();
        var email = UniqueEmail();

        using var register = await client.RegisterAsync(email);

        register.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        var authCookie = register.Headers.GetValues("Set-Cookie")
            .Single(value => value.StartsWith("Miga.Auth=", StringComparison.Ordinal));
        authCookie.ShouldContain("httponly", Case.Insensitive);
        authCookie.ShouldContain("samesite=lax", Case.Insensitive);
        authCookie.ShouldContain("path=/", Case.Insensitive);

        var session = await client.GetFromJsonAsync<SessionResponse>("/api/auth/session");
        session.ShouldNotBeNull();
        session.Authenticated.ShouldBeTrue();
        session.AccountType.ShouldBe("registered");
        session.Email.ShouldBe(email);
        session.EmailConfirmed.ShouldBeNull();

        using var scope = factory.Services.CreateScope();
        var storedUser = await scope.ServiceProvider
            .GetRequiredService<MigaDbContext>()
            .Users
            .SingleAsync(x => x.Email == email);
        storedUser.EmailConfirmed.ShouldBeFalse();
    }

    [Fact]
    public async Task UnsafeEndpoint_WithoutCsrf_ShouldReturnStableProblem()
    {
        using var factory = new MigaWebApplicationFactory();
        using var client = factory.CreateClient();

        using var rejected = await client.PostAsJsonAsync("/api/auth/demo", new { });

        rejected.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        var problem = await rejected.Content.ReadFromJsonAsync<ProblemDetails>();
        problem.ShouldNotBeNull();
        problem!.Extensions["code"]!.ToString().ShouldBe("csrf_invalid");

        using var accepted = await client.PostWithCsrfAsync("/api/auth/demo", new { });
        accepted.StatusCode.ShouldBe(HttpStatusCode.NoContent);
    }

    [Fact]
    public async Task Logout_ShouldRevokeServerSession_EvenIfOldCookieIsReplayed()
    {
        using var factory = new MigaWebApplicationFactory();
        using var client = factory.CreateClient();
        using var register = await client.RegisterAsync(UniqueEmail());
        register.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        var oldCookie = register.Headers.GetValues("Set-Cookie")
            .Single(value => value.StartsWith("Miga.Auth=", StringComparison.Ordinal))
            .Split(';', 2)[0];

        using var logout = await client.PostWithCsrfAsync("/api/auth/logout", new { });
        logout.StatusCode.ShouldBe(HttpStatusCode.NoContent);

        using var replayClient = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            HandleCookies = false
        });
        replayClient.DefaultRequestHeaders.Add("Cookie", oldCookie);
        var session = await replayClient.GetFromJsonAsync<SessionResponse>("/api/auth/session");

        session.ShouldNotBeNull();
        session.Authenticated.ShouldBeFalse();
    }

    [Fact]
    public async Task ChangePassword_ShouldRotateCurrentSession_AndRevokeOtherSessions()
    {
        using var factory = new MigaWebApplicationFactory();
        using var firstClient = factory.CreateClient();
        using var secondClient = factory.CreateClient();
        var email = UniqueEmail();
        using var register = await firstClient.RegisterAsync(email);
        register.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        var preChangeCookie = register.Headers.GetValues("Set-Cookie")
            .Single(value => value.StartsWith("Miga.Auth=", StringComparison.Ordinal))
            .Split(';', 2)[0];

        using var login = await secondClient.PostWithCsrfAsync(
            "/api/auth/login",
            new { email, password = ApiClientExtensions.ValidPassword });
        login.StatusCode.ShouldBe(HttpStatusCode.NoContent);

        const string newPassword = "Miga!Another-Unique-Passphrase-9842";
        using var change = await firstClient.PostWithCsrfAsync(
            "/api/auth/change-password",
            new
            {
                currentPassword = ApiClientExtensions.ValidPassword,
                newPassword
            });
        change.StatusCode.ShouldBe(HttpStatusCode.NoContent);

        var firstSession =
            await firstClient.GetFromJsonAsync<SessionResponse>("/api/auth/session");
        var secondSession =
            await secondClient.GetFromJsonAsync<SessionResponse>("/api/auth/session");
        firstSession!.Authenticated.ShouldBeTrue();
        secondSession!.Authenticated.ShouldBeFalse();

        using var replayClient = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            HandleCookies = false
        });
        replayClient.DefaultRequestHeaders.Add("Cookie", preChangeCookie);
        var replayed =
            await replayClient.GetFromJsonAsync<SessionResponse>("/api/auth/session");
        replayed!.Authenticated.ShouldBeFalse();
    }

    [Fact]
    public async Task ConfirmationAndResetTokens_ShouldBeSingleUse_AndResetRevokesSessions()
    {
        using var factory = new MigaWebApplicationFactory(requireConfirmedEmail: true);
        using var client = factory.CreateClient();
        var email = UniqueEmail();
        using var register = await client.RegisterAsync(email);
        register.StatusCode.ShouldBe(HttpStatusCode.Accepted);

        var confirmation = factory.EmailSender.Messages
            .Single(message => message.Kind == "confirmation");
        confirmation.ActionUrl.AbsolutePath.ShouldBe("/verificar-email");
        confirmation.ActionUrl.Query.ShouldBeEmpty();
        var confirmationValues = ApiClientExtensions.ParseFragment(confirmation.ActionUrl);
        var confirmationBody = new
        {
            userId = Guid.Parse(confirmationValues["userId"]),
            token = confirmationValues["token"]
        };

        using var confirmed = await client.PostWithCsrfAsync(
            "/api/auth/confirm-email",
            confirmationBody);
        confirmed.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        using var confirmationReplay = await client.PostWithCsrfAsync(
            "/api/auth/confirm-email",
            confirmationBody);
        confirmationReplay.StatusCode.ShouldBe(HttpStatusCode.BadRequest);

        using var login = await client.PostWithCsrfAsync(
            "/api/auth/login",
            new { email, password = ApiClientExtensions.ValidPassword });
        login.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        using var forgot = await client.PostWithCsrfAsync(
            "/api/auth/forgot-password",
            new { email });
        forgot.StatusCode.ShouldBe(HttpStatusCode.Accepted);

        var reset = factory.EmailSender.Messages
            .Single(message => message.Kind == "password-reset");
        reset.ActionUrl.AbsolutePath.ShouldBe("/restablecer");
        reset.ActionUrl.Query.ShouldBeEmpty();
        var resetValues = ApiClientExtensions.ParseFragment(reset.ActionUrl);
        const string newPassword = "Miga!Reset-Unique-Passphrase-6638";
        var resetBody = new
        {
            email = resetValues["email"],
            token = resetValues["token"],
            newPassword
        };
        using var resetResponse = await client.PostWithCsrfAsync(
            "/api/auth/reset-password",
            resetBody);
        resetResponse.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        using var resetReplay = await client.PostWithCsrfAsync(
            "/api/auth/reset-password",
            resetBody);
        resetReplay.StatusCode.ShouldBe(HttpStatusCode.BadRequest);

        var revokedSession =
            await client.GetFromJsonAsync<SessionResponse>("/api/auth/session");
        revokedSession!.Authenticated.ShouldBeFalse();
    }

    [Fact]
    public async Task ExpiredConfirmationToken_ShouldBeRejected()
    {
        using var factory = new MigaWebApplicationFactory(
            requireConfirmedEmail: true,
            tokenLifespan: TimeSpan.Zero);
        using var client = factory.CreateClient();
        using var register = await client.RegisterAsync(UniqueEmail());
        register.StatusCode.ShouldBe(HttpStatusCode.Accepted);
        var confirmation = factory.EmailSender.Messages.Single();
        var values = ApiClientExtensions.ParseFragment(confirmation.ActionUrl);

        await Task.Delay(10);
        using var response = await client.PostWithCsrfAsync(
            "/api/auth/confirm-email",
            new
            {
                userId = Guid.Parse(values["userId"]),
                token = values["token"]
            });

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task ExpiredResetToken_ShouldBeRejected()
    {
        using var factory = new MigaWebApplicationFactory(
            requireConfirmedEmail: false,
            tokenLifespan: TimeSpan.Zero);
        using var client = factory.CreateClient();
        var email = UniqueEmail();
        using var register = await client.RegisterAsync(email);
        register.StatusCode.ShouldBe(HttpStatusCode.NoContent);

        using (var scope = factory.Services.CreateScope())
        {
            var userManager = scope.ServiceProvider.GetRequiredService<UserManager<MigaUser>>();
            var user = await userManager.FindByEmailAsync(email);
            user.ShouldNotBeNull();
            user!.EmailConfirmed = true;
            (await userManager.UpdateAsync(user)).Succeeded.ShouldBeTrue();
        }

        using var forgot = await client.PostWithCsrfAsync(
            "/api/auth/forgot-password",
            new { email });
        forgot.StatusCode.ShouldBe(HttpStatusCode.Accepted);
        var reset = factory.EmailSender.Messages
            .Single(message => message.Kind == "password-reset");
        var values = ApiClientExtensions.ParseFragment(reset.ActionUrl);

        await Task.Delay(10);
        using var response = await client.PostWithCsrfAsync(
            "/api/auth/reset-password",
            new
            {
                email = values["email"],
                token = values["token"],
                newPassword = "Miga!Expired-Reset-Passphrase-9381"
            });

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task RecoveryEndpoints_ShouldUseGenericResponsesForMissingAccounts()
    {
        using var factory = new MigaWebApplicationFactory(requireConfirmedEmail: true);
        using var client = factory.CreateClient();
        var confirmedEmail = UniqueEmail();
        var pendingEmail = UniqueEmail();
        using var confirmedRegistration = await client.RegisterAsync(confirmedEmail);
        using var pendingRegistration = await client.RegisterAsync(pendingEmail);
        confirmedRegistration.StatusCode.ShouldBe(HttpStatusCode.Accepted);
        pendingRegistration.StatusCode.ShouldBe(HttpStatusCode.Accepted);

        var confirmation = factory.EmailSender.Messages
            .Single(message =>
                message.Kind == "confirmation" &&
                message.Email == confirmedEmail);
        var values = ApiClientExtensions.ParseFragment(confirmation.ActionUrl);
        using var confirm = await client.PostWithCsrfAsync(
            "/api/auth/confirm-email",
            new
            {
                userId = Guid.Parse(values["userId"]),
                token = values["token"]
            });
        confirm.StatusCode.ShouldBe(HttpStatusCode.NoContent);

        using var existingForgot = await client.PostWithCsrfAsync(
            "/api/auth/forgot-password",
            new { email = confirmedEmail });
        using var missingForgot = await client.PostWithCsrfAsync(
            "/api/auth/forgot-password",
            new { email = $"missing-{Guid.NewGuid():N}@example.test" });
        using var existingResend = await client.PostWithCsrfAsync(
            "/api/auth/resend-confirmation",
            new { email = pendingEmail });
        using var missingResend = await client.PostWithCsrfAsync(
            "/api/auth/resend-confirmation",
            new { email = $"missing-{Guid.NewGuid():N}@example.test" });

        foreach (var response in new[]
                 {
                     existingForgot,
                     missingForgot,
                     existingResend,
                     missingResend
                 })
        {
            response.StatusCode.ShouldBe(HttpStatusCode.Accepted);
            (await response.Content.ReadAsStringAsync()).ShouldBeEmpty();
        }
    }

    [Fact]
    public async Task ExpiredRegisteredAndDemoSessions_ShouldBeRejected()
    {
        using var factory = new MigaWebApplicationFactory();
        using var registeredClient = factory.CreateClient();
        using var demoClient = factory.CreateClient();
        using var register = await registeredClient.RegisterAsync(UniqueEmail());
        using var createDemo = await demoClient.PostWithCsrfAsync("/api/auth/demo", new { });
        register.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        createDemo.StatusCode.ShouldBe(HttpStatusCode.NoContent);

        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<MigaDbContext>();
            var expiredAt = DateTimeOffset.UtcNow.AddMinutes(-1);
            (await db.UserSessions.SingleAsync()).IdleExpiresAtUtc = expiredAt;
            (await db.DemoSessions.SingleAsync()).IdleExpiresAtUtc = expiredAt;
            await db.SaveChangesAsync();
        }

        var registeredSession =
            await registeredClient.GetFromJsonAsync<SessionResponse>("/api/auth/session");
        var demoSession =
            await demoClient.GetFromJsonAsync<SessionResponse>("/api/auth/session");

        registeredSession!.Authenticated.ShouldBeFalse();
        demoSession!.Authenticated.ShouldBeFalse();
    }

    [Fact]
    public async Task DuplicateRegistrationAndWrongLogin_ShouldUseGenericResponses()
    {
        using var factory = new MigaWebApplicationFactory(requireConfirmedEmail: true);
        using var client = factory.CreateClient();
        var email = UniqueEmail();

        using var first = await client.RegisterAsync(email);
        using var duplicate = await client.RegisterAsync(email);
        first.StatusCode.ShouldBe(HttpStatusCode.Accepted);
        duplicate.StatusCode.ShouldBe(HttpStatusCode.Accepted);
        (await first.Content.ReadAsStringAsync()).ShouldBeEmpty();
        (await duplicate.Content.ReadAsStringAsync()).ShouldBeEmpty();

        using var existingWrong = await client.PostWithCsrfAsync(
            "/api/auth/login",
            new { email, password = "Wrong-but-long-password-1459" });
        using var missingWrong = await client.PostWithCsrfAsync(
            "/api/auth/login",
            new
            {
                email = $"missing-{Guid.NewGuid():N}@example.test",
                password = "Wrong-but-long-password-1459"
            });
        existingWrong.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
        missingWrong.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
        var existingProblem = await existingWrong.Content.ReadFromJsonAsync<ProblemDetails>();
        var missingProblem = await missingWrong.Content.ReadFromJsonAsync<ProblemDetails>();
        existingProblem!.Extensions["code"]!.ToString().ShouldBe("invalid_credentials");
        missingProblem!.Extensions["code"]!.ToString().ShouldBe("invalid_credentials");
        existingProblem.Title.ShouldBe(missingProblem.Title);

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<MigaDbContext>();
        (await db.Users.CountAsync()).ShouldBe(1);
        (await db.Workspaces.CountAsync()).ShouldBe(1);
    }

    [Fact]
    public async Task Login_ShouldBeRateLimitedAfterConfiguredBurst()
    {
        using var factory = new MigaWebApplicationFactory();
        using var client = factory.CreateClient();
        HttpResponseMessage? last = null;
        for (var attempt = 0; attempt < 11; attempt++)
        {
            last?.Dispose();
            last = await client.PostWithCsrfAsync(
                "/api/auth/login",
                new
                {
                    email = $"rate-{Guid.NewGuid():N}@example.test",
                    password = "Wrong-but-long-password-1459"
                });
        }

        using (last)
        {
            last.ShouldNotBeNull();
            last!.StatusCode.ShouldBe(HttpStatusCode.TooManyRequests);
            (await last.Content.ReadAsStringAsync()).ShouldContain("rate_limited");
        }
    }

    [Fact]
    public async Task Registration_ShouldRejectUnknownRoleFieldWithoutMassAssignment()
    {
        using var factory = new MigaWebApplicationFactory();
        using var client = factory.CreateClient();

        using var response = await client.PostWithCsrfAsync(
            "/api/auth/register",
            new
            {
                email = UniqueEmail(),
                password = ApiClientExtensions.ValidPassword,
                privacyPolicyVersion = "2026-07-23",
                importDemoData = false,
                roles = new[] { "admin" }
            });

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        (await response.Content.ReadAsStringAsync()).ShouldContain("validation_failed");
        using var scope = factory.Services.CreateScope();
        (await scope.ServiceProvider.GetRequiredService<MigaDbContext>().Users.CountAsync())
            .ShouldBe(0);
    }

    private static string UniqueEmail() =>
        $"security-{Guid.NewGuid():N}@example.test";
}
