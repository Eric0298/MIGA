using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json.Nodes;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Miga.Application.Demo;
using Miga.Contracts.Auth;
using Miga.Contracts.Data;
using Miga.Domain.Entities;
using Miga.Domain.Enums;
using Miga.Infrastructure.Demo;
using Miga.Infrastructure.Persistence;
using Miga.IntegrationTests.Infrastructure;
using Shouldly;

namespace Miga.IntegrationTests;

public sealed class WorkspaceSecurityTests
{
    [Fact]
    public async Task AnonymousClient_ShouldNotReadSnapshot()
    {
        using var factory = new MigaWebApplicationFactory();
        using var client = factory.CreateClient();

        using var response = await client.GetAsync("/api/data/snapshot");

        response.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task DemoWorkspaces_ShouldBeIsolated_AndUseOptimisticRevision()
    {
        using var factory = new MigaWebApplicationFactory();
        using var firstClient = factory.CreateClient();
        using var secondClient = factory.CreateClient();
        using var firstDemo = await firstClient.PostWithCsrfAsync("/api/auth/demo", new { });
        using var secondDemo = await secondClient.PostWithCsrfAsync("/api/auth/demo", new { });
        firstDemo.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        secondDemo.StatusCode.ShouldBe(HttpStatusCode.NoContent);

        var firstSnapshot =
            await firstClient.GetFromJsonAsync<DataSnapshotResponse>("/api/data/snapshot");
        var secondSnapshot =
            await secondClient.GetFromJsonAsync<DataSnapshotResponse>("/api/data/snapshot");
        firstSnapshot.ShouldNotBeNull();
        secondSnapshot.ShouldNotBeNull();
        var firstSession =
            await firstClient.GetFromJsonAsync<Miga.Contracts.Auth.SessionResponse>(
                "/api/auth/session");
        firstSession!.WorkspaceId.ShouldNotBeNull();
        firstSnapshot.Revision.ShouldBe(0);
        secondSnapshot.Revision.ShouldBe(0);
        firstSnapshot.Data.GetProperty("version").GetInt32().ShouldBe(7);

        using var update = await firstClient.SendWithCsrfAsync(
            HttpMethod.Put,
            "/api/data/snapshot",
            new
            {
                workspaceId = firstSession.WorkspaceId,
                revision = 0,
                data = firstSnapshot.Data
            });
        update.StatusCode.ShouldBe(
            HttpStatusCode.OK,
            await update.Content.ReadAsStringAsync());
        var updated = await update.Content.ReadFromJsonAsync<DataSnapshotResponse>();
        updated!.Revision.ShouldBe(1);

        using var conflict = await firstClient.SendWithCsrfAsync(
            HttpMethod.Put,
            "/api/data/snapshot",
            new
            {
                workspaceId = firstSession.WorkspaceId,
                revision = 0,
                data = firstSnapshot.Data
            });
        conflict.StatusCode.ShouldBe(HttpStatusCode.Conflict);
        var conflictBody = await conflict.Content.ReadAsStringAsync();
        conflictBody.ShouldContain("snapshot_revision_conflict");
        conflictBody.ShouldContain("\"currentRevision\":1");

        var unchangedSecond =
            await secondClient.GetFromJsonAsync<DataSnapshotResponse>("/api/data/snapshot");
        unchangedSecond!.Revision.ShouldBe(0);

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<MigaDbContext>();
        (await db.Users.CountAsync()).ShouldBe(0);
        (await db.Workspaces.CountAsync(x => x.Kind == WorkspaceKind.Demo)).ShouldBe(2);
    }

    [Fact]
    public async Task SnapshotWrite_ShouldRejectMalformedUtf8WithoutServerError()
    {
        using var factory = new MigaWebApplicationFactory();
        using var client = factory.CreateClient();
        using var demo = await client.PostWithCsrfAsync("/api/auth/demo", new { });
        demo.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        var session = await client.GetFromJsonAsync<SessionResponse>("/api/auth/session");
        var snapshot = await client.GetFromJsonAsync<DataSnapshotResponse>("/api/data/snapshot");
        session!.WorkspaceId.ShouldNotBeNull();
        snapshot.ShouldNotBeNull();

        var data = JsonNode.Parse(snapshot.Data.GetRawText())!.AsObject();
        data["goals"]!.AsArray()[0]!["name"] = "INVALID_BYTE_SENTINEL";
        var body = new JsonObject
        {
            ["workspaceId"] = session.WorkspaceId.ToString(),
            ["revision"] = snapshot.Revision,
            ["data"] = data
        };
        var utf8 = Encoding.UTF8.GetBytes(body.ToJsonString());
        var marker = Encoding.ASCII.GetBytes("INVALID_BYTE_SENTINEL");
        var markerIndex = utf8.AsSpan().IndexOf(marker);
        markerIndex.ShouldBeGreaterThanOrEqualTo(0);
        utf8[markerIndex] = 0xF3;

        var csrf = await client.GetFromJsonAsync<CsrfTokenResponse>("/api/auth/csrf");
        csrf.ShouldNotBeNull();
        using var request = new HttpRequestMessage(HttpMethod.Put, "/api/data/snapshot");
        request.Headers.Add("X-XSRF-TOKEN", csrf.RequestToken);
        request.Content = new ByteArrayContent(utf8);
        request.Content.Headers.ContentType = new MediaTypeHeaderValue("application/json");

        using var response = await client.SendAsync(request);

        response.StatusCode.ShouldBe(
            HttpStatusCode.BadRequest,
            await response.Content.ReadAsStringAsync()
        );
        (await response.Content.ReadAsStringAsync()).ShouldContain("snapshot_invalid");
    }

    [Fact]
    public async Task DemoImport_ShouldAtomicallyConvertToRegisteredWorkspace()
    {
        using var factory = new MigaWebApplicationFactory();
        using var client = factory.CreateClient();
        using var demo = await client.PostWithCsrfAsync("/api/auth/demo", new { });
        demo.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        var seeded =
            await client.GetFromJsonAsync<DataSnapshotResponse>("/api/data/snapshot");
        seeded.ShouldNotBeNull();
        seeded.Data.GetProperty("goals").GetArrayLength().ShouldBeGreaterThan(0);
        var demoSession =
            await client.GetFromJsonAsync<Miga.Contracts.Auth.SessionResponse>(
                "/api/auth/session");
        demoSession!.WorkspaceId.ShouldNotBeNull();

        using var changed = await client.SendWithCsrfAsync(
            HttpMethod.Put,
            "/api/data/snapshot",
            new
            {
                workspaceId = demoSession.WorkspaceId,
                revision = seeded.Revision,
                data = seeded.Data
            });
        changed.StatusCode.ShouldBe(
            HttpStatusCode.OK,
            await changed.Content.ReadAsStringAsync());
        using var register = await client.RegisterAsync(UniqueEmail(), importDemoData: true);
        register.StatusCode.ShouldBe(
            HttpStatusCode.NoContent,
            await register.Content.ReadAsStringAsync());

        var session = await client.GetFromJsonAsync<Miga.Contracts.Auth.SessionResponse>(
            "/api/auth/session");
        session!.AccountType.ShouldBe("registered");
        session.WorkspaceId.ShouldBe(demoSession.WorkspaceId);
        var imported =
            await client.GetFromJsonAsync<DataSnapshotResponse>("/api/data/snapshot");
        imported!.Revision.ShouldBe(2);
        imported.Data.GetProperty("goals").GetArrayLength()
            .ShouldBe(seeded.Data.GetProperty("goals").GetArrayLength());

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<MigaDbContext>();
        (await db.Workspaces.CountAsync(x => x.Kind == WorkspaceKind.Demo)).ShouldBe(0);
        (await db.DemoSessions.CountAsync()).ShouldBe(0);
        (await db.Workspaces.CountAsync(x => x.Kind == WorkspaceKind.Registered)).ShouldBe(1);
        (await db.Users.CountAsync()).ShouldBe(1);
    }

    [Fact]
    public async Task DemoConsumption_ShouldRejectAStaleSnapshotRevisionWithoutDeletingWorkspace()
    {
        using var factory = new MigaWebApplicationFactory();
        using var client = factory.CreateClient();
        using var demo = await client.PostWithCsrfAsync("/api/auth/demo", new { });
        demo.StatusCode.ShouldBe(HttpStatusCode.NoContent);

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<MigaDbContext>();
        var snapshot = await db.WorkspaceSnapshots.SingleAsync();
        var workspaceId = snapshot.WorkspaceId;
        snapshot.Revision = 1;
        await db.SaveChangesAsync();

        await using (var transaction = await db.Database.BeginTransactionAsync())
        {
            var service =
                scope.ServiceProvider.GetRequiredService<IDemoWorkspaceConsumptionService>();
            (await service.TryConvertAsync(
                    workspaceId,
                    (await db.DemoSessions.AsNoTracking().SingleAsync()).Id,
                    expectedRevision: 0,
                    ownerUserId: Guid.CreateVersion7(),
                    convertedAtUtc: DateTimeOffset.UtcNow))
                .ShouldBeFalse();
            await transaction.RollbackAsync();
        }

        (await db.Workspaces.AnyAsync(workspace => workspace.Id == workspaceId))
            .ShouldBeTrue();
        (await db.WorkspaceSnapshots
                .AsNoTracking()
                .SingleAsync(stored => stored.WorkspaceId == workspaceId))
            .Revision
            .ShouldBe(1);
    }

    [Fact]
    public async Task DemoWorkspaceId_ShouldRemainStableWhenIdleExpiryExtends()
    {
        using var factory = new MigaWebApplicationFactory();
        using var client = factory.CreateClient();
        using var demo = await client.PostWithCsrfAsync("/api/auth/demo", new { });
        demo.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        var initial = await client.GetFromJsonAsync<Miga.Contracts.Auth.SessionResponse>(
            "/api/auth/session");
        initial!.WorkspaceId.ShouldNotBeNull();
        var now = DateTimeOffset.UtcNow;

        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<MigaDbContext>();
            var storedSession = await db.DemoSessions.SingleAsync();
            storedSession.LastSeenAtUtc = now.AddMinutes(-5);
            storedSession.IdleExpiresAtUtc = now.AddMinutes(1);
            await db.SaveChangesAsync();
        }

        var renewed = await client.GetFromJsonAsync<Miga.Contracts.Auth.SessionResponse>(
            "/api/auth/session");
        renewed!.WorkspaceId.ShouldBe(initial.WorkspaceId);

        using var assertionScope = factory.Services.CreateScope();
        var assertionDb = assertionScope.ServiceProvider.GetRequiredService<MigaDbContext>();
        var renewedSession = await assertionDb.DemoSessions.AsNoTracking().SingleAsync();
        renewedSession.IdleExpiresAtUtc.ShouldBeGreaterThan(now.AddMinutes(20));
    }

