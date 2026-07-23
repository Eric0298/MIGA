using System.Globalization;
using System.Text;
using System.Text.Json;

namespace Miga.Application.Data;

/// <summary>
/// Strict validator for MIGA's browser export format v7. It validates the
/// complete aggregate before persistence so a later client never imports a
/// partially valid or cross-linked snapshot.
/// </summary>
public sealed class DataSnapshotValidator : IDataSnapshotValidator
{
    private const long MaxSafeJavaScriptInteger = 9_007_199_254_740_991;
    private const long MaxTimestamp = 8_640_000_000_000;
    private const long MaxPdfBytes = 100L * 1024 * 1024;
    private const long MaxVideoBytes = 500L * 1024 * 1024;
    private const long MaxNoteDocumentBytes = 25L * 1024 * 1024;
    private const long MaxNoteImageBytes = 10L * 1024 * 1024;
    private const long MaxVoiceBytes = 25L * 1024 * 1024;
    private const long MaxVoiceDurationSeconds = 15 * 60;
    private const long MaxTimeLimitMilliseconds = 7L * 24 * 60 * 60 * 1000;
    private const int MaxPageNumber = 100_000;

    private static readonly string[] RootProperties =
    [
        "version",
        "exportedAt",
        "goals",
        "sessions",
        "materials",
        "materialGoalLinks",
        "materialProgress",
        "notes",
        "questions",
        "examAttempts"
    ];

    private static readonly HashSet<string> SessionStatuses =
        new(["running", "paused", "completed", "discarded"], StringComparer.Ordinal);

    private static readonly HashSet<string> MaterialKinds =
        new(["link", "note", "video-youtube", "video-upload", "pdf"], StringComparer.Ordinal);

    private static readonly HashSet<string> MaterialProviders =
        new(["youtube", "upload", "pdf"], StringComparer.Ordinal);

    private static readonly HashSet<string> NoteKinds =
        new(["text", "voice", "document", "image"], StringComparer.Ordinal);

    private static readonly HashSet<string> NoteSources =
        new(["manual", "session", "exam"], StringComparer.Ordinal);

    private static readonly HashSet<string> ExamKinds =
        new(["pdf", "questions"], StringComparer.Ordinal);

    private static readonly HashSet<string> ExamStatuses =
        new(
            ["in-progress", "paused", "pending-grade", "graded", "completed", "discarded"],
            StringComparer.Ordinal
        );

    private static readonly HashSet<string> AllowedDocumentMimeTypes =
        new(
            [
                "application/pdf",
                "application/msword",
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            ],
            StringComparer.OrdinalIgnoreCase
        );

    private static readonly HashSet<string> AllowedImageMimeTypes =
        new(["image/png", "image/jpeg", "image/webp", "image/gif"], StringComparer.OrdinalIgnoreCase);

    public DataSnapshotValidationResult Validate(JsonElement data)
    {
        var context = new ValidationContext();

        if (data.ValueKind != JsonValueKind.Object)
        {
            context.Add(DataSnapshotValidationErrorCodes.InvalidType, "$");
            return context.ToResult();
        }

        var raw = data.GetRawText();
        if (
            raw.Length > DataSnapshotValidationLimits.MaxPayloadUtf8Bytes
            || Encoding.UTF8.GetByteCount(raw) > DataSnapshotValidationLimits.MaxPayloadUtf8Bytes
        )
        {
            context.Add(DataSnapshotValidationErrorCodes.PayloadTooLarge, "$");
            return context.ToResult();
        }

        ScanPropertyNames(data, "$", 0, context);
        ValidateObjectShape(data, "$", RootProperties, RootProperties, context);

        if (
            data.TryGetProperty("version", out var versionElement)
            && TryReadInteger(versionElement, "$.version", 7, 7, context, out _)
        )
        {
            // Literal seven is enforced by the numeric bounds above.
        }

        var exportedAt = MaxTimestamp;
        if (data.TryGetProperty("exportedAt", out var exportedAtElement))
        {
            TryReadInteger(
                exportedAtElement,
                "$.exportedAt",
                1,
                MaxTimestamp,
                context,
                out exportedAt
            );
        }

        var graph = new SnapshotGraph();
        ValidateGoals(data, exportedAt, graph, context);
        ValidateSessions(data, exportedAt, graph, context);
        ValidateMaterials(data, exportedAt, graph, context);
        ValidateMaterialGoalLinks(data, exportedAt, graph, context);
        ValidateMaterialProgress(data, exportedAt, graph, context);
        ValidateNotes(data, exportedAt, graph, context);
        ValidateQuestions(data, exportedAt, graph, context);
        ValidateExamAttempts(data, exportedAt, graph, context);
        ValidateRelations(graph, context);

        return context.ToResult();
    }

    private static void ValidateGoals(
        JsonElement root,
        long exportedAt,
        SnapshotGraph graph,
        ValidationContext context
    )
    {
        if (
            !TryGetArray(
                root,
                "goals",
                "$.goals",
                DataSnapshotValidationLimits.MaxGoals,
                context,
                out var records
            )
        )
        {
            return;
        }

        var count = Math.Min(records.GetArrayLength(), DataSnapshotValidationLimits.MaxGoals);
        for (var index = 0; index < count; index++)
        {
            var path = $"$.goals[{index}]";
            var record = records[index];
            var properties = new[]
            {
                "id",
                "name",
                "targetMinutes",
                "scheduledDays",
                "createdAt",
                "updatedAt"
            };
            if (!ValidateObjectShape(record, path, properties, properties, context))
            {
                continue;
            }

            Guid id = default;
            var hasId =
                record.TryGetProperty("id", out var idElement)
                && TryReadGuid(idElement, $"{path}.id", context, out id);

            if (record.TryGetProperty("name", out var nameElement))
            {
                TryReadString(nameElement, $"{path}.name", 2, 60, false, context, out _);
            }

            if (record.TryGetProperty("targetMinutes", out var targetElement))
            {
                TryReadInteger(targetElement, $"{path}.targetMinutes", 15, 525_600, context, out _);
            }

            if (
                record.TryGetProperty("scheduledDays", out var daysElement)
                && TryValidateArray(
                    daysElement,
                    $"{path}.scheduledDays",
                    1,
                    DataSnapshotValidationLimits.MaxScheduledDaysPerGoal,
                    context
                )
            )
            {
                var seenDays = new HashSet<string>(StringComparer.Ordinal);
                var daysCount = Math.Min(
                    daysElement.GetArrayLength(),
                    DataSnapshotValidationLimits.MaxScheduledDaysPerGoal
                );
                for (var dayIndex = 0; dayIndex < daysCount; dayIndex++)
                {
                    var dayPath = $"{path}.scheduledDays[{dayIndex}]";
                    if (
                        !TryReadString(
                            daysElement[dayIndex],
                            dayPath,
                            10,
                            10,
                            false,
                            context,
                            out var day
                        )
                    )
                    {
                        continue;
                    }

                    if (
                        !DateOnly.TryParseExact(
                            day,
                            "yyyy-MM-dd",
                            CultureInfo.InvariantCulture,
                            DateTimeStyles.None,
                            out _
                        )
                    )
                    {
                        context.Add(DataSnapshotValidationErrorCodes.InvalidFormat, dayPath);
                    }
                    else if (!seenDays.Add(day))
                    {
                        context.Add(DataSnapshotValidationErrorCodes.DuplicateValue, dayPath);
                    }
                }
            }

            var hasCreatedAt = TryReadTimestamp(record, "createdAt", path, context, out var createdAt);
            var hasUpdatedAt = TryReadTimestamp(record, "updatedAt", path, context, out var updatedAt);
            ValidateCreatedAndUpdated(
                path,
                hasCreatedAt,
                createdAt,
                hasUpdatedAt,
                updatedAt,
                exportedAt,
                context
            );

            if (hasId)
            {
                AddUniqueId(graph.GoalIds, id, $"{path}.id", context);
            }
        }
    }

    private static void ValidateSessions(
        JsonElement root,
        long exportedAt,
        SnapshotGraph graph,
        ValidationContext context
    )
    {
        if (
            !TryGetArray(
                root,
                "sessions",
                "$.sessions",
                DataSnapshotValidationLimits.MaxSessions,
                context,
                out var records
            )
        )
        {
            return;
        }

        var activeSessionCount = 0;
        var count = Math.Min(records.GetArrayLength(), DataSnapshotValidationLimits.MaxSessions);
        for (var index = 0; index < count; index++)
        {
            var path = $"$.sessions[{index}]";
            var record = records[index];
            var properties = new[]
            {
                "id",
                "goalId",
                "startedAt",
                "pausedAt",
                "endedAt",
                "totalPausedMs",
                "status",
                "createdAt",
                "updatedAt",
                "materialIds"
            };
            if (!ValidateObjectShape(record, path, properties, properties, context))
            {
                continue;
            }

            Guid id = default;
            var hasId =
                record.TryGetProperty("id", out var idElement)
                && TryReadGuid(idElement, $"{path}.id", context, out id);
            TryReadNullableGuid(record, "goalId", path, context, out var goalId);

            var materialIds = new HashSet<Guid>();
            if (
                record.TryGetProperty("materialIds", out var materialIdsElement)
                && TryValidateArray(
                    materialIdsElement,
                    $"{path}.materialIds",
                    0,
                    DataSnapshotValidationLimits.MaxMaterialsPerSession,
                    context
                )
            )
            {
                var materialCount = Math.Min(
                    materialIdsElement.GetArrayLength(),
                    DataSnapshotValidationLimits.MaxMaterialsPerSession
                );
                for (var materialIndex = 0; materialIndex < materialCount; materialIndex++)
                {
                    var materialPath = $"{path}.materialIds[{materialIndex}]";
                    if (
                        TryReadGuid(
                            materialIdsElement[materialIndex],
                            materialPath,
                            context,
                            out var materialId
                        )
                        && !materialIds.Add(materialId)
                    )
                    {
                        context.Add(DataSnapshotValidationErrorCodes.DuplicateValue, materialPath);
                    }
                }
            }

            string? status = null;
            var hasStatus =
                record.TryGetProperty("status", out var statusElement)
                && TryReadEnum(
                    statusElement,
                    $"{path}.status",
                    SessionStatuses,
                    context,
                    out status
                );
            status ??= string.Empty;

            var hasStartedAt = TryReadTimestamp(record, "startedAt", path, context, out var startedAt);
            TryReadNullableTimestamp(record, "pausedAt", path, context, out var pausedAt);
            TryReadNullableTimestamp(record, "endedAt", path, context, out var endedAt);
            long totalPausedMs = default;
            var hasTotalPaused =
                record.TryGetProperty("totalPausedMs", out var totalPausedElement)
                && TryReadInteger(
                    totalPausedElement,
                    $"{path}.totalPausedMs",
                    0,
                    MaxSafeJavaScriptInteger,
                    context,
                    out totalPausedMs
                );
            var hasCreatedAt = TryReadTimestamp(record, "createdAt", path, context, out var createdAt);
            var hasUpdatedAt = TryReadTimestamp(record, "updatedAt", path, context, out var updatedAt);

            ValidateCreatedAndUpdated(
                path,
                hasCreatedAt,
                createdAt,
                hasUpdatedAt,
                updatedAt,
                exportedAt,
                context
            );
            ValidateTimestampAtMost(startedAt, exportedAt, $"{path}.startedAt", hasStartedAt, context);
            ValidateTimestampAtMost(pausedAt, exportedAt, $"{path}.pausedAt", context);
            ValidateTimestampAtMost(endedAt, exportedAt, $"{path}.endedAt", context);

            if (hasCreatedAt && hasStartedAt && startedAt < createdAt)
            {
                context.Add(DataSnapshotValidationErrorCodes.Inconsistent, $"{path}.startedAt");
            }
            if (pausedAt is not null && hasStartedAt && pausedAt < startedAt)
            {
                context.Add(DataSnapshotValidationErrorCodes.Inconsistent, $"{path}.pausedAt");
            }
            if (endedAt is not null && hasStartedAt && endedAt < startedAt)
            {
                context.Add(DataSnapshotValidationErrorCodes.Inconsistent, $"{path}.endedAt");
            }
            if (hasUpdatedAt && pausedAt is not null && pausedAt > updatedAt)
            {
                context.Add(DataSnapshotValidationErrorCodes.Inconsistent, $"{path}.pausedAt");
            }
            if (hasUpdatedAt && endedAt is not null && endedAt > updatedAt)
            {
                context.Add(DataSnapshotValidationErrorCodes.Inconsistent, $"{path}.endedAt");
            }

            if (hasStatus)
            {
                var isActive = status is "running" or "paused";
                if (isActive)
                {
                    activeSessionCount++;
                }

                var stateIsCoherent = status switch
                {
                    "running" => pausedAt is null && endedAt is null,
                    "paused" => pausedAt is not null && endedAt is null,
                    "completed" or "discarded" => pausedAt is null && endedAt is not null,
                    _ => false
                };
                if (!stateIsCoherent)
                {
                    context.Add(DataSnapshotValidationErrorCodes.Inconsistent, $"{path}.status");
                }
            }

            if (hasTotalPaused && hasStartedAt)
            {
                var comparisonEnd = endedAt ?? exportedAt;
                if (comparisonEnd >= startedAt && totalPausedMs > comparisonEnd - startedAt)
                {
                    context.Add(DataSnapshotValidationErrorCodes.Inconsistent, $"{path}.totalPausedMs");
                }
            }

            if (hasId)
            {
                if (AddUniqueId(graph.SessionIds, id, $"{path}.id", context))
                {
                    graph.Sessions[id] = new SessionInfo(path, goalId, materialIds);
                }
            }
        }

        if (activeSessionCount > 1)
        {
            context.Add(DataSnapshotValidationErrorCodes.Inconsistent, "$.sessions");
        }
    }

