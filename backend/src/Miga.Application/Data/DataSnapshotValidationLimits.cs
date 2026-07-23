namespace Miga.Application.Data;

/// <summary>
/// Server-side limits for the lightweight v7 JSON snapshot. Binary blobs are
/// intentionally outside this format.
/// </summary>
public static class DataSnapshotValidationLimits
{
    public const int MaxPayloadUtf8Bytes = 5 * 1024 * 1024;
    public const int MaxErrors = 100;
    public const int MaxJsonDepth = 64;

    public const int MaxGoals = 500;
    public const int MaxSessions = 20_000;
    public const int MaxMaterials = 5_000;
    public const int MaxMaterialGoalLinks = 20_000;
    public const int MaxMaterialProgressRecords = 50_000;
    public const int MaxNotes = 5_000;
    public const int MaxQuestions = 10_000;
    public const int MaxExamAttempts = 10_000;

    public const int MaxScheduledDaysPerGoal = 3_660;
    public const int MaxMaterialsPerSession = 500;
    public const int MaxGoalsPerNote = 100;
    public const int MaxVideoRangesPerProgress = 10_000;
    public const int MaxPagesPerProgress = 10_000;
    public const int MaxAnswersPerQuestion = 10;
    public const int MaxQuestionsPerExam = 500;
    public const int MaxResponsesPerExam = 500;
}
