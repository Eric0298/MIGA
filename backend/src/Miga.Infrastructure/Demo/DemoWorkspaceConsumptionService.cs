using Microsoft.EntityFrameworkCore;
using Miga.Application.Demo;
using Miga.Domain.Enums;
using Miga.Infrastructure.Persistence;

namespace Miga.Infrastructure.Demo;

public sealed class DemoWorkspaceConsumptionService : IDemoWorkspaceConsumptionService
{
    private readonly MigaDbContext _dbContext;

    public DemoWorkspaceConsumptionService(MigaDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<bool> TryConvertAsync(
        Guid workspaceId,
        Guid demoSessionId,
        long expectedRevision,
        Guid ownerUserId,
        DateTimeOffset convertedAtUtc,
        CancellationToken cancellationToken = default)
    {
        var sessionState = await _dbContext.DemoSessions
            .AsNoTracking()
            .Where(session =>
                session.Id == demoSessionId &&
                session.WorkspaceId == workspaceId)
            .Select(session => new
            {
                session.IdleExpiresAtUtc,
                session.AbsoluteExpiresAtUtc,
                session.RevokedAtUtc,
                WorkspaceExpiresAtUtc = session.Workspace.ExpiresAtUtc
            })
            .SingleOrDefaultAsync(cancellationToken);
        if (sessionState is null ||
            sessionState.RevokedAtUtc is not null ||
            sessionState.IdleExpiresAtUtc <= convertedAtUtc ||
            sessionState.AbsoluteExpiresAtUtc <= convertedAtUtc ||
            sessionState.WorkspaceExpiresAtUtc <= convertedAtUtc)
        {
            return false;
        }

        // Updating the versioned row first serializes conversion with
        // PUT /snapshot. Exactly one operation can win the expected revision.
        var snapshotRows = await _dbContext.WorkspaceSnapshots
            .Where(snapshot =>
                snapshot.WorkspaceId == workspaceId &&
                snapshot.Revision == expectedRevision)
            .ExecuteUpdateAsync(
                setters => setters
                    .SetProperty(snapshot => snapshot.Revision, expectedRevision + 1)
                    .SetProperty(snapshot => snapshot.UpdatedAtUtc, convertedAtUtc),
                cancellationToken);
        if (snapshotRows != 1)
        {
            return false;
        }

        var sessionRows = await _dbContext.DemoSessions
            .Where(session =>
                session.Id == demoSessionId &&
                session.WorkspaceId == workspaceId &&
                session.RevokedAtUtc == null &&
                session.IdleExpiresAtUtc == sessionState.IdleExpiresAtUtc &&
                session.AbsoluteExpiresAtUtc == sessionState.AbsoluteExpiresAtUtc)
            .ExecuteDeleteAsync(cancellationToken);
        if (sessionRows != 1)
        {
            return false;
        }

        var workspaceRows = await _dbContext.Workspaces
            .Where(workspace =>
                workspace.Id == workspaceId &&
                workspace.Kind == WorkspaceKind.Demo &&
                workspace.OwnerUserId == null &&
                workspace.ExpiresAtUtc == sessionState.WorkspaceExpiresAtUtc)
            .ExecuteUpdateAsync(
                setters => setters
                    .SetProperty(workspace => workspace.Kind, WorkspaceKind.Registered)
                    .SetProperty(workspace => workspace.OwnerUserId, ownerUserId)
                    .SetProperty(workspace => workspace.ExpiresAtUtc, (DateTimeOffset?)null),
                cancellationToken);
        return workspaceRows == 1;
    }
}