    private static void ValidateMaterials(
        JsonElement root,
        long exportedAt,
        SnapshotGraph graph,
        ValidationContext context
    )
    {
        if (
            !TryGetArray(
                root,
                "materials",
                "$.materials",
                DataSnapshotValidationLimits.MaxMaterials,
                context,
                out var records
            )
        )
        {
            return;
        }

        var count = Math.Min(records.GetArrayLength(), DataSnapshotValidationLimits.MaxMaterials);
        for (var index = 0; index < count; index++)
        {
            var path = $"$.materials[{index}]";
            var record = records[index];
            var required = new[] { "id", "kind", "title", "metadata", "createdAt", "updatedAt" };
            var allowed = new[]
            {
                "id",
                "kind",
                "title",
                "url",
                "notes",
                "fileBlobKey",
                "metadata",
                "createdAt",
                "updatedAt"
            };
            if (!ValidateObjectShape(record, path, allowed, required, context))
            {
                continue;
            }

            Guid id = default;
            var hasId =
                record.TryGetProperty("id", out var idElement)
                && TryReadGuid(idElement, $"{path}.id", context, out id);
            string? kind = null;
            var hasKind =
                record.TryGetProperty("kind", out var kindElement)
                && TryReadEnum(
                    kindElement,
                    $"{path}.kind",
                    MaterialKinds,
                    context,
                    out kind
                );
            kind ??= string.Empty;

            if (record.TryGetProperty("title", out var titleElement))
            {
                TryReadString(titleElement, $"{path}.title", 1, 80, false, context, out _);
            }

            string? url = null;
            var hasUrlProperty = record.TryGetProperty("url", out var urlElement);
            if (hasUrlProperty)
            {
                TryReadHttpUrl(urlElement, $"{path}.url", context, out url);
            }

            string? notes = null;
            var hasNotesProperty = record.TryGetProperty("notes", out var notesElement);
            if (hasNotesProperty)
            {
                TryReadString(notesElement, $"{path}.notes", 0, 500, true, context, out notes);
            }

            Guid fileBlobKey = default;
            var hasFileBlobKey =
                record.TryGetProperty("fileBlobKey", out var blobElement)
                && TryReadGuid(blobElement, $"{path}.fileBlobKey", context, out fileBlobKey);

            var metadata = default(MaterialMetadataInfo);
            if (record.TryGetProperty("metadata", out var metadataElement))
            {
                metadata = ValidateMaterialMetadata(metadataElement, $"{path}.metadata", context);
            }

            var hasCreatedAt = TryReadTimestamp(record, "createdAt", path, context, out var createdAt);
            var hasUpdatedAt = TryReadTimestamp(record, "updatedAt", path, context, out var updatedAt);
            ValidateCreatedAndUpdated(
                path,
                hasCreatedAt,
                createdAt,
                hasUpdatedAt,
                updatedAt,
                exportedAt,
                context
            );

            if (hasKind)
            {
                if (kind is "link" or "video-youtube")
                {
                    if (url is null)
                    {
                        context.Add(DataSnapshotValidationErrorCodes.Inconsistent, $"{path}.url");
                    }
                }
                else if (hasUrlProperty)
                {
                    context.Add(DataSnapshotValidationErrorCodes.Inconsistent, $"{path}.url");
                }

                if (kind == "note")
                {
                    if (string.IsNullOrWhiteSpace(notes))
                    {
                        context.Add(DataSnapshotValidationErrorCodes.Inconsistent, $"{path}.notes");
                    }
                }
                else if (hasNotesProperty)
                {
                    context.Add(DataSnapshotValidationErrorCodes.Inconsistent, $"{path}.notes");
                }

                if (kind is "video-upload" or "pdf")
                {
                    if (!hasFileBlobKey)
                    {
                        context.Add(
                            DataSnapshotValidationErrorCodes.Inconsistent,
                            $"{path}.fileBlobKey"
                        );
                    }
                }
                else if (record.TryGetProperty("fileBlobKey", out _))
                {
                    context.Add(
                        DataSnapshotValidationErrorCodes.Inconsistent,
                        $"{path}.fileBlobKey"
                    );
                }

                ValidateMaterialMetadataCoherence(kind, metadata, $"{path}.metadata", context);
            }

            if (hasId)
            {
                if (AddUniqueId(graph.MaterialIds, id, $"{path}.id", context))
                {
                    graph.Materials[id] = new MaterialInfo(
                        path,
                        kind,
                        metadata.DurationSeconds,
                        metadata.TotalPages
                    );
                }
            }
        }
    }

    private static MaterialMetadataInfo ValidateMaterialMetadata(
        JsonElement metadata,
        string path,
        ValidationContext context
    )
    {
        var allowed = new[]
        {
            "provider",
            "youtubeVideoId",
            "thumbnailUrl",
            "author",
            "durationSeconds",
            "totalPages",
            "mimeType",
            "fileSizeBytes"
        };
        if (!ValidateObjectShape(metadata, path, allowed, [], context))
        {
            return default;
        }

        string? provider = null;
        if (metadata.TryGetProperty("provider", out var providerElement))
        {
            TryReadEnum(providerElement, $"{path}.provider", MaterialProviders, context, out provider);
        }

        if (metadata.TryGetProperty("youtubeVideoId", out var videoIdElement))
        {
            if (
                TryReadString(
                    videoIdElement,
                    $"{path}.youtubeVideoId",
                    11,
                    11,
                    false,
                    context,
                    out var videoId
                )
                && !IsYouTubeVideoId(videoId)
            )
            {
                context.Add(DataSnapshotValidationErrorCodes.InvalidFormat, $"{path}.youtubeVideoId");
            }
        }

        if (metadata.TryGetProperty("thumbnailUrl", out var thumbnailElement))
        {
            TryReadHttpUrl(thumbnailElement, $"{path}.thumbnailUrl", context, out _);
        }

        if (metadata.TryGetProperty("author", out var authorElement))
        {
            TryReadString(authorElement, $"{path}.author", 0, 200, false, context, out _);
        }

        long? durationSeconds = null;
        if (
            metadata.TryGetProperty("durationSeconds", out var durationElement)
            && TryReadInteger(
                durationElement,
                $"{path}.durationSeconds",
                0,
                365 * 24 * 60 * 60,
                context,
                out var duration
            )
        )
        {
            durationSeconds = duration;
        }

        long? totalPages = null;
        if (
            metadata.TryGetProperty("totalPages", out var totalPagesElement)
            && TryReadInteger(
                totalPagesElement,
                $"{path}.totalPages",
                1,
                MaxPageNumber,
                context,
                out var pages
            )
        )
        {
            totalPages = pages;
        }

        string? mimeType = null;
        if (
            metadata.TryGetProperty("mimeType", out var mimeElement)
            && TryReadString(
                mimeElement,
                $"{path}.mimeType",
                3,
                200,
                false,
                context,
                out var mime
            )
        )
        {
            if (!IsMimeType(mime))
            {
                context.Add(DataSnapshotValidationErrorCodes.InvalidFormat, $"{path}.mimeType");
            }
            else
            {
                mimeType = mime;
            }
        }

        long? fileSizeBytes = null;
        if (
            metadata.TryGetProperty("fileSizeBytes", out var sizeElement)
            && TryReadInteger(
                sizeElement,
                $"{path}.fileSizeBytes",
                0,
                MaxVideoBytes,
                context,
                out var size
            )
        )
        {
            fileSizeBytes = size;
        }

        return new MaterialMetadataInfo(
            provider,
            durationSeconds,
            totalPages,
            mimeType,
            fileSizeBytes,
            metadata.TryGetProperty("youtubeVideoId", out _),
            metadata.TryGetProperty("thumbnailUrl", out _)
        );
    }

