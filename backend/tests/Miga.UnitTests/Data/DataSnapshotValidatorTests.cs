using System.Text.Json;
using System.Text.Json.Nodes;
using Miga.Application.Data;
using Shouldly;

namespace Miga.UnitTests.Data;

public sealed class DataSnapshotValidatorTests
{
    private readonly DataSnapshotValidator _sut = new();

    [Fact]
    public void Validate_ShouldRejectNonObjectRoot()
    {
        var result = Validate(new JsonArray());

        result.Errors.ShouldBe(
            [new DataSnapshotValidationError(DataSnapshotValidationErrorCodes.InvalidType, "$")]
        );
    }

    [Fact]
    public void Validate_ShouldAcceptCompleteV7Snapshot()
    {
        var result = Validate(ValidDataSnapshot.Create());

        result.IsValid.ShouldBeTrue(
            string.Join(", ", result.Errors.Select(error => $"{error.Code}@{error.Path}"))
        );
        result.Errors.ShouldBeEmpty();
    }

    [Fact]
    public void Validate_ShouldRejectUnknownPropertiesAtEverySchemaLevel()
    {
        var snapshot = ValidDataSnapshot.Create();
        snapshot["unexpected"] = true;
        Goal(snapshot)["ownerUserId"] = Guid.NewGuid().ToString();
        VideoMetadata(snapshot)["extra"] = "not allowed";
        QuestionAnswer(snapshot)["html"] = "<script>";

        var result = Validate(snapshot);

        result.Errors.Count(error => error.Code == DataSnapshotValidationErrorCodes.UnknownProperty)
            .ShouldBe(4);
    }

    [Theory]
    [InlineData("__proto__")]
    [InlineData("prototype")]
    [InlineData("constructor")]
    [InlineData("__PROTO__")]
    public void Validate_ShouldRejectPrototypePollutionKeysRecursively(string dangerousKey)
    {
        var snapshot = ValidDataSnapshot.Create();
        VideoMetadata(snapshot)[dangerousKey] = new JsonObject
        {
            ["nested"] = new JsonArray(new JsonObject { ["safe"] = true })
        };

        var result = Validate(snapshot);

        result.Errors.ShouldContain(
            error => error.Code == DataSnapshotValidationErrorCodes.PrototypeKey
        );
    }

    [Fact]
    public void Validate_ShouldRejectPrototypeKeyInsideDictionary()
    {
        var snapshot = ValidDataSnapshot.Create();
        PdfProgress(snapshot)["pagesReadCounts"]!.AsObject()["__proto__"] = 1;

        var result = Validate(snapshot);

        result.Errors.ShouldContain(
            error =>
                error.Code == DataSnapshotValidationErrorCodes.PrototypeKey
                && error.Path.EndsWith("pagesReadCounts.__proto__", StringComparison.Ordinal)
        );
    }

    [Fact]
    public void Validate_ShouldRejectDuplicateJsonProperties()
    {
        using var document = JsonDocument.Parse(
            """
            {
              "version": 7,
              "version": 7,
              "exportedAt": 1,
              "goals": [],
              "sessions": [],
              "materials": [],
              "materialGoalLinks": [],
              "materialProgress": [],
              "notes": [],
              "questions": [],
              "examAttempts": []
            }
            """
        );

        var result = _sut.Validate(document.RootElement);

        result.Errors.ShouldContain(
            error =>
                error.Code == DataSnapshotValidationErrorCodes.DuplicateProperty
                && error.Path == "$.version"
        );
    }

    [Fact]
    public void Validate_ShouldRejectMissingFieldsWrongVersionAndWrongTypes()
    {
        var snapshot = ValidDataSnapshot.Create();
        snapshot.Remove("notes");
        snapshot["version"] = 6;
        snapshot["goals"] = "not-an-array";

        var result = Validate(snapshot);

        result.Errors.ShouldContain(
            error =>
                error.Code == DataSnapshotValidationErrorCodes.MissingProperty
                && error.Path == "$.notes"
        );
        result.Errors.ShouldContain(
            error =>
                error.Code == DataSnapshotValidationErrorCodes.InvalidValue
                && error.Path == "$.version"
        );
        result.Errors.ShouldContain(
            error =>
                error.Code == DataSnapshotValidationErrorCodes.InvalidType
                && error.Path == "$.goals"
        );
    }

