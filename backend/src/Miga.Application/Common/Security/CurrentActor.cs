namespace Miga.Application.Common.Security;

public enum ActorType
{
    Registered,
    Demo
}

public sealed record CurrentActor(
    ActorType Type,
    Guid SessionId,
    Guid WorkspaceId,
    Guid? UserId,
    DateTimeOffset ExpiresAtUtc);

public interface ICurrentActorAccessor
{
    Task<CurrentActor?> GetCurrentAsync(CancellationToken cancellationToken = default);

    Task<CurrentActor?> GetRegisteredAsync(CancellationToken cancellationToken = default);

    Task<CurrentActor?> GetDemoAsync(CancellationToken cancellationToken = default);
}
