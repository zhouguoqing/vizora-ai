using System.Net.Mail;

namespace Vizora;

public static class Api
{
    public static object Failure(string code, string error, HttpContext? h = null) =>
        new { error, code, traceId = h?.TraceIdentifier };
    public static IResult Error(int status, string code, string message) =>
        Results.Json(Failure(code, message), statusCode: status);
    public static bool Email(string? email) => email is { Length: <= 320 } &&
        MailAddress.TryCreate(email.Trim(), out var mail) &&
        mail.Address == email.Trim() && mail.Host.Contains('.');
    public static bool Password(string? password) => password?.Length is >= 12 and <= 256;
    public static bool LegalReady(IConfiguration cfg) => cfg.GetValue<bool>("Legal:Ready") &&
        Text(cfg["Legal:OperatorName"], 200) && Email(cfg["Legal:ContactEmail"]);
    public static bool Text(string? value, int max) =>
        !string.IsNullOrWhiteSpace(value) && value.Trim().Length <= max;
    public static IResult Unauthorized() => Error(401, "unauthorized", "请重新登录");
    public static IResult NotFound() => Error(404, "not_found", "记录不存在");
    public static IResult Invalid() => Error(400, "invalid_request", "请检查输入字段");
}
