using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Npgsql;

namespace Vizora;

public sealed class Accounts(Db db, IConfiguration cfg, IHostEnvironment env, ILogger<Accounts> log, IAccountMailer mailer)
{
    string Key => cfg["Auth:SigningKey"] is { Length: >= 40 } key ? key :
        env.IsProduction() ? throw new InvalidOperationException("Auth key missing") :
        "local-development-only-change-before-deploy-at-least-40-characters";

    public async Task<Guid?> User(HttpContext h)
    {
        var header = h.Request.Headers.Authorization.ToString();
        if (!header.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase) || header.Length > 8192) return null;
        using var doc = Security.VerifyToken(header[7..], Key);
        if (doc == null) return null;
        var r = doc.RootElement;
        if (!r.TryGetProperty("iss", out var issuer) || issuer.GetString() != (cfg["Auth:Issuer"] ?? "vizora-api") ||
            !r.TryGetProperty("sub", out var sub) || !Guid.TryParse(sub.GetString(), out var id) ||
            !r.TryGetProperty("ver", out var version) || !version.TryGetInt32(out var ver)) return null;
        await using var c = await db.Open();
        var u = await Db.One(c, "SELECT token_version,email_verified_at,disabled_at FROM users WHERE id=@id", ("id", id));
        return u != null && u["disabled_at"] == null && u["email_verified_at"] != null &&
            Convert.ToInt32(u["token_version"]) == ver ? id : null;
    }

    public string Sign(Dictionary<string, object?> user) => Security.SignToken(new
    {
        iss = cfg["Auth:Issuer"] ?? "vizora-api", sub = user["id"]!.ToString(),
        role = user["role"], ver = user["token_version"],
        exp = DateTimeOffset.UtcNow.AddHours(Math.Clamp(cfg.GetValue<int?>("Auth:LifetimeHours") ?? 24, 1, 24)).ToUnixTimeSeconds()
    }, Key);

    public bool MailConfigured => Api.Text(cfg["Mail:Host"], 255) && Api.Email(cfg["Mail:From"]) &&
        SmtpTransportOptions.HasConsistentCredentials(cfg["Mail:User"], cfg["Mail:Password"]) &&
        Uri.TryCreate(cfg["Payments:WebBaseUrl"], UriKind.Absolute, out var url) &&
        (url.Scheme == "https" || (!env.IsProduction() && url.IsLoopback));

    public async Task<bool> Send(Guid uid, string email, string purpose)
    {
        var token = Security.Base64UrlEncode(RandomNumberGenerator.GetBytes(32));
        await using (var c = await db.Open())
        await using (var tx = await c.BeginTransactionAsync())
        {
            await Db.Exec(c, "SELECT id FROM users WHERE id=@u FOR UPDATE", ("u", uid));
            await Db.Exec(c, "UPDATE account_tokens SET consumed_at=now() WHERE user_id=@u AND purpose=@p AND consumed_at IS NULL",
                ("u", uid), ("p", purpose));
            await Db.Exec(c, "INSERT INTO account_tokens(id,user_id,purpose,token_hash,expires_at) VALUES(@id,@u,@p,@hash,now()+interval '30 minutes')",
                ("id", Guid.NewGuid()), ("u", uid), ("p", purpose), ("hash", Digest(token)));
            await tx.CommitAsync();
        }
        try
        {
            var path = purpose == "verify" ? "/verify-email" : "/reset-password";
            var link = cfg["Payments:WebBaseUrl"]!.TrimEnd('/') + path + "?token=" + Uri.EscapeDataString(token);
            await mailer.SendAsync(email,
                purpose == "verify" ? "Vizora AI 邮箱验证" : "Vizora AI 密码重置",
                $"请在30分钟内访问以下链接：\n{link}\n如果不是您本人操作，请忽略本邮件。");
            return true;
        }
        catch (Exception ex)
        {
            log.LogError("Account SMTP delivery failed: {Type}", ex.GetType().Name);
            return false;
        }
    }

    public async Task<bool> Consume(string? token, string purpose, string? password = null)
    {
        if (token?.Length is not (>= 30 and <= 200)) return false;
        await using var c = await db.Open();
        await using var tx = await c.BeginTransactionAsync();
        // Use the same user->token lock order as issuance; recheck after obtaining the lock.
        var candidate = await Db.One(c, "SELECT user_id FROM account_tokens WHERE token_hash=@hash AND purpose=@p",
            ("hash", Digest(token)), ("p", purpose));
        if (candidate == null) return false;
        await Db.Exec(c, "SELECT id FROM users WHERE id=@u FOR UPDATE", ("u", candidate["user_id"]));
        var row = await Db.One(c, "UPDATE account_tokens SET consumed_at=now() WHERE token_hash=@hash AND purpose=@p AND consumed_at IS NULL AND expires_at>now() RETURNING user_id",
            ("hash", Digest(token)), ("p", purpose));
        if (row == null) return false;
        if (purpose == "verify")
            await Db.Exec(c, "UPDATE users SET email_verified_at=COALESCE(email_verified_at,now()),token_version=token_version+1 WHERE id=@u", ("u", row["user_id"]));
        else
        {
            await Db.Exec(c, "UPDATE users SET password_hash=@pw,token_version=token_version+1 WHERE id=@u",
                ("pw", Security.HashPassword(password!)), ("u", row["user_id"]));
            await Db.Exec(c, "UPDATE account_tokens SET consumed_at=now() WHERE user_id=@u AND purpose='reset' AND consumed_at IS NULL", ("u", row["user_id"]));
        }
        await tx.CommitAsync();
        return true;
    }
    static string Digest(string token) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token)));
}

