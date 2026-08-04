using System.Diagnostics;
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

        var confirmation = await factory.EmailSender.WaitForMessageAsync(
            message => message.Kind == "confirmation");
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

        var reset = await factory.EmailSender.WaitForMessageAsync(
            message => message.Kind == "password-reset");
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
        var confirmation = await factory.EmailSender.WaitForMessageAsync(
            message => message.Kind == "confirmation");
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
        var reset = await factory.EmailSender.WaitForMessageAsync(
            message => message.Kind == "password-reset");
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

        var confirmation = await factory.EmailSender.WaitForMessageAsync(
            message =>
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
    public async Task DemoImport_WhenConfirmationIsRequired_ShouldRemainUsableUntilAtomicConversion()
    {
        using var factory = new MigaWebApplicationFactory(requireConfirmedEmail: true);
        using var client = factory.CreateClient();
        using var demo = await client.PostWithCsrfAsync("/api/auth/demo", new { });
        demo.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        var demoSession = await client.GetFromJsonAsync<SessionResponse>("/api/auth/session");
        demoSession!.AccountType.ShouldBe("demo");
        demoSession.WorkspaceId.ShouldNotBeNull();

        var email = UniqueEmail();
        using var registration = await client.RegisterAsync(email, importDemoData: true);
        registration.StatusCode.ShouldBe(HttpStatusCode.Accepted);

        var pendingSession =
            await client.GetFromJsonAsync<SessionResponse>("/api/auth/session");
        pendingSession!.AccountType.ShouldBe("demo");
        pendingSession.WorkspaceId.ShouldBe(demoSession.WorkspaceId);

        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<MigaDbContext>();
            var pendingUser = await db.Users.AsNoTracking().SingleAsync(x => x.Email == email);
            pendingUser.EmailConfirmed.ShouldBeFalse();
            pendingUser.PasswordHash.ShouldNotBeNullOrEmpty();
            pendingUser.PrivacyPolicyVersion.ShouldBe("2026-07-23");
            pendingUser.PrivacyPolicyAcceptedAtUtc.ShouldNotBeNull();
            pendingUser.PendingDemoWorkspaceId.ShouldBe(demoSession.WorkspaceId);
            pendingUser.PendingDemoSessionId.ShouldNotBeNull();
            (await db.Workspaces.AsNoTracking().SingleAsync()).Kind
                .ShouldBe(Miga.Domain.Enums.WorkspaceKind.Demo);
        }

        var snapshot = await client.GetFromJsonAsync<
            Miga.Contracts.Data.DataSnapshotResponse>("/api/data/snapshot");
        snapshot.ShouldNotBeNull();
        using var changed = await client.SendWithCsrfAsync(
            HttpMethod.Put,
            "/api/data/snapshot",
            new
            {
                workspaceId = demoSession.WorkspaceId,
                revision = snapshot.Revision,
                data = snapshot.Data
            });
        changed.StatusCode.ShouldBe(HttpStatusCode.OK);
        var changedSnapshot =
            await changed.Content.ReadFromJsonAsync<Miga.Contracts.Data.DataSnapshotResponse>();

        var confirmation = await factory.EmailSender.WaitForMessageAsync(
            message => message.Kind == "confirmation" && message.Email == email);
        var values = ApiClientExtensions.ParseFragment(confirmation.ActionUrl);
        using var confirm = await client.PostWithCsrfAsync(
            "/api/auth/confirm-email",
            new
            {
                userId = Guid.Parse(values["userId"]),
                token = values["token"]
            });
        confirm.StatusCode.ShouldBe(
            HttpStatusCode.NoContent,
            await confirm.Content.ReadAsStringAsync());

        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<MigaDbContext>();
            var user = await db.Users.AsNoTracking().SingleAsync(x => x.Email == email);
            user.EmailConfirmed.ShouldBeTrue();
            user.PrivacyPolicyVersion.ShouldBe("2026-07-23");
            user.PrivacyPolicyAcceptedAtUtc.ShouldNotBeNull();
            user.PendingDemoWorkspaceId.ShouldBeNull();
            user.PendingDemoSessionId.ShouldBeNull();
            user.PendingDemoExpiresAtUtc.ShouldBeNull();
            var workspace = await db.Workspaces.AsNoTracking().SingleAsync();
            workspace.Id.ShouldBe(demoSession.WorkspaceId.Value);
            workspace.Kind.ShouldBe(Miga.Domain.Enums.WorkspaceKind.Registered);
            workspace.OwnerUserId.ShouldBe(user.Id);
            (await db.DemoSessions.CountAsync()).ShouldBe(0);
            (await db.WorkspaceSnapshots.AsNoTracking().SingleAsync()).Revision
                .ShouldBe(changedSnapshot!.Revision + 1);
        }

        using var login = await client.PostWithCsrfAsync(
            "/api/auth/login",
            new { email, password = ApiClientExtensions.ValidPassword });
        login.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        var registeredSession =
            await client.GetFromJsonAsync<SessionResponse>("/api/auth/session");
        registeredSession!.AccountType.ShouldBe("registered");
        registeredSession.WorkspaceId.ShouldBe(demoSession.WorkspaceId);
    }

    [Fact]
    public async Task ConfirmationImport_ShouldReplaceOnlyPristinePlaceholderWithActiveDemo()
    {
        using var factory = new MigaWebApplicationFactory(requireConfirmedEmail: true);
        using var preRegistrationClient = factory.CreateClient();
        using var victimClient = factory.CreateClient();
        var email = UniqueEmail();
        using var preRegistration = await preRegistrationClient.RegisterAsync(email);
        preRegistration.StatusCode.ShouldBe(HttpStatusCode.Accepted);
        var confirmation = await factory.EmailSender.WaitForMessageAsync(
            message => message.Kind == "confirmation" && message.Email == email);
        var values = ApiClientExtensions.ParseFragment(confirmation.ActionUrl);

        using var createDemo =
            await victimClient.PostWithCsrfAsync("/api/auth/demo", new { });
        createDemo.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        var demoSession =
            await victimClient.GetFromJsonAsync<SessionResponse>("/api/auth/session");
        demoSession!.WorkspaceId.ShouldNotBeNull();
        var demoWorkspaceId = demoSession.WorkspaceId.Value;
        Guid placeholderWorkspaceId;
        const string victimSnapshot = """{"version":7,"marker":"victim-demo"}""";
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<MigaDbContext>();
            var user = await db.Users.AsNoTracking().SingleAsync(x => x.Email == email);
            placeholderWorkspaceId = await db.Workspaces
                .Where(workspace => workspace.OwnerUserId == user.Id)
                .Select(workspace => workspace.Id)
                .SingleAsync();
            var snapshot = await db.WorkspaceSnapshots
                .SingleAsync(candidate => candidate.WorkspaceId == demoWorkspaceId);
            snapshot.Revision = 7;
            snapshot.DataJson = victimSnapshot;
            await db.SaveChangesAsync();
        }

        using var genericRegistration =
            await victimClient.RegisterAsync(email, importDemoData: true);
        genericRegistration.StatusCode.ShouldBe(HttpStatusCode.Accepted);
        using var confirm = await victimClient.PostWithCsrfAsync(
            "/api/auth/confirm-email",
            new
            {
                userId = Guid.Parse(values["userId"]),
                token = values["token"],
                importDemoData = true
            });

        confirm.StatusCode.ShouldBe(
            HttpStatusCode.NoContent,
            await confirm.Content.ReadAsStringAsync());
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<MigaDbContext>();
            var user = await db.Users.AsNoTracking().SingleAsync(x => x.Email == email);
            user.EmailConfirmed.ShouldBeTrue();
            var workspace = await db.Workspaces.AsNoTracking().SingleAsync();
            workspace.Id.ShouldBe(demoWorkspaceId);
            workspace.Id.ShouldNotBe(placeholderWorkspaceId);
            workspace.Kind.ShouldBe(Miga.Domain.Enums.WorkspaceKind.Registered);
            workspace.OwnerUserId.ShouldBe(user.Id);
            var snapshot = await db.WorkspaceSnapshots.AsNoTracking().SingleAsync();
            snapshot.Revision.ShouldBe(8);
            snapshot.DataJson.ShouldBe(victimSnapshot);
            (await db.DemoSessions.CountAsync()).ShouldBe(0);
        }

        var session =
            await victimClient.GetFromJsonAsync<SessionResponse>("/api/auth/session");
        session!.Authenticated.ShouldBeFalse();
    }

    [Fact]
    public async Task ConfirmationImport_ShouldConvertActiveDemoAndPreserveAlienPendingDemo()
    {
        using var factory = new MigaWebApplicationFactory(requireConfirmedEmail: true);
        using var preRegistrationClient = factory.CreateClient();
        using var victimClient = factory.CreateClient();
        using var createAlienDemo =
            await preRegistrationClient.PostWithCsrfAsync("/api/auth/demo", new { });
        createAlienDemo.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        var alienDemo =
            await preRegistrationClient.GetFromJsonAsync<SessionResponse>("/api/auth/session");
        alienDemo!.WorkspaceId.ShouldNotBeNull();
        var email = UniqueEmail();
        using var preRegistration =
            await preRegistrationClient.RegisterAsync(email, importDemoData: true);
        preRegistration.StatusCode.ShouldBe(HttpStatusCode.Accepted);
        var confirmation = await factory.EmailSender.WaitForMessageAsync(
            message => message.Kind == "confirmation" && message.Email == email);
        var values = ApiClientExtensions.ParseFragment(confirmation.ActionUrl);

        using var createVictimDemo =
            await victimClient.PostWithCsrfAsync("/api/auth/demo", new { });
        createVictimDemo.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        var victimDemo =
            await victimClient.GetFromJsonAsync<SessionResponse>("/api/auth/session");
        victimDemo!.WorkspaceId.ShouldNotBeNull();
        const string alienSnapshot = """{"version":7,"marker":"alien-demo"}""";
        const string victimSnapshot = """{"version":7,"marker":"owned-demo"}""";
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<MigaDbContext>();
            var snapshots = await db.WorkspaceSnapshots
                .Where(snapshot =>
                    snapshot.WorkspaceId == alienDemo.WorkspaceId ||
                    snapshot.WorkspaceId == victimDemo.WorkspaceId)
                .ToDictionaryAsync(snapshot => snapshot.WorkspaceId);
            snapshots[alienDemo.WorkspaceId.Value].Revision = 3;
            snapshots[alienDemo.WorkspaceId.Value].DataJson = alienSnapshot;
            snapshots[victimDemo.WorkspaceId.Value].Revision = 5;
            snapshots[victimDemo.WorkspaceId.Value].DataJson = victimSnapshot;
            await db.SaveChangesAsync();
        }

        using var genericRegistration =
            await victimClient.RegisterAsync(email, importDemoData: true);
        genericRegistration.StatusCode.ShouldBe(HttpStatusCode.Accepted);
        using var confirm = await victimClient.PostWithCsrfAsync(
            "/api/auth/confirm-email",
            new
            {
                userId = Guid.Parse(values["userId"]),
                token = values["token"],
                importDemoData = true
            });

        confirm.StatusCode.ShouldBe(
            HttpStatusCode.NoContent,
            await confirm.Content.ReadAsStringAsync());
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<MigaDbContext>();
            var user = await db.Users.AsNoTracking().SingleAsync(x => x.Email == email);
            user.EmailConfirmed.ShouldBeTrue();
            user.PendingDemoWorkspaceId.ShouldBeNull();
            var workspaces = await db.Workspaces.AsNoTracking().ToListAsync();
            var preservedAlien = workspaces.Single(
                workspace => workspace.Id == alienDemo.WorkspaceId);
            preservedAlien.Kind.ShouldBe(Miga.Domain.Enums.WorkspaceKind.Demo);
            preservedAlien.OwnerUserId.ShouldBeNull();
            var convertedVictim = workspaces.Single(
                workspace => workspace.Id == victimDemo.WorkspaceId);
            convertedVictim.Kind.ShouldBe(Miga.Domain.Enums.WorkspaceKind.Registered);
            convertedVictim.OwnerUserId.ShouldBe(user.Id);
            var snapshots = await db.WorkspaceSnapshots
                .AsNoTracking()
                .ToDictionaryAsync(snapshot => snapshot.WorkspaceId);
            snapshots[alienDemo.WorkspaceId.Value].Revision.ShouldBe(3);
            snapshots[alienDemo.WorkspaceId.Value].DataJson.ShouldBe(alienSnapshot);
            snapshots[victimDemo.WorkspaceId.Value].Revision.ShouldBe(6);
            snapshots[victimDemo.WorkspaceId.Value].DataJson.ShouldBe(victimSnapshot);
            var remainingDemoSession = await db.DemoSessions.AsNoTracking().SingleAsync();
            remainingDemoSession.WorkspaceId.ShouldBe(alienDemo.WorkspaceId.Value);
        }

        (await preRegistrationClient.GetFromJsonAsync<SessionResponse>("/api/auth/session"))!
            .WorkspaceId
            .ShouldBe(alienDemo.WorkspaceId);
        (await victimClient.GetFromJsonAsync<SessionResponse>("/api/auth/session"))!
            .Authenticated
            .ShouldBeFalse();
    }

    [Fact]
    public async Task PendingDemoConfirmation_ShouldRequireMatchingDemoOrExplicitFallback()
    {
        using var factory = new MigaWebApplicationFactory(requireConfirmedEmail: true);
        using var demoClient = factory.CreateClient();
        using var confirmationClient = factory.CreateClient();
        using var demo = await demoClient.PostWithCsrfAsync("/api/auth/demo", new { });
        demo.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        var demoSession =
            await demoClient.GetFromJsonAsync<SessionResponse>("/api/auth/session");
        var email = UniqueEmail();
        using var registration =
            await demoClient.RegisterAsync(email, importDemoData: true);
        registration.StatusCode.ShouldBe(HttpStatusCode.Accepted);
        var confirmation = await factory.EmailSender.WaitForMessageAsync(
            message => message.Kind == "confirmation" && message.Email == email);
        var values = ApiClientExtensions.ParseFragment(confirmation.ActionUrl);

        using var rejected = await confirmationClient.PostWithCsrfAsync(
            "/api/auth/confirm-email",
            new
            {
                userId = Guid.Parse(values["userId"]),
                token = values["token"]
            });
        rejected.StatusCode.ShouldBe(HttpStatusCode.Conflict);
        (await rejected.Content.ReadAsStringAsync())
            .ShouldContain("demo_conversion_unavailable");

        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<MigaDbContext>();
            (await db.Users.AsNoTracking().SingleAsync()).EmailConfirmed.ShouldBeFalse();
            (await db.Workspaces.AsNoTracking().SingleAsync()).Kind
                .ShouldBe(Miga.Domain.Enums.WorkspaceKind.Demo);
        }

        using var confirmed = await confirmationClient.PostWithCsrfAsync(
            "/api/auth/confirm-email",
            new
            {
                userId = Guid.Parse(values["userId"]),
                token = values["token"],
                continueWithoutDemoData = true
            });
        confirmed.StatusCode.ShouldBe(HttpStatusCode.NoContent);

        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<MigaDbContext>();
            var user = await db.Users.AsNoTracking().SingleAsync();
            user.EmailConfirmed.ShouldBeTrue();
            var workspaces = await db.Workspaces.AsNoTracking().ToListAsync();
            workspaces.Count.ShouldBe(2);
            workspaces.Single(workspace =>
                    workspace.Kind == Miga.Domain.Enums.WorkspaceKind.Demo)
                .Id.ShouldBe(demoSession!.WorkspaceId!.Value);
            workspaces.Single(workspace =>
                    workspace.Kind == Miga.Domain.Enums.WorkspaceKind.Registered)
                .OwnerUserId.ShouldBe(user.Id);
            (await db.DemoSessions.CountAsync()).ShouldBe(1);
        }

        (await demoClient.GetFromJsonAsync<SessionResponse>("/api/auth/session"))!
            .AccountType
            .ShouldBe("demo");
        using var login = await confirmationClient.PostWithCsrfAsync(
            "/api/auth/login",
            new { email, password = ApiClientExtensions.ValidPassword });
        login.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        var registeredSession =
            await confirmationClient.GetFromJsonAsync<SessionResponse>("/api/auth/session");
        registeredSession!.AccountType.ShouldBe("registered");
        registeredSession.WorkspaceId.ShouldNotBe(demoSession.WorkspaceId);
    }

    [Fact]
    public async Task PendingDemoConfirmation_ExplicitSkip_ShouldPreserveMatchingActiveDemo()
    {
        using var factory = new MigaWebApplicationFactory(requireConfirmedEmail: true);
        using var client = factory.CreateClient();
        using var createDemo = await client.PostWithCsrfAsync("/api/auth/demo", new { });
        createDemo.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        var demoSession = await client.GetFromJsonAsync<SessionResponse>("/api/auth/session");
        demoSession!.WorkspaceId.ShouldNotBeNull();
        var email = UniqueEmail();
        using var registration = await client.RegisterAsync(email, importDemoData: true);
        registration.StatusCode.ShouldBe(HttpStatusCode.Accepted);
        var confirmation = await factory.EmailSender.WaitForMessageAsync(
            message => message.Kind == "confirmation" && message.Email == email);
        var values = ApiClientExtensions.ParseFragment(confirmation.ActionUrl);

        using var confirmed = await client.PostWithCsrfAsync(
            "/api/auth/confirm-email",
            new
            {
                userId = Guid.Parse(values["userId"]),
                token = values["token"],
                importDemoData = false,
                continueWithoutDemoData = true
            });

        confirmed.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<MigaDbContext>();
            var user = await db.Users.AsNoTracking().SingleAsync();
            user.EmailConfirmed.ShouldBeTrue();
            var workspaces = await db.Workspaces.AsNoTracking().ToListAsync();
            workspaces.Count.ShouldBe(2);
            workspaces.Single(workspace =>
                    workspace.Id == demoSession.WorkspaceId.Value)
                .Kind.ShouldBe(Miga.Domain.Enums.WorkspaceKind.Demo);
            workspaces.Single(workspace =>
                    workspace.Kind == Miga.Domain.Enums.WorkspaceKind.Registered)
                .OwnerUserId.ShouldBe(user.Id);
            (await db.DemoSessions.CountAsync()).ShouldBe(1);
        }

        var stillDemo = await client.GetFromJsonAsync<SessionResponse>("/api/auth/session");
        stillDemo!.AccountType.ShouldBe("demo");
        stillDemo.WorkspaceId.ShouldBe(demoSession.WorkspaceId);
    }

    [Fact]
    public async Task ConfirmationImport_ShouldNeverDeleteNonPristineWorkspace()
    {
        using var factory = new MigaWebApplicationFactory(requireConfirmedEmail: true);
        using var preRegistrationClient = factory.CreateClient();
        using var victimClient = factory.CreateClient();
        var email = UniqueEmail();
        using var preRegistration = await preRegistrationClient.RegisterAsync(email);
        preRegistration.StatusCode.ShouldBe(HttpStatusCode.Accepted);
        var confirmation = await factory.EmailSender.WaitForMessageAsync(
            message => message.Kind == "confirmation" && message.Email == email);
        var values = ApiClientExtensions.ParseFragment(confirmation.ActionUrl);
        using var createDemo =
            await victimClient.PostWithCsrfAsync("/api/auth/demo", new { });
        createDemo.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        var demo =
            await victimClient.GetFromJsonAsync<SessionResponse>("/api/auth/session");
        demo!.WorkspaceId.ShouldNotBeNull();
        Guid placeholderWorkspaceId;
        const string protectedSnapshot = """{"version":7,"marker":"must-survive"}""";
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<MigaDbContext>();
            var user = await db.Users.AsNoTracking().SingleAsync(x => x.Email == email);
            var placeholder = await db.Workspaces
                .Include(workspace => workspace.Snapshot)
                .SingleAsync(workspace => workspace.OwnerUserId == user.Id);
            placeholderWorkspaceId = placeholder.Id;
            placeholder.Snapshot!.Revision = 1;
            placeholder.Snapshot.DataJson = protectedSnapshot;
            await db.SaveChangesAsync();
        }

        using var genericRegistration =
            await victimClient.RegisterAsync(email, importDemoData: true);
        genericRegistration.StatusCode.ShouldBe(HttpStatusCode.Accepted);
        using var rejected = await victimClient.PostWithCsrfAsync(
            "/api/auth/confirm-email",
            new
            {
                userId = Guid.Parse(values["userId"]),
                token = values["token"],
                importDemoData = true
            });
        rejected.StatusCode.ShouldBe(HttpStatusCode.Conflict);
        (await rejected.Content.ReadAsStringAsync())
            .ShouldContain("demo_conversion_unavailable");

        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<MigaDbContext>();
            (await db.Users.AsNoTracking().SingleAsync()).EmailConfirmed.ShouldBeFalse();
            var protectedWorkspace = await db.Workspaces
                .AsNoTracking()
                .SingleAsync(workspace => workspace.Id == placeholderWorkspaceId);
            protectedWorkspace.Kind.ShouldBe(Miga.Domain.Enums.WorkspaceKind.Registered);
            var protectedState = await db.WorkspaceSnapshots
                .AsNoTracking()
                .SingleAsync(snapshot => snapshot.WorkspaceId == placeholderWorkspaceId);
            protectedState.Revision.ShouldBe(1);
            protectedState.DataJson.ShouldBe(protectedSnapshot);
            (await db.Workspaces.CountAsync()).ShouldBe(2);
            (await db.DemoSessions.CountAsync()).ShouldBe(1);
        }

        using var confirmed = await victimClient.PostWithCsrfAsync(
            "/api/auth/confirm-email",
            new
            {
                userId = Guid.Parse(values["userId"]),
                token = values["token"],
                continueWithoutDemoData = true
            });
        confirmed.StatusCode.ShouldBe(HttpStatusCode.NoContent);

        using var assertionScope = factory.Services.CreateScope();
        var assertionDb = assertionScope.ServiceProvider.GetRequiredService<MigaDbContext>();
        (await assertionDb.Users.AsNoTracking().SingleAsync()).EmailConfirmed.ShouldBeTrue();
        var survivingState = await assertionDb.WorkspaceSnapshots
            .AsNoTracking()
            .SingleAsync(snapshot => snapshot.WorkspaceId == placeholderWorkspaceId);
        survivingState.Revision.ShouldBe(1);
        survivingState.DataJson.ShouldBe(protectedSnapshot);
        (await assertionDb.Workspaces.CountAsync()).ShouldBe(2);
        (await assertionDb.DemoSessions.CountAsync()).ShouldBe(1);
    }

    [Fact]
    public async Task Confirmation_ShouldRejectContradictoryDemoFlagsWithoutMutation()
    {
        using var factory = new MigaWebApplicationFactory(requireConfirmedEmail: true);
        using var client = factory.CreateClient();
        var email = UniqueEmail();
        using var registration = await client.RegisterAsync(email);
        registration.StatusCode.ShouldBe(HttpStatusCode.Accepted);
        var confirmation = await factory.EmailSender.WaitForMessageAsync(
            message => message.Kind == "confirmation" && message.Email == email);
        var values = ApiClientExtensions.ParseFragment(confirmation.ActionUrl);

        using var response = await client.PostWithCsrfAsync(
            "/api/auth/confirm-email",
            new
            {
                userId = Guid.Parse(values["userId"]),
                token = values["token"],
                importDemoData = true,
                continueWithoutDemoData = true
            });

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        (await response.Content.ReadAsStringAsync())
            .ShouldContain("demo_confirmation_options_invalid");
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<MigaDbContext>();
        (await db.Users.AsNoTracking().SingleAsync()).EmailConfirmed.ShouldBeFalse();
        (await db.Workspaces.CountAsync()).ShouldBe(1);
    }

    [Fact]
    public async Task PendingDemoConfirmation_ShouldRecoverAfterDemoWasDeleted()
    {
        using var factory = new MigaWebApplicationFactory(requireConfirmedEmail: true);
        using var client = factory.CreateClient();
        using var demo = await client.PostWithCsrfAsync("/api/auth/demo", new { });
        demo.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        var email = UniqueEmail();
        using var registration = await client.RegisterAsync(email, importDemoData: true);
        registration.StatusCode.ShouldBe(HttpStatusCode.Accepted);
        var confirmation = await factory.EmailSender.WaitForMessageAsync(
            message => message.Kind == "confirmation" && message.Email == email);
        var values = ApiClientExtensions.ParseFragment(confirmation.ActionUrl);

        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<MigaDbContext>();
            db.Workspaces.Remove(await db.Workspaces.SingleAsync());
            await db.SaveChangesAsync();
        }

        using var rejected = await client.PostWithCsrfAsync(
            "/api/auth/confirm-email",
            new
            {
                userId = Guid.Parse(values["userId"]),
                token = values["token"],
                importDemoData = true
            });
        rejected.StatusCode.ShouldBe(HttpStatusCode.Conflict);
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<MigaDbContext>();
            var pendingUser = await db.Users.AsNoTracking().SingleAsync();
            pendingUser.EmailConfirmed.ShouldBeFalse();
            pendingUser.PendingDemoWorkspaceId.ShouldNotBeNull();
            (await db.Workspaces.CountAsync()).ShouldBe(0);
        }

        using var confirmed = await client.PostWithCsrfAsync(
            "/api/auth/confirm-email",
            new
            {
                userId = Guid.Parse(values["userId"]),
                token = values["token"],
                continueWithoutDemoData = true
            });
        confirmed.StatusCode.ShouldBe(HttpStatusCode.NoContent);

        using var assertionScope = factory.Services.CreateScope();
        var assertionDb = assertionScope.ServiceProvider.GetRequiredService<MigaDbContext>();
        (await assertionDb.Users.AsNoTracking().SingleAsync()).EmailConfirmed.ShouldBeTrue();
        var workspace = await assertionDb.Workspaces.AsNoTracking().SingleAsync();
        workspace.Kind.ShouldBe(Miga.Domain.Enums.WorkspaceKind.Registered);
        (await assertionDb.DemoSessions.CountAsync()).ShouldBe(0);
    }

    [Fact]
    public async Task LegacyPendingAccountWithoutPassword_ShouldBeRejectedAtConfirmation()
    {
        // Migration safety: accounts created before password-at-registration
        // existed have no PasswordHash. Confirming them would leave a
        // usable account with no credential, so the endpoint refuses and the
        // cleanup job removes them once expired.
        using var factory = new MigaWebApplicationFactory(requireConfirmedEmail: true);
        using var client = factory.CreateClient();
        var email = UniqueEmail();
        Guid userId;
        string confirmationToken;
        using (var scope = factory.Services.CreateScope())
        {
            var userManager = scope.ServiceProvider.GetRequiredService<UserManager<MigaUser>>();
            var user = new MigaUser
            {
                Id = Guid.CreateVersion7(),
                Email = email,
                UserName = email,
                CreatedAtUtc = DateTimeOffset.UtcNow,
                SecurityStamp = Guid.NewGuid().ToString("N")
            };
            (await userManager.CreateAsync(user)).Succeeded.ShouldBeTrue();
            userId = user.Id;
            confirmationToken = await userManager.GenerateEmailConfirmationTokenAsync(user);
        }

        using var response = await client.PostWithCsrfAsync(
            "/api/auth/confirm-email",
            new { userId, token = confirmationToken });

        response.StatusCode.ShouldBe(HttpStatusCode.Conflict);
        (await response.Content.ReadAsStringAsync())
            .ShouldContain("confirmation_password_missing");
        using var scope2 = factory.Services.CreateScope();
        var db = scope2.ServiceProvider.GetRequiredService<MigaDbContext>();
        (await db.Users.AsNoTracking().SingleAsync(x => x.Email == email))
            .EmailConfirmed.ShouldBeFalse();
    }

    [Fact]
    public async Task ExpiredPendingDemoAccountCleanup_ShouldBeIdempotentAndPreserveDemo()
    {
        using var factory = new MigaWebApplicationFactory(requireConfirmedEmail: true);
        using var client = factory.CreateClient();
        using var demo = await client.PostWithCsrfAsync("/api/auth/demo", new { });
        demo.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        var email = UniqueEmail();
        using var registration = await client.RegisterAsync(email, importDemoData: true);
        registration.StatusCode.ShouldBe(HttpStatusCode.Accepted);
        _ = await factory.EmailSender.WaitForMessageAsync(
            message => message.Kind == "confirmation" && message.Email == email);
        var now = DateTimeOffset.UtcNow;
        var confirmedEmail = UniqueEmail();
        var freshPendingEmail = UniqueEmail();

        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<MigaDbContext>();
            var user = await db.Users.SingleAsync(x => x.Email == email);
            user.PendingDemoExpiresAtUtc = now.AddMinutes(-1);
            await db.SaveChangesAsync();

            var userManager = scope.ServiceProvider.GetRequiredService<UserManager<MigaUser>>();
            var confirmedUser = new MigaUser
            {
                Id = Guid.CreateVersion7(),
                Email = confirmedEmail,
                UserName = confirmedEmail,
                EmailConfirmed = true,
                CreatedAtUtc = now.AddDays(-30),
                PrivacyPolicyVersion = "2026-07-23",
                PrivacyPolicyAcceptedAtUtc = now.AddDays(-30),
                SecurityStamp = Guid.NewGuid().ToString("N")
            };
            (await userManager.CreateAsync(confirmedUser)).Succeeded.ShouldBeTrue();
            var freshPendingUser = new MigaUser
            {
                Id = Guid.CreateVersion7(),
                Email = freshPendingEmail,
                UserName = freshPendingEmail,
                CreatedAtUtc = now,
                SecurityStamp = Guid.NewGuid().ToString("N")
            };
            (await userManager.CreateAsync(freshPendingUser)).Succeeded.ShouldBeTrue();
        }

        var cleanup =
            factory.Services.GetRequiredService<UnconfirmedAccountCleanupService>();
        (await cleanup.CleanupExpiredAsync(now)).ShouldBe(1);
        (await cleanup.CleanupExpiredAsync(now)).ShouldBe(0);

        using var assertionScope = factory.Services.CreateScope();
        var assertionDb = assertionScope.ServiceProvider.GetRequiredService<MigaDbContext>();
        (await assertionDb.Users.CountAsync()).ShouldBe(2);
        (await assertionDb.Users.AnyAsync(user =>
                user.Email == confirmedEmail && user.EmailConfirmed))
            .ShouldBeTrue();
        (await assertionDb.Users.AnyAsync(user =>
                user.Email == freshPendingEmail && !user.EmailConfirmed))
            .ShouldBeTrue();
        (await assertionDb.Workspaces.CountAsync(
                workspace => workspace.Kind == Miga.Domain.Enums.WorkspaceKind.Demo))
            .ShouldBe(1);
        (await assertionDb.DemoSessions.CountAsync()).ShouldBe(1);
    }

    [Fact]
    public async Task Register_WithActiveRegisteredSession_ShouldBeRejected()
    {
        using var factory = new MigaWebApplicationFactory();
        using var client = factory.CreateClient();
        using var initial = await client.RegisterAsync(UniqueEmail());
        initial.StatusCode.ShouldBe(HttpStatusCode.NoContent);

        using var response = await client.RegisterAsync(UniqueEmail());

        response.StatusCode.ShouldBe(HttpStatusCode.Conflict);
        var problem = await response.Content.ReadFromJsonAsync<ProblemDetails>();
        problem!.Extensions["code"]!.ToString().ShouldBe("registered_session_active");
    }

    [Fact]
    public async Task DemoImportPrecondition_ShouldRunBeforeAccountLookup()
    {
        using var factory = new MigaWebApplicationFactory(requireConfirmedEmail: true);
        using var client = factory.CreateClient();
        var existingEmail = UniqueEmail();
        using (var scope = factory.Services.CreateScope())
        {
            var userManager = scope.ServiceProvider.GetRequiredService<UserManager<MigaUser>>();
            var result = await userManager.CreateAsync(new MigaUser
            {
                Id = Guid.CreateVersion7(),
                Email = existingEmail,
                UserName = existingEmail,
                CreatedAtUtc = DateTimeOffset.UtcNow,
                SecurityStamp = Guid.NewGuid().ToString("N")
            });
            result.Succeeded.ShouldBeTrue();
        }

        using var existing = await client.RegisterAsync(
            existingEmail,
            importDemoData: true);
        using var missing = await client.RegisterAsync(
            UniqueEmail(),
            importDemoData: true);

        existing.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        missing.StatusCode.ShouldBe(existing.StatusCode);
        var existingProblem = await existing.Content.ReadFromJsonAsync<ProblemDetails>();
        var missingProblem = await missing.Content.ReadFromJsonAsync<ProblemDetails>();
        existingProblem!.Extensions["code"]!.ToString().ShouldBe("demo_session_required");
        missingProblem!.Extensions["code"]!.ToString()
            .ShouldBe(existingProblem.Extensions["code"]!.ToString());
    }

    [Fact]
    public async Task PendingDemoRegistration_ShouldBeGenericForExistingAndNewAccounts()
    {
        using var factory = new MigaWebApplicationFactory(requireConfirmedEmail: true);
        using var client = factory.CreateClient();
        var existingEmail = UniqueEmail();
        using (var scope = factory.Services.CreateScope())
        {
            var userManager = scope.ServiceProvider.GetRequiredService<UserManager<MigaUser>>();
            (await userManager.CreateAsync(new MigaUser
            {
                Id = Guid.CreateVersion7(),
                Email = existingEmail,
                UserName = existingEmail,
                CreatedAtUtc = DateTimeOffset.UtcNow,
                SecurityStamp = Guid.NewGuid().ToString("N")
            })).Succeeded.ShouldBeTrue();
        }

        using var demo = await client.PostWithCsrfAsync("/api/auth/demo", new { });
        demo.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        var demoSession = await client.GetFromJsonAsync<SessionResponse>("/api/auth/session");
        var newEmail = UniqueEmail();
        using var existing = await client.RegisterAsync(
            existingEmail,
            importDemoData: true);
        using var created = await client.RegisterAsync(
            newEmail,
            importDemoData: true);

        existing.StatusCode.ShouldBe(HttpStatusCode.Accepted);
        created.StatusCode.ShouldBe(existing.StatusCode);
        (await existing.Content.ReadAsStringAsync()).ShouldBeEmpty();
        (await created.Content.ReadAsStringAsync()).ShouldBeEmpty();
        var stillDemo = await client.GetFromJsonAsync<SessionResponse>("/api/auth/session");
        stillDemo!.AccountType.ShouldBe("demo");
        stillDemo.WorkspaceId.ShouldBe(demoSession!.WorkspaceId);

        using var assertionScope = factory.Services.CreateScope();
        var assertionDb = assertionScope.ServiceProvider.GetRequiredService<MigaDbContext>();
        (await assertionDb.Workspaces.SingleAsync()).Kind
            .ShouldBe(Miga.Domain.Enums.WorkspaceKind.Demo);
        (await assertionDb.Users.SingleAsync(user => user.Email == newEmail))
            .PendingDemoWorkspaceId
            .ShouldBe(demoSession.WorkspaceId);
    }

    [Fact]
    public async Task AuthController_ShouldRejectBodiesLargerThanSixteenKiB()
    {
        using var factory = new MigaWebApplicationFactory();
        using var client = factory.CreateClient();

        using var response = await client.PostWithCsrfAsync(
            "/api/auth/login",
            new
            {
                email = UniqueEmail(),
                password = new string('x', 17 * 1024)
            });

        response.StatusCode.ShouldBe(HttpStatusCode.RequestEntityTooLarge);
    }

    [Fact]
    public async Task AnonymousAuthenticationFailures_ShouldNotIdentifyTheTargetAccountInAudit()
    {
        using var factory = new MigaWebApplicationFactory();
        using var owner = factory.CreateClient();
        using var anonymous = factory.CreateClient();
        var email = UniqueEmail();
        using var registration = await owner.RegisterAsync(email);
        registration.StatusCode.ShouldBe(HttpStatusCode.NoContent);

        using var login = await anonymous.PostWithCsrfAsync(
            "/api/auth/login",
            new { email, password = "Miga!Wrong-Unique-Passphrase-6318" });
        using var forgot = await anonymous.PostWithCsrfAsync(
            "/api/auth/forgot-password",
            new { email });
        login.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
        forgot.StatusCode.ShouldBe(HttpStatusCode.Accepted);

        using var scope = factory.Services.CreateScope();
        var audits = await scope.ServiceProvider
            .GetRequiredService<MigaDbContext>()
            .SecurityAuditEvents
            .AsNoTracking()
            .Where(audit =>
                audit.EventType == "auth.login" ||
                audit.EventType == "password.reset_requested")
            .ToListAsync();
        audits.Count.ShouldBe(2);
        audits.ShouldAllBe(audit => audit.ActorType == null && audit.ActorId == null);
    }

    [Fact]
    public async Task LoginFailures_ShouldApplyTheSameMinimumResponseFloor()
    {
        using var factory = new MigaWebApplicationFactory(requireConfirmedEmail: true);
        using var registrationClient = factory.CreateClient();
        using var client = factory.CreateClient();
        var email = UniqueEmail();
        using var registration = await registrationClient.RegisterAsync(email);
        registration.StatusCode.ShouldBe(HttpStatusCode.Accepted);

        var existingTimer = Stopwatch.StartNew();
        using var existing = await client.PostWithCsrfAsync(
            "/api/auth/login",
            new { email, password = ApiClientExtensions.ValidPassword });
        existingTimer.Stop();
        var missingTimer = Stopwatch.StartNew();
        using var missing = await client.PostWithCsrfAsync(
            "/api/auth/login",
            new
            {
                email = UniqueEmail(),
                password = ApiClientExtensions.ValidPassword
            });
        missingTimer.Stop();

        existing.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
        missing.StatusCode.ShouldBe(existing.StatusCode);
        existingTimer.Elapsed.ShouldBeGreaterThanOrEqualTo(TimeSpan.FromMilliseconds(450));
        missingTimer.Elapsed.ShouldBeGreaterThanOrEqualTo(TimeSpan.FromMilliseconds(450));
    }

    [Fact]
    public async Task ResetPasswordFailures_ShouldUseSameFloorAndAnonymousAudit()
    {
        using var factory = new MigaWebApplicationFactory();
        using var registrationClient = factory.CreateClient();
        using var client = factory.CreateClient();
        var email = UniqueEmail();
        using var registration = await registrationClient.RegisterAsync(email);
        registration.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        const string invalidToken = "invalid-reset-token";
        const string newPassword = "Miga!Invalid-Reset-Passphrase-8046";

        var existingTimer = Stopwatch.StartNew();
        using var existing = await client.PostWithCsrfAsync(
            "/api/auth/reset-password",
            new
            {
                email,
                token = invalidToken,
                newPassword
            });
        existingTimer.Stop();
        var missingTimer = Stopwatch.StartNew();
        using var missing = await client.PostWithCsrfAsync(
            "/api/auth/reset-password",
            new
            {
                email = UniqueEmail(),
                token = invalidToken,
                newPassword
            });
        missingTimer.Stop();

        existing.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        missing.StatusCode.ShouldBe(existing.StatusCode);
        var existingProblem = await existing.Content.ReadFromJsonAsync<ProblemDetails>();
        var missingProblem = await missing.Content.ReadFromJsonAsync<ProblemDetails>();
        existingProblem!.Extensions["code"]!.ToString()
            .ShouldBe("invalid_or_expired_token");
        missingProblem!.Extensions["code"]!.ToString()
            .ShouldBe(existingProblem.Extensions["code"]!.ToString());
        existingTimer.Elapsed.ShouldBeGreaterThanOrEqualTo(TimeSpan.FromMilliseconds(450));
        missingTimer.Elapsed.ShouldBeGreaterThanOrEqualTo(TimeSpan.FromMilliseconds(450));

        using var scope = factory.Services.CreateScope();
        var failures = await scope.ServiceProvider
            .GetRequiredService<MigaDbContext>()
            .SecurityAuditEvents
            .AsNoTracking()
            .Where(audit =>
                audit.EventType == "password.reset" &&
                audit.Outcome == "failure")
            .ToListAsync();
        failures.Count.ShouldBe(2);
        failures.ShouldAllBe(audit => audit.ActorType == null && audit.ActorId == null);
    }

    [Fact]
    public async Task Registration_ShouldNotWaitForEmailTransport()
    {
        using var factory = new MigaWebApplicationFactory(requireConfirmedEmail: true);
        factory.EmailSender.BlockDelivery = true;
        using var client = factory.CreateClient();

        var registrationTask = client.RegisterAsync(UniqueEmail());
        var completed = await Task.WhenAny(registrationTask, Task.Delay(TimeSpan.FromSeconds(2)));

        completed.ShouldBe(registrationTask);
        using var registration = await registrationTask;
        registration.StatusCode.ShouldBe(HttpStatusCode.Accepted);
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
