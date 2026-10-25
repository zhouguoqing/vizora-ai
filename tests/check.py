from pathlib import Path
p=Path(__file__).resolve().parents[1]
checks={
 'dotnet_10_project':('api/Vizora.Api.csproj','<TargetFramework>net10.0</TargetFramework>'),
 'vue_3':('web/package.json','"vue":"^3'),
 'wechat_signature':('api/Payments.cs','VerifyWechat('),
 'wechat_aes':('api/Payments.cs','AesGcm('),
 'alipay_signature':('api/Payments.cs','VerifyAlipay('),
 'server_amount':('api/Program.cs','SELECT code,price_fen FROM plans'),
 'password_pbkdf2':('api/Security.cs','Rfc2898DeriveBytes.Pbkdf2'),
 'auth_rate_limit':('api/Program.cs','RequireRateLimiting("auth")'),
 'once_ticket':('api/Program.cs','UPDATE ticket_nonces SET used_at=now()'),
 'idempotent_pay':('api/Program.cs','status\"]!=\"pending\"'),
 'database_schema':('db/schema.sql','CREATE TABLE IF NOT EXISTS orders'),
 'compose':('deploy/compose.yml','services:'),
 'privacy':('web/src/pages/Legal.vue','隐私政策'),
 'refund':('api/Program.cs','/api/admin/refunds'),
}
for name,(file,needle) in checks.items():
    assert needle in (p/file).read_text(),f'{name} FAILED'
    print('PASS',name)
print('STATIC CONTRACT CHECKS:',len(checks),'PASSED (not compilation or runtime tests)')
