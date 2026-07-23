using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Options;

namespace Miga.Infrastructure.Materials;

public sealed class YouTubeApiOptionsValidator : IValidateOptions<YouTubeApiOptions>
{
    private readonly IHostEnvironment _environment;

    public YouTubeApiOptionsValidator(IHostEnvironment environment)
    {
        _environment = environment;
    }

    public ValidateOptionsResult Validate(string? name, YouTubeApiOptions options)
    {
        if (options.CacheTtl < TimeSpan.FromMinutes(1) ||
            options.CacheTtl > TimeSpan.FromDays(7))
        {
            return ValidateOptionsResult.Fail("YouTubeApi:CacheTtl must be between 1 minute and 7 days.");
        }

        if (options.Enabled &&
            string.IsNullOrWhiteSpace(options.ApiKey) &&
            _environment.IsProduction())
        {
            return ValidateOptionsResult.Fail(
                "YouTubeApi:ApiKey is required when the integration is enabled in production.");
        }

        if (options.ApiKey.Contains('\r') || options.ApiKey.Contains('\n'))
        {
            return ValidateOptionsResult.Fail(
                "YouTubeApi:ApiKey contains invalid characters.");
        }

        return ValidateOptionsResult.Success;
    }
}
