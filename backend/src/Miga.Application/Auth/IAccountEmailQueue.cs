namespace Miga.Application.Auth;

public interface IAccountEmailQueue
{
    bool TryQueueEmailConfirmation(Guid userId);

    bool TryQueuePasswordReset(Guid userId);
}
