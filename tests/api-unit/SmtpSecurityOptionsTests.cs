using MailKit.Security;
using Vizora;

namespace Api.UnitTests;

public sealed class SmtpSecurityOptionsTests
{
    [Fact]
    public void Port465UsesImplicitTls()
    {
        var options = SmtpTransportOptions.ResolveSecureSocketOptions(
            enableSsl: true, port: 465, host: "smtp.163.com", isDevelopment: true);

        Assert.Equal(SecureSocketOptions.SslOnConnect, options);
    }

    [Fact]
    public void OtherTlsPortsUseStartTls()
    {
        var options = SmtpTransportOptions.ResolveSecureSocketOptions(
            enableSsl: true, port: 587, host: "smtp.example.com", isDevelopment: false);

        Assert.Equal(SecureSocketOptions.StartTls, options);
    }

    [Theory]
    [InlineData("localhost")]
    [InlineData("127.0.0.1")]
    [InlineData("::1")]
    public void DevelopmentLoopbackCanUsePlainSmtpCapture(string host)
    {
        var options = SmtpTransportOptions.ResolveSecureSocketOptions(
            enableSsl: false, port: 55252, host, isDevelopment: true);

        Assert.Equal(SecureSocketOptions.None, options);
    }

    [Fact]
    public void PlainSmtpIsRejectedOutsideDevelopmentLoopback()
    {
        Assert.Throws<InvalidOperationException>(() =>
            SmtpTransportOptions.ResolveSecureSocketOptions(
                enableSsl: false, port: 25, host: "smtp.example.com", isDevelopment: true));

        Assert.Throws<InvalidOperationException>(() =>
            SmtpTransportOptions.ResolveSecureSocketOptions(
                enableSsl: false, port: 25, host: "localhost", isDevelopment: false));
    }

    [Theory]
    [InlineData(0)]
    [InlineData(65536)]
    public void InvalidPortsAreRejected(int port)
    {
        Assert.Throws<ArgumentOutOfRangeException>(() =>
            SmtpTransportOptions.ResolveSecureSocketOptions(
                enableSsl: true, port, host: "smtp.example.com", isDevelopment: false));
    }

    [Theory]
    [InlineData(null, null, true)]
    [InlineData("", "", true)]
    [InlineData("mailer", "password", true)]
    [InlineData("mailer", "", false)]
    [InlineData("", "password", false)]
    [InlineData(null, "password", false)]
    public void CredentialsMustBeProvidedAsAConsistentPair(string? user, string? password, bool expected)
    {
        Assert.Equal(expected, SmtpTransportOptions.HasConsistentCredentials(user, password));
    }
}
