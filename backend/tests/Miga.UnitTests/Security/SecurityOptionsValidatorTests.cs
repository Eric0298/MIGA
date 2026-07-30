using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;
using Miga.Infrastructure.Security;
using Shouldly;

namespace Miga.UnitTests.Security;

public sealed class SecurityOptionsValidatorTests
{
    [Theory]
    [InlineData("https://user:password@miga.example/")]
    [InlineData("https://miga.example/?next=evil")]
    [InlineData("https://miga.example/#token")]
    [InlineData("https:\\\\miga.example\\app")]
    [InlineData("https://")]
    public void AuthenticationValidator_ShouldRejectAmbiguousPublicBaseUrls(string publicBaseUrl)
    {
        var validator = new AuthenticationSecurityOptionsValidator(
            new TestHostEnvironment(Environments.Production));

        var result = validator.Validate(
            null,
            ValidAuthenticationOptions(publicBaseUrl));

        result.Failed.ShouldBeTrue();
    }

    [Fact]
    public void AuthenticationValidator_ShouldAllowCanonicalHttpsBasePath()
    {
        var validator = new AuthenticationSecurityOptionsValidator(
            new TestHostEnvironment(Environments.Production));

        var result = validator.Validate(
            null,
            ValidAuthenticationOptions("https://miga.example/application/"));

        result.Succeeded.ShouldBeTrue();
    }

    [Fact]
    public void AuthenticationValidator_ShouldRequireConfirmedEmailInProduction()
    {
        var validator = new AuthenticationSecurityOptionsValidator(
            new TestHostEnvironment(Environments.Production));
        var options = new AuthenticationSecurityOptions
        {
            RequireConfirmedEmail = false,
            PublicBaseUrl = "https://miga.example/"
        };

        validator.Validate(null, options).Failed.ShouldBeTrue();
    }

    [Fact]
    public void AuthenticationValidator_ShouldRejectExcessiveSecurityTimeouts()
    {
        var validator = new AuthenticationSecurityOptionsValidator(
            new TestHostEnvironment(Environments.Production));

        validator.Validate(
                null,
                new AuthenticationSecurityOptions
                {
                    RequireConfirmedEmail = true,
                    PublicBaseUrl = "https://miga.example/",
                    UserAbsoluteTimeout = TimeSpan.FromDays(8)
                })
            .Failed
            .ShouldBeTrue();
        validator.Validate(
                null,
                new AuthenticationSecurityOptions
                {
                    RequireConfirmedEmail = true,
                    PublicBaseUrl = "https://miga.example/",
                    UnconfirmedAccountLifetime = TimeSpan.FromDays(31)
                })
            .Failed
            .ShouldBeTrue();
    }

    [Fact]
    public void SmtpValidator_ShouldRequireTlsAndValidMailboxInProduction()
    {
        var environment = new TestHostEnvironment(Environments.Production);
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Authentication:RequireConfirmedEmail"] = "true"
            })
            .Build();
        var validator = new SmtpOptionsValidator(environment, configuration);

        validator.Validate(
                null,
                ValidSmtpOptions(useSsl: false, fromAddress: "security@miga.example"))
            .Failed
            .ShouldBeTrue();
        validator.Validate(
                null,
                ValidSmtpOptions(useSsl: true, fromAddress: "not-an-address"))
            .Failed
            .ShouldBeTrue();
        validator.Validate(
                null,
                ValidSmtpOptions(useSsl: true, fromAddress: "security@miga.example"))
            .Succeeded
            .ShouldBeTrue();
    }

    [Theory]
    [InlineData("Host=db.example;Database=miga;Username=miga;SSL Mode=Disable")]
    [InlineData("Host=db.example;Database=miga;Username=miga;SSL Mode=Require")]
    [InlineData(
        "Host=db.example;Database=miga;Username=miga;SSL Mode=VerifyFull;Trust Server Certificate=true")]
    public void DatabaseValidator_ShouldRejectUnverifiedProductionTls(string connectionString)
    {
        Should.Throw<InvalidOperationException>(
            () => DatabaseConnectionSecurityValidator.ValidateProduction(connectionString));
    }

    [Fact]
    public void DatabaseValidator_ShouldAcceptFullCertificateAndHostnameVerification()
    {
        Should.NotThrow(
            () => DatabaseConnectionSecurityValidator.ValidateProduction(
                "Host=db.example;Database=miga;Username=miga;" +
                "SSL Mode=VerifyFull;Trust Server Certificate=false"));
    }

    private static AuthenticationSecurityOptions ValidAuthenticationOptions(
        string publicBaseUrl) =>
        new()
        {
            RequireConfirmedEmail = true,
            PublicBaseUrl = publicBaseUrl
        };

    private static SmtpOptions ValidSmtpOptions(bool useSsl, string fromAddress) =>
        new()
        {
            Enabled = true,
            Host = "smtp.miga.example",
            Port = 587,
            UseSsl = useSsl,
            FromAddress = fromAddress
        };

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
