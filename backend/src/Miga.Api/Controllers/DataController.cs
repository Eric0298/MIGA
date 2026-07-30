using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Miga.Api.Security;
using Miga.Application.Common.Security;
using Miga.Application.Data;
using Miga.Contracts.Data;
using Miga.Infrastructure.Auth;
using Miga.Infrastructure.Persistence;
using Miga.Infrastructure.Security;

namespace Miga.Api.Controllers;

[ApiController]
[Route("api/data/snapshot")]
[Authorize(Policy = MigaAuthenticationConstants.WorkspacePolicy)]
public sealed class DataController : ApiControllerBase
{
    private readonly ICurrentActorAccessor _currentActorAccessor;
    private readonly IDataSnapshotValidator _validator;
    private readonly MigaDbContext _dbContext;
    private readonly DemoSecurityOptions _demoOptions;

    public DataController(
        ICurrentActorAccessor currentActorAccessor,
        IDataSnapshotValidator validator,
        MigaDbContext dbContext,
        IOptions<DemoSecurityOptions> demoOptions)
    {
        _currentActorAccessor = currentActorAccessor;
        _validator = validator;
        _dbContext = dbContext;
        _demoOptions = demoOptions.Value;
    }

    [HttpGet]
    [ProducesResponseType<DataSnapshotResponse>(StatusCodes.Status200OK)]
    public async Task<ActionResult<DataSnapshotResponse>> Get(CancellationToken cancellationToken)
    {
        var actor = await _currentActorAccessor.GetCurrentAsync(cancellationToken);
        if (actor is null)
        {
            return ApiProblem(
                StatusCodes.Status401Unauthorized,
                "session_invalid",
                "The session is no longer valid.");
        }

        var snapshot = await _dbContext.WorkspaceSnapshots
            .AsNoTracking()
            .Where(x => x.WorkspaceId == actor.WorkspaceId)
            .Select(x => new { x.Revision, x.UpdatedAtUtc, x.DataJson })
            .SingleOrDefaultAsync(cancellationToken);
        if (snapshot is null)
        {
            return ApiProblem(
                StatusCodes.Status409Conflict,
                "workspace_unavailable",
                "The workspace is unavailable.");
        }

        using var document = JsonDocument.Parse(snapshot.DataJson);
        return Ok(new DataSnapshotResponse(
            snapshot.Revision,
            snapshot.UpdatedAtUtc,
            document.RootElement.Clone()));
    }

    [HttpPut]
    [EnableRateLimiting(ApiSecurityConstants.SnapshotWriteRatePolicy)]
    [RequestSizeLimit(6 * 1024 * 1024)]
    [ProducesResponseType<DataSnapshotResponse>(StatusCodes.Status200OK)]
    public async Task<ActionResult<DataSnapshotResponse>> Put(
        [FromBody] PutDataSnapshotRequest request,
        CancellationToken cancellationToken)
    {
        if (request.Revision < 0)
        {
            return ApiProblem(
                StatusCodes.Status400BadRequest,
                "snapshot_revision_invalid",
                "The snapshot revision is invalid.");
        }

        var actor = await _currentActorAccessor.GetCurrentAsync(cancellationToken);
        if (actor is null)
        {
            return ApiProblem(
                StatusCodes.Status401Unauthorized,
                "session_invalid",
                "The session is no longer valid.");
        }

        if (request.WorkspaceId != actor.WorkspaceId)
        {
            return ApiProblem(
                StatusCodes.Status409Conflict,
                "workspace_scope_mismatch",
                "The active workspace changed. Reload before saving.");
        }

        var validation = _validator.Validate(request.Data);
        if (!validation.IsValid)
        {
            return ApiProblem(
                StatusCodes.Status400BadRequest,
                "snapshot_invalid",
                "The snapshot payload is invalid.",
                new Dictionary<string, object?>
                {
                    ["errors"] = validation.Errors
                });
        }

        var dataJson = request.Data.GetRawText();
        var maximumBytes = actor.Type == ActorType.Demo
            ? _demoOptions.MaximumSnapshotBytes
            : _demoOptions.RegisteredMaximumSnapshotBytes;
        if (Encoding.UTF8.GetByteCount(dataJson) > maximumBytes)
        {
            return ApiProblem(
                StatusCodes.Status413PayloadTooLarge,
                "snapshot_too_large",
                "The snapshot payload exceeds the account limit.",
                new Dictionary<string, object?>
                {
                    ["maximumBytes"] = maximumBytes
                });
        }

        var updatedAtUtc = DateTimeOffset.UtcNow;
        var affected = await _dbContext.WorkspaceSnapshots
            .Where(x =>
                x.WorkspaceId == actor.WorkspaceId &&
                x.Revision == request.Revision)
            .ExecuteUpdateAsync(
                setters => setters
                    .SetProperty(x => x.Revision, request.Revision + 1)
                    .SetProperty(x => x.DataJson, dataJson)
                    .SetProperty(x => x.UpdatedAtUtc, updatedAtUtc),
                cancellationToken);

        if (affected == 0)
        {
            var currentRevision = await _dbContext.WorkspaceSnapshots
                .AsNoTracking()
                .Where(x => x.WorkspaceId == actor.WorkspaceId)
                .Select(x => (long?)x.Revision)
                .SingleOrDefaultAsync(cancellationToken);
            if (currentRevision is null)
            {
                return ApiProblem(
                    StatusCodes.Status409Conflict,
                    "workspace_unavailable",
                    "The workspace is unavailable.");
            }

            return ApiProblem(
                StatusCodes.Status409Conflict,
                "snapshot_revision_conflict",
                "The snapshot has changed.",
                new Dictionary<string, object?>
                {
                    ["currentRevision"] = currentRevision.Value
                });
        }

        return Ok(new DataSnapshotResponse(
            request.Revision + 1,
            updatedAtUtc,
            request.Data.Clone()));
    }
}
