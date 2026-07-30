using System.Text.Json;

namespace Miga.Infrastructure.Demo;

public static class SnapshotSeedFactory
{
    private static readonly Guid DemoGoalId = Guid.Parse("10000000-0000-4000-8000-000000000001");
    private static readonly Guid DemoSessionId = Guid.Parse("10000000-0000-4000-8000-000000000002");
    private static readonly Guid DemoMaterialId = Guid.Parse("10000000-0000-4000-8000-000000000003");
    private static readonly Guid DemoLinkId = Guid.Parse("10000000-0000-4000-8000-000000000004");
    private static readonly Guid DemoNoteId = Guid.Parse("10000000-0000-4000-8000-000000000005");

    public static string CreateEmpty(DateTimeOffset now) =>
        JsonSerializer.Serialize(new
        {
            version = 7,
            exportedAt = now.ToUnixTimeMilliseconds(),
            goals = Array.Empty<object>(),
            sessions = Array.Empty<object>(),
            materials = Array.Empty<object>(),
            materialGoalLinks = Array.Empty<object>(),
            materialProgress = Array.Empty<object>(),
            notes = Array.Empty<object>(),
            questions = Array.Empty<object>(),
            examAttempts = Array.Empty<object>()
        });

    public static string CreateDemo(DateTimeOffset now)
    {
        var createdAt = now.AddDays(-7).ToUnixTimeMilliseconds();
        var sessionStarted = now.AddDays(-1).AddHours(-1).ToUnixTimeMilliseconds();
        var sessionEnded = now.AddDays(-1).ToUnixTimeMilliseconds();

        return JsonSerializer.Serialize(new
        {
            version = 7,
            exportedAt = now.ToUnixTimeMilliseconds(),
            goals = new[]
            {
                new
                {
                    id = DemoGoalId,
                    name = "Certificación de ejemplo",
                    targetMinutes = 1800,
                    scheduledDays = new[] { now.Date.ToString("yyyy-MM-dd") },
                    createdAt,
                    updatedAt = createdAt
                }
            },
            sessions = new[]
            {
                new
                {
                    id = DemoSessionId,
                    goalId = DemoGoalId,
                    materialIds = new[] { DemoMaterialId },
                    startedAt = sessionStarted,
                    pausedAt = (long?)null,
                    endedAt = (long?)sessionEnded,
                    totalPausedMs = 0,
                    status = "completed",
                    createdAt = sessionStarted,
                    updatedAt = sessionEnded
                }
            },
            materials = new[]
            {
                new
                {
                    id = DemoMaterialId,
                    kind = "link",
                    title = "Guía ficticia de preparación",
                    url = "https://example.com/miga-demo-material",
                    metadata = new { },
                    createdAt,
                    updatedAt = createdAt
                }
            },
            materialGoalLinks = new[]
            {
                new
                {
                    id = DemoLinkId,
                    materialId = DemoMaterialId,
                    goalId = DemoGoalId,
                    createdAt
                }
            },
            materialProgress = Array.Empty<object>(),
            notes = new[]
            {
                new
                {
                    id = DemoNoteId,
                    goalIds = new[] { DemoGoalId },
                    kind = "text",
                    title = "Resumen ficticio",
                    text = "Repasar los conceptos principales y realizar un simulacro.",
                    metadata = new { },
                    sourceSessionId = (Guid?)null,
                    source = "manual",
                    createdAt,
                    updatedAt = createdAt
                }
            },
            questions = Array.Empty<object>(),
            examAttempts = Array.Empty<object>()
        });
    }
}
