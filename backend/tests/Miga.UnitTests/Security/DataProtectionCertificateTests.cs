using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;
using Miga.Infrastructure.Security;
using Shouldly;

namespace Miga.UnitTests.Security;

public sealed class DataProtectionCertificateTests
{
    private const string TestPassword = "Miga-DataProtection-Test!";

    [Fact]
    public void Loader_ShouldLoadCertificateFromBase64()
    {
        var pfx = GenerateSelfSignedPfx(TestPassword);
        var options = new DataProtectionSecurityOptions
        {
            CertificateBase64 = Convert.ToBase64String(pfx),
            CertificatePassword = TestPassword
        };

        using var certificate = DataProtectionCertificateLoader.Load(options);

        certificate.HasPrivateKey.ShouldBeTrue();
        certificate.Subject.ShouldContain("CN=miga-data-protection-test");
    }

    [Fact]
    public void Loader_ShouldLoadCertificateFromFile()
    {
        var pfx = GenerateSelfSignedPfx(TestPassword);
        var path = Path.Combine(Path.GetTempPath(), $"miga-dp-{Guid.NewGuid():N}.pfx");
        File.WriteAllBytes(path, pfx);

        try
        {
            var options = new DataProtectionSecurityOptions
            {
                CertificatePath = path,
                CertificatePassword = TestPassword
            };

            using var certificate = DataProtectionCertificateLoader.Load(options);
            certificate.HasPrivateKey.ShouldBeTrue();
        }
        finally
        {
            File.Delete(path);
        }
    }

    [Fact]
    public void Validator_ShouldRejectInvalidBase64InProduction()
    {
        var validator = new DataProtectionSecurityOptionsValidator(
            new TestHostEnvironment(Environments.Production));

        var result = validator.Validate(
            null,
            new DataProtectionSecurityOptions
            {
                CertificateBase64 = "not a base64 payload!!",
                CertificatePassword = TestPassword
            });

        result.Failed.ShouldBeTrue();
        result.FailureMessage.ShouldNotContain(TestPassword);
    }

    [Fact]
    public void Validator_ShouldRejectWrongPasswordInProduction()
    {
        var pfx = GenerateSelfSignedPfx(TestPassword);
        var validator = new DataProtectionSecurityOptionsValidator(
            new TestHostEnvironment(Environments.Production));

        var result = validator.Validate(
            null,
            new DataProtectionSecurityOptions
            {
                CertificateBase64 = Convert.ToBase64String(pfx),
                CertificatePassword = "totally-wrong-password"
            });

        result.Failed.ShouldBeTrue();
        result.FailureMessage.ShouldNotContain("totally-wrong-password");
    }

    [Fact]
    public void Validator_ShouldRejectMissingSourceInProduction()
    {
        var validator = new DataProtectionSecurityOptionsValidator(
            new TestHostEnvironment(Environments.Production));

        var result = validator.Validate(null, new DataProtectionSecurityOptions());

        result.Failed.ShouldBeTrue();
        result.FailureMessage.ShouldContain("required in production");
    }

    [Fact]
    public void Validator_ShouldRejectBothSourcesSet()
    {
        var pfx = GenerateSelfSignedPfx(TestPassword);
        var path = Path.Combine(Path.GetTempPath(), $"miga-dp-{Guid.NewGuid():N}.pfx");
        File.WriteAllBytes(path, pfx);

        try
        {
            var validator = new DataProtectionSecurityOptionsValidator(
                new TestHostEnvironment(Environments.Production));

            var result = validator.Validate(
                null,
                new DataProtectionSecurityOptions
                {
                    CertificatePath = path,
                    CertificateBase64 = Convert.ToBase64String(pfx),
                    CertificatePassword = TestPassword
                });

            result.Failed.ShouldBeTrue();
            result.FailureMessage.ShouldContain("exactly one");
        }
        finally
        {
            File.Delete(path);
        }
    }

    [Fact]
    public void Validator_ShouldAllowMissingSourceOutsideProduction()
    {
        var validator = new DataProtectionSecurityOptionsValidator(
            new TestHostEnvironment(Environments.Development));

        validator
            .Validate(null, new DataProtectionSecurityOptions())
            .Succeeded
            .ShouldBeTrue();
    }

    [Fact]
    public void Loader_ShouldRejectMissingFile()
    {
        var options = new DataProtectionSecurityOptions
        {
            CertificatePath = Path.Combine(Path.GetTempPath(), $"missing-{Guid.NewGuid():N}.pfx"),
            CertificatePassword = TestPassword
        };

        Should.Throw<FileNotFoundException>(() => DataProtectionCertificateLoader.Load(options));
    }

    private static byte[] GenerateSelfSignedPfx(string password)
    {
        using var rsa = RSA.Create(2048);
        var request = new CertificateRequest(
            "CN=miga-data-protection-test",
            rsa,
            HashAlgorithmName.SHA256,
            RSASignaturePadding.Pkcs1);
        request.CertificateExtensions.Add(
            new X509KeyUsageExtension(
                X509KeyUsageFlags.DataEncipherment | X509KeyUsageFlags.KeyEncipherment,
                critical: true));

        var notBefore = DateTimeOffset.UtcNow.AddMinutes(-5);
        var notAfter = notBefore.AddDays(1);
        using var certificate = request.CreateSelfSigned(notBefore, notAfter);
        return certificate.Export(X509ContentType.Pfx, password);
    }

    private sealed class TestHostEnvironment : IHostEnvironment
    {
        public TestHostEnvironment(string environmentName)
        {
            EnvironmentName = environmentName;
        }

        public string EnvironmentName { get; set; }

        public string ApplicationName { get; set; } = "Miga.UnitTests";

        public string ContentRootPath { get; set; } = AppContext.BaseDirectory;

        public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
    }
}
