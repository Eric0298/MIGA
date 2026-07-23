namespace Miga.Application.Auth;

public interface IPasswordPolicy
{
    PasswordPolicyResult Validate(string password);
}

public sealed record PasswordPolicyResult(bool IsValid, string? ErrorCode)
{
    public static PasswordPolicyResult Success { get; } = new(true, null);

    public static PasswordPolicyResult Failure(string code) => new(false, code);
}
