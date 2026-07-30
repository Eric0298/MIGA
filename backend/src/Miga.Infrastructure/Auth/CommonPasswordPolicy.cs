using Miga.Application.Auth;

namespace Miga.Infrastructure.Auth;

public sealed class CommonPasswordPolicy : IPasswordPolicy
{
    private const int MinimumLength = 12;
    private const int MaximumLength = 128;

    private static readonly HashSet<string> CommonPasswords = new(StringComparer.OrdinalIgnoreCase)
    {
        "123456789012",
        "password1234",
        "password123",
        "qwertyuiop12",
        "letmein123456",
        "administrator",
        "iloveyou12345",
        "welcome12345",
        "contraseña123",
        "miga12345678",
        "changeme1234",
        "correcthorsebatterystaple"
    };

    public PasswordPolicyResult Validate(string password)
    {
        if (password.Length < MinimumLength)
        {
            return PasswordPolicyResult.Failure("password_too_short");
        }

        if (password.Length > MaximumLength)
        {
            return PasswordPolicyResult.Failure("password_too_long");
        }

        if (CommonPasswords.Contains(password.Trim()))
        {
            return PasswordPolicyResult.Failure("password_too_common");
        }

        if (HasLowCharacterDiversity(password) ||
            IsShortPatternRepeated(password) ||
            ContainsLongSequentialRun(password))
        {
            return PasswordPolicyResult.Failure("password_too_common");
        }

        return PasswordPolicyResult.Success;
    }

    private static bool HasLowCharacterDiversity(string password) =>
        password
            .Select(char.ToLowerInvariant)
            .Distinct()
            .Take(4)
            .Count() < 4;

    private static bool IsShortPatternRepeated(string password)
    {
        for (var patternLength = 1; patternLength <= 4; patternLength++)
        {
            if (password.Length % patternLength != 0)
            {
                continue;
            }

            var repeats = true;
            for (var index = patternLength; index < password.Length; index++)
            {
                if (char.ToLowerInvariant(password[index]) !=
                    char.ToLowerInvariant(password[index % patternLength]))
                {
                    repeats = false;
                    break;
                }
            }

            if (repeats)
            {
                return true;
            }
        }

        return false;
    }

    private static bool ContainsLongSequentialRun(string password)
    {
        var runLength = 1;

        for (var index = 1; index < password.Length; index++)
        {
            var previous = char.ToLowerInvariant(password[index - 1]);
            var current = char.ToLowerInvariant(password[index]);
            var bothLetters = char.IsAsciiLetter(previous) && char.IsAsciiLetter(current);
            var bothDigits = char.IsAsciiDigit(previous) && char.IsAsciiDigit(current);

            if ((bothLetters || bothDigits) &&
                Math.Abs(current - previous) == 1)
            {
                runLength++;
                if (runLength >= 8)
                {
                    return true;
                }
            }
            else
            {
                runLength = 1;
            }
        }

        return false;
    }
}
