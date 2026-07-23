namespace Miga.Application.Data;

public sealed record DataSnapshotValidationError(string Code, string Path);

public sealed class DataSnapshotValidationResult
{
    public DataSnapshotValidationResult(IReadOnlyList<DataSnapshotValidationError> errors)
    {
        Errors = errors;
    }

    public bool IsValid => Errors.Count == 0;

    public IReadOnlyList<DataSnapshotValidationError> Errors { get; }
}

public interface IDataSnapshotValidator
{
    DataSnapshotValidationResult Validate(System.Text.Json.JsonElement data);
}