    private static void ValidateMaterialMetadataCoherence(
        string kind,
        MaterialMetadataInfo metadata,
        string path,
        ValidationContext context
    )
    {
        var expectedProvider = kind switch
        {
            "video-youtube" => "youtube",
            "video-upload" => "upload",
            "pdf" => "pdf",
            _ => null
        };

        if (metadata.Provider is not null && metadata.Provider != expectedProvider)
        {
            context.Add(DataSnapshotValidationErrorCodes.Inconsistent, $"{path}.provider");
        }

        if (kind != "video-youtube" && (metadata.HasYouTubeVideoId || metadata.HasThumbnailUrl))
        {
            context.Add(DataSnapshotValidationErrorCodes.Inconsistent, path);
        }

        if (metadata.DurationSeconds is not null && kind is not ("video-youtube" or "video-upload"))
        {
            context.Add(DataSnapshotValidationErrorCodes.Inconsistent, $"{path}.durationSeconds");
        }

        if (metadata.TotalPages is not null && kind != "pdf")
        {
            context.Add(DataSnapshotValidationErrorCodes.Inconsistent, $"{path}.totalPages");
        }

        if (kind == "pdf")
        {
            if (
                metadata.MimeType is not null
                && !string.Equals(metadata.MimeType, "application/pdf", StringComparison.OrdinalIgnoreCase)
            )
            {
                context.Add(DataSnapshotValidationErrorCodes.Inconsistent, $"{path}.mimeType");
            }
            if (metadata.FileSizeBytes > MaxPdfBytes)
            {
                context.Add(DataSnapshotValidationErrorCodes.InvalidValue, $"{path}.fileSizeBytes");
            }
        }
        else if (kind == "video-upload")
        {
            if (
                metadata.MimeType is not null
                && !metadata.MimeType.StartsWith("video/", StringComparison.OrdinalIgnoreCase)
            )
            {
                context.Add(DataSnapshotValidationErrorCodes.Inconsistent, $"{path}.mimeType");
            }
        }
        else if (metadata.MimeType is not null || metadata.FileSizeBytes is not null)
        {
            context.Add(DataSnapshotValidationErrorCodes.Inconsistent, path);
        }
    }

    private static void ValidateMaterialGoalLinks(
        JsonElement root,
        long exportedAt,
        SnapshotGraph graph,
        ValidationContext context
    )
    {
        if (
            !TryGetArray(
                root,
                "materialGoalLinks",
                "$.materialGoalLinks",
                DataSnapshotValidationLimits.MaxMaterialGoalLinks,
                context,
                out var records
            )
        )
        {
            return;
        }

        var count = Math.Min(
            records.GetArrayLength(),
            DataSnapshotValidationLimits.MaxMaterialGoalLinks
        );
        for (var index = 0; index < count; index++)
        {
            var path = $"$.materialGoalLinks[{index}]";
            var record = records[index];
            var properties = new[] { "id", "materialId", "goalId", "createdAt" };
            if (!ValidateObjectShape(record, path, properties, properties, context))
            {
                continue;
            }

            Guid id = default;
            var hasId =
                record.TryGetProperty("id", out var idElement)
                && TryReadGuid(idElement, $"{path}.id", context, out id);
            Guid materialId = default;
            var hasMaterialId =
                record.TryGetProperty("materialId", out var materialElement)
                && TryReadGuid(materialElement, $"{path}.materialId", context, out materialId);
            Guid goalId = default;
            var hasGoalId =
                record.TryGetProperty("goalId", out var goalElement)
                && TryReadGuid(goalElement, $"{path}.goalId", context, out goalId);

            if (
                record.TryGetProperty("createdAt", out var createdElement)
                && TryReadInteger(
                    createdElement,
                    $"{path}.createdAt",
                    0,
                    MaxTimestamp,
                    context,
                    out var createdAt
                )
            )
            {
                ValidateTimestampAtMost(createdAt, exportedAt, $"{path}.createdAt", true, context);
            }

            if (hasId)
            {
                AddUniqueId(graph.MaterialGoalLinkIds, id, $"{path}.id", context);
            }

            if (hasMaterialId && hasGoalId)
            {
                if (!graph.MaterialGoalPairs.Add((materialId, goalId)))
                {
                    context.Add(DataSnapshotValidationErrorCodes.DuplicateValue, path);
                }
                graph.MaterialGoalLinks.Add(new MaterialGoalLinkInfo(path, materialId, goalId));
            }
        }
    }

    private static void ValidateMaterialProgress(
        JsonElement root,
        long exportedAt,
        SnapshotGraph graph,
        ValidationContext context
    )
    {
        if (
            !TryGetArray(
                root,
                "materialProgress",
                "$.materialProgress",
                DataSnapshotValidationLimits.MaxMaterialProgressRecords,
                context,
                out var records
            )
        )
        {
            return;
        }

        var count = Math.Min(
            records.GetArrayLength(),
            DataSnapshotValidationLimits.MaxMaterialProgressRecords
        );
        for (var index = 0; index < count; index++)
        {
            var path = $"$.materialProgress[{index}]";
            var record = records[index];
            var required = new[]
            {
                "id",
                "materialId",
                "goalId",
                "sessionId",
                "kind",
                "totalWatchedMs",
                "startedAt",
                "endedAt",
                "createdAt",
                "updatedAt"
            };
            var allowed = new[]
            {
                "id",
                "materialId",
                "goalId",
                "sessionId",
                "kind",
                "totalWatchedMs",
                "videoRanges",
                "pagesRead",
                "pagesReadCounts",
                "startedAt",
                "endedAt",
                "createdAt",
                "updatedAt"
            };
            if (!ValidateObjectShape(record, path, allowed, required, context))
            {
                continue;
            }

            Guid id = default;
            var hasId =
                record.TryGetProperty("id", out var idElement)
                && TryReadGuid(idElement, $"{path}.id", context, out id);
            Guid materialId = default;
            var hasMaterialId =
                record.TryGetProperty("materialId", out var materialElement)
                && TryReadGuid(materialElement, $"{path}.materialId", context, out materialId);
            TryReadNullableGuid(record, "goalId", path, context, out var goalId);
            TryReadNullableGuid(record, "sessionId", path, context, out var sessionId);

            string? kind = null;
            var hasKind =
                record.TryGetProperty("kind", out var kindElement)
                && TryReadEnum(
                    kindElement,
                    $"{path}.kind",
                    MaterialKinds,
                    context,
                    out kind
                );
            kind ??= string.Empty;

            long totalWatchedMs = default;
            var hasTotalWatched =
                record.TryGetProperty("totalWatchedMs", out var watchedElement)
                && TryReadInteger(
                    watchedElement,
                    $"{path}.totalWatchedMs",
                    0,
                    MaxSafeJavaScriptInteger,
                    context,
                    out totalWatchedMs
                );

            var hasVideoRanges = record.TryGetProperty("videoRanges", out var rangesElement);
            if (hasVideoRanges)
            {
                ValidateVideoRanges(rangesElement, $"{path}.videoRanges", context);
            }

            var hasPagesRead = record.TryGetProperty("pagesRead", out var pagesElement);
            HashSet<int>? pagesRead = null;
            if (hasPagesRead)
            {
                pagesRead = ValidatePagesRead(pagesElement, $"{path}.pagesRead", context);
            }

            var hasPageCounts = record.TryGetProperty("pagesReadCounts", out var countsElement);
            HashSet<int>? countedPages = null;
            if (hasPageCounts)
            {
                countedPages = ValidatePageCounts(
                    countsElement,
                    $"{path}.pagesReadCounts",
                    context
                );
            }

            var hasStartedAt = TryReadTimestamp(record, "startedAt", path, context, out var startedAt);
            var hasEndedAt = TryReadTimestamp(record, "endedAt", path, context, out var endedAt);
            var hasCreatedAt = TryReadTimestamp(record, "createdAt", path, context, out var createdAt);
            var hasUpdatedAt = TryReadTimestamp(record, "updatedAt", path, context, out var updatedAt);

            ValidateCreatedAndUpdated(
                path,
                hasCreatedAt,
                createdAt,
                hasUpdatedAt,
                updatedAt,
                exportedAt,
                context
            );
            ValidateTimestampAtMost(startedAt, exportedAt, $"{path}.startedAt", hasStartedAt, context);
            ValidateTimestampAtMost(endedAt, exportedAt, $"{path}.endedAt", hasEndedAt, context);

            if (hasStartedAt && hasEndedAt && endedAt < startedAt)
            {
                context.Add(DataSnapshotValidationErrorCodes.Inconsistent, $"{path}.endedAt");
            }
            if (hasEndedAt && hasCreatedAt && endedAt > createdAt)
            {
                context.Add(DataSnapshotValidationErrorCodes.Inconsistent, $"{path}.createdAt");
            }
            if (
                hasTotalWatched
                && hasStartedAt
                && hasEndedAt
                && endedAt >= startedAt
                && totalWatchedMs > endedAt - startedAt
            )
            {
                context.Add(
                    DataSnapshotValidationErrorCodes.Inconsistent,
                    $"{path}.totalWatchedMs"
                );
            }

            if (hasKind)
            {
                var isVideo = kind is "video-youtube" or "video-upload";
                if (hasVideoRanges && !isVideo)
                {
                    context.Add(DataSnapshotValidationErrorCodes.Inconsistent, $"{path}.videoRanges");
                }
                if ((hasPagesRead || hasPageCounts) && kind != "pdf")
                {
                    context.Add(DataSnapshotValidationErrorCodes.Inconsistent, path);
                }
            }

            if (
                pagesRead is not null
                && countedPages is not null
                && !pagesRead.SetEquals(countedPages)
            )
            {
                context.Add(DataSnapshotValidationErrorCodes.Inconsistent, $"{path}.pagesReadCounts");
            }

            if (hasId)
            {
                AddUniqueId(graph.MaterialProgressIds, id, $"{path}.id", context);
            }
            graph.MaterialProgress.Add(
                new MaterialProgressInfo(
                    path,
                    hasMaterialId ? materialId : null,
                    goalId,
                    sessionId,
                    hasKind ? kind : null
                )
            );
        }
    }

    private static void ValidateVideoRanges(
        JsonElement ranges,
        string path,
        ValidationContext context
    )
    {
        if (
            !TryValidateArray(
                ranges,
                path,
                0,
                DataSnapshotValidationLimits.MaxVideoRangesPerProgress,
                context
            )
        )
        {
            return;
        }

        double? previousEnd = null;
        var count = Math.Min(
            ranges.GetArrayLength(),
            DataSnapshotValidationLimits.MaxVideoRangesPerProgress
        );
        for (var index = 0; index < count; index++)
        {
            var rangePath = $"{path}[{index}]";
            var range = ranges[index];
            if (!TryValidateArray(range, rangePath, 2, 2, context))
            {
                continue;
            }

            var hasStart = TryReadNumber(
                range[0],
                $"{rangePath}[0]",
                0,
                365 * 24 * 60 * 60,
                context,
                out var start
            );
            var hasEnd = TryReadNumber(
                range[1],
                $"{rangePath}[1]",
                0,
                365 * 24 * 60 * 60,
                context,
                out var end
            );
            if (!hasStart || !hasEnd)
            {
                continue;
            }

            if (end < start)
            {
                context.Add(DataSnapshotValidationErrorCodes.Inconsistent, $"{rangePath}[1]");
            }
            if (previousEnd is not null && start < previousEnd)
            {
                context.Add(DataSnapshotValidationErrorCodes.Inconsistent, $"{rangePath}[0]");
            }
            previousEnd = end;
        }
    }

