using System.Globalization;
using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace Vizora;

public sealed class PaymentGateway(IConfiguration cfg, IHttpClientFactory clients)
{
    string W(string key) => Security.GetRequired(cfg, "Payments:Wechat:" + key);
    string A(string key) => Security.GetRequired(cfg, "Payments:Alipay:" + key);
    public bool Configured(string provider) => provider switch
    {
        "wechat" => new[] { "MchId", "AppId", "SerialNo", "PrivateKeyPem", "ApiV3Key" }
            .All(k => !string.IsNullOrWhiteSpace(cfg["Payments:Wechat:" + k])) &&
            cfg.GetSection("Payments:Wechat:PlatformCertificates").GetChildren().Any(x => !string.IsNullOrWhiteSpace(x.Value)),
        "alipay" => new[] { "AppId", "PrivateKeyPem", "AlipayPublicKeyPem", "SellerId" }
            .All(k => !string.IsNullOrWhiteSpace(cfg["Payments:Alipay:" + k])),
        _ => false
    };
    string Notify(string provider) => !string.IsNullOrWhiteSpace(cfg[$"Payments:{provider}:NotifyUrl"]) ?
        cfg[$"Payments:{provider}:NotifyUrl"]! :
        Security.GetRequired(cfg, "Payments:PublicBaseUrl").TrimEnd('/') + "/api/payments/" + provider.ToLowerInvariant() + "/notify";
    string WechatAuthorization(string method, string path, string body)
    {
        var ts = DateTimeOffset.UtcNow.ToUnixTimeSeconds().ToString(CultureInfo.InvariantCulture);
        var nonce = Guid.NewGuid().ToString("N");
        var signature = Security.RsaSign($"{method}\n{path}\n{ts}\n{nonce}\n{body}\n", W("PrivateKeyPem"));
        return $"WECHATPAY2-SHA256-RSA2048 mchid=\"{W("MchId")}\",nonce_str=\"{nonce}\",timestamp=\"{ts}\",serial_no=\"{W("SerialNo")}\",signature=\"{signature}\"";
    }
    async Task<JsonDocument> WxRequest(string method, string path, object? payload, CancellationToken ct)
    {
        var body = payload == null ? "" : JsonSerializer.Serialize(payload);
        using var req = new HttpRequestMessage(new HttpMethod(method), "https://api.mch.weixin.qq.com" + path);
        req.Headers.TryAddWithoutValidation("Authorization", WechatAuthorization(method, path, body));
        req.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
        req.Headers.UserAgent.ParseAdd("VizoraAI/4.2");
        if (payload != null) req.Content = new StringContent(body, Encoding.UTF8, "application/json");
        using var resp = await clients.CreateClient("payments").SendAsync(req, ct);
        var text = await resp.Content.ReadAsStringAsync(ct);
        resp.EnsureSuccessStatusCode();
        string Header(string name) => resp.Headers.TryGetValues(name, out var values) ? values.Single() : "";
        if (!VerifyWechat(Header("Wechatpay-Timestamp"), Header("Wechatpay-Nonce"), text,
            Header("Wechatpay-Signature"), Header("Wechatpay-Serial")))
            throw new InvalidOperationException("Untrusted WeChat merchant response");
        return JsonDocument.Parse(text);
    }
    public bool VerifyWechat(string timestamp, string nonce, string body, string signature, string serial)
    {
        if (serial.Length > 150 || string.IsNullOrWhiteSpace(nonce) ||
            !long.TryParse(timestamp, out var ts) || Math.Abs(DateTimeOffset.UtcNow.ToUnixTimeSeconds() - ts) > 300) return false;
        var cert = cfg["Payments:Wechat:PlatformCertificates:" + serial];
        return !string.IsNullOrWhiteSpace(cert) &&
            Security.RsaVerify(timestamp + "\n" + nonce + "\n" + body + "\n", signature, cert.Replace("\\n", "\n"));
    }
    public JsonDocument DecryptWechat(JsonElement resource)
    {
        var key = Encoding.UTF8.GetBytes(W("ApiV3Key"));
        if (key.Length != 32) throw new InvalidOperationException("Invalid API v3 key");
        var data = Convert.FromBase64String(resource.GetProperty("ciphertext").GetString()!);
        if (data.Length < 16) throw new JsonException("Invalid encrypted resource");
        var plain = new byte[data.Length - 16];
        using var aes = new AesGcm(key, 16);
        aes.Decrypt(Encoding.UTF8.GetBytes(resource.GetProperty("nonce").GetString()!), data.AsSpan(0, data.Length - 16),
            data.AsSpan(data.Length - 16), plain, Encoding.UTF8.GetBytes(resource.GetProperty("associated_data").GetString() ?? ""));
        return JsonDocument.Parse(plain);
    }
    public async Task<string> WechatNative(string no, long amount, CancellationToken ct)
    {
        using var d = await WxRequest("POST", "/v3/pay/transactions/native", new
        {
            appid = W("AppId"), mchid = W("MchId"), description = "Vizora AI 会员",
            out_trade_no = no, notify_url = Notify("Wechat"),
            time_expire = DateTimeOffset.UtcNow.AddMinutes(20).ToString("yyyy-MM-ddTHH:mm:sszzz", CultureInfo.InvariantCulture),
            amount = new { total = amount, currency = "CNY" }
        }, ct);
        var url = d.RootElement.GetProperty("code_url").GetString();
        return Api.Text(url, 4096) ? url! : throw new InvalidOperationException("Empty merchant checkout");
    }
    public async Task<string?> WechatQueryPaid(string no, long amount, CancellationToken ct)
    {
        using var d = await WxRequest("GET", "/v3/pay/transactions/out-trade-no/" + Uri.EscapeDataString(no) +
            "?mchid=" + Uri.EscapeDataString(W("MchId")), null, ct);
        var r = d.RootElement;
        if (r.GetProperty("trade_state").GetString() != "SUCCESS") return null;
        if (r.GetProperty("out_trade_no").GetString() != no || r.GetProperty("amount").GetProperty("total").GetInt64() != amount ||
            r.GetProperty("amount").GetProperty("currency").GetString() != "CNY" ||
            r.GetProperty("mchid").GetString() != W("MchId") || r.GetProperty("appid").GetString() != W("AppId"))
            throw new InvalidOperationException("Merchant transaction mismatch");
        return r.GetProperty("transaction_id").GetString() ?? throw new InvalidOperationException("Missing transaction");
    }
    public async Task<string> WechatRefund(string no, string refundNo, long amount, CancellationToken ct)
    {
        using var d = await WxRequest("POST", "/v3/refund/domestic/refunds", new
        {
            out_trade_no = no, out_refund_no = refundNo, reason = "客户申请退款",
            amount = new { refund = amount, total = amount, currency = "CNY" }
        }, ct);
        return d.RootElement.GetProperty("status").GetString() == "CLOSED" ? "failed" : "processing";
    }
    public async Task<string> WechatRefundStatus(string no, string refundNo, long amount, CancellationToken ct)
    {
        using var d = await WxRequest("GET", "/v3/refund/domestic/refunds/" + Uri.EscapeDataString(refundNo), null, ct);
        var r = d.RootElement;
        if (r.GetProperty("out_trade_no").GetString() != no || r.GetProperty("out_refund_no").GetString() != refundNo ||
            r.GetProperty("amount").GetProperty("refund").GetInt64() != amount ||
            r.GetProperty("amount").GetProperty("currency").GetString() != "CNY")
            throw new InvalidOperationException("Merchant refund mismatch");
        // ABNORMAL is not a definitive failure; do not permit a new financial submission.
        return r.GetProperty("status").GetString() switch { "SUCCESS" => "succeeded", "CLOSED" => "failed", _ => "processing" };
    }
    SortedDictionary<string, string> AliArgs(string method, string biz) => new(StringComparer.Ordinal)
    {
        ["app_id"] = A("AppId"), ["method"] = method, ["format"] = "JSON", ["charset"] = "utf-8",
        ["sign_type"] = "RSA2", ["timestamp"] = DateTimeOffset.UtcNow.ToOffset(TimeSpan.FromHours(8)).ToString("yyyy-MM-dd HH:mm:ss", CultureInfo.InvariantCulture),
        ["version"] = "1.0", ["biz_content"] = biz
    };
    void Sign(SortedDictionary<string, string> args) =>
        args["sign"] = Security.RsaSign(string.Join("&", args.Select(k => $"{k.Key}={k.Value}")), A("PrivateKeyPem"));
    public string AlipayPage(string no, long amount)
    {
        var args = AliArgs("alipay.trade.page.pay", JsonSerializer.Serialize(new
        {
            out_trade_no = no, product_code = "FAST_INSTANT_TRADE_PAY", total_amount = Yuan(amount),
            subject = "Vizora AI 会员", timeout_express = "20m"
        }));
        args["notify_url"] = Notify("Alipay");
        args["return_url"] = Security.GetRequired(cfg, "Payments:WebBaseUrl").TrimEnd('/') + "/billing";
        Sign(args);
        return (cfg["Payments:Alipay:Gateway"] ?? "https://openapi.alipay.com/gateway.do") + "?" +
            string.Join("&", args.Select(k => Uri.EscapeDataString(k.Key) + "=" + Uri.EscapeDataString(k.Value)));
    }
    public bool VerifyAlipay(IFormCollection form)
    {
        if (form["sign_type"].ToString() != "RSA2" || form.Any(p => p.Value.Count != 1)) return false;
        var pairs = form.Where(k => k.Key != "sign" && k.Key != "sign_type" && !string.IsNullOrEmpty(k.Value.ToString()))
            .OrderBy(k => k.Key, StringComparer.Ordinal).Select(k => k.Key + "=" + k.Value.ToString());
        return Security.RsaVerify(string.Join("&", pairs), form["sign"].ToString(), A("AlipayPublicKeyPem"));
    }
    public bool ValidateAlipay(IFormCollection form, string no, long amount) =>
        form["app_id"].ToString() == A("AppId") && form["seller_id"].ToString() == A("SellerId") &&
        form["out_trade_no"].ToString() == no && Money(form["total_amount"].ToString(), amount) &&
        form["trade_status"].ToString() is "TRADE_SUCCESS" or "TRADE_FINISHED" &&
        !string.IsNullOrWhiteSpace(form["trade_no"]) && !string.IsNullOrWhiteSpace(form["notify_id"]);
    async Task<JsonDocument> AliRequest(string method, object biz, CancellationToken ct)
    {
        var args = AliArgs(method, JsonSerializer.Serialize(biz));
        Sign(args);
        using var resp = await clients.CreateClient("payments").PostAsync(
            cfg["Payments:Alipay:Gateway"] ?? "https://openapi.alipay.com/gateway.do", new FormUrlEncodedContent(args), ct);
        resp.EnsureSuccessStatusCode();
        var doc = JsonDocument.Parse(await resp.Content.ReadAsStringAsync(ct));
        var node = method.Replace('.', '_') + "_response";
        if (!doc.RootElement.TryGetProperty(node, out var r) ||
            !doc.RootElement.TryGetProperty("sign", out var sign) ||
            !Security.RsaVerify(r.GetRawText(), sign.GetString()!, A("AlipayPublicKeyPem")))
        {
            doc.Dispose();
            throw new InvalidOperationException("Untrusted Alipay merchant response");
        }
        return doc;
    }
    public async Task<string?> AlipayQueryPaid(string no, long amount, CancellationToken ct)
    {
        using var d = await AliRequest("alipay.trade.query", new { out_trade_no = no }, ct);
        var r = d.RootElement.GetProperty("alipay_trade_query_response");
        if (r.GetProperty("code").GetString() != "10000") throw new InvalidOperationException("Merchant query not conclusive");
        if (r.GetProperty("trade_status").GetString() is not ("TRADE_SUCCESS" or "TRADE_FINISHED")) return null;
        if (r.GetProperty("out_trade_no").GetString() != no || !Money(r.GetProperty("total_amount").GetString(), amount) ||
            r.GetProperty("seller_id").GetString() != A("SellerId")) throw new InvalidOperationException("Merchant transaction mismatch");
        return r.GetProperty("trade_no").GetString() ?? throw new InvalidOperationException("Missing transaction");
    }
    public async Task<string> AlipayRefund(string no, string refundNo, long amount, CancellationToken ct)
    {
        using var d = await AliRequest("alipay.trade.refund", new { out_trade_no = no, refund_amount = Yuan(amount), out_request_no = refundNo }, ct);
        var r = d.RootElement.GetProperty("alipay_trade_refund_response");
        if (r.GetProperty("code").GetString() == "10000") return "processing";
        if (r.TryGetProperty("sub_code", out var sub) &&
            sub.GetString() is "ACQ.TRADE_NOT_EXIST" or "ACQ.REFUND_AMT_NOT_EQUAL_TOTAL" or "ACQ.REFUND_AMT_NOT_EQUAL_TOTAL_AMOUNT")
            return "failed";
        throw new InvalidOperationException("Merchant refund submission not conclusive");
    }
    public async Task<string> AlipayRefundStatus(string no, string refundNo, long amount, CancellationToken ct)
    {
        using var d = await AliRequest("alipay.trade.fastpay.refund.query", new { out_trade_no = no, out_request_no = refundNo }, ct);
        var r = d.RootElement.GetProperty("alipay_trade_fastpay_refund_query_response");
        if (r.GetProperty("code").GetString() != "10000") return "processing";
        if (r.GetProperty("out_trade_no").GetString() != no || r.GetProperty("out_request_no").GetString() != refundNo)
            throw new InvalidOperationException("Merchant refund mismatch");
        // Merely containing refund_amount is not proof of refund success.
        if (!r.TryGetProperty("refund_status", out var status) || status.GetString() != "REFUND_SUCCESS") return "processing";
        if (!Money(r.GetProperty("refund_amount").GetString(), amount)) throw new InvalidOperationException("Merchant refund amount mismatch");
        return "succeeded";
    }
    static string Yuan(long fen) => (fen / 100m).ToString("F2", CultureInfo.InvariantCulture);
    static bool Money(string? text, long amount) =>
        decimal.TryParse(text, NumberStyles.AllowDecimalPoint, CultureInfo.InvariantCulture, out var value) && value * 100 == amount;
}
