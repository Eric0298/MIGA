using Microsoft.AspNetCore.Mvc;

namespace Miga.Api.Controllers;

[ApiController]
[Route("api/health")]
public sealed class HealthController : ControllerBase
{
    private readonly IHostEnvironment _environment;

    public HealthController(IHostEnvironment environment)
    {
        _environment = environment;
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
}

public sealed record HealthResponse(
    string Status,
    string Service,
    string Environment,
    DateTimeOffset UtcNow
);