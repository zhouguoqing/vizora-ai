using System.Net;
using MailKit.Net.Smtp;
using MailKit.Security;
using MimeKit;

namespace Vizora;

public interface IAccountMailer
{
    Task SendAsync(string recipient, string subject, string body);
}

public sealed class SmtpAccountMailer(IConfiguration cfg, IHostEnvironment env) : IAccountMailer
{
    public async Task SendAsync(string recipient, string subject, string body)
    {
        var host = cfg["Mail:Host"];
        var port = cfg.GetValue<int?>("Mail:Port") ?? 587;
        var enableSsl = env.IsProduction() || cfg.GetValue<bool?>("Mail:EnableSsl") != false;
        var options = SmtpTransportOptions.ResolveSecureSocketOptions(
            enableSsl, port, host ?? "", env.IsDevelopment());

        using var client = new SmtpClient { Timeout = 15000 };
        await client.ConnectAsync(host!, port, options);

        var user = cfg["Mail:User"];
        if (!string.IsNullOrWhiteSpace(user))
            await client.AuthenticateAsync(user, cfg["Mail:Password"] ?? "");

        var message = new MimeMessage();
        message.From.Add(MailboxAddress.Parse(cfg["Mail:From"]!));
        message.To.Add(MailboxAddress.Parse(recipient));
        message.Subject = subject;
        message.Body = new TextPart("plain") { Text = body };

        await client.SendAsync(message);
        await client.DisconnectAsync(true);
    }
}

public static class SmtpTransportOptions
{
    public static bool HasConsistentCredentials(string? user, string? password) =>
        string.IsNullOrWhiteSpace(user) == string.IsNullOrWhiteSpace(password);

    public static SecureSocketOptions ResolveSecureSocketOptions(
        bool enableSsl, int port, string host, bool isDevelopment)
    {
        if (port is < 1 or > 65535)
            throw new ArgumentOutOfRangeException(nameof(port));
        if (string.IsNullOrWhiteSpace(host))
            throw new ArgumentException("SMTP host is required", nameof(host));

        if (enableSsl)
            return port == 465 ? SecureSocketOptions.SslOnConnect : SecureSocketOptions.StartTls;

        if (isDevelopment && IsLoopbackHost(host))
            return SecureSocketOptions.None;

        throw new InvalidOperationException("SMTP TLS is required outside loopback Development");
    }

    static bool IsLoopbackHost(string host) =>
        string.Equals(host.Trim(), "localhost", StringComparison.OrdinalIgnoreCase) ||
        (IPAddress.TryParse(host, out var address) && IPAddress.IsLoopback(address));
}