    [Fact]
    public void Validate_ShouldRejectInvalidAndDuplicateIdentifiers()
    {
        var snapshot = ValidDataSnapshot.Create();
        Goal(snapshot)["id"] = "goal-1";
        var materials = snapshot["materials"]!.AsArray();
        materials[1]!["id"] = ValidDataSnapshot.VideoMaterialId;

        var result = Validate(snapshot);

        result.Errors.ShouldContain(
            error =>
                error.Code == DataSnapshotValidationErrorCodes.InvalidFormat
                && error.Path == "$.goals[0].id"
        );
        result.Errors.ShouldContain(
            error => error.Code == DataSnapshotValidationErrorCodes.DuplicateId
        );
    }

    [Theory]
    [InlineData("javascript:alert(1)")]
    [InlineData("file:///etc/passwd")]
    [InlineData("https://user:password@example.com/")]
    [InlineData("https:\\\\example.com")]
    public void Validate_ShouldRejectUnsafeOrMalformedUrls(string url)
    {
        var snapshot = ValidDataSnapshot.Create();
        VideoMaterial(snapshot)["url"] = url;

        var result = Validate(snapshot);

        result.Errors.ShouldContain(
            error =>
                error.Code == DataSnapshotValidationErrorCodes.InvalidFormat
                && error.Path == "$.materials[0].url"
        );
    }

    [Fact]
    public void Validate_ShouldEnforceStringAndCollectionCaps()
    {
        var snapshot = ValidDataSnapshot.Create();
        Goal(snapshot)["name"] = new string('x', 61);
        var materialIds = Session(snapshot)["materialIds"]!.AsArray();
        for (
            var index = materialIds.Count;
            index <= DataSnapshotValidationLimits.MaxMaterialsPerSession;
            index++
        )
        {
            materialIds.Add(Guid.NewGuid().ToString());
        }

        var result = Validate(snapshot);

        result.Errors.ShouldContain(
            error =>
                error.Code == DataSnapshotValidationErrorCodes.StringTooLong
                && error.Path == "$.goals[0].name"
        );
        result.Errors.ShouldContain(
            error =>
                error.Code == DataSnapshotValidationErrorCodes.TooManyItems
                && error.Path == "$.sessions[0].materialIds"
        );
    }

    [Fact]
    public void Validate_ShouldRejectPayloadAboveUtf8LimitBeforeDeepValidation()
    {
        var snapshot = ValidDataSnapshot.Create();
        snapshot["oversized"] = new string(
            'x',
            DataSnapshotValidationLimits.MaxPayloadUtf8Bytes
        );

        var result = Validate(snapshot);

        result.Errors.ShouldBe(
            [
                new DataSnapshotValidationError(
                    DataSnapshotValidationErrorCodes.PayloadTooLarge,
                    "$"
                )
            ]
        );
    }

    [Fact]
    public void Validate_ShouldRequireStrictMaterialGoalLinkRelations()
    {
        var snapshot = ValidDataSnapshot.Create();
        Link(snapshot)["goalId"] = Guid.NewGuid().ToString();

        var result = Validate(snapshot);

        result.Errors.ShouldContain(
            error =>
                error.Code == DataSnapshotValidationErrorCodes.InvalidReference
                && error.Path == "$.materialGoalLinks[0].goalId"
        );
    }

    [Fact]
    public void Validate_ShouldRejectDuplicateMaterialGoalPairs()
    {
        var snapshot = ValidDataSnapshot.Create();
        var duplicate = Link(snapshot).DeepClone().AsObject();
        duplicate["id"] = Guid.NewGuid().ToString();
        snapshot["materialGoalLinks"]!.AsArray().Add(duplicate);

        var result = Validate(snapshot);

        result.Errors.ShouldContain(
            error => error.Code == DataSnapshotValidationErrorCodes.DuplicateValue
        );
    }

