using Microsoft.Extensions.Configuration;
using Npgsql;
using Vizora;

static class CommerceRegression
{
    public static async Task Run(string connection, NpgsqlConnection c)
    {
        var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["ConnectionStrings:Main"] = connection
        }).Build();
        var commerce = new Commerce(new Db(config));
        var users = new List<Guid>();
        var count = 0;
        void Check(bool condition, string name)
        {
            if (!condition) throw new InvalidOperationException(name);
            Console.WriteLine("PASS " + name);
            count++;
        }
        async Task<Guid> User(string? plan, DateTime until)
        {
            var id = Guid.NewGuid();
            await Db.Exec(c, "INSERT INTO users(id,email,password_hash) VALUES(@u,@e,'domain-test-only')",
                ("u", id), ("e", $"commerce-{id:N}@example.test"));
            users.Add(id);
            if (plan != null)
                await Db.Exec(c, "INSERT INTO memberships(user_id,plan_code,valid_until) VALUES(@u,@p,@t)",
                    ("u", id), ("p", plan), ("t", until));
            return id;
        }
        async Task<(Guid Id, string No)> Order(Guid user, string plan)
        {
            var id = Guid.NewGuid();
            var no = "TEST" + id.ToString("N");
            await Db.Exec(c, """
                INSERT INTO orders(id,order_no,user_id,plan_code,amount_fen,provider,duration_days)
                SELECT @id,@no,@u,code,price_fen,'wechat',duration_days FROM plans WHERE code=@p
                """, ("id", id), ("no", no), ("u", user), ("p", plan));
            return (id, no);
        }
        async Task<Dictionary<string, object?>> Membership(Guid user) =>
            (await Db.One(c, "SELECT plan_code,valid_until FROM memberships WHERE user_id=@u", ("u", user)))!;
        async Task<long> Rows(string table, Guid order) =>
            Convert.ToInt64((await Db.One(c, $"SELECT count(*) AS n FROM {table} WHERE order_id=@id", ("id", order)))!["n"]);
        var until = DateTime.UtcNow.AddDays(100);
        try
        {
            foreach (var pair in new[] { ("creator-year", "fde-month"), ("fde-year", "creator-month") })
            {
                var uid = await User(pair.Item1, until);
                var original = await Membership(uid);
                var order = await Order(uid, pair.Item2);
                await commerce.CompletePayment(order.No, "domain-trade-" + order.No, "wechat", "domain-event-" + order.No);
                var current = await Membership(uid);
                Check(Equals(current["plan_code"], original["plan_code"]) && Equals(current["valid_until"], original["valid_until"]),
                    $"{pair.Item1} -> {pair.Item2} preserves existing tier and expiry");
                Check(await Rows("entitlement_review", order.Id) == 1 && await Rows("entitlement_grants", order.Id) == 0,
                    "cross-tier receipt is reviewed, never automatically granted");
                var paid = await Db.One(c, "SELECT status FROM orders WHERE id=@id", ("id", order.Id));
                Check(paid!["status"]?.ToString() == "paid", "confirmed funds remain recorded as paid");
                await commerce.CompletePayment(order.No, "domain-trade-" + order.No, "wechat", "domain-event-" + order.No);
                Check(await Rows("entitlement_review", order.Id) == 1 && await Rows("entitlement_grants", order.Id) == 0,
                    "duplicate cross-tier receipt is idempotent");
                var refund = Guid.NewGuid();
                await Db.Exec(c, """
                    INSERT INTO refunds(id,refund_no,order_id,amount_fen,reason)
                    SELECT @r,@no,id,amount_fen,'domain regression' FROM orders WHERE id=@o
                    """, ("r", refund), ("no", "REF" + refund.ToString("N")), ("o", order.Id));
                await commerce.ApplyRefund(refund, "succeeded");
                current = await Membership(uid);
                Check(Equals(current["plan_code"], original["plan_code"]) && Equals(current["valid_until"], original["valid_until"]),
                    "refund of an ungranted cross-tier purchase does not revoke existing membership");
            }
            var renewalUser = await User("creator-month", until);
            var before = await Membership(renewalUser);
            var renewal = await Order(renewalUser, "creator-year");
            await commerce.CompletePayment(renewal.No, "domain-renewal", "wechat");
            var renewed = await Membership(renewalUser);
            Check(renewed["plan_code"]?.ToString() == "creator-year" &&
                  (DateTime)renewed["valid_until"]! == ((DateTime)before["valid_until"]!).AddDays(365),
                "same-tier monthly/yearly renewal extends the existing expiry exactly");
            var expiredUser = await User("creator-year", DateTime.UtcNow.AddDays(-1));
            var afterExpiry = await Order(expiredUser, "fde-month");
            await commerce.CompletePayment(afterExpiry.No, "domain-expired", "wechat");
            var activated = await Membership(expiredUser);
            Check(activated["plan_code"]?.ToString() == "fde-month" &&
                  Math.Abs(((DateTime)activated["valid_until"]! - DateTime.UtcNow.AddDays(30)).TotalSeconds) < 10 &&
                  await Rows("entitlement_review", afterExpiry.Id) == 0,
                "expired membership permits a new tier without carrying over expired days");
            var newUser = await User(null, until);
            var first = await Order(newUser, "creator-month");
            var second = await Order(newUser, "fde-month");
            await Task.WhenAll(
                commerce.CompletePayment(first.No, "domain-concurrent-creator", "wechat"),
                commerce.CompletePayment(second.No, "domain-concurrent-fde", "wechat"));
            var grants = await Db.One(c, "SELECT count(*) AS n FROM entitlement_grants WHERE user_id=@u", ("u", newUser));
            Check(Convert.ToInt64(grants!["n"]) == 1 &&
                  await Rows("entitlement_review", first.Id) + await Rows("entitlement_review", second.Id) == 1,
                "simultaneous cross-tier receipts grant one tier and flag the other for review");
            Console.WriteLine($"Commerce domain regression: {count}/{count} passed; no merchant acceptance is simulated or claimed");
        }
        finally
        {
            foreach (var uid in users)
                await Db.Exec(c, """
                    DELETE FROM payment_events WHERE order_no IN (SELECT order_no FROM orders WHERE user_id=@u);
                    DELETE FROM refunds WHERE order_id IN (SELECT id FROM orders WHERE user_id=@u);
                    DELETE FROM entitlement_review WHERE order_id IN (SELECT id FROM orders WHERE user_id=@u);
                    DELETE FROM entitlement_grants WHERE user_id=@u;
                    DELETE FROM orders WHERE user_id=@u;
                    DELETE FROM memberships WHERE user_id=@u;
                    DELETE FROM users WHERE id=@u
                    """, ("u", uid));
        }
    }
}
