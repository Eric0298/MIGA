using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;
using Miga.Infrastructure.Security;
using Shouldly;

namespace Miga.UnitTests.Security;

public sealed class EmailDeliveryValidatorTests
{
    [Fact]
    public void EmailDelivery_Disabled_InProduction_WithConfirmedEmail_Fails()
    {
        var validator = new EmailDeliveryOptionsValidator(
            new TestHostEnvironment(Environments.Production),
            BuildConfiguration(new Dictionary<string, string?>
            {
                ["Authentication:RequireConfirmedEmail"] = "true"
            }));

        var result = validator.Validate(
            null,
            new EmailDeliveryOptions { Provider = EmailDeliveryProvider.Disabled });

        result.Failed.ShouldBeTrue();
        result.FailureMessage.ShouldContain("BrevoApi");
    }

    [Fact]
    public void EmailDelivery_Disabled_InProduction_WithoutConfirmedEmail_Passes()
    {
        var validator = new EmailDeliveryOptionsValidator(
            new TestHostEnvironment(Environments.Production),
            BuildConfiguration(new Dictionary<string, string?>
            {
                ["Authentication:RequireConfirmedEmail"] = "false"
            }));

        validator
            .Validate(null, new EmailDeliveryOptions { Provider = EmailDeliveryProvider.Disabled })
            .Succeeded
            .ShouldBeTrue();
    }

    [Fact]
    public void EmailDelivery_BrevoApi_InProduction_Passes()
    {
        var validator = new EmailDeliveryOptionsValidator(
            new TestHostEnvironment(Environments.Production),
            BuildConfiguration(new Dictionary<string, string?>
            {
                ["Authentication:RequireConfirmedEmail"] = "true"
            }));

        validator
            .Validate(null, new EmailDeliveryOptions { Provider = EmailDeliveryProvider.BrevoApi })
            .Succeeded
            .ShouldBeTrue();
    }

    [Fact]
    public void Brevo_WithoutApiKey_FailsWhenBrevoSelected()
    {
        var validator = new BrevoOptionsValidator(
            new TestHostEnvironment(Environments.Production),
            BuildConfiguration(new Dictionary<string, string?>
            {
                ["EmailDelivery:Provider"] = "BrevoApi",
                ["Authentication:RequireConfirmedEmail"] = "true"
            }));

        validator
            .Validate(
                null,
                new BrevoOptions
                {
                    FromAddress = "no-reply@ericmancebo.com",
                    FromName = "MIGA"
                })
            .Failed
            .ShouldBeTrue();
    }

    [Fact]
    public void Brevo_ApiKeyWithControlCharacters_Fails()
    {
        var validator = new BrevoOptionsValidator(
            new TestHostEnvironment(Environments.Production),
            BuildConfiguration(new Dictionary<string, string?>
            {
                ["EmailDelivery:Provider"] = "BrevoApi"
            }));

        validator
            .Validate(
                null,
                new BrevoOptions
                {
                    ApiKey = "xkeysib-\nlinefeed",
                    FromAddress = "no-reply@ericmancebo.com",
                    FromName = "MIGA"
                })
            .Failed
            .ShouldBeTrue();
    }

    [Fact]
    public void Brevo_InvalidFromAddress_Fails()
    {
        var validator = new BrevoOptionsValidator(
            new TestHostEnvironment(Environments.Production),
            BuildConfiguration(new Dictionary<string, string?>
            {
                ["EmailDelivery:Provider"] = "BrevoApi"
            }));

        validator
            .Validate(
                null,
                new BrevoOptions
                {
                    ApiKey = "xkeysib-valid-shape",
                    FromAddress = "not-a-mailbox",
                    FromName = "MIGA"
                })
            .Failed
            .ShouldBeTrue();
    }

    [Fact]
    public void Brevo_InProductionRequiresVerifiedSender()
    {
        var validator = new BrevoOptionsValidator(
            new TestHostEnvironment(Environments.Production),
            BuildConfiguration(new Dictionary<string, string?>
            {
                ["EmailDelivery:Provider"] = "BrevoApi"
            }));

        var result = validator.Validate(
            null,
            new BrevoOptions
            {
                ApiKey = "xkeysib-valid-shape",
                FromAddress = "someone@example.com",
                FromName = "MIGA"
            });

        result.Failed.ShouldBeTrue();
        result.FailureMessage.ShouldContain("production sender identity");
    }

    [Fact]
    public void Brevo_IgnoredWhenSmtpSelected()
    {
        var validator = new BrevoOptionsValidator(
            new TestHostEnvironment(Environments.Production),
            BuildConfiguration(new Dictionary<string, string?>
            {
                ["EmailDelivery:Provider"] = "Smtp"
            }));

        // Empty Brevo options must not gate startup when the SMTP provider is
        // active — the Brevo variables are simply not needed.
        validator
            .Validate(null, new BrevoOptions())
            .Succeeded
            .ShouldBeTrue();
    }

    [Fact]
    public void Smtp_IgnoredWhenBrevoApiSelected()
    {
        var validator = new SmtpOptionsValidator(
            new TestHostEnvironment(Environments.Production),
            BuildConfiguration(new Dictionary<string, string?>
            {
                ["EmailDelivery:Provider"] = "BrevoApi",
                ["Authentication:RequireConfirmedEmail"] = "true"
            }));

        // Legacy SMTP variables can stay in place during rollout without
        // failing startup once EmailDelivery:Provider=BrevoApi.
        validator
            .Validate(
                null,
                new SmtpOptions
                {
                    Enabled = true,
                    Host = "smtp.example",
                    Port = 587,
                    UseSsl = true,
                    FromAddress = "no-reply@example.com"
                })
            .Succeeded
            .ShouldBeTrue();
    }

    [Fact]
    public void Smtp_SelectedWithoutEnabled_Fails()
    {
        var validator = new SmtpOptionsValidator(
            new TestHostEnvironment(Environments.Production),
            BuildConfiguration(new Dictionary<string, string?>
            {
                ["EmailDelivery:Provider"] = "Smtp"
            }));

        validator
            .Validate(null, new SmtpOptions { Enabled = false })
            .Failed
            .ShouldBeTrue();
    }

    private static IConfiguration BuildConfiguration(IDictionary<string, string?> values)
    {
        return new ConfigurationBuilder()
            .AddInMemoryCollection(values)
            .Build();
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
