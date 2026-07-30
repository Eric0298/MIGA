using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;

namespace Miga.Infrastructure.Security;

/// <summary>
/// Loads the Data Protection X.509 certificate from either a mounted PFX file
/// or a sealed base64-encoded PFX supplied via a secret variable.
/// Callers must ensure exactly one source is configured before invoking Load.
/// </summary>
public static class DataProtectionCertificateLoader
{
    public enum SourceKind
    {
        None,
        File,
        Base64,
        Both
    }

    public static SourceKind ResolveSource(DataProtectionSecurityOptions options)
    {
        var hasPath = !string.IsNullOrWhiteSpace(options.CertificatePath);
        var hasBase64 = !string.IsNullOrWhiteSpace(options.CertificateBase64);

        return (hasPath, hasBase64) switch
        {
            (true, true) => SourceKind.Both,
            (true, false) => SourceKind.File,
            (false, true) => SourceKind.Base64,
            _ => SourceKind.None
        };
    }

    public static X509Certificate2 Load(DataProtectionSecurityOptions options)
    {
        var source = ResolveSource(options);
        return source switch
        {
            SourceKind.File => LoadFromFile(options.CertificatePath, options.CertificatePassword),
            SourceKind.Base64 => LoadFromBase64(options.CertificateBase64, options.CertificatePassword),
            SourceKind.Both => throw new InvalidOperationException(
                "DataProtection: CertificatePath and CertificateBase64 cannot both be set."),
            _ => throw new InvalidOperationException(
                "DataProtection: exactly one of CertificatePath or CertificateBase64 must be set.")
        };
    }

    private static X509Certificate2 LoadFromFile(string path, string password)
    {
        if (!File.Exists(path))
        {
            throw new FileNotFoundException(
                "DataProtection: certificate file was not found at the configured path.",
                path);
        }

        try
        {
            return X509CertificateLoader.LoadPkcs12FromFile(
                path,
                password,
                X509KeyStorageFlags.EphemeralKeySet);
        }
        catch (CryptographicException ex)
        {
            throw new InvalidOperationException(
                "DataProtection: certificate at the configured path is invalid or the password is wrong.",
                ex);
        }
    }

    private static X509Certificate2 LoadFromBase64(string base64, string password)
    {
        byte[] bytes;
        try
        {
            bytes = Convert.FromBase64String(base64.Trim());
        }
        catch (FormatException ex)
        {
            throw new InvalidOperationException(
                "DataProtection: CertificateBase64 is not a valid base64 string.",
                ex);
        }

        try
        {
            return X509CertificateLoader.LoadPkcs12(
                bytes,
                password,
                X509KeyStorageFlags.EphemeralKeySet);
        }
        catch (CryptographicException ex)
        {
            throw new InvalidOperationException(
                "DataProtection: sealed certificate is invalid or the password is wrong.",
                ex);
        }
        finally
        {
            CryptographicOperations.ZeroMemory(bytes);
        }
    }
}