    private static HashSet<int>? ValidatePagesRead(
        JsonElement pages,
        string path,
        ValidationContext context
    )
    {
        if (
            !TryValidateArray(
                pages,
                path,
                0,
                DataSnapshotValidationLimits.MaxPagesPerProgress,
                context
            )
        )
        {
            return null;
        }

        var result = new HashSet<int>();
        var count = Math.Min(
            pages.GetArrayLength(),
            DataSnapshotValidationLimits.MaxPagesPerProgress
        );
        for (var index = 0; index < count; index++)
        {
            var pagePath = $"{path}[{index}]";
            if (
                TryReadInteger(pages[index], pagePath, 1, MaxPageNumber, context, out var page)
                && !result.Add((int)page)
            )
            {
                context.Add(DataSnapshotValidationErrorCodes.DuplicateValue, pagePath);
            }
        }
        return result;
    }

    private static HashSet<int>? ValidatePageCounts(
        JsonElement counts,
        string path,
        ValidationContext context
    )
    {
        if (counts.ValueKind != JsonValueKind.Object)
        {
            context.Add(DataSnapshotValidationErrorCodes.InvalidType, path);
            return null;
        }

        var propertyCount = counts.EnumerateObject().Count();
        if (propertyCount > DataSnapshotValidationLimits.MaxPagesPerProgress)
        {
            context.Add(DataSnapshotValidationErrorCodes.TooManyItems, path);
        }

        var result = new HashSet<int>();
        var index = 0;
        foreach (var property in counts.EnumerateObject())
        {
            if (index++ >= DataSnapshotValidationLimits.MaxPagesPerProgress)
            {
                break;
            }

            var propertyPath = AppendPropertyPath(path, property.Name);
            if (
                !int.TryParse(
                    property.Name,
                    NumberStyles.None,
                    CultureInfo.InvariantCulture,
                    out var page
                )
                || page < 1
                || page > MaxPageNumber
                || !string.Equals(
                    property.Name,
                    page.ToString(CultureInfo.InvariantCulture),
                    StringComparison.Ordinal
                )
            )
            {
                context.Add(DataSnapshotValidationErrorCodes.InvalidFormat, propertyPath);
                continue;
            }

            result.Add(page);
            TryReadInteger(
                property.Value,
                propertyPath,
                0,
                1_000_000,
                context,
                out _
            );
        }
        return result;
    }

    private static void ValidateNotes(
        JsonElement root,
        long exportedAt,
        SnapshotGraph graph,
        ValidationContext context
    )
    {
        if (
            !TryGetArray(
                root,
                "notes",
                "$.notes",
                DataSnapshotValidationLimits.MaxNotes,
                context,
                out var records
            )
        )
        {
            return;
        }

        var count = Math.Min(records.GetArrayLength(), DataSnapshotValidationLimits.MaxNotes);
        for (var index = 0; index < count; index++)
        {
            var path = $"$.notes[{index}]";
            var record = records[index];
            var required = new[]
            {
                "id",
                "goalIds",
                "kind",
                "title",
                "metadata",
                "sourceSessionId",
                "source",
                "createdAt",
                "updatedAt"
            };
            var allowed = new[]
            {
                "id",
                "goalIds",
                "kind",
                "title",
                "text",
                "fileBlobKey",
                "metadata",
                "sourceSessionId",
                "source",
                "createdAt",
                "updatedAt"
            };
            if (!ValidateObjectShape(record, path, allowed, required, context))
            {
                continue;
            }

            Guid id = default;
            var hasId =
                record.TryGetProperty("id", out var idElement)
                && TryReadGuid(idElement, $"{path}.id", context, out id);

            var goalIds = new HashSet<Guid>();
            if (
                record.TryGetProperty("goalIds", out var goalsElement)
                && TryValidateArray(
                    goalsElement,
                    $"{path}.goalIds",
                    1,
                    DataSnapshotValidationLimits.MaxGoalsPerNote,
                    context
                )
            )
            {
                var goalCount = Math.Min(
                    goalsElement.GetArrayLength(),
                    DataSnapshotValidationLimits.MaxGoalsPerNote
                );
                for (var goalIndex = 0; goalIndex < goalCount; goalIndex++)
                {
                    var goalPath = $"{path}.goalIds[{goalIndex}]";
                    if (
                        TryReadGuid(
                            goalsElement[goalIndex],
                            goalPath,
                            context,
                            out var goalId
                        )
                        && !goalIds.Add(goalId)
                    )
                    {
                        context.Add(DataSnapshotValidationErrorCodes.DuplicateValue, goalPath);
                    }
                }
            }

            string? kind = null;
            var hasKind =
                record.TryGetProperty("kind", out var kindElement)
                && TryReadEnum(kindElement, $"{path}.kind", NoteKinds, context, out kind);
            kind ??= string.Empty;
            string? source = null;
            var hasSource =
                record.TryGetProperty("source", out var sourceElement)
                && TryReadEnum(
                    sourceElement,
                    $"{path}.source",
                    NoteSources,
                    context,
                    out source
                );
            source ??= string.Empty;

            if (record.TryGetProperty("title", out var titleElement))
            {
                TryReadString(titleElement, $"{path}.title", 1, 80, false, context, out _);
            }

            string? text = null;
            var hasTextProperty = record.TryGetProperty("text", out var textElement);
            if (hasTextProperty)
            {
                TryReadString(textElement, $"{path}.text", 0, 50_000, true, context, out text);
            }

            Guid fileBlobKey = default;
            var hasFileBlobKey =
                record.TryGetProperty("fileBlobKey", out var blobElement)
                && TryReadGuid(blobElement, $"{path}.fileBlobKey", context, out fileBlobKey);
            TryReadNullableGuid(record, "sourceSessionId", path, context, out var sourceSessionId);

            var metadata = default(NoteMetadataInfo);
            if (record.TryGetProperty("metadata", out var metadataElement))
            {
                metadata = ValidateNoteMetadata(metadataElement, $"{path}.metadata", context);
            }

            var hasCreatedAt = TryReadTimestamp(record, "createdAt", path, context, out var createdAt);
            var hasUpdatedAt = TryReadTimestamp(record, "updatedAt", path, context, out var updatedAt);
            ValidateCreatedAndUpdated(
                path,
                hasCreatedAt,
                createdAt,
                hasUpdatedAt,
                updatedAt,
                exportedAt,
                context
            );

            if (hasKind)
            {
                if (kind == "text")
                {
                    if (string.IsNullOrWhiteSpace(text))
                    {
                        context.Add(DataSnapshotValidationErrorCodes.Inconsistent, $"{path}.text");
                    }
                    if (record.TryGetProperty("fileBlobKey", out _))
                    {
                        context.Add(
                            DataSnapshotValidationErrorCodes.Inconsistent,
                            $"{path}.fileBlobKey"
                        );
                    }
                }
                else
                {
                    if (!hasFileBlobKey)
                    {
                        context.Add(
                            DataSnapshotValidationErrorCodes.Inconsistent,
                            $"{path}.fileBlobKey"
                        );
                    }
                    if (hasTextProperty)
                    {
                        context.Add(DataSnapshotValidationErrorCodes.Inconsistent, $"{path}.text");
                    }
                }

                ValidateNoteMetadataCoherence(kind, metadata, $"{path}.metadata", context);
            }

            if (
                hasSource
                && (
                    (source == "session" && sourceSessionId is null)
                    || (source != "session" && sourceSessionId is not null)
                )
            )
            {
                context.Add(
                    DataSnapshotValidationErrorCodes.Inconsistent,
                    $"{path}.sourceSessionId"
                );
            }

            if (hasId)
            {
                if (AddUniqueId(graph.NoteIds, id, $"{path}.id", context))
                {
                    graph.Notes[id] = new NoteInfo(path, goalIds, sourceSessionId, kind);
                }
            }
        }
    }

    private static NoteMetadataInfo ValidateNoteMetadata(
        JsonElement metadata,
        string path,
        ValidationContext context
    )
    {
        var allowed = new[]
        {
            "mimeType",
            "fileSizeBytes",
            "durationSeconds",
            "originalFilename"
        };
        if (!ValidateObjectShape(metadata, path, allowed, [], context))
        {
            return default;
        }

        string? mimeType = null;
        if (
            metadata.TryGetProperty("mimeType", out var mimeElement)
            && TryReadString(
                mimeElement,
                $"{path}.mimeType",
                3,
                200,
                false,
                context,
                out var mime
            )
        )
        {
            if (!IsMimeType(mime))
            {
                context.Add(DataSnapshotValidationErrorCodes.InvalidFormat, $"{path}.mimeType");
            }
            else
            {
                mimeType = mime;
            }
        }

        long? fileSizeBytes = null;
        if (
            metadata.TryGetProperty("fileSizeBytes", out var sizeElement)
            && TryReadInteger(
                sizeElement,
                $"{path}.fileSizeBytes",
                0,
                MaxVoiceBytes,
                context,
                out var size
            )
        )
        {
            fileSizeBytes = size;
        }

        double? durationSeconds = null;
        if (
            metadata.TryGetProperty("durationSeconds", out var durationElement)
            && TryReadNumber(
                durationElement,
                $"{path}.durationSeconds",
                0,
                MaxVoiceDurationSeconds,
                context,
                out var duration
            )
        )
        {
            durationSeconds = duration;
        }

        var hasOriginalFilename = metadata.TryGetProperty(
            "originalFilename",
            out var filenameElement
        );
        if (
            hasOriginalFilename
            && TryReadString(
                filenameElement,
                $"{path}.originalFilename",
                1,
                255,
                false,
                context,
                out var filename
            )
            && (
                filename is "." or ".."
                || filename.Contains('/')
                || filename.Contains('\\')
            )
        )
        {
            context.Add(
                DataSnapshotValidationErrorCodes.InvalidFormat,
                $"{path}.originalFilename"
            );
        }

        return new NoteMetadataInfo(
            mimeType,
            fileSizeBytes,
            durationSeconds,
            hasOriginalFilename
        );
    }

