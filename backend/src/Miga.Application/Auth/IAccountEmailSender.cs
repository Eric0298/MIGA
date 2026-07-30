namespace Miga.Application.Auth;

public interface IAccountEmailSender
{
    bool IsConfigured { get; }

    Task SendEmailConfirmationAsync(
        string email,
        Uri confirmationUrl,
        CancellationToken cancellationToken);

    Task SendPasswordResetAsync(
        string email,
        Uri resetUrl,
        CancellationToken cancellationToken);
}
