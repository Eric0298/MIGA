using Microsoft.AspNetCore.Http;
using Miga.Application.Common.Security;
using Miga.Domain.Entities;
using Miga.Infrastructure.Persistence;

namespace Miga.Infrastructure.Security;

public sealed class SecurityAuditService : ISecurityAuditService
{
    private readonly MigaDbContext _dbContext;
    private readonly IHttpContextAccessor _httpContextAccessor;

    public SecurityAuditService(
        MigaDbContext dbContext,
        IHttpContextAccessor httpContextAccessor)
    {
        _dbContext = dbContext;
        _httpContextAccessor = httpContextAccessor;
    }

    public async Task RecordAsync(
        string eventType,
        string outcome,
        ActorType? actorType,
        Guid? actorId,
        CancellationToken cancellationToken = default)
    {
        var correlationId = _httpContextAccessor.HttpContext?.TraceIdentifier ?? Guid.NewGuid().ToString("N");
        _dbContext.SecurityAuditEvents.Add(new SecurityAuditEvent
        {
            EventType = eventType,
            Outcome = outcome,
            ActorType = actorType?.ToString().ToLowerInvariant(),
            ActorId = actorId,
            CorrelationId = correlationId,
            OccurredAtUtc = DateTimeOffset.UtcNow
        });
        await _dbContext.SaveChangesAsync(cancellationToken);
    }
}