    [Fact]
    public async Task SnapshotWrite_ShouldRejectWorkspaceAssertionFromAnotherAuthenticatedAccount()
    {
        using var factory = new MigaWebApplicationFactory();
        using var firstClient = factory.CreateClient();
        using var secondClient = factory.CreateClient();
        using var firstRegistration = await firstClient.RegisterAsync(UniqueEmail());
        using var secondRegistration = await secondClient.RegisterAsync(UniqueEmail());
        firstRegistration.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        secondRegistration.StatusCode.ShouldBe(HttpStatusCode.NoContent);

        var firstSession =
            await firstClient.GetFromJsonAsync<Miga.Contracts.Auth.SessionResponse>(
                "/api/auth/session");
        var secondSession =
            await secondClient.GetFromJsonAsync<Miga.Contracts.Auth.SessionResponse>(
                "/api/auth/session");
        var firstSnapshot =
            await firstClient.GetFromJsonAsync<DataSnapshotResponse>("/api/data/snapshot");
        var secondSnapshot =
            await secondClient.GetFromJsonAsync<DataSnapshotResponse>("/api/data/snapshot");
        firstSession!.WorkspaceId.ShouldNotBeNull();
        secondSession!.WorkspaceId.ShouldNotBeNull();
        firstSession.WorkspaceId.ShouldNotBe(secondSession.WorkspaceId);
        firstSnapshot.ShouldNotBeNull();
        secondSnapshot.ShouldNotBeNull();
        firstSnapshot.Revision.ShouldBe(secondSnapshot.Revision);

        using var rejected = await secondClient.SendWithCsrfAsync(
            HttpMethod.Put,
            "/api/data/snapshot",
            new
            {
                workspaceId = firstSession.WorkspaceId,
                revision = secondSnapshot.Revision,
                data = firstSnapshot.Data
            });

        rejected.StatusCode.ShouldBe(HttpStatusCode.Conflict);
        (await rejected.Content.ReadAsStringAsync()).ShouldContain("workspace_scope_mismatch");
        var unchanged =
            await secondClient.GetFromJsonAsync<DataSnapshotResponse>("/api/data/snapshot");
        unchanged!.Revision.ShouldBe(secondSnapshot.Revision);
        unchanged.Data.GetRawText().ShouldBe(secondSnapshot.Data.GetRawText());
    }

