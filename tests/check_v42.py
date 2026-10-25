from pathlib import Path
root=Path(__file__).resolve().parents[1]
s=(root/'api/Program.cs').read_text(); db=(root/'db/schema.sql').read_text(); routes=(root/'web/src/main.ts').read_text(); page=(root/'web/src/pages/AccountRecovery.vue').read_text()
checks={
 'Email verification demanded before login': 'u["email_verified_at"]==null' in s,
 'Password reset uses one-time database token': 'ConsumeAccountToken(db,req.Token,"reset"' in s,
 'Token digests saved not raw values': 'SHA256.HashData(Encoding.UTF8.GetBytes(token))' in s and 'token_hash' in db,
 'Server-side token-version check': 'u["token_version"]' in s and 'ver=u["token_version"]' in s,
 'Logout-all revocation': 'UPDATE users SET token_version=token_version+1' in s,
 'Account verification page': "name:'verify'" in routes,
 'Forgot-password page': "name:'forgot'" in routes,
 'Reset-password page': "name:'reset'" in routes,
 'Resend-verification page': "name:'resend'" in routes,
 'Auth workflows use HTTP endpoints': '/auth/reset-password' in page and '/auth/verify-email' in page,
 'Order-linked entitlement grants': 'entitlement_grants' in db and 'INSERT INTO entitlement_grants' in s,
 'Refund reconciles entitlement revocation': 'UPDATE entitlement_grants SET revoked_at=' in s,
 'Complex entitlements require manual review': 'refund_with_prior_grants' in s and 'refund_of_historical_grant' in s,
 'Production mail settings documented': 'Mail__Host=' in (root/'deploy/.env.example').read_text()
}
for k,v in checks.items(): print(('PASS' if v else 'FAIL'),k)
assert all(checks.values());print(f'V4.2 STATIC CHECKS: {sum(checks.values())}/{len(checks)} PASSED; NOT BUILD OR RUNTIME TESTS')
