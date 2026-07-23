namespace Miga.Application.Data;

/// <summary>
/// Stable, non-localized codes returned by <see cref="IDataSnapshotValidator"/>.
/// Callers may map these codes to user-facing messages without reflecting
/// untrusted values.
/// </summary>
public static class DataSnapshotValidationErrorCodes
{
    public const string InvalidType = "snapshot.invalid_type";
    public const string MissingProperty = "snapshot.missing_property";
    public const string UnknownProperty = "snapshot.unknown_property";
    public const string DuplicateProperty = "snapshot.duplicate_property";
    public const string PrototypeKey = "snapshot.prototype_key";
    public const string PayloadTooLarge = "snapshot.payload_too_large";
    public const string TooManyItems = "snapshot.too_many_items";
    public const string StringTooLong = "snapshot.string_too_long";
    public const string InvalidString = "snapshot.invalid_string";
    public const string InvalidFormat = "snapshot.invalid_format";
    public const string InvalidValue = "snapshot.invalid_value";
    public const string DuplicateId = "snapshot.duplicate_id";
    public const string DuplicateValue = "snapshot.duplicate_value";
    public const string InvalidReference = "snapshot.invalid_reference";
    public const string Inconsistent = "snapshot.inconsistent";
    public const string TooManyErrors = "snapshot.too_many_errors";
}
