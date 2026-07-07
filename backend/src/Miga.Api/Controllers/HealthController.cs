using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Miga.Infrastructure.Persistence;

namespace Miga.Api.Controllers;

[ApiController]
[Route("api/health")]
public sealed class HealthController : ControllerBase
{
    private readonly IHostEnvironment _environment;
    private readonly MigaDbContext _dbContext;

    public HealthController(
        IHostEnvironment environment,
        MigaDbContext dbContext)
    {
        _environment = environment;
        _dbContext = dbContext;
    }

    [HttpGet]
    [ProducesResponseType(typeof(HealthResponse), StatusCodes.Status200OK)]
    public ActionResult<HealthResponse> Get()
    {
        var response = new HealthResponse(
            Status: "healthy",
            Service: "Miga.Api",
            Environment: _environment.EnvironmentName,
            UtcNow: DateTimeOffset.UtcNow
        );

        return Ok(response);
    }

    [HttpGet("db")]
    [ProducesResponseType(typeof(DatabaseHealthResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(DatabaseHealthResponse), StatusCodes.Status503ServiceUnavailable)]
    public async Task<ActionResult<DatabaseHealthResponse>> GetDatabaseHealth(
        CancellationToken cancellationToken)
    {
        var canConnect = await _dbContext.Database.CanConnectAsync(cancellationToken);

        var response = new DatabaseHealthResponse(
            Status: canConnect ? "healthy" : "unhealthy",
            Database: "PostgreSQL",
            CanConnect: canConnect,
            UtcNow: DateTimeOffset.UtcNow
        );

        if (!canConnect)
        {
            return StatusCode(StatusCodes.Status503ServiceUnavailable, response);
        }

        return Ok(response);
    }
}

public sealed record HealthResponse(
    string Status,
    string Service,
    string Environment,
    DateTimeOffset UtcNow
);

public sealed record DatabaseHealthResponse(
    string Status,
    string Database,
    bool CanConnect,
    DateTimeOffset UtcNow
);