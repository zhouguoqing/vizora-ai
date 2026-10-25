using System.Globalization;
using System.Text.Json;

namespace Vizora;

public static class CommerceEndpoints
{
    const string ReviewField = "EXISTS(SELECT 1 FROM entitlement_review r WHERE r.order_id=orders.id AND r.resolved_at IS NULL) AS entitlement_review_required";
    const string OrderFields = "id,order_no,plan_code,amount_fen,provider,status,created_at,paid_at,expires_at,code_url,checkout_url,closed_reason," + ReviewField;
    public static void MapCommerceEndpoints(this WebApplication app)
    {
        var cfg = app.Configuration;
        app.MapPost("/api/orders", async (HttpContext h, Purchase req, Db db, Accounts accounts, PaymentGateway gateway, CancellationToken ct) =>
        {
            var uid = await accounts.User(h);
            if (uid == null) return Api.Unauthorized();
            if (req.Provider is not ("wechat" or "alipay") || !Api.Text(req.PlanCode, 30)) return Api.Invalid();
            await using var c = await db.Open(ct);
            var plan = await Db.One(c, "SELECT code,price_fen,duration_days FROM plans WHERE code=@code AND active", ("code", req.PlanCode));
            if (plan == null) return Api.NotFound();
            if (app.Environment.IsProduction() && !Api.LegalReady(cfg))
                return Api.Error(503, "legal_not_ready", "正式交易条款尚未完成审核，暂不开放购买");
            await using var tx = await c.BeginTransactionAsync(ct);
            await Db.Exec(c, "SELECT id FROM users WHERE id=@u FOR UPDATE", ("u", uid.Value));
            if (await Commerce.HasTierConflict(c, uid.Value, req.PlanCode!))
                return Api.Error(409, "membership_tier_conflict", "当前会员有效期内仅支持同档续期。请到期后再购买其他档位，或联系支持处理。");
            if (!gateway.Configured(req.Provider)) return Unavailable();
            var no = "V" + DateTime.UtcNow.ToString("yyyyMMddHHmmss") + Guid.NewGuid().ToString("N")[..12];
            var id = Guid.NewGuid();
            var fen = Convert.ToInt64(plan["price_fen"]);
            var expires = DateTime.UtcNow.AddMinutes(20);
            await Db.Exec(c, """
                INSERT INTO orders(id,order_no,user_id,plan_code,amount_fen,provider,duration_days,expires_at)
                VALUES(@id,@no,@u,@plan,@fen,@p,@days,@expires)
                """, ("id", id), ("no", no), ("u", uid.Value), ("plan", req.PlanCode), ("fen", fen),
                ("p", req.Provider), ("days", plan["duration_days"]), ("expires", expires));
            await tx.CommitAsync(ct);
            try
            {
                var url = req.Provider == "wechat" ? await gateway.WechatNative(no, fen, ct) : gateway.AlipayPage(no, fen);
                await Db.Exec(c, req.Provider == "wechat" ? "UPDATE orders SET code_url=@url WHERE id=@id" :
                    "UPDATE orders SET checkout_url=@url WHERE id=@id", ("url", url), ("id", id));
                return Results.Ok(new { id, orderNo = no, provider = req.Provider, payUrl = url, amountFen = fen, expiresAt = expires });
            }
            catch (Exception ex)
            {
                app.Logger.LogError("Payment initiation failed {Type} order={Order}", ex.GetType().Name, id);
                await Db.Exec(c, "UPDATE orders SET status='closed',closed_reason='gateway_error' WHERE id=@id AND status='pending'", ("id", id));
                return Api.Error(502, "payment_gateway_error", "支付网关暂不可用，订单可在账单中查询");
            }
        });
        app.MapGet("/api/orders", async (HttpContext h, Db db, Accounts accounts) =>
        {
            var uid = await accounts.User(h);
            if (uid == null) return Api.Unauthorized();
            await using var c = await db.Open();
            await Commerce.Expire(c, uid.Value);
            return Results.Ok(await Db.Many(c, $"SELECT {OrderFields} FROM orders WHERE user_id=@u ORDER BY created_at DESC,id LIMIT 100", ("u", uid.Value)));
        });
        app.MapGet("/api/orders/{id:guid}", async (Guid id, HttpContext h, Db db, Accounts accounts) =>
        {
            var uid = await accounts.User(h);
            if (uid == null) return Api.Unauthorized();
            await using var c = await db.Open();
            await Commerce.Expire(c, uid.Value);
            var order = await Db.One(c, $"SELECT {OrderFields} FROM orders WHERE id=@id AND user_id=@u", ("id", id), ("u", uid.Value));
            return order == null ? Api.NotFound() : Results.Ok(order);
        });
        app.MapPost("/api/orders/{id:guid}/reconcile", async (Guid id, HttpContext h, Db db, Accounts accounts, PaymentGateway g, Commerce commerce, CancellationToken ct) =>
        {
            var uid = await accounts.User(h);
            if (uid == null) return Api.Unauthorized();
            await using var c = await db.Open();
            await Commerce.Expire(c, uid.Value);
            var o = await Db.One(c, $"SELECT order_no,amount_fen,provider,status,{ReviewField} FROM orders WHERE id=@id AND user_id=@u", ("id", id), ("u", uid.Value));
            if (o == null) return Api.NotFound();
            if (o["status"]!.ToString() is not ("pending" or "closed"))
                return Results.Ok(new { status = o["status"], entitlement_review_required = o["entitlement_review_required"] });
            var provider = o["provider"]!.ToString()!;
            if (!g.Configured(provider)) return Unavailable();
            try
            {
                var no = (string)o["order_no"]!;
                var trade = provider == "wechat" ? await g.WechatQueryPaid(no, Convert.ToInt64(o["amount_fen"]), ct) :
                    await g.AlipayQueryPaid(no, Convert.ToInt64(o["amount_fen"]), ct);
                if (trade != null) await commerce.CompletePayment(no, trade, provider);
                var current = await Db.One(c, $"SELECT status,{ReviewField} FROM orders WHERE id=@id", ("id", id));
                return Results.Ok(new { status = current!["status"], entitlement_review_required = current["entitlement_review_required"] });
            }
            catch (Exception ex)
            {
                app.Logger.LogError("Payment reconciliation failed {Type} order={Order}", ex.GetType().Name, id);
                return Api.Error(502, "payment_gateway_error", "暂时无法确认支付结果，请稍后查询");
            }
        });
        app.MapPost("/api/payments/wechat/notify", async (HttpContext h, Db db, PaymentGateway g, Commerce commerce) =>
        {
            if (!g.Configured("wechat")) return Unavailable();
            using var reader = new StreamReader(h.Request.Body);
            var body = await reader.ReadToEndAsync();
            if (!long.TryParse(h.Request.Headers["Wechatpay-Timestamp"], out var ts) ||
                Math.Abs(DateTimeOffset.UtcNow.ToUnixTimeSeconds() - ts) > 300 ||
                !g.VerifyWechat(h.Request.Headers["Wechatpay-Timestamp"].ToString(), h.Request.Headers["Wechatpay-Nonce"].ToString(),
                    body, h.Request.Headers["Wechatpay-Signature"].ToString(), h.Request.Headers["Wechatpay-Serial"].ToString()))
                return Api.Unauthorized();
            using var doc = JsonDocument.Parse(body);
            var root = doc.RootElement;
            if (root.GetProperty("event_type").GetString() != "TRANSACTION.SUCCESS") return Results.Ok(new { code = "SUCCESS" });
            using var resource = g.DecryptWechat(root.GetProperty("resource"));
            var r = resource.RootElement;
            var no = r.GetProperty("out_trade_no").GetString()!;
            await using var c = await db.Open();
            var o = await Db.One(c, "SELECT amount_fen,provider FROM orders WHERE order_no=@no", ("no", no));
            if (o == null || o["provider"]!.ToString() != "wechat" ||
                Convert.ToInt64(o["amount_fen"]) != r.GetProperty("amount").GetProperty("total").GetInt64() ||
                r.GetProperty("amount").GetProperty("currency").GetString() != "CNY" ||
                r.GetProperty("trade_state").GetString() != "SUCCESS" ||
                r.GetProperty("mchid").GetString() != cfg["Payments:Wechat:MchId"] ||
                r.GetProperty("appid").GetString() != cfg["Payments:Wechat:AppId"]) return Api.Invalid();
            await commerce.CompletePayment(no, r.GetProperty("transaction_id").GetString()!, "wechat", root.GetProperty("id").GetString());
            return Results.Ok(new { code = "SUCCESS", message = "成功" });
        });
        app.MapPost("/api/payments/alipay/notify", async (HttpContext h, Db db, PaymentGateway g, Commerce commerce) =>
        {
            if (!g.Configured("alipay")) return Unavailable();
            if (!h.Request.HasFormContentType) return Api.Invalid();
            var form = await h.Request.ReadFormAsync();
            if (!g.VerifyAlipay(form)) return Api.Invalid();
            var no = form["out_trade_no"].ToString();
            await using var c = await db.Open();
            var o = await Db.One(c, "SELECT amount_fen,provider FROM orders WHERE order_no=@no", ("no", no));
            if (o == null || o["provider"]!.ToString() != "alipay" || !g.ValidateAlipay(form, no, Convert.ToInt64(o["amount_fen"])))
                return Api.Invalid();
            await commerce.CompletePayment(no, form["trade_no"].ToString(), "alipay", form["notify_id"].ToString());
            return Results.Text("success", "text/plain");
        });
        app.MapPost("/api/admin/refunds", async (HttpContext h, RefundCreate req, Db db, Accounts accounts, PaymentGateway g, Commerce commerce, CancellationToken ct) =>
        {
            var uid = await accounts.User(h);
            if (uid == null) return Api.Unauthorized();
            if (!Api.Text(req.Reason, 200)) return Api.Invalid();
            await using var c = await db.Open();
            if (!await Commerce.Admin(c, uid.Value)) return Api.Error(403, "forbidden", "需要管理员权限");
            Dictionary<string, object?>? o;
            var rid = Guid.NewGuid();
            var no = "R" + DateTime.UtcNow.ToString("yyyyMMddHHmmss") + Guid.NewGuid().ToString("N")[..12];
            await using (var tx = await c.BeginTransactionAsync(ct))
            {
                o = await Db.One(c, "SELECT id,order_no,amount_fen,provider,status FROM orders WHERE id=@id FOR UPDATE", ("id", req.OrderId));
                if (o == null) return Api.NotFound();
                var prior = await Db.One(c, "SELECT id,status FROM refunds WHERE order_id=@id AND status IN ('pending','processing','succeeded')", ("id", req.OrderId));
                if (prior != null) return Results.Ok(new { refundId = prior["id"], status = prior["status"], note = "已有退款，未重复请求商户" });
                if (o["status"]!.ToString() != "paid") return Api.Error(409, "order_not_refundable", "订单不是可退款状态");
                if (!g.Configured(o["provider"]!.ToString()!)) return Unavailable();
                await Db.Exec(c, "INSERT INTO refunds(id,refund_no,order_id,amount_fen,reason) VALUES(@id,@no,@o,@fen,@reason)",
                    ("id", rid), ("no", no), ("o", req.OrderId), ("fen", o["amount_fen"]), ("reason", req.Reason!.Trim()));
                await Db.Exec(c, "UPDATE orders SET status='refunding' WHERE id=@id", ("id", req.OrderId));
                await tx.CommitAsync(ct);
            }
            try
            {
                // Submission acknowledgement is never final success; query merchant before revoking entitlements.
                var outcome = o["provider"]!.ToString() == "wechat" ?
                    await g.WechatRefund((string)o["order_no"]!, no, Convert.ToInt64(o["amount_fen"]), ct) :
                    await g.AlipayRefund((string)o["order_no"]!, no, Convert.ToInt64(o["amount_fen"]), ct);
                var status = await commerce.ApplyRefund(rid, outcome == "failed" ? "failed" : "processing");
                return Results.Ok(new { refundId = rid, status, note = "实际成功以商户退款查询为准" });
            }
            catch (Exception ex)
            {
                app.Logger.LogError("Refund submission uncertain {Type} refund={Refund}", ex.GetType().Name, rid);
                await commerce.ApplyRefund(rid, "processing");
                return Results.Json(new { refundId = rid, status = "processing", error = "退款结果暂不确定，请先查询，禁止重复提交", code = "refund_uncertain" }, statusCode: 502);
            }
        });
        app.MapGet("/api/admin/refunds", async (HttpContext h, Db db, Accounts accounts) =>
        {
            var uid = await accounts.User(h);
            if (uid == null) return Api.Unauthorized();
            await using var c = await db.Open();
            if (!await Commerce.Admin(c, uid.Value)) return Api.Error(403, "forbidden", "需要管理员权限");
            return Results.Ok(await Db.Many(c, "SELECT r.*,o.order_no FROM refunds r JOIN orders o ON o.id=r.order_id ORDER BY r.created_at DESC LIMIT 200"));
        });
        app.MapPost("/api/admin/refunds/{id:guid}/reconcile", async (Guid id, HttpContext h, Db db, Accounts accounts, PaymentGateway g, Commerce commerce, CancellationToken ct) =>
        {
            var uid = await accounts.User(h);
            if (uid == null) return Api.Unauthorized();
            await using var c = await db.Open();
            if (!await Commerce.Admin(c, uid.Value)) return Api.Error(403, "forbidden", "需要管理员权限");
            var r = await Db.One(c, """
                SELECT r.refund_no,r.amount_fen,r.status,o.order_no,o.provider
                FROM refunds r JOIN orders o ON r.order_id=o.id WHERE r.id=@id
                """, ("id", id));
            if (r == null) return Api.NotFound();
            if (r["status"]!.ToString() is "succeeded" or "failed") return Results.Ok(new { status = r["status"] });
            if (!g.Configured(r["provider"]!.ToString()!)) return Unavailable();
            try
            {
                var outcome = r["provider"]!.ToString() == "wechat" ?
                    await g.WechatRefundStatus((string)r["order_no"]!, (string)r["refund_no"]!, Convert.ToInt64(r["amount_fen"]), ct) :
                    await g.AlipayRefundStatus((string)r["order_no"]!, (string)r["refund_no"]!, Convert.ToInt64(r["amount_fen"]), ct);
                return Results.Ok(new { status = await commerce.ApplyRefund(id, outcome), note = "叠加或历史权益退款进入人工复核，不声称已自动重算" });
            }
            catch (Exception ex)
            {
                app.Logger.LogError("Refund reconciliation failed {Type} refund={Refund}", ex.GetType().Name, id);
                return Api.Error(502, "refund_uncertain", "暂时无法确认商户退款结果，请稍后查询");
            }
        });
    }
    static IResult Unavailable() => Api.Error(503, "payment_unavailable", "商户通道尚未配置");
}

record Purchase(string? PlanCode, string? Provider);
record RefundCreate(Guid OrderId, string? Reason);