    [Fact]
    public async Task Snapshot_ShouldRejectUnknownFields_AndEnforceDemoSizeCap()
    {
        using var factory = new MigaWebApplicationFactory();
        using var client = factory.CreateClient();
        using var demo = await client.PostWithCsrfAsync("/api/auth/demo", new { });
        demo.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        var snapshot =
            await client.GetFromJsonAsync<DataSnapshotResponse>("/api/data/snapshot");
        snapshot.ShouldNotBeNull();

        var unknown = JsonNode.Parse(snapshot.Data.GetRawText())!.AsObject();
        unknown["workspaceId"] = Guid.NewGuid().ToString();
        using var unknownResponse = await client.SendWithCsrfAsync(
            HttpMethod.Put,
            "/api/data/snapshot",
            new
            {
                workspaceId = (await client.GetFromJsonAsync<
                    Miga.Contracts.Auth.SessionResponse>("/api/auth/session"))!.WorkspaceId,
                revision = snapshot.Revision,
                data = unknown
            });
        unknownResponse.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        (await unknownResponse.Content.ReadAsStringAsync()).ShouldContain("snapshot_invalid");

        var oversized = JsonNode.Parse(snapshot.Data.GetRawText())!.AsObject();
        var goalId = oversized["goals"]![0]!["id"]!.GetValue<string>();
        var timestamp = oversized["exportedAt"]!.GetValue<long>() - 1_000;
        var notes = new JsonArray();
        for (var index = 0; index < 6; index++)
        {
            notes.Add(new JsonObject
            {
                ["id"] = Guid.NewGuid().ToString(),
                ["goalIds"] = new JsonArray(goalId),
                ["kind"] = "text",
                ["title"] = $"Large note {index}",
                ["text"] = new string('x', 49_000),
                ["metadata"] = new JsonObject(),
                ["sourceSessionId"] = null,
                ["source"] = "manual",
                ["createdAt"] = timestamp,
                ["updatedAt"] = timestamp
            });
        }
        oversized["notes"] = notes;

        using var oversizedResponse = await client.SendWithCsrfAsync(
            HttpMethod.Put,
            "/api/data/snapshot",
            new
            {
                workspaceId = (await client.GetFromJsonAsync<
                    Miga.Contracts.Auth.SessionResponse>("/api/auth/session"))!.WorkspaceId,
                revision = snapshot.Revision,
                data = oversized
            });
        oversizedResponse.StatusCode.ShouldBe(HttpStatusCode.RequestEntityTooLarge);
        (await oversizedResponse.Content.ReadAsStringAsync()).ShouldContain("snapshot_too_large");
    }