    private static void ValidateNoteMetadataCoherence(
        string kind,
        NoteMetadataInfo metadata,
        string path,
        ValidationContext context
    )
    {
        if (kind == "text")
        {
            if (
                metadata.MimeType is not null
                || metadata.FileSizeBytes is not null
                || metadata.DurationSeconds is not null
                || metadata.HasOriginalFilename
            )
            {
                context.Add(DataSnapshotValidationErrorCodes.Inconsistent, path);
            }
            return;
        }

        if (
            kind == "voice"
            && metadata.MimeType is not null
            && !metadata.MimeType.StartsWith("audio/", StringComparison.OrdinalIgnoreCase)
        )
        {
            context.Add(DataSnapshotValidationErrorCodes.Inconsistent, $"{path}.mimeType");
        }
        else if (
            kind == "document"
            && metadata.MimeType is not null
            && !AllowedDocumentMimeTypes.Contains(metadata.MimeType)
        )
        {
            context.Add(DataSnapshotValidationErrorCodes.Inconsistent, $"{path}.mimeType");
        }
        else if (
            kind == "image"
            && metadata.MimeType is not null
            && !AllowedImageMimeTypes.Contains(metadata.MimeType)
        )
        {
            context.Add(DataSnapshotValidationErrorCodes.Inconsistent, $"{path}.mimeType");
        }

        var maxBytes = kind switch
        {
            "voice" => MaxVoiceBytes,
            "document" => MaxNoteDocumentBytes,
            "image" => MaxNoteImageBytes,
            _ => 0
        };
        if (metadata.FileSizeBytes > maxBytes)
        {
            context.Add(DataSnapshotValidationErrorCodes.InvalidValue, $"{path}.fileSizeBytes");
        }

        if (metadata.DurationSeconds is not null && kind != "voice")
        {
            context.Add(DataSnapshotValidationErrorCodes.Inconsistent, $"{path}.durationSeconds");
        }
    }

    private static void ValidateQuestions(
        JsonElement root,
        long exportedAt,
        SnapshotGraph graph,
        ValidationContext context
    )
    {
        if (
            !TryGetArray(
                root,
                "questions",
                "$.questions",
                DataSnapshotValidationLimits.MaxQuestions,
                context,
                out var records
            )
        )
        {
            return;
        }

        var count = Math.Min(records.GetArrayLength(), DataSnapshotValidationLimits.MaxQuestions);
        for (var index = 0; index < count; index++)
        {
            var path = $"$.questions[{index}]";
            var record = records[index];
            var required = new[]
            {
                "id",
                "goalId",
                "prompt",
                "answers",
                "reviewState",
                "createdAt",
                "updatedAt"
            };
            var allowed = new[]
            {
                "id",
                "goalId",
                "prompt",
                "imageBlobKey",
                "audioBlobKey",
                "answers",
                "reviewState",
                "createdAt",
                "updatedAt"
            };
            if (!ValidateObjectShape(record, path, allowed, required, context))
            {
                continue;
            }

            Guid id = default;
            var hasId =
                record.TryGetProperty("id", out var idElement)
                && TryReadGuid(idElement, $"{path}.id", context, out id);
            Guid goalId = default;
            var hasGoalId =
                record.TryGetProperty("goalId", out var goalElement)
                && TryReadGuid(goalElement, $"{path}.goalId", context, out goalId);

            if (record.TryGetProperty("prompt", out var promptElement))
            {
                TryReadString(promptElement, $"{path}.prompt", 1, 1_000, false, context, out _);
            }
            if (record.TryGetProperty("imageBlobKey", out var imageElement))
            {
                TryReadGuid(imageElement, $"{path}.imageBlobKey", context, out _);
            }
            if (record.TryGetProperty("audioBlobKey", out var audioElement))
            {
                TryReadGuid(audioElement, $"{path}.audioBlobKey", context, out _);
            }

            var answerIds = ValidateQuestionAnswers(record, path, context);
            ValidateQuestionReviewState(record, path, exportedAt, context);

            var hasCreatedAt = TryReadTimestamp(record, "createdAt", path, context, out var createdAt);
            var hasUpdatedAt = TryReadTimestamp(record, "updatedAt", path, context, out var updatedAt);
            ValidateCreatedAndUpdated(
                path,
                hasCreatedAt,
                createdAt,
                hasUpdatedAt,
                updatedAt,
                exportedAt,
                context
            );

            if (hasId)
            {
                if (AddUniqueId(graph.QuestionIds, id, $"{path}.id", context))
                {
                    graph.Questions[id] = new QuestionInfo(
                        path,
                        hasGoalId ? goalId : null,
                        answerIds
                    );
                }
            }
        }
    }

    private static HashSet<Guid> ValidateQuestionAnswers(
        JsonElement record,
        string path,
        ValidationContext context
    )
    {
        var result = new HashSet<Guid>();
        if (
            !record.TryGetProperty("answers", out var answers)
            || !TryValidateArray(
                answers,
                $"{path}.answers",
                2,
                DataSnapshotValidationLimits.MaxAnswersPerQuestion,
                context
            )
        )
        {
            return result;
        }

        var correctAnswers = 0;
        var count = Math.Min(
            answers.GetArrayLength(),
            DataSnapshotValidationLimits.MaxAnswersPerQuestion
        );
        for (var index = 0; index < count; index++)
        {
            var answerPath = $"{path}.answers[{index}]";
            var answer = answers[index];
            var properties = new[] { "id", "text", "isCorrect" };
            if (!ValidateObjectShape(answer, answerPath, properties, properties, context))
            {
                continue;
            }

            if (
                answer.TryGetProperty("id", out var idElement)
                && TryReadGuid(idElement, $"{answerPath}.id", context, out var id)
                && !result.Add(id)
            )
            {
                context.Add(DataSnapshotValidationErrorCodes.DuplicateId, $"{answerPath}.id");
            }
            if (answer.TryGetProperty("text", out var textElement))
            {
                TryReadString(
                    textElement,
                    $"{answerPath}.text",
                    1,
                    300,
                    false,
                    context,
                    out _
                );
            }
            if (
                answer.TryGetProperty("isCorrect", out var correctElement)
                && TryReadBoolean(correctElement, $"{answerPath}.isCorrect", context, out var correct)
                && correct
            )
            {
                correctAnswers++;
            }
        }

        if (correctAnswers == 0)
        {
            context.Add(DataSnapshotValidationErrorCodes.Inconsistent, $"{path}.answers");
        }
        return result;
    }

    private static void ValidateQuestionReviewState(
        JsonElement record,
        string path,
        long exportedAt,
        ValidationContext context
    )
    {
        if (!record.TryGetProperty("reviewState", out var reviewState))
        {
            return;
        }

        var reviewPath = $"{path}.reviewState";
        var properties = new[]
        {
            "timesSeen",
            "timesCorrect",
            "timesIncorrect",
            "lastSeenAt",
            "weight"
        };
        if (!ValidateObjectShape(reviewState, reviewPath, properties, properties, context))
        {
            return;
        }

        long timesSeen = default;
        var hasTimesSeen =
            reviewState.TryGetProperty("timesSeen", out var seenElement)
            && TryReadInteger(
                seenElement,
                $"{reviewPath}.timesSeen",
                0,
                1_000_000,
                context,
                out timesSeen
            );
        long timesCorrect = default;
        var hasTimesCorrect =
            reviewState.TryGetProperty("timesCorrect", out var correctElement)
            && TryReadInteger(
                correctElement,
                $"{reviewPath}.timesCorrect",
                0,
                1_000_000,
                context,
                out timesCorrect
            );
        long timesIncorrect = default;
        var hasTimesIncorrect =
            reviewState.TryGetProperty("timesIncorrect", out var incorrectElement)
            && TryReadInteger(
                incorrectElement,
                $"{reviewPath}.timesIncorrect",
                0,
                1_000_000,
                context,
                out timesIncorrect
            );
        TryReadNullableTimestamp(reviewState, "lastSeenAt", reviewPath, context, out var lastSeenAt);
        if (lastSeenAt is not null)
        {
            ValidateTimestampAtMost(
                lastSeenAt,
                exportedAt,
                $"{reviewPath}.lastSeenAt",
                context
            );
        }

        if (reviewState.TryGetProperty("weight", out var weightElement))
        {
            TryReadNumber(weightElement, $"{reviewPath}.weight", double.Epsilon, 1_000_000, context, out _);
        }

        if (
            hasTimesSeen
            && hasTimesCorrect
            && hasTimesIncorrect
            && timesSeen != timesCorrect + timesIncorrect
        )
        {
            context.Add(DataSnapshotValidationErrorCodes.Inconsistent, $"{reviewPath}.timesSeen");
        }
        if (
            hasTimesSeen
            && ((timesSeen == 0 && lastSeenAt is not null) || (timesSeen > 0 && lastSeenAt is null))
        )
        {
            context.Add(DataSnapshotValidationErrorCodes.Inconsistent, $"{reviewPath}.lastSeenAt");
        }
    }