    [Fact]
    public void Validate_ShouldAllowFrontendHistoricalDanglingReferences()
    {
        var snapshot = ValidDataSnapshot.Create();
        var deletedGoalId = Guid.NewGuid().ToString();
        var deletedMaterialId = Guid.NewGuid().ToString();
        var deletedSessionId = Guid.NewGuid().ToString();
        var deletedQuestionId = Guid.NewGuid().ToString();

        Session(snapshot)["goalId"] = deletedGoalId;
        Session(snapshot)["materialIds"] = new JsonArray(deletedMaterialId);
        VideoProgress(snapshot)["materialId"] = deletedMaterialId;
        VideoProgress(snapshot)["goalId"] = deletedGoalId;
        VideoProgress(snapshot)["sessionId"] = deletedSessionId;
        QuestionsAttempt(snapshot)["questionIds"] = new JsonArray(deletedQuestionId);
        ExamResponse(snapshot)["questionId"] = deletedQuestionId;

        var result = Validate(snapshot);

        result.IsValid.ShouldBeTrue(
            string.Join(", ", result.Errors.Select(error => $"{error.Code}@{error.Path}"))
        );
    }

    [Fact]
    public void Validate_ShouldRejectLiveRelationInconsistency()
    {
        var snapshot = ValidDataSnapshot.Create();
        VideoProgress(snapshot)["goalId"] = null;
        Question(snapshot)["goalId"] = Guid.NewGuid().ToString();

        var result = Validate(snapshot);

        result.Errors.ShouldContain(
            error =>
                error.Code == DataSnapshotValidationErrorCodes.Inconsistent
                && error.Path == "$.materialProgress[0].goalId"
        );
        result.Errors.ShouldContain(
            error =>
                error.Code == DataSnapshotValidationErrorCodes.InvalidReference
                && error.Path == "$.questions[0].goalId"
        );
    }

    [Theory]
    [InlineData("running", 1700000070000, null)]
    [InlineData("paused", null, null)]
    [InlineData("completed", null, null)]
    public void Validate_ShouldRejectIncoherentSessionStates(
        string status,
        long? endedAt,
        long? pausedAt
    )
    {
        var snapshot = ValidDataSnapshot.Create();
        Session(snapshot)["status"] = status;
        Session(snapshot)["endedAt"] = endedAt;
        Session(snapshot)["pausedAt"] = pausedAt;

        var result = Validate(snapshot);

        result.Errors.ShouldContain(
            error =>
                error.Code == DataSnapshotValidationErrorCodes.Inconsistent
                && error.Path == "$.sessions[0].status"
        );
    }

    [Fact]
    public void Validate_ShouldRejectMaterialKindAndMetadataMismatch()
    {
        var snapshot = ValidDataSnapshot.Create();
        VideoMaterial(snapshot)["kind"] = "pdf";
        VideoMetadata(snapshot)["provider"] = "youtube";
        VideoMetadata(snapshot)["mimeType"] = "text/html";

        var result = Validate(snapshot);

        result.Errors.ShouldContain(
            error =>
                error.Code == DataSnapshotValidationErrorCodes.Inconsistent
                && error.Path.StartsWith("$.materials[0]", StringComparison.Ordinal)
        );
    }

    [Fact]
    public void Validate_ShouldRejectMalformedProgressRangesAndPages()
    {
        var snapshot = ValidDataSnapshot.Create();
        VideoProgress(snapshot)["videoRanges"] = JsonNode.Parse("[[5, 8], [7, 9]]");
        PdfProgress(snapshot)["pagesRead"] = JsonNode.Parse("[1, 1]");
        PdfProgress(snapshot)["pagesReadCounts"] = JsonNode.Parse("""{"1": 1, "02": 1}""");

        var result = Validate(snapshot);

        result.Errors.ShouldContain(
            error =>
                error.Code == DataSnapshotValidationErrorCodes.Inconsistent
                && error.Path == "$.materialProgress[0].videoRanges[1][0]"
        );
        result.Errors.ShouldContain(
            error => error.Code == DataSnapshotValidationErrorCodes.DuplicateValue
        );
        result.Errors.ShouldContain(
            error => error.Code == DataSnapshotValidationErrorCodes.InvalidFormat
        );
    }

    [Fact]
    public void Validate_ShouldRejectIncoherentNote()
    {
        var snapshot = ValidDataSnapshot.Create();
        var note = Note(snapshot);
        note["source"] = "session";
        note["sourceSessionId"] = null;
        note["text"] = "";

        var result = Validate(snapshot);

        result.Errors.ShouldContain(
            error =>
                error.Code == DataSnapshotValidationErrorCodes.Inconsistent
                && error.Path == "$.notes[0].sourceSessionId"
        );
        result.Errors.ShouldContain(
            error =>
                error.Code == DataSnapshotValidationErrorCodes.Inconsistent
                && error.Path == "$.notes[0].text"
        );
    }