    [Fact]
    public async Task DemoCleanup_ShouldRemoveOnlyExpiredDemoWorkspaces()
    {
        using var factory = new MigaWebApplicationFactory();
        using var client = factory.CreateClient();
        using var register = await client.RegisterAsync(UniqueEmail());
        register.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        var now = DateTimeOffset.UtcNow;
        var expiredWorkspaceId = Guid.CreateVersion7();

        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<MigaDbContext>();
            var workspace = new Workspace
            {
                Id = expiredWorkspaceId,
                Kind = WorkspaceKind.Demo,
                CreatedAtUtc = now.AddHours(-3),
                ExpiresAtUtc = now.AddHours(-1),
                Snapshot = new WorkspaceSnapshot
                {
                    WorkspaceId = expiredWorkspaceId,
                    Revision = 0,
                    DataJson = SnapshotSeedFactory.CreateEmpty(now.AddHours(-3)),
                    UpdatedAtUtc = now.AddHours(-3)
                },
                DemoSession = new DemoSession
                {
                    Id = Guid.CreateVersion7(),
                    WorkspaceId = expiredWorkspaceId,
                    CreatedAtUtc = now.AddHours(-3),
                    LastSeenAtUtc = now.AddHours(-3),
                    IdleExpiresAtUtc = now.AddHours(-2),
                    AbsoluteExpiresAtUtc = now.AddHours(-1)
                }
            };
            db.Workspaces.Add(workspace);
            await db.SaveChangesAsync();
        }

        var cleanup = factory.Services.GetRequiredService<IDemoCleanupService>();
        var removed = await cleanup.CleanupExpiredAsync(now);
        removed.ShouldBe(1);
        (await cleanup.CleanupExpiredAsync(now)).ShouldBe(0);

        using var assertionScope = factory.Services.CreateScope();
        var assertionDb = assertionScope.ServiceProvider.GetRequiredService<MigaDbContext>();
        (await assertionDb.Workspaces.AnyAsync(x => x.Id == expiredWorkspaceId)).ShouldBeFalse();
        (await assertionDb.Workspaces.CountAsync(x => x.Kind == WorkspaceKind.Registered))
            .ShouldBe(1);
        (await assertionDb.Users.CountAsync()).ShouldBe(1);
    }

    [Fact]
    public async Task DemoSession_ShouldNotAccessRegisteredOnlyMaterialProxy()
    {
        using var factory = new MigaWebApplicationFactory();
        using var client = factory.CreateClient();
        using var demo = await client.PostWithCsrfAsync("/api/auth/demo", new { });
        demo.StatusCode.ShouldBe(HttpStatusCode.NoContent);

        using var response = await client.GetAsync(
            "/api/materials/youtube-metadata?url=https%3A%2F%2Fyoutu.be%2FdQw4w9WgXcQ");

        new[] { HttpStatusCode.Unauthorized, HttpStatusCode.Forbidden }
            .ShouldContain(response.StatusCode);
    }

    private static string UniqueEmail() =>
        $"workspace-{Guid.NewGuid():N}@example.test";
}