    private static void ValidateExamAttempts(
        JsonElement root,
        long exportedAt,
        SnapshotGraph graph,
        ValidationContext context
    )
    {
        if (
            !TryGetArray(
                root,
                "examAttempts",
                "$.examAttempts",
                DataSnapshotValidationLimits.MaxExamAttempts,
                context,
                out var records
            )
        )
        {
            return;
        }

        var count = Math.Min(
            records.GetArrayLength(),
            DataSnapshotValidationLimits.MaxExamAttempts
        );
        for (var index = 0; index < count; index++)
        {
            var path = $"$.examAttempts[{index}]";
            var record = records[index];
            var required = new[]
            {
                "id",
                "goalId",
                "kind",
                "title",
                "startedAt",
                "pausedAt",
                "endedAt",
                "totalPausedMs",
                "status",
                "timeLimitMs",
                "score",
                "maxScore",
                "notes",
                "createdAt",
                "updatedAt"
            };
            var allowed = new[]
            {
                "id",
                "goalId",
                "kind",
                "title",
                "startedAt",
                "pausedAt",
                "endedAt",
                "totalPausedMs",
                "status",
                "timeLimitMs",
                "score",
                "maxScore",
                "notes",
                "pdfMaterialId",
                "pdfNoteId",
                "questionIds",
                "responses",
                "createdAt",
                "updatedAt"
            };
            if (!ValidateObjectShape(record, path, allowed, required, context))
            {
                continue;
            }

            Guid id = default;
            var hasId =
                record.TryGetProperty("id", out var idElement)
                && TryReadGuid(idElement, $"{path}.id", context, out id);
            Guid goalId = default;
            var hasGoalId =
                record.TryGetProperty("goalId", out var goalElement)
                && TryReadGuid(goalElement, $"{path}.goalId", context, out goalId);
            string? kind = null;
            var hasKind =
                record.TryGetProperty("kind", out var kindElement)
                && TryReadEnum(kindElement, $"{path}.kind", ExamKinds, context, out kind);
            kind ??= string.Empty;
            string? status = null;
            var hasStatus =
                record.TryGetProperty("status", out var statusElement)
                && TryReadEnum(
                    statusElement,
                    $"{path}.status",
                    ExamStatuses,
                    context,
                    out status
                );
            status ??= string.Empty;

            if (record.TryGetProperty("title", out var titleElement))
            {
                TryReadString(titleElement, $"{path}.title", 1, 80, false, context, out _);
            }
            if (record.TryGetProperty("notes", out var notesElement))
            {
                TryReadString(notesElement, $"{path}.notes", 0, 10_000, true, context, out _);
            }

            var hasStartedAt = TryReadTimestamp(record, "startedAt", path, context, out var startedAt);
            TryReadNullableTimestamp(record, "pausedAt", path, context, out var pausedAt);
            TryReadNullableTimestamp(record, "endedAt", path, context, out var endedAt);
            long totalPausedMs = default;
            var hasTotalPaused =
                record.TryGetProperty("totalPausedMs", out var pausedTotalElement)
                && TryReadInteger(
                    pausedTotalElement,
                    $"{path}.totalPausedMs",
                    0,
                    MaxSafeJavaScriptInteger,
                    context,
                    out totalPausedMs
                );
            TryReadNullableInteger(
                record,
                "timeLimitMs",
                path,
                1,
                MaxTimeLimitMilliseconds,
                context,
                out _
            );
            TryReadNullableNumber(
                record,
                "score",
                path,
                0,
                1_000_000,
                context,
                out var score
            );
            TryReadNullableNumber(
                record,
                "maxScore",
                path,
                double.Epsilon,
                1_000_000,
                context,
                out var maxScore
            );

            Guid? pdfMaterialId = null;
            var hasPdfMaterial = record.TryGetProperty("pdfMaterialId", out var pdfMaterialElement);
            if (
                hasPdfMaterial
                && TryReadGuid(
                    pdfMaterialElement,
                    $"{path}.pdfMaterialId",
                    context,
                    out var parsedPdfMaterialId
                )
            )
            {
                pdfMaterialId = parsedPdfMaterialId;
            }

            Guid? pdfNoteId = null;
            var hasPdfNote = record.TryGetProperty("pdfNoteId", out var pdfNoteElement);
            if (
                hasPdfNote
                && TryReadGuid(
                    pdfNoteElement,
                    $"{path}.pdfNoteId",
                    context,
                    out var parsedPdfNoteId
                )
            )
            {
                pdfNoteId = parsedPdfNoteId;
            }

            var hasQuestionIds = record.TryGetProperty("questionIds", out var questionIdsElement);
            var questionIds = hasQuestionIds
                ? ValidateExamQuestionIds(questionIdsElement, $"{path}.questionIds", context)
                : null;
            var hasResponses = record.TryGetProperty("responses", out var responsesElement);
            var responses = hasResponses
                ? ValidateExamResponses(responsesElement, $"{path}.responses", exportedAt, context)
                : null;

            var hasCreatedAt = TryReadTimestamp(record, "createdAt", path, context, out var createdAt);
            var hasUpdatedAt = TryReadTimestamp(record, "updatedAt", path, context, out var updatedAt);
            ValidateCreatedAndUpdated(
                path,
                hasCreatedAt,
                createdAt,
                hasUpdatedAt,
                updatedAt,
                exportedAt,
                context
            );
            ValidateTimestampAtMost(startedAt, exportedAt, $"{path}.startedAt", hasStartedAt, context);
            ValidateTimestampAtMost(pausedAt, exportedAt, $"{path}.pausedAt", context);
            ValidateTimestampAtMost(endedAt, exportedAt, $"{path}.endedAt", context);

            if (hasCreatedAt && hasStartedAt && startedAt < createdAt)
            {
                context.Add(DataSnapshotValidationErrorCodes.Inconsistent, $"{path}.startedAt");
            }
            if (pausedAt is not null && hasStartedAt && pausedAt < startedAt)
            {
                context.Add(DataSnapshotValidationErrorCodes.Inconsistent, $"{path}.pausedAt");
            }
            if (endedAt is not null && hasStartedAt && endedAt < startedAt)
            {
                context.Add(DataSnapshotValidationErrorCodes.Inconsistent, $"{path}.endedAt");
            }
            if (hasUpdatedAt && pausedAt is not null && pausedAt > updatedAt)
            {
                context.Add(DataSnapshotValidationErrorCodes.Inconsistent, $"{path}.pausedAt");
            }
            if (hasUpdatedAt && endedAt is not null && endedAt > updatedAt)
            {
                context.Add(DataSnapshotValidationErrorCodes.Inconsistent, $"{path}.endedAt");
            }
            if (
                hasTotalPaused
                && hasStartedAt
                && (endedAt ?? exportedAt) >= startedAt
                && totalPausedMs > (endedAt ?? exportedAt) - startedAt
            )
            {
                context.Add(
                    DataSnapshotValidationErrorCodes.Inconsistent,
                    $"{path}.totalPausedMs"
                );
            }

            if (hasStatus)
            {
                var stateIsCoherent = status switch
                {
                    "in-progress" => pausedAt is null && endedAt is null,
                    "paused" => pausedAt is not null && endedAt is null,
                    "pending-grade" or "graded" or "completed" or "discarded" =>
                        pausedAt is null && endedAt is not null,
                    _ => false
                };
                if (!stateIsCoherent)
                {
                    context.Add(DataSnapshotValidationErrorCodes.Inconsistent, $"{path}.status");
                }
            }

            if (score is not null && maxScore is not null && score > maxScore)
            {
                context.Add(DataSnapshotValidationErrorCodes.Inconsistent, $"{path}.score");
            }

            if (hasKind)
            {
                if (kind == "pdf")
                {
                    if ((pdfMaterialId is null) == (pdfNoteId is null))
                    {
                        context.Add(DataSnapshotValidationErrorCodes.Inconsistent, path);
                    }
                    if (hasQuestionIds || hasResponses)
                    {
                        context.Add(DataSnapshotValidationErrorCodes.Inconsistent, path);
                    }
                    if (status is "completed")
                    {
                        context.Add(DataSnapshotValidationErrorCodes.Inconsistent, $"{path}.status");
                    }
                    if (
                        status == "pending-grade"
                        && (score is not null || maxScore is not null)
                    )
                    {
                        context.Add(DataSnapshotValidationErrorCodes.Inconsistent, $"{path}.score");
                    }
                    if (status == "graded" && (score is null || maxScore is null))
                    {
                        context.Add(DataSnapshotValidationErrorCodes.Inconsistent, $"{path}.score");
                    }
                }
                else if (kind == "questions")
                {
                    if (hasPdfMaterial || hasPdfNote)
                    {
                        context.Add(DataSnapshotValidationErrorCodes.Inconsistent, path);
                    }
                    if (questionIds is null || questionIds.Count == 0 || responses is null)
                    {
                        context.Add(DataSnapshotValidationErrorCodes.Inconsistent, path);
                    }
                    if (status is "pending-grade" or "graded")
                    {
                        context.Add(DataSnapshotValidationErrorCodes.Inconsistent, $"{path}.status");
                    }
                    if (
                        questionIds is not null
                        && maxScore is not null
                        && maxScore != questionIds.Count
                    )
                    {
                        context.Add(
                            DataSnapshotValidationErrorCodes.Inconsistent,
                            $"{path}.maxScore"
                        );
                    }
                    if (
                        responses is not null
                        && score is not null
                        && score != responses.Count(response => response.IsCorrect)
                    )
                    {
                        context.Add(DataSnapshotValidationErrorCodes.Inconsistent, $"{path}.score");
                    }
                    if (
                        status == "completed"
                        && questionIds is not null
                        && responses is not null
                        && questionIds.Count != responses.Count
                    )
                    {
                        context.Add(
                            DataSnapshotValidationErrorCodes.Inconsistent,
                            $"{path}.responses"
                        );
                    }
                }
            }

            if (questionIds is not null && responses is not null)
            {
                foreach (var response in responses)
                {
                    if (!questionIds.Contains(response.QuestionId))
                    {
                        context.Add(
                            DataSnapshotValidationErrorCodes.InvalidReference,
                            $"{response.Path}.questionId"
                        );
                    }
                }
            }

            if (hasId)
            {
                AddUniqueId(graph.ExamAttemptIds, id, $"{path}.id", context);
            }
            graph.ExamAttempts.Add(
                new ExamAttemptInfo(
                    path,
                    hasGoalId ? goalId : null,
                    hasKind ? kind : null,
                    pdfMaterialId,
                    pdfNoteId,
                    questionIds
                )
            );
        }
    }

    private static HashSet<Guid>? ValidateExamQuestionIds(
        JsonElement questionIds,
        string path,
        ValidationContext context
    )
    {
        if (
            !TryValidateArray(
                questionIds,
                path,
                1,
                DataSnapshotValidationLimits.MaxQuestionsPerExam,
                context
            )
        )
        {
            return null;
        }

        var result = new HashSet<Guid>();
        var count = Math.Min(
            questionIds.GetArrayLength(),
            DataSnapshotValidationLimits.MaxQuestionsPerExam
        );
        for (var index = 0; index < count; index++)
        {
            var questionPath = $"{path}[{index}]";
            if (
                TryReadGuid(questionIds[index], questionPath, context, out var questionId)
                && !result.Add(questionId)
            )
            {
                context.Add(DataSnapshotValidationErrorCodes.DuplicateValue, questionPath);
            }
        }
        return result;
    }

    private static List<ExamResponseInfo>? ValidateExamResponses(
        JsonElement responses,
        string path,
        long exportedAt,
        ValidationContext context
    )
    {
        if (
            !TryValidateArray(
                responses,
                path,
                0,
                DataSnapshotValidationLimits.MaxResponsesPerExam,
                context
            )
        )
        {
            return null;
        }

        var result = new List<ExamResponseInfo>();
        var responseQuestionIds = new HashSet<Guid>();
        var count = Math.Min(
            responses.GetArrayLength(),
            DataSnapshotValidationLimits.MaxResponsesPerExam
        );
        for (var index = 0; index < count; index++)
        {
            var responsePath = $"{path}[{index}]";
            var response = responses[index];
            var properties = new[] { "questionId", "chosenAnswerIds", "isCorrect", "answeredAt" };
            if (!ValidateObjectShape(response, responsePath, properties, properties, context))
            {
                continue;
            }

            Guid questionId = default;
            var hasQuestionId =
                response.TryGetProperty("questionId", out var questionElement)
                && TryReadGuid(
                    questionElement,
                    $"{responsePath}.questionId",
                    context,
                    out questionId
                );
            if (hasQuestionId && !responseQuestionIds.Add(questionId))
            {
                context.Add(
                    DataSnapshotValidationErrorCodes.DuplicateValue,
                    $"{responsePath}.questionId"
                );
            }

            if (
                response.TryGetProperty("chosenAnswerIds", out var chosenIds)
                && TryValidateArray(
                    chosenIds,
                    $"{responsePath}.chosenAnswerIds",
                    0,
                    DataSnapshotValidationLimits.MaxAnswersPerQuestion,
                    context
                )
            )
            {
                var seenAnswers = new HashSet<Guid>();
                var chosenCount = Math.Min(
                    chosenIds.GetArrayLength(),
                    DataSnapshotValidationLimits.MaxAnswersPerQuestion
                );
                for (var answerIndex = 0; answerIndex < chosenCount; answerIndex++)
                {
                    var answerPath = $"{responsePath}.chosenAnswerIds[{answerIndex}]";
                    if (
                        TryReadGuid(chosenIds[answerIndex], answerPath, context, out var answerId)
                        && !seenAnswers.Add(answerId)
                    )
                    {
                        context.Add(DataSnapshotValidationErrorCodes.DuplicateValue, answerPath);
                    }
                }
            }

            bool isCorrect = default;
            var hasIsCorrect =
                response.TryGetProperty("isCorrect", out var correctElement)
                && TryReadBoolean(
                    correctElement,
                    $"{responsePath}.isCorrect",
                    context,
                    out isCorrect
                );
            if (
                response.TryGetProperty("answeredAt", out var answeredElement)
                && TryReadInteger(
                    answeredElement,
                    $"{responsePath}.answeredAt",
                    0,
                    MaxTimestamp,
                    context,
                    out var answeredAt
                )
            )
            {
                ValidateTimestampAtMost(
                    answeredAt,
                    exportedAt,
                    $"{responsePath}.answeredAt",
                    true,
                    context
                );
            }

            if (hasQuestionId && hasIsCorrect)
            {
                result.Add(new ExamResponseInfo(responsePath, questionId, isCorrect));
            }
        }
        return result;
    }