public static class AccountEndpoints
{
    public static void MapAccountEndpoints(this WebApplication app)
    {
        app.MapPost("/api/auth/register", async (Register req, Db db, Accounts accounts) =>
        {
            if (!Api.Email(req.Email) || !Api.Password(req.Password) || req.Name?.Length > 120) return Api.Invalid();
            if (!req.Consent) return Api.Error(400, "consent_required", "注册须明确同意用户协议和隐私政策");
            if (app.Environment.IsProduction() && !Api.LegalReady(app.Configuration))
                return Api.Error(503, "legal_not_ready", "正式用户协议与隐私政策尚未完成审核，暂不开放注册");
            if (!accounts.MailConfigured) return MailUnavailable();
            var id = Guid.NewGuid();
            var email = req.Email!.Trim().ToLowerInvariant();
            await using var c = await db.Open();
            try
            {
                await Db.Exec(c, "INSERT INTO users(id,email,password_hash,display_name,terms_consented_at,privacy_consented_at,consent_version) VALUES(@id,@e,@pw,@name,now(),now(),'v4.2')",
                    ("id", id), ("e", email), ("pw", Security.HashPassword(req.Password!)), ("name", req.Name?.Trim() ?? ""));
            }
            catch (PostgresException ex) when (ex.SqlState == PostgresErrorCodes.UniqueViolation)
            { return Api.Error(409, "account_exists", "账号已存在，请登录或重发验证邮件"); }
            return await accounts.Send(id, email, "verify") ?
                Results.Ok(new { message = "验证邮件已发送，请先验证邮箱" }) :
                Api.Error(503, "mail_unavailable", "账号已创建，但验证邮件发送失败，请稍后请求重发");
        }).RequireRateLimiting("auth");

        app.MapPost("/api/auth/login", async (Login req, Db db, Accounts accounts) =>
        {
            if (!Api.Email(req.Email) || !Api.Password(req.Password)) return Api.Invalid();
            await using var c = await db.Open();
            var u = await Db.One(c, "SELECT id,password_hash,role,token_version,email_verified_at,disabled_at FROM users WHERE email=@e",
                ("e", req.Email!.Trim().ToLowerInvariant()));
            if (u == null || !Security.VerifyPassword(req.Password!, (string)u["password_hash"]!))
                return Api.Error(401, "invalid_credentials", "邮箱或密码错误");
            if (u["disabled_at"] != null) return Api.Error(403, "account_disabled", "账号不可用，请联系管理员");
            if (u["email_verified_at"] == null) return Api.Error(403, "email_not_verified", "请先完成邮箱验证");
            return Results.Ok(new { token = accounts.Sign(u) });
        }).RequireRateLimiting("auth");

        app.MapPost("/api/auth/verify-email", async (AccountTokenRequest req, Accounts accounts) =>
            await accounts.Consume(req.Token, "verify") ? Results.Ok(new { message = "邮箱验证成功" }) :
                Api.Error(400, "invalid_token", "无效或过期的验证链接")).RequireRateLimiting("auth");
        app.MapPost("/api/auth/reset-password", async (ResetPasswordRequest req, Accounts accounts) =>
            Api.Password(req.NewPassword) && await accounts.Consume(req.Token, "reset", req.NewPassword) ?
                Results.Ok(new { message = "密码已更新，请重新登录" }) :
                Api.Error(400, "invalid_token_or_password", "链接无效或密码需12-256位")).RequireRateLimiting("auth");
        foreach (var purpose in new[] { "verify", "reset" })
        {
            app.MapPost(purpose == "verify" ? "/api/auth/resend-verification" : "/api/auth/forgot-password",
                async (AccountEmailRequest req, Db db, Accounts accounts) =>
                {
                    if (!Api.Email(req.Email)) return Api.Invalid();
                    if (!accounts.MailConfigured) return MailUnavailable();
                    var email = req.Email!.Trim().ToLowerInvariant();
                    await using var c = await db.Open();
                    var u = await Db.One(c, "SELECT id,email_verified_at FROM users WHERE email=@e AND disabled_at IS NULL", ("e", email));
                    if (u != null && (purpose == "reset" || u["email_verified_at"] == null) &&
                        !await accounts.Send((Guid)u["id"]!, email, purpose)) return MailUnavailable();
                    return Results.Ok(new { message = "如账号符合条件，邮件将发送至您的邮箱" });
                }).RequireRateLimiting("auth");
        }
        app.MapPost("/api/auth/logout-all", async (HttpContext h, Db db, Accounts accounts) =>
        {
            var uid = await accounts.User(h);
            if (uid == null) return Api.Unauthorized();
            await using var c = await db.Open();
            await Db.Exec(c, "UPDATE users SET token_version=token_version+1 WHERE id=@u", ("u", uid.Value));
            return Results.NoContent();
        });
    }
    static IResult MailUnavailable() => Api.Error(503, "mail_unavailable", "邮件服务暂不可用，请稍后重试");
}

record Register(string? Email, string? Password, string? Name, bool Consent = false);
record Login(string? Email, string? Password);
record AccountTokenRequest(string? Token);
record AccountEmailRequest(string? Email);
record ResetPasswordRequest(string? Token, string? NewPassword);
