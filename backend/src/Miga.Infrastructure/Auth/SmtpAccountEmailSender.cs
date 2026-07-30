using System.Net;
using System.Net.Mail;
using Microsoft.Extensions.Options;
using Miga.Application.Auth;
using Miga.Infrastructure.Security;

namespace Miga.Infrastructure.Auth;

public sealed class SmtpAccountEmailSender : IAccountEmailSender
{
    private static readonly TimeSpan DeliveryTimeout = TimeSpan.FromSeconds(15);

    private readonly SmtpOptions _options;

    public SmtpAccountEmailSender(IOptions<SmtpOptions> options)
    {
        _options = options.Value;
    }

    public bool IsConfigured => _options.Enabled;

    public Task SendEmailConfirmationAsync(
        string email,
        Uri confirmationUrl,
        CancellationToken cancellationToken) =>
        SendAsync(
            email,
            "Confirma tu cuenta de MIGA",
            $"Confirma tu cuenta abriendo este enlace:\n\n{confirmationUrl.AbsoluteUri}\n\n" +
            "El enlace caduca en 30 minutos. Si no solicitaste la cuenta, ignora este mensaje.",
            cancellationToken);

    public Task SendPasswordResetAsync(
        string email,
        Uri resetUrl,
        CancellationToken cancellationToken) =>
        SendAsync(
            email,
            "Restablece tu contraseña de MIGA",
            $"Restablece tu contraseña abriendo este enlace:\n\n{resetUrl.AbsoluteUri}\n\n" +
            "El enlace caduca en 30 minutos. Si no lo solicitaste, ignora este mensaje.",
            cancellationToken);

    private async Task SendAsync(
        string destination,
        string subject,
        string body,
        CancellationToken cancellationToken)
    {
        if (!_options.Enabled)
        {
            throw new InvalidOperationException("SMTP delivery is not configured.");
        }

        using var message = new MailMessage(_options.FromAddress, destination, subject, body);
        using var client = new SmtpClient(_options.Host, _options.Port)
        {
            EnableSsl = _options.UseSsl,
            DeliveryMethod = SmtpDeliveryMethod.Network,
            UseDefaultCredentials = false,
            Credentials = new NetworkCredential(_options.Username, _options.Password),
            Timeout = (int)DeliveryTimeout.TotalMilliseconds
        };

        using var deliveryCancellation =
            CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        deliveryCancellation.CancelAfter(DeliveryTimeout);
        await client.SendMailAsync(message, deliveryCancellation.Token);
    }
}

public sealed class UnconfiguredAccountEmailSender : IAccountEmailSender
{
    public bool IsConfigured => false;

    public Task SendEmailConfirmationAsync(
        string email,
        Uri confirmationUrl,
        CancellationToken cancellationToken) =>
        Task.FromException(new InvalidOperationException("SMTP delivery is not configured."));

    public Task SendPasswordResetAsync(
        string email,
        Uri resetUrl,
        CancellationToken cancellationToken) =>
        Task.FromException(new InvalidOperationException("SMTP delivery is not configured."));
}
