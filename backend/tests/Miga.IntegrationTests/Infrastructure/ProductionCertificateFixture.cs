using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;

namespace Miga.IntegrationTests.Infrastructure;

// Generates an ephemeral PFX once per test process so Production-mode
// integration tests can satisfy DataProtectionSecurityOptionsValidator without
// touching the filesystem or any real secret. The certificate never leaves
// memory; only its Base64/password strings are exposed to the test harness.
internal static class ProductionCertificateFixture
{
    public const string Password = "miga-integration-tests-only";

    public static readonly string Base64 = CreateBase64();

    private static string CreateBase64()
    {
        using var rsa = RSA.Create(2048);
        var request = new CertificateRequest(
            "CN=miga-integration-tests",
            rsa,
            HashAlgorithmName.SHA256,
            RSASignaturePadding.Pkcs1);
        request.CertificateExtensions.Add(
            new X509KeyUsageExtension(
                X509KeyUsageFlags.DataEncipherment | X509KeyUsageFlags.KeyEncipherment,
                critical: true));

        var notBefore = DateTimeOffset.UtcNow.AddMinutes(-5);
        var notAfter = notBefore.AddHours(2);
        using var certificate = request.CreateSelfSigned(notBefore, notAfter);
        return Convert.ToBase64String(certificate.Export(X509ContentType.Pfx, Password));
    }
}
