using Npgsql;

namespace Vizora;

public sealed class Commerce(Db db)
{
    static string Tier(string code) =>
        code.EndsWith("-month", StringComparison.Ordinal) ? code[..^6] :
        code.EndsWith("-year", StringComparison.Ordinal) ? code[..^5] : code;

    public static async Task<bool> HasTierConflict(NpgsqlConnection c, Guid uid, string planCode)
    {
        var active = await Db.One(c, "SELECT plan_code FROM memberships WHERE user_id=@u AND valid_until>now()", ("u", uid));
        return active != null && Tier((string)active["plan_code"]!) != Tier(planCode);
    }

    public static async Task<bool> Admin(NpgsqlConnection c, Guid uid) =>
        (await Db.One(c, "SELECT role FROM users WHERE id=@u", ("u", uid)))?["role"]?.ToString() == "admin";

    public static Task<int> Expire(NpgsqlConnection c, Guid uid) =>
        Db.Exec(c, "UPDATE orders SET status='closed',closed_reason='expired' WHERE user_id=@u AND status='pending' AND expires_at<=now()", ("u", uid));

    public async Task CompletePayment(string orderNo, string tradeNo, string provider, string? eventKey = null)
    {
        await using var c = await db.Open();
        await using var tx = await c.BeginTransactionAsync();
        var o = await Db.One(c, "SELECT id,user_id,plan_code,duration_days,status FROM orders WHERE order_no=@no AND provider=@p FOR UPDATE",
            ("no", orderNo), ("p", provider));
        if (o == null) throw new InvalidOperationException("Unknown merchant order");
        if (!string.IsNullOrWhiteSpace(eventKey))
        {
            var e = await Db.One(c, """
                INSERT INTO payment_events(provider,event_key,order_no) VALUES(@p,@e,@no)
                ON CONFLICT(provider,event_key) DO UPDATE SET event_key=excluded.event_key RETURNING order_no
                """, ("p", provider), ("e", eventKey), ("no", orderNo));
            if (e!["order_no"]?.ToString() != orderNo) throw new InvalidOperationException("Payment event reused across orders");
        }
        // A local timeout is not proof of non-payment. Authenticated late success must grant once.
        if (o["status"]!.ToString() is "pending" or "closed")
        {
            await Db.Exec(c, "SELECT id FROM users WHERE id=@u FOR UPDATE", ("u", o["user_id"]));
            await Db.Exec(c, "UPDATE orders SET status='paid',provider_trade_no=@trade,paid_at=now(),closed_reason=NULL WHERE id=@id",
                ("trade", tradeNo), ("id", o["id"]));
            if (await HasTierConflict(c, (Guid)o["user_id"]!, (string)o["plan_code"]!))
                await Db.Exec(c, """
                    INSERT INTO entitlement_review(order_id,reason) VALUES(@id,'cross_tier_payment_requires_review')
                    ON CONFLICT(order_id) DO NOTHING
                    """, ("id", o["id"]));
            else
            {
                await Db.Exec(c, """
                INSERT INTO entitlement_grants(order_id,user_id,plan_code,duration_days,paid_at)
                VALUES(@id,@u,@p,@days,now()) ON CONFLICT(order_id) DO NOTHING
                """, ("id", o["id"]), ("u", o["user_id"]), ("p", o["plan_code"]), ("days", o["duration_days"]));
                await Db.Exec(c, """
                INSERT INTO memberships(user_id,plan_code,valid_until)
                VALUES(@u,@p,now()+@days*interval '1 day')
                ON CONFLICT(user_id) DO UPDATE SET plan_code=excluded.plan_code,
                  valid_until=greatest(COALESCE(memberships.valid_until,now()),now())+@days*interval '1 day',updated_at=now()
                """, ("u", o["user_id"]), ("p", o["plan_code"]), ("days", o["duration_days"]));
            }
        }
        await tx.CommitAsync();
    }

    public async Task<string> ApplyRefund(Guid refundId, string outcome)
    {
        await using var c = await db.Open();
        await using var tx = await c.BeginTransactionAsync();
        var lookup = await Db.One(c, "SELECT order_id FROM refunds WHERE id=@id", ("id", refundId));
        if (lookup == null) throw new InvalidOperationException("Unknown refund");
        // All commerce mutations lock order -> user -> refund to serialize callbacks and reconciliation.
        var o = await Db.One(c, "SELECT id,user_id FROM orders WHERE id=@id FOR UPDATE", ("id", lookup["order_id"]));
        await Db.Exec(c, "SELECT id FROM users WHERE id=@u FOR UPDATE", ("u", o!["user_id"]));
        var r = await Db.One(c, "SELECT status FROM refunds WHERE id=@id FOR UPDATE", ("id", refundId));
        if (r!["status"]!.ToString() is "succeeded" or "failed")
        {
            await tx.CommitAsync();
            return r["status"]!.ToString()!;
        }
        if (outcome == "succeeded")
        {
            await Db.Exec(c, "UPDATE refunds SET status='succeeded',finished_at=now() WHERE id=@id", ("id", refundId));
            await Db.Exec(c, "UPDATE orders SET status='refunded' WHERE id=@id", ("id", o["id"]));
            await Db.Exec(c, "UPDATE entitlement_grants SET revoked_at=COALESCE(revoked_at,now()) WHERE order_id=@id", ("id", o["id"]));
            var grant = await Db.One(c, "SELECT order_id FROM entitlement_grants WHERE order_id=@id", ("id", o["id"]));
            var others = await Db.One(c, "SELECT count(*) AS n FROM entitlement_grants WHERE user_id=@u AND order_id<>@id", ("u", o["user_id"]), ("id", o["id"]));
            var legacy = await Db.One(c, """
                SELECT count(*) AS n FROM orders o WHERE o.user_id=@u AND o.status IN ('paid','refunding','refunded')
                  AND NOT EXISTS(SELECT 1 FROM entitlement_grants g WHERE g.order_id=o.id)
                """, ("u", o["user_id"]));
            if (grant != null && Convert.ToInt64(others!["n"]) == 0 && Convert.ToInt64(legacy!["n"]) == 0)
                await Db.Exec(c, "UPDATE memberships SET valid_until=now(),updated_at=now() WHERE user_id=@u", ("u", o["user_id"]));
            else
                await Db.Exec(c, """
                    INSERT INTO entitlement_review(order_id,reason) VALUES(@id,'stacked_or_legacy_grants_require_review')
                    ON CONFLICT(order_id) DO NOTHING
                    """, ("id", o["id"]));
        }
        else if (outcome == "failed")
        {
            await Db.Exec(c, "UPDATE refunds SET status='failed',finished_at=now() WHERE id=@id", ("id", refundId));
            await Db.Exec(c, "UPDATE orders SET status='paid' WHERE id=@id AND status='refunding'", ("id", o["id"]));
        }
        else
        {
            outcome = "processing";
            await Db.Exec(c, "UPDATE refunds SET status='processing' WHERE id=@id AND status='pending'", ("id", refundId));
        }
        await tx.CommitAsync();
        return outcome;
    }
}
