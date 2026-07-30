using System.Security.Cryptography;
using System.Text;

namespace Miga.Application.Common.Security;

/// <summary>
/// Helpers to make user-controlled strings safe for structured log messages.
/// Removes control characters, caps length, and offers non-reversible fingerprints
/// so that log-injection payloads (CR/LF forgery) and sensitive values (URLs, tokens)
/// never reach a log sink verbatim. Every operation is total and allocation-bounded.
/// </summary>
public static class LogSanitizer
{
    public const int DefaultMaxLength = 256;
    private const char Replacement = '_';
    private const int FingerprintBytes = 8;

    private static readonly HashSet<string> KnownHttpMethods = new(StringComparer.Ordinal)
    {
        "GET",
        "HEAD",
        "POST",
        "PUT",
        "PATCH",
        "DELETE",
        "OPTIONS",
        "TRACE",
        "CONNECT",
    };

    public static string Sanitize(string? value, int maxLength = DefaultMaxLength)
    {
        if (maxLength <= 0 || string.IsNullOrEmpty(value))
        {
            return string.Empty;
        }

        var length = Math.Min(value.Length, maxLength);
        var buffer = new char[length];
        for (var i = 0; i < length; i++)
        {
            var current = value[i];
            buffer[i] = char.IsControl(current) ? Replacement : current;
        }
        return new string(buffer);
    }

    public static string SanitizeHttpMethod(string? method)
    {
        if (string.IsNullOrEmpty(method))
        {
            return "UNKNOWN";
        }

        // Uppercase in a bounded way so a hostile client cannot smuggle
        // Unicode-cased look-alikes past the whitelist check.
        var normalized = method.Length > 16 ? method[..16] : method;
        var upper = normalized.ToUpperInvariant();
        return KnownHttpMethods.Contains(upper) ? upper : "OTHER";
    }

    /// <summary>
    /// Returns a short hex fingerprint (SHA-256 truncated) suitable for log correlation.
    /// The result is a constant-shape token (16 hex chars) that cannot inject control
    /// characters and does not reveal the underlying value.
    /// </summary>
    public static string Fingerprint(string? value)
    {
        if (string.IsNullOrEmpty(value))
        {
            return "0000000000000000";
        }

        Span<byte> hash = stackalloc byte[SHA256.HashSizeInBytes];
        var bytes = Encoding.UTF8.GetBytes(value);
        SHA256.HashData(bytes, hash);
        return Convert.ToHexString(hash[..FingerprintBytes]);
    }
}
