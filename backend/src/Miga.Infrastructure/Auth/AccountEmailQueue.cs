using System.Threading.Channels;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Miga.Application.Auth;
using Miga.Infrastructure.Security;

namespace Miga.Infrastructure.Auth;

public sealed class AccountEmailQueue : BackgroundService, IAccountEmailQueue
{
    private const int Capacity = 256;

    private readonly Channel<AccountEmailWorkItem> _channel =
        Channel.CreateBounded<AccountEmailWorkItem>(
            new BoundedChannelOptions(Capacity)
            {
                FullMode = BoundedChannelFullMode.Wait,
                SingleReader = true,
                SingleWriter = false
            });
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly AuthenticationSecurityOptions _options;
    private readonly ILogger<AccountEmailQueue> _logger;

    public AccountEmailQueue(
        IServiceScopeFactory scopeFactory,
        IOptions<AuthenticationSecurityOptions> options,
        ILogger<AccountEmailQueue> logger)
    {
        _scopeFactory = scopeFactory;
        _options = options.Value;
        _logger = logger;
    }

    public bool TryQueueEmailConfirmation(Guid userId) =>
        _channel.Writer.TryWrite(
            new AccountEmailWorkItem(AccountEmailKind.Confirmation, userId));

    public bool TryQueuePasswordReset(Guid userId) =>
        _channel.Writer.TryWrite(
            new AccountEmailWorkItem(AccountEmailKind.PasswordReset, userId));

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        try
        {
            await foreach (var item in _channel.Reader.ReadAllAsync(stoppingToken))
            {
                await ProcessAsync(item, stoppingToken);
            }
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
        {
            // Normal host shutdown.
        }
    }

    private async Task ProcessAsync(
        AccountEmailWorkItem item,
        CancellationToken cancellationToken)
    {
        const int maximumAttempts = 4;
        for (var attempt = 1; attempt <= maximumAttempts; attempt++)
        {
            var deliveryStarted = false;
            try
            {
                await using var scope = _scopeFactory.CreateAsyncScope();
                var sender = scope.ServiceProvider.GetRequiredService<IAccountEmailSender>();
                if (!sender.IsConfigured)
                {
                    return;
                }

                var userManager =
                    scope.ServiceProvider.GetRequiredService<UserManager<MigaUser>>();
                var user = await userManager.FindByIdAsync(item.UserId.ToString());
                if (user?.Email is not { Length: > 0 } email)
                {
                    return;
                }

                switch (item.Kind)
                {
                    case AccountEmailKind.Confirmation when !user.EmailConfirmed:
                        {
                            var token = await userManager.GenerateEmailConfirmationTokenAsync(user);
                            var url = BuildFragmentUrl(
                                "verificar-email",
                                ("userId", user.Id.ToString()),
                                ("token", token));
                            deliveryStarted = true;
                            await sender.SendEmailConfirmationAsync(
                                email,
                                url,
                                cancellationToken);
                            return;
                        }
                    case AccountEmailKind.PasswordReset when user.EmailConfirmed:
                        {
                            var token = await userManager.GeneratePasswordResetTokenAsync(user);
                            var url = BuildFragmentUrl(
                                "restablecer",
                                ("email", email),
                                ("token", token));
                            deliveryStarted = true;
                            await sender.SendPasswordResetAsync(email, url, cancellationToken);
                            return;
                        }
                    default:
                        return;
                }
            }
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
            {
                throw;
            }
            catch (Exception exception)
                when (!deliveryStarted && attempt < maximumAttempts)
            {
                _logger.LogWarning(
                    exception,
                    "Account email preparation attempt {Attempt} failed for work item " +
                    "{EmailKind} and user {UserId}",
                    attempt,
                    item.Kind,
                    item.UserId);
                await Task.Delay(TimeSpan.FromMilliseconds(50 * attempt), cancellationToken);
            }
            catch (Exception exception)
            {
                _logger.LogError(
                    exception,
                    "Account email delivery failed for work item {EmailKind} and user {UserId}",
                    item.Kind,
                    item.UserId);
                return;
            }
        }
    }

    private Uri BuildFragmentUrl(
        string relativePath,
        params (string Key, string Value)[] values)
    {
        var baseUri = new Uri(_options.PublicBaseUrl.TrimEnd('/') + "/");
        var destination = new Uri(baseUri, relativePath);
        var fragment = string.Join(
            "&",
            values.Select(value =>
                $"{Uri.EscapeDataString(value.Key)}={Uri.EscapeDataString(value.Value)}"));
        return new UriBuilder(destination) { Fragment = fragment }.Uri;
    }

    private sealed record AccountEmailWorkItem(AccountEmailKind Kind, Guid UserId);

    private enum AccountEmailKind
    {
        Confirmation,
        PasswordReset
    }
}