    private static void ValidateRelations(SnapshotGraph graph, ValidationContext context)
    {
        foreach (var link in graph.MaterialGoalLinks)
        {
            if (!graph.MaterialIds.Contains(link.MaterialId))
            {
                context.Add(
                    DataSnapshotValidationErrorCodes.InvalidReference,
                    $"{link.Path}.materialId"
                );
            }
            if (!graph.GoalIds.Contains(link.GoalId))
            {
                context.Add(
                    DataSnapshotValidationErrorCodes.InvalidReference,
                    $"{link.Path}.goalId"
                );
            }
        }

        // Progress is historical. Deleting a material, goal or session in the
        // current frontend intentionally leaves old progress rows behind. A
        // surviving target is still checked for consistency.
        foreach (var progress in graph.MaterialProgress)
        {
            if (
                progress.MaterialId is { } materialId
                && graph.Materials.TryGetValue(materialId, out var material)
                && progress.Kind is not null
                && progress.Kind != material.Kind
            )
            {
                context.Add(
                    DataSnapshotValidationErrorCodes.Inconsistent,
                    $"{progress.Path}.kind"
                );
            }

            if (
                progress.SessionId is { } sessionId
                && graph.Sessions.TryGetValue(sessionId, out var session)
                && progress.GoalId != session.GoalId
            )
            {
                context.Add(
                    DataSnapshotValidationErrorCodes.Inconsistent,
                    $"{progress.Path}.goalId"
                );
            }
        }

        foreach (var note in graph.Notes.Values)
        {
            foreach (var goalId in note.GoalIds)
            {
                if (!graph.GoalIds.Contains(goalId))
                {
                    context.Add(
                        DataSnapshotValidationErrorCodes.InvalidReference,
                        $"{note.Path}.goalIds"
                    );
                }
            }

            if (
                note.SourceSessionId is { } sourceSessionId
                && graph.Sessions.TryGetValue(sourceSessionId, out var sourceSession)
                && sourceSession.GoalId is { } sourceGoalId
                && !note.GoalIds.Contains(sourceGoalId)
            )
            {
                context.Add(
                    DataSnapshotValidationErrorCodes.InvalidReference,
                    $"{note.Path}.sourceSessionId"
                );
            }
        }

        foreach (var question in graph.Questions.Values)
        {
            if (question.GoalId is { } goalId && !graph.GoalIds.Contains(goalId))
            {
                context.Add(
                    DataSnapshotValidationErrorCodes.InvalidReference,
                    $"{question.Path}.goalId"
                );
            }
        }

        foreach (var attempt in graph.ExamAttempts)
        {
            if (attempt.GoalId is { } goalId && !graph.GoalIds.Contains(goalId))
            {
                context.Add(
                    DataSnapshotValidationErrorCodes.InvalidReference,
                    $"{attempt.Path}.goalId"
                );
            }

            // PDF sources and questions may have been deleted after an
            // attempt completed. Dangling historical identifiers are allowed;
            // a surviving source must still have the expected kind and goal.
            if (
                attempt.PdfMaterialId is { } pdfMaterialId
                && graph.Materials.TryGetValue(pdfMaterialId, out var pdfMaterial)
                && pdfMaterial.Kind != "pdf"
            )
            {
                context.Add(
                    DataSnapshotValidationErrorCodes.InvalidReference,
                    $"{attempt.Path}.pdfMaterialId"
                );
            }
            if (
                attempt.PdfNoteId is { } pdfNoteId
                && graph.Notes.TryGetValue(pdfNoteId, out var pdfNote)
                && pdfNote.Kind != "document"
            )
            {
                context.Add(
                    DataSnapshotValidationErrorCodes.InvalidReference,
                    $"{attempt.Path}.pdfNoteId"
                );
            }

            if (attempt.QuestionIds is null)
            {
                continue;
            }
            foreach (var questionId in attempt.QuestionIds)
            {
                if (
                    graph.Questions.TryGetValue(questionId, out var question)
                    && attempt.GoalId is not null
                    && question.GoalId != attempt.GoalId
                )
                {
                    context.Add(
                        DataSnapshotValidationErrorCodes.InvalidReference,
                        $"{attempt.Path}.questionIds"
                    );
                }
            }
        }
    }

    private static bool TryGetArray(
        JsonElement parent,
        string propertyName,
        string path,
        int maximumCount,
        ValidationContext context,
        out JsonElement array
    )
    {
        array = default;
        if (!parent.TryGetProperty(propertyName, out var value))
        {
            return false;
        }
        if (!TryValidateArray(value, path, 0, maximumCount, context))
        {
            return false;
        }
        array = value;
        return true;
    }

    private static bool TryValidateArray(
        JsonElement value,
        string path,
        int minimumCount,
        int maximumCount,
        ValidationContext context
    )
    {
        if (value.ValueKind != JsonValueKind.Array)
        {
            context.Add(DataSnapshotValidationErrorCodes.InvalidType, path);
            return false;
        }

        var count = value.GetArrayLength();
        if (count < minimumCount)
        {
            context.Add(DataSnapshotValidationErrorCodes.InvalidValue, path);
        }
        if (count > maximumCount)
        {
            context.Add(DataSnapshotValidationErrorCodes.TooManyItems, path);
        }
        return true;
    }

    private static bool ValidateObjectShape(
        JsonElement value,
        string path,
        IReadOnlyCollection<string> allowedProperties,
        IReadOnlyCollection<string> requiredProperties,
        ValidationContext context
    )
    {
        if (value.ValueKind != JsonValueKind.Object)
        {
            context.Add(DataSnapshotValidationErrorCodes.InvalidType, path);
            return false;
        }

        foreach (var property in value.EnumerateObject())
        {
            if (!allowedProperties.Contains(property.Name, StringComparer.Ordinal))
            {
                context.Add(
                    DataSnapshotValidationErrorCodes.UnknownProperty,
                    $"{path}.<unknown>"
                );
            }
        }
        foreach (var requiredProperty in requiredProperties)
        {
            if (!value.TryGetProperty(requiredProperty, out _))
            {
                context.Add(
                    DataSnapshotValidationErrorCodes.MissingProperty,
                    AppendPropertyPath(path, requiredProperty)
                );
            }
        }
        return true;
    }

    private static void ScanPropertyNames(
        JsonElement value,
        string path,
        int depth,
        ValidationContext context
    )
    {
        if (depth > DataSnapshotValidationLimits.MaxJsonDepth)
        {
            context.Add(DataSnapshotValidationErrorCodes.InvalidValue, path);
            return;
        }

        if (value.ValueKind == JsonValueKind.Object)
        {
            var names = new HashSet<string>(StringComparer.Ordinal);
            foreach (var property in value.EnumerateObject())
            {
                var propertyPath = AppendPropertyPath(path, property.Name);
                if (!names.Add(property.Name))
                {
                    context.Add(DataSnapshotValidationErrorCodes.DuplicateProperty, propertyPath);
                }
                if (IsPrototypePollutionKey(property.Name))
                {
                    context.Add(DataSnapshotValidationErrorCodes.PrototypeKey, propertyPath);
                }
                ScanPropertyNames(property.Value, propertyPath, depth + 1, context);
            }
        }
        else if (value.ValueKind == JsonValueKind.Array)
        {
            var index = 0;
            foreach (var item in value.EnumerateArray())
            {
                ScanPropertyNames(item, $"{path}[{index++}]", depth + 1, context);
            }
        }
    }

    private static bool TryReadString(
        JsonElement value,
        string path,
        int minimumLength,
        int maximumLength,
        bool allowLineBreaks,
        ValidationContext context,
        out string result
    )
    {
        result = string.Empty;
        if (value.ValueKind != JsonValueKind.String)
        {
            context.Add(DataSnapshotValidationErrorCodes.InvalidType, path);
            return false;
        }

        result = value.GetString() ?? string.Empty;
        if (result.Length > maximumLength)
        {
            context.Add(DataSnapshotValidationErrorCodes.StringTooLong, path);
            return false;
        }
        if (result.Length < minimumLength)
        {
            context.Add(DataSnapshotValidationErrorCodes.InvalidValue, path);
            return false;
        }
        if (!allowLineBreaks && !string.Equals(result, result.Trim(), StringComparison.Ordinal))
        {
            context.Add(DataSnapshotValidationErrorCodes.InvalidString, path);
            return false;
        }

        foreach (var character in result)
        {
            if (
                char.IsControl(character)
                && (!allowLineBreaks || character is not ('\r' or '\n' or '\t'))
            )
            {
                context.Add(DataSnapshotValidationErrorCodes.InvalidString, path);
                return false;
            }
        }
        return true;
    }

    private static bool TryReadGuid(
        JsonElement value,
        string path,
        ValidationContext context,
        out Guid result
    )
    {
        result = default;
        if (!TryReadString(value, path, 1, 64, false, context, out var text))
        {
            return false;
        }
        if (text.Length != 36 || !Guid.TryParseExact(text, "D", out result))
        {
            context.Add(DataSnapshotValidationErrorCodes.InvalidFormat, path);
            return false;
        }
        return true;
    }

    private static bool TryReadNullableGuid(
        JsonElement parent,
        string propertyName,
        string parentPath,
        ValidationContext context,
        out Guid? result
    )
    {
        result = null;
        if (!parent.TryGetProperty(propertyName, out var value))
        {
            return false;
        }
        if (value.ValueKind == JsonValueKind.Null)
        {
            return true;
        }
        if (!TryReadGuid(value, AppendPropertyPath(parentPath, propertyName), context, out var parsed))
        {
            return false;
        }
        result = parsed;
        return true;
    }

    private static bool TryReadEnum(
        JsonElement value,
        string path,
        IReadOnlySet<string> allowedValues,
        ValidationContext context,
        out string? result
    )
    {
        result = null;
        if (!TryReadString(value, path, 1, 64, false, context, out var parsed))
        {
            return false;
        }
        if (!allowedValues.Contains(parsed))
        {
            context.Add(DataSnapshotValidationErrorCodes.InvalidValue, path);
            return false;
        }
        result = parsed;
        return true;
    }

