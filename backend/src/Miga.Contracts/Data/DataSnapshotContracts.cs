using System.Text.Json;
using System.Text.Json.Serialization;

namespace Miga.Contracts.Data;

/// <summary>
/// Complete, workspace-scoped client data returned by GET /api/data.
/// The payload is deliberately kept as JSON because it mirrors the
/// versioned browser export format without allowing ownership fields.
/// </summary>
[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public sealed record DataSnapshotResponse(
    [property: JsonPropertyName("revision"), JsonRequired] long Revision,
    [property: JsonPropertyName("updatedAtUtc"), JsonRequired] DateTimeOffset UpdatedAtUtc,
    [property: JsonPropertyName("data"), JsonRequired] JsonElement Data
);

/// <summary>
/// Optimistic-concurrency request for PUT /api/data.
/// Revision zero represents a client that has not stored a snapshot yet.
/// </summary>
[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public sealed record PutDataSnapshotRequest(
    [property: JsonPropertyName("workspaceId"), JsonRequired] Guid WorkspaceId,
    [property: JsonPropertyName("revision"), JsonRequired] long Revision,
    [property: JsonPropertyName("data"), JsonRequired] JsonElement Data
);
