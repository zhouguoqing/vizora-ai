using System.Net;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.HttpOverrides;
using Vizora;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddSingleton<Db>();
builder.Services.AddSingleton<IAccountMailer, SmtpAccountMailer>();
builder.Services.AddSingleton<Accounts>();
builder.Services.AddSingleton<Commerce>();
builder.Services.AddHttpClient("payments", c => c.Timeout = TimeSpan.FromSeconds(20));
builder.Services.AddSingleton<PaymentGateway>();
builder.Services.AddCors(o => o.AddPolicy("web", p => p
    .WithOrigins(builder.Configuration["Payments:WebBaseUrl"] ?? "http://localhost:5173")
    .AllowAnyMethod().AllowAnyHeader()));
builder.Services.Configure<Microsoft.AspNetCore.Http.Json.JsonOptions>(o =>
    o.SerializerOptions.PropertyNameCaseInsensitive = true);
builder.Services.Configure<RouteHandlerOptions>(o => o.ThrowOnBadRequest = true);
builder.Services.AddRateLimiter(o =>
{
    o.OnRejected = async (context, ct) =>
    {
        context.HttpContext.Response.StatusCode = 429;
        context.HttpContext.Response.Headers.RetryAfter = "60";
        await context.HttpContext.Response.WriteAsJsonAsync(
            Api.Failure("rate_limited", "请求过于频繁，请稍后重试", context.HttpContext), ct);
    };
    o.AddPolicy("auth", ctx => RateLimitPartition.GetFixedWindowLimiter(
        ctx.Connection.RemoteIpAddress?.ToString() ?? "unknown",
        _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = builder.Configuration.GetValue<int?>("RateLimits:AuthPerMinute") ?? 8,
            Window = TimeSpan.FromMinutes(1), QueueLimit = 0
        }));
});
var app = builder.Build();
if (app.Environment.IsProduction() && (app.Configuration["Auth:SigningKey"]?.Length ?? 0) < 40)
    throw new InvalidOperationException("A strong Auth:SigningKey is required");

// Only explicitly trusted proxies may supply client IP/protocol, never arbitrary callers.
var forwarding = new ForwardedHeadersOptions
{
    ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto,
    ForwardLimit = 1
};
foreach (var address in app.Configuration.GetSection("Proxy:KnownProxies").Get<string[]>() ?? [])
    forwarding.KnownProxies.Add(IPAddress.Parse(address));
app.UseForwardedHeaders(forwarding);
app.Use(async (ctx, next) =>
{
    ctx.Response.Headers["X-Content-Type-Options"] = "nosniff";
    ctx.Response.Headers["X-Frame-Options"] = "DENY";
    ctx.Response.Headers["Referrer-Policy"] = "no-referrer";
    ctx.Response.Headers.CacheControl = "no-store";
    try { await next(); }
    catch (Exception ex) when (!ctx.Response.HasStarted)
    {
        var status = ex is BadHttpRequestException bad ? bad.StatusCode :
            ex is System.Text.Json.JsonException ? 400 : ex is Npgsql.NpgsqlException ? 503 : 500;
        // Do not log request bodies, SQL parameters, URLs with tokens, or exception messages containing PII.
        app.Logger.LogError("API failure {Type} {Method} {Path} trace={Trace}",
            ex.GetType().Name, ctx.Request.Method, ctx.Request.Path, ctx.TraceIdentifier);
        ctx.Response.Clear();
        ctx.Response.StatusCode = status;
        await ctx.Response.WriteAsJsonAsync(Api.Failure(status == 400 ? "invalid_request" :
            status == 503 ? "database_unavailable" : "internal_error",
            status == 400 ? "请求格式无效" : "服务暂时不可用，请稍后重试", ctx));
    }
});
app.UseStatusCodePages(async context =>
{
    var h = context.HttpContext;
    var code = h.Response.StatusCode;
    await h.Response.WriteAsJsonAsync(Api.Failure(code switch
    {
        401 => "unauthorized", 403 => "forbidden", 404 => "not_found",
        405 => "method_not_allowed", 415 => "unsupported_media_type", _ => "request_failed"
    }, code == 401 ? "请重新登录" : "请求无法完成", h));
});
app.UseCors("web");
app.UseRateLimiter();
app.MapGet("/api/health", async (Db db) =>
{
    await using var c = await db.Open();
    await Db.One(c, "SELECT 1 AS ready");
    return Results.Ok(new { status = "ok", utc = DateTimeOffset.UtcNow });
});
app.MapAccountEndpoints();
app.MapProjectEndpoints();
app.MapCommerceEndpoints();
app.Run();
