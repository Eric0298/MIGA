using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Miga.Application.Materials;
using Miga.Infrastructure.Materials;
using Miga.Infrastructure.Persistence;

namespace Miga.Infrastructure.DependencyInjection;

public static class InfrastructureServiceCollectionExtensions
{
    public static IServiceCollection AddInfrastructure(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString("MigaDatabase");

        if (string.IsNullOrWhiteSpace(connectionString))
        {
            throw new InvalidOperationException(
                "Connection string 'MigaDatabase' is not configured.");
        }

        services.AddDbContext<MigaDbContext>(options =>
        {
            options.UseNpgsql(connectionString);
        });

        services.AddMemoryCache();

        services
            .AddOptions<YouTubeApiOptions>()
            .Bind(configuration.GetSection(YouTubeApiOptions.SectionName));

        services.AddHttpClient<IYouTubeMetadataService, YouTubeMetadataService>(client =>
        {
            client.Timeout = TimeSpan.FromSeconds(5);
            client.DefaultRequestHeaders.Add("User-Agent", "Miga-Backend/1.0");
            client.DefaultRequestHeaders.Add("Accept", "application/json");
        });

        return services;
    }
}
