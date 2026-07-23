using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Miga.Infrastructure.Persistence;
using Miga.Infrastructure.Security;

namespace Miga.Api.Controllers;

[ApiController]
[AllowAnonymous]
[Route("api/health")]
public sealed class HealthController : ControllerBase
{
    private readonly MigaDbContext _dbContext;
    private readonly DatabaseHealthOptions _healthOptions;

    public HealthController(
        MigaDbContext dbContext,
        IOptions<DatabaseHealthOptions> healthOptions)
    {
        _dbContext = dbContext;
        _healthOptions = healthOptions.Value;
    }

    [HttpGet]
    [ProducesResponseType(typeof(HealthResponse), StatusCodes.Status200OK)]
    public ActionResult<HealthResponse> Get()
    {
        var response = new HealthResponse(
            Status: "healthy",
            Service: "Miga.Api",
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
        if (!_healthOptions.ExposeDatabaseEndpoint)
        {
            return NotFound();
        }

        var canConnect = await _dbContext.Database.CanConnectAsync(cancellationToken);

        var response = new DatabaseHealthResponse(
            Status: canConnect ? "healthy" : "unhealthy",
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
    DateTimeOffset UtcNow
);

public sealed record DatabaseHealthResponse(
    string Status,
    bool CanConnect,
    DateTimeOffset UtcNow
);