    [Fact]
    public void Validate_ShouldRejectIncoherentQuestion()
    {
        var snapshot = ValidDataSnapshot.Create();
        QuestionAnswer(snapshot)["isCorrect"] = false;
        Question(snapshot)["reviewState"]!["timesSeen"] = 3;

        var result = Validate(snapshot);

        result.Errors.ShouldContain(
            error =>
                error.Code == DataSnapshotValidationErrorCodes.Inconsistent
                && error.Path == "$.questions[0].answers"
        );
        result.Errors.ShouldContain(
            error =>
                error.Code == DataSnapshotValidationErrorCodes.Inconsistent
                && error.Path == "$.questions[0].reviewState.timesSeen"
        );
    }

    [Fact]
    public void Validate_ShouldRejectIncoherentExamScoreAndResponseRelation()
    {
        var snapshot = ValidDataSnapshot.Create();
        QuestionsAttempt(snapshot)["score"] = 0;
        ExamResponse(snapshot)["questionId"] = Guid.NewGuid().ToString();

        var result = Validate(snapshot);

        result.Errors.ShouldContain(
            error =>
                error.Code == DataSnapshotValidationErrorCodes.Inconsistent
                && error.Path == "$.examAttempts[0].score"
        );
        result.Errors.ShouldContain(
            error =>
                error.Code == DataSnapshotValidationErrorCodes.InvalidReference
                && error.Path == "$.examAttempts[0].responses[0].questionId"
        );
    }

    [Fact]
    public void Validate_ShouldBoundReturnedErrors()
    {
        var snapshot = ValidDataSnapshot.Create();
        var goals = snapshot["goals"]!.AsArray();
        for (var index = 0; index < 150; index++)
        {
            goals.Add(new JsonObject { ["unexpected"] = true });
        }

        var result = Validate(snapshot);

        result.Errors.Count.ShouldBe(DataSnapshotValidationLimits.MaxErrors);
        result.Errors[^1].Code.ShouldBe(DataSnapshotValidationErrorCodes.TooManyErrors);
    }

    private DataSnapshotValidationResult Validate(JsonNode node)
    {
        return _sut.Validate(JsonSerializer.SerializeToElement(node));
    }

    private static JsonObject Goal(JsonObject snapshot) =>
        snapshot["goals"]!.AsArray()[0]!.AsObject();

    private static JsonObject Session(JsonObject snapshot) =>
        snapshot["sessions"]!.AsArray()[0]!.AsObject();

    private static JsonObject VideoMaterial(JsonObject snapshot) =>
        snapshot["materials"]!.AsArray()[0]!.AsObject();

    private static JsonObject VideoMetadata(JsonObject snapshot) =>
        VideoMaterial(snapshot)["metadata"]!.AsObject();

    private static JsonObject Link(JsonObject snapshot) =>
        snapshot["materialGoalLinks"]!.AsArray()[0]!.AsObject();

    private static JsonObject VideoProgress(JsonObject snapshot) =>
        snapshot["materialProgress"]!.AsArray()[0]!.AsObject();

    private static JsonObject PdfProgress(JsonObject snapshot) =>
        snapshot["materialProgress"]!.AsArray()[1]!.AsObject();

    private static JsonObject Note(JsonObject snapshot) =>
        snapshot["notes"]!.AsArray()[0]!.AsObject();

    private static JsonObject Question(JsonObject snapshot) =>
        snapshot["questions"]!.AsArray()[0]!.AsObject();

    private static JsonObject QuestionAnswer(JsonObject snapshot) =>
        Question(snapshot)["answers"]!.AsArray()[0]!.AsObject();

    private static JsonObject QuestionsAttempt(JsonObject snapshot) =>
        snapshot["examAttempts"]!.AsArray()[0]!.AsObject();

    private static JsonObject ExamResponse(JsonObject snapshot) =>
        QuestionsAttempt(snapshot)["responses"]!.AsArray()[0]!.AsObject();
}
