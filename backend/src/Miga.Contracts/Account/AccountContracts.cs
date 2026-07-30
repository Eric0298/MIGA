using System.ComponentModel.DataAnnotations;
using System.Text.Json;

namespace Miga.Contracts.Account;

public sealed record DeleteAccountRequest(
    [Required, MaxLength(128)] string CurrentPassword,
    [Required] string Confirmation);

public sealed record AccountExportResponse(
    DateTimeOffset ExportedAtUtc,
    AccountExportIdentity Account,
    AccountExportSnapshot Snapshot);

public sealed record AccountExportIdentity(
    Guid UserId,
    string Email,
    bool EmailConfirmed,
    DateTimeOffset CreatedAtUtc,
    string PrivacyPolicyVersion,
    DateTimeOffset PrivacyPolicyAcceptedAtUtc);

public sealed record AccountExportSnapshot(
    long Revision,
    DateTimeOffset UpdatedAtUtc,
    JsonElement Data);

public sealed record AccountSessionResponse(
    Guid SessionId,
    DateTimeOffset CreatedAtUtc,
    DateTimeOffset LastSeenAtUtc,
    DateTimeOffset ExpiresAtUtc,
    bool Current);