    private static bool TryReadInteger(
        JsonElement value,
        string path,
        long minimum,
        long maximum,
        ValidationContext context,
        out long result
    )
    {
        result = default;
        if (value.ValueKind != JsonValueKind.Number)
        {
            context.Add(DataSnapshotValidationErrorCodes.InvalidType, path);
            return false;
        }
        if (!value.TryGetInt64(out result) || result < minimum || result > maximum)
        {
            context.Add(DataSnapshotValidationErrorCodes.InvalidValue, path);
            return false;
        }
        return true;
    }

    private static bool TryReadNumber(
        JsonElement value,
        string path,
        double minimum,
        double maximum,
        ValidationContext context,
        out double result
    )
    {
        result = default;
        if (value.ValueKind != JsonValueKind.Number)
        {
            context.Add(DataSnapshotValidationErrorCodes.InvalidType, path);
            return false;
        }
        if (
            !value.TryGetDouble(out result)
            || !double.IsFinite(result)
            || result < minimum
            || result > maximum
        )
        {
            context.Add(DataSnapshotValidationErrorCodes.InvalidValue, path);
            return false;
        }
        return true;
    }

    private static bool TryReadBoolean(
        JsonElement value,
        string path,
        ValidationContext context,
        out bool result
    )
    {
        result = default;
        if (value.ValueKind is not (JsonValueKind.True or JsonValueKind.False))
        {
            context.Add(DataSnapshotValidationErrorCodes.InvalidType, path);
            return false;
        }
        result = value.GetBoolean();
        return true;
    }

    private static bool TryReadTimestamp(
        JsonElement parent,
        string propertyName,
        string parentPath,
        ValidationContext context,
        out long result
    )
    {
        result = default;
        return parent.TryGetProperty(propertyName, out var value)
            && TryReadInteger(
                value,
                AppendPropertyPath(parentPath, propertyName),
                0,
                MaxTimestamp,
                context,
                out result
            );
    }

    private static bool TryReadNullableTimestamp(
        JsonElement parent,
        string propertyName,
        string parentPath,
        ValidationContext context,
        out long? result
    )
    {
        result = null;
        if (!parent.TryGetProperty(propertyName, out var value))
        {
            return false;
        }
        if (value.ValueKind == JsonValueKind.Null)
        {
            return true;
        }
        if (
            !TryReadInteger(
                value,
                AppendPropertyPath(parentPath, propertyName),
                0,
                MaxTimestamp,
                context,
                out var parsed
            )
        )
        {
            return false;
        }
        result = parsed;
        return true;
    }

    private static bool TryReadNullableInteger(
        JsonElement parent,
        string propertyName,
        string parentPath,
        long minimum,
        long maximum,
        ValidationContext context,
        out long? result
    )
    {
        result = null;
        if (!parent.TryGetProperty(propertyName, out var value))
        {
            return false;
        }
        if (value.ValueKind == JsonValueKind.Null)
        {
            return true;
        }
        if (
            !TryReadInteger(
                value,
                AppendPropertyPath(parentPath, propertyName),
                minimum,
                maximum,
                context,
                out var parsed
            )
        )
        {
            return false;
        }
        result = parsed;
        return true;
    }

    private static bool TryReadNullableNumber(
        JsonElement parent,
        string propertyName,
        string parentPath,
        double minimum,
        double maximum,
        ValidationContext context,
        out double? result
    )
    {
        result = null;
        if (!parent.TryGetProperty(propertyName, out var value))
        {
            return false;
        }
        if (value.ValueKind == JsonValueKind.Null)
        {
            return true;
        }
        if (
            !TryReadNumber(
                value,
                AppendPropertyPath(parentPath, propertyName),
                minimum,
                maximum,
                context,
                out var parsed
            )
        )
        {
            return false;
        }
        result = parsed;
        return true;
    }

    private static bool TryReadHttpUrl(
        JsonElement value,
        string path,
        ValidationContext context,
        out string? result
    )
    {
        result = null;
        if (!TryReadString(value, path, 1, 2_048, false, context, out var raw))
        {
            return false;
        }

        if (
            raw.Contains('\\')
            || !Uri.TryCreate(raw, UriKind.Absolute, out var uri)
            || (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps)
            || string.IsNullOrWhiteSpace(uri.Host)
            || !string.IsNullOrEmpty(uri.UserInfo)
        )
        {
            context.Add(DataSnapshotValidationErrorCodes.InvalidFormat, path);
            return false;
        }
        result = raw;
        return true;
    }

    private static void ValidateCreatedAndUpdated(
        string path,
        bool hasCreatedAt,
        long createdAt,
        bool hasUpdatedAt,
        long updatedAt,
        long exportedAt,
        ValidationContext context
    )
    {
        ValidateTimestampAtMost(
            createdAt,
            exportedAt,
            $"{path}.createdAt",
            hasCreatedAt,
            context
        );
        ValidateTimestampAtMost(
            updatedAt,
            exportedAt,
            $"{path}.updatedAt",
            hasUpdatedAt,
            context
        );
        if (hasCreatedAt && hasUpdatedAt && updatedAt < createdAt)
        {
            context.Add(DataSnapshotValidationErrorCodes.Inconsistent, $"{path}.updatedAt");
        }
    }

    private static void ValidateTimestampAtMost(
        long value,
        long maximum,
        string path,
        bool hasValue,
        ValidationContext context
    )
    {
        if (hasValue && value > maximum)
        {
            context.Add(DataSnapshotValidationErrorCodes.Inconsistent, path);
        }
    }

    private static void ValidateTimestampAtMost(
        long? value,
        long maximum,
        string path,
        ValidationContext context
    )
    {
        if (value > maximum)
        {
            context.Add(DataSnapshotValidationErrorCodes.Inconsistent, path);
        }
    }

    private static bool AddUniqueId(
        HashSet<Guid> identifiers,
        Guid identifier,
        string path,
        ValidationContext context
    )
    {
        if (identifiers.Add(identifier))
        {
            return true;
        }
        context.Add(DataSnapshotValidationErrorCodes.DuplicateId, path);
        return false;
    }

    private static bool IsPrototypePollutionKey(string propertyName)
    {
        return propertyName.Equals("__proto__", StringComparison.OrdinalIgnoreCase)
            || propertyName.Equals("prototype", StringComparison.OrdinalIgnoreCase)
            || propertyName.Equals("constructor", StringComparison.OrdinalIgnoreCase);
    }

    private static bool IsYouTubeVideoId(string value)
    {
        return value.Length == 11
            && value.All(
                character =>
                    char.IsAsciiLetterOrDigit(character) || character is '-' or '_'
            );
    }

    private static bool IsMimeType(string value)
    {
        var slash = value.IndexOf('/');
        return slash > 0
            && slash == value.LastIndexOf('/')
            && slash < value.Length - 1
            && value.All(
                character =>
                    char.IsAsciiLetterOrDigit(character)
                    || character is '!' or '#' or '$' or '&' or '^' or '_' or '.' or '+' or '-' or '/'
            );
    }

    private static string AppendPropertyPath(string parentPath, string propertyName)
    {
        if (
            propertyName.Length is > 0 and <= 64
            && propertyName.All(
                character =>
                    char.IsAsciiLetterOrDigit(character) || character is '_' or '-'
            )
        )
        {
            return $"{parentPath}.{propertyName}";
        }
        return $"{parentPath}.<property>";
    }

    private sealed class ValidationContext
    {
        private readonly List<DataSnapshotValidationError> _errors = [];
        private bool _truncated;

        public void Add(string code, string path)
        {
            if (_truncated)
            {
                return;
            }
            if (_errors.Count < DataSnapshotValidationLimits.MaxErrors - 1)
            {
                _errors.Add(new DataSnapshotValidationError(code, path));
                return;
            }

            _errors.Add(
                new DataSnapshotValidationError(
                    DataSnapshotValidationErrorCodes.TooManyErrors,
                    "$"
                )
            );
            _truncated = true;
        }

        public DataSnapshotValidationResult ToResult()
        {
            return new DataSnapshotValidationResult(_errors.ToArray());
        }
    }

    private sealed class SnapshotGraph
    {
        public HashSet<Guid> GoalIds { get; } = [];
        public HashSet<Guid> SessionIds { get; } = [];
        public HashSet<Guid> MaterialIds { get; } = [];
        public HashSet<Guid> MaterialGoalLinkIds { get; } = [];
        public HashSet<Guid> MaterialProgressIds { get; } = [];
        public HashSet<Guid> NoteIds { get; } = [];
        public HashSet<Guid> QuestionIds { get; } = [];
        public HashSet<Guid> ExamAttemptIds { get; } = [];

        public Dictionary<Guid, SessionInfo> Sessions { get; } = [];
        public Dictionary<Guid, MaterialInfo> Materials { get; } = [];
        public Dictionary<Guid, NoteInfo> Notes { get; } = [];
        public Dictionary<Guid, QuestionInfo> Questions { get; } = [];
        public List<MaterialGoalLinkInfo> MaterialGoalLinks { get; } = [];
        public HashSet<(Guid MaterialId, Guid GoalId)> MaterialGoalPairs { get; } = [];
        public List<MaterialProgressInfo> MaterialProgress { get; } = [];
        public List<ExamAttemptInfo> ExamAttempts { get; } = [];
    }

    private readonly record struct MaterialMetadataInfo(
        string? Provider,
        long? DurationSeconds,
        long? TotalPages,
        string? MimeType,
        long? FileSizeBytes,
        bool HasYouTubeVideoId,
        bool HasThumbnailUrl
    );

    private readonly record struct NoteMetadataInfo(
        string? MimeType,
        long? FileSizeBytes,
        double? DurationSeconds,
        bool HasOriginalFilename
    );

    private sealed record SessionInfo(
        string Path,
        Guid? GoalId,
        IReadOnlySet<Guid> MaterialIds
    );

    private sealed record MaterialInfo(
        string Path,
        string Kind,
        long? DurationSeconds,
        long? TotalPages
    );

    private sealed record MaterialGoalLinkInfo(string Path, Guid MaterialId, Guid GoalId);

    private sealed record MaterialProgressInfo(
        string Path,
        Guid? MaterialId,
        Guid? GoalId,
        Guid? SessionId,
        string? Kind
    );

    private sealed record NoteInfo(
        string Path,
        IReadOnlySet<Guid> GoalIds,
        Guid? SourceSessionId,
        string Kind
    );

    private sealed record QuestionInfo(
        string Path,
        Guid? GoalId,
        IReadOnlySet<Guid> AnswerIds
    );

    private sealed record ExamAttemptInfo(
        string Path,
        Guid? GoalId,
        string? Kind,
        Guid? PdfMaterialId,
        Guid? PdfNoteId,
        IReadOnlySet<Guid>? QuestionIds
    );

    private sealed record ExamResponseInfo(string Path, Guid QuestionId, bool IsCorrect);
}
