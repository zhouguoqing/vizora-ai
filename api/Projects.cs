using System.Security.Cryptography;
using System.Text;
using Npgsql;

namespace Vizora;

public static class ProjectEndpoints
{
    public static async Task<Dictionary<string, object?>> Quota(NpgsqlConnection c, Guid uid) =>
        (await Db.One(c, """
            SELECT EXISTS(SELECT 1 FROM memberships WHERE user_id=@u AND valid_until>now()) AS active,
              COALESCE((SELECT p.code FROM memberships m JOIN plans p ON p.code=m.plan_code WHERE m.user_id=@u AND m.valid_until>now()),'free') AS plan_code,
              CASE WHEN EXISTS(SELECT 1 FROM memberships WHERE user_id=@u AND valid_until>now())
                THEN (SELECT p.project_limit FROM memberships m JOIN plans p ON p.code=m.plan_code WHERE m.user_id=@u)
                ELSE 3 END AS project_limit,
              (SELECT count(*) FROM dashboards WHERE user_id=@u) AS project_used
            """, ("u", uid)))!;

    public static void MapProjectEndpoints(this WebApplication app)
    {
        var cfg = app.Configuration;
        bool DesignerConfigured() => (cfg["Designer:TicketSigningKey"]?.Length ?? 0) >= 40 &&
            (cfg["Designer:ServerSecret"]?.Length ?? 0) >= 40 &&
            Uri.TryCreate(cfg["Designer:Url"], UriKind.Absolute, out var url) &&
            (url.Scheme == "https" || (!app.Environment.IsProduction() && url.IsLoopback)) &&
            string.IsNullOrEmpty(url.UserInfo) && string.IsNullOrEmpty(url.Query) && string.IsNullOrEmpty(url.Fragment);
        app.MapGet("/api/me", async (HttpContext h, Db db, Accounts accounts) =>
        {
            var uid = await accounts.User(h);
            if (uid == null) return Api.Unauthorized();
            await using var c = await db.Open();
            var user = await Db.One(c, "SELECT id,email,display_name,role,email_verified_at FROM users WHERE id=@u", ("u", uid.Value));
            var membership = await Db.One(c, """
                SELECT m.plan_code,m.valid_until,p.project_limit,p.name, m.valid_until>now() AS active
                FROM memberships m JOIN plans p ON p.code=m.plan_code WHERE m.user_id=@u
                """, ("u", uid.Value));
            var quota = await Quota(c, uid.Value);
            return Results.Ok(new
            {
                user, id = user!["id"], email = user["email"], display_name = user["display_name"],
                membership, project_limit = quota["project_limit"], quota
            });
        });
        app.MapGet("/api/public-config", () => Results.Ok(new
        {
            legalReady = Api.LegalReady(cfg),
            operatorName = cfg["Legal:OperatorName"],
            contactEmail = cfg["Legal:ContactEmail"]
        }));
        app.MapGet("/api/plans", async (Db db) =>
        {
            await using var c = await db.Open();
            // Free is returned for display but cannot be purchased.
            return Results.Ok(await Db.Many(c, """
                SELECT 'free' AS code,'Free' AS name,0::bigint AS price_fen,0 AS duration_days,3 AS project_limit
                UNION ALL SELECT code,name,price_fen,duration_days,project_limit FROM plans WHERE active
                ORDER BY price_fen
                """));
        });
        app.MapGet("/api/dashboards", async (HttpContext h, Db db, Accounts accounts) =>
        {
            var uid = await accounts.User(h);
            if (uid == null) return Api.Unauthorized();
            await using var c = await db.Open();
            return Results.Ok(await Db.Many(c, "SELECT id,title,prompt,created_at FROM dashboards WHERE user_id=@u ORDER BY created_at DESC,id", ("u", uid.Value)));
        });
        app.MapPost("/api/dashboards", async (HttpContext h, DashboardCreate req, Db db, Accounts accounts) =>
        {
            var uid = await accounts.User(h);
            if (uid == null) return Api.Unauthorized();
            if (!Api.Text(req.Title, 200) || req.Prompt?.Length > 5000) return Api.Invalid();
            await using var c = await db.Open();
            await using var tx = await c.BeginTransactionAsync();
            await Db.Exec(c, "SELECT id FROM users WHERE id=@u FOR UPDATE", ("u", uid.Value));
            var quota = await Quota(c, uid.Value);
            if (quota["project_limit"] != null && Convert.ToInt64(quota["project_used"]) >= Convert.ToInt64(quota["project_limit"]))
                return Api.Error(403, "project_limit_reached", "已达到套餐项目上限");
            var id = Guid.NewGuid();
            await Db.Exec(c, "INSERT INTO dashboards(id,user_id,title,prompt) VALUES(@id,@u,@title,@prompt)",
                ("id", id), ("u", uid.Value), ("title", req.Title!.Trim()), ("prompt", req.Prompt ?? ""));
            await tx.CommitAsync();
            return Results.Ok(new { id });
        });
        app.MapDelete("/api/dashboards/{id:guid}", async (Guid id, HttpContext h, Db db, Accounts accounts) =>
        {
            var uid = await accounts.User(h);
            if (uid == null) return Api.Unauthorized();
            await using var c = await db.Open();
            await using var tx = await c.BeginTransactionAsync();
            await Db.Exec(c, "SELECT id FROM users WHERE id=@u FOR UPDATE", ("u", uid.Value));
            // Used and outstanding tickets must not block deletion or remain redeemable.
            await Db.Exec(c, "DELETE FROM ticket_nonces WHERE dashboard_id=@d AND user_id=@u", ("d", id), ("u", uid.Value));
            var count = await Db.Exec(c, "DELETE FROM dashboards WHERE id=@id AND user_id=@u", ("id", id), ("u", uid.Value));
            await tx.CommitAsync();
            return count == 1 ? Results.NoContent() : Api.NotFound();
        });
        app.MapPost("/api/designer/ticket", async (HttpContext h, DesignerReq req, Db db, Accounts accounts) =>
        {
            var uid = await accounts.User(h);
            if (uid == null) return Api.Unauthorized();
            await using var c = await db.Open();
            await using var tx = await c.BeginTransactionAsync();
            await Db.Exec(c, "SELECT id FROM users WHERE id=@u FOR UPDATE", ("u", uid.Value));
            var project = await Db.One(c, "SELECT id FROM dashboards WHERE id=@d AND user_id=@u", ("d", req.DashboardId), ("u", uid.Value));
            if (project == null) return Api.NotFound();
            if (!DesignerConfigured()) return Api.Error(503, "designer_unavailable", "Designer 尚未配置");
            var quota = await Quota(c, uid.Value);
            if (quota["project_limit"] != null && Convert.ToInt64(quota["project_used"]) > Convert.ToInt64(quota["project_limit"]))
                return Api.Error(403, "project_limit_reached", "当前项目数超过套餐配额，请删除项目或升级");
            var nonce = Guid.NewGuid();
            var exp = DateTimeOffset.UtcNow.AddMinutes(2);
            await Db.Exec(c, "INSERT INTO ticket_nonces(nonce,user_id,dashboard_id,expires_at) VALUES(@n,@u,@d,@exp)",
                ("n", nonce), ("u", uid.Value), ("d", req.DashboardId), ("exp", exp.UtcDateTime));
            var ticket = Security.SignToken(new
            {
                iss = "vizora-designer", sub = uid.ToString(), dashboard_id = req.DashboardId.ToString(),
                jti = nonce.ToString(), exp = exp.ToUnixTimeSeconds()
            }, cfg["Designer:TicketSigningKey"]!);
            await tx.CommitAsync();
            return Results.Ok(new { url = cfg["Designer:Url"], ticket, expiresAt = exp });
        });
        app.MapPost("/api/designer/redeem", async (HttpContext h, TicketReq req, Db db) =>
        {
            if (!DesignerConfigured()) return Api.Error(503, "designer_unavailable", "Designer 尚未配置");
            if (!CryptographicOperations.FixedTimeEquals(
                SHA256.HashData(Encoding.UTF8.GetBytes(h.Request.Headers["X-Designer-Secret"].ToString())),
                SHA256.HashData(Encoding.UTF8.GetBytes(cfg["Designer:ServerSecret"]!)))) return Api.Unauthorized();
            if (req.Ticket?.Length is not (>= 30 and <= 4096)) return Api.Invalid();
            using var doc = Security.VerifyToken(req.Ticket, cfg["Designer:TicketSigningKey"]!);
            if (doc == null) return Api.Unauthorized();
            var r = doc.RootElement;
            if (!r.TryGetProperty("iss", out var iss) || iss.GetString() != "vizora-designer" ||
                !r.TryGetProperty("jti", out var jti) || !Guid.TryParse(jti.GetString(), out var nonce) ||
                !r.TryGetProperty("sub", out var sub) || !Guid.TryParse(sub.GetString(), out var uid) ||
                !r.TryGetProperty("dashboard_id", out var d) || !Guid.TryParse(d.GetString(), out var did))
                return Api.Unauthorized();
            await using var c = await db.Open();
            var count = await Db.Exec(c, """
                UPDATE ticket_nonces t SET used_at=now() FROM users u,dashboards d
                WHERE t.nonce=@n AND t.user_id=@u AND t.dashboard_id=@d AND t.used_at IS NULL AND t.expires_at>now()
                  AND u.id=t.user_id AND u.disabled_at IS NULL AND u.email_verified_at IS NOT NULL
                  AND d.id=t.dashboard_id AND d.user_id=u.id
                """, ("n", nonce), ("u", uid), ("d", did));
            return count == 1 ? Results.Ok(new { userId = uid.ToString(), dashboardId = did.ToString() }) : Api.Unauthorized();
        });
        app.MapPost("/api/leads", async (LeadCreate req, Db db) =>
        {
            if (!req.Consent || !Api.Text(req.Name, 120) || !Api.Text(req.Company, 200) ||
                !Api.Email(req.Email) || !Api.Text(req.Details, 4000)) return Api.Invalid();
            var id = Guid.NewGuid();
            await using var c = await db.Open();
            await Db.Exec(c, "INSERT INTO sales_leads(id,contact_name,company,email,requirements,privacy_consented_at) VALUES(@id,@name,@co,@email,@details,now())",
                ("id", id), ("name", req.Name!.Trim()), ("co", req.Company!.Trim()),
                ("email", req.Email!.Trim().ToLowerInvariant()), ("details", req.Details!.Trim()));
            return Results.Accepted(value: new { id, message = "已收到咨询需求" });
        }).RequireRateLimiting("auth");
        app.MapGet("/api/admin/leads", async (HttpContext h, Db db, Accounts accounts) =>
        {
            var uid = await accounts.User(h);
            if (uid == null) return Api.Unauthorized();
            await using var c = await db.Open();
            if (!await Commerce.Admin(c, uid.Value)) return Api.Error(403, "forbidden", "需要管理员权限");
            return Results.Ok(await Db.Many(c, "SELECT id,contact_name,company,email,requirements,created_at,status FROM sales_leads ORDER BY created_at DESC LIMIT 200"));
        });
    }
}

record DashboardCreate(string? Title, string? Prompt);
record DesignerReq(Guid DashboardId);
record TicketReq(string? Ticket);
record LeadCreate(string? Name, string? Company, string? Email, string? Details, bool Consent = false);
