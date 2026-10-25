from pathlib import Path
import re
root=Path(__file__).resolve().parents[1]
api=(root/'api/Program.cs').read_text()
pay=(root/'api/Payments.cs').read_text()
web=(root/'web/src/pages/Contact.vue').read_text()
sql=(root/'db/schema.sql').read_text()
checks={
 'lead API requires consent': 'if(!req.Consent' in api,
 'lead is stored': 'INSERT INTO sales_leads' in api,
 'admin leads role restricted': '/api/admin/leads' in api and 'role FROM users' in api,
 'lead schema has consent field': 'privacy_consented_at timestamptz NOT NULL' in sql,
 'lead form uses HTTP API': "api('/leads','POST'" in web,
 'lead form requires checkbox': 'type="checkbox" required' in web,
 'no simulated successful lead form': 'mailto:' not in web,
 'refund verification endpoint': '/api/admin/refunds/{id:guid}/reconcile' in api,
 'wechat status query': '/v3/refund/domestic/refunds/' in pay,
 'alipay status query': 'alipay.trade.fastpay.refund.query' in pay,
 'gateway refund not immediately final': 'ok?"processing":"failed"' in api,
 'refund reversal marked blocker': '退款权益冲正' in (root/'RELEASE_GATE.md').read_text(),
 'secrets not committed as .env': not (root/'deploy/.env').exists(),
}
for name,ok in checks.items():
 print(('PASS' if ok else 'FAIL'),name)
assert all(checks.values())
print(f'V4.1 supplemental static checks {len(checks)}/{len(checks)} passed; not a build or financial end-to-end test')
