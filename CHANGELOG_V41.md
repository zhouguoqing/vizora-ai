# Vizora AI V4.1 changes — 2026-10-20

## Implemented (source-level, not production-certified)
- Enterprise sales inquiries now POST to `/api/leads` and persist to PostgreSQL with privacy consent timestamp; admin retrieval `/api/admin/leads`.
- Frontend inquiry form includes validation, consent, pending/error/success states; removed misleading simulated submission.
- Admin refund reconciliation endpoint `/api/admin/refunds/{id}/reconcile` queries WeChat Pay or Alipay before moving refund to terminal state.
- Added `sales_leads` table in initial schema and expanded static contract checks.

## Blockers (DO NOT take real money yet)
1. No .NET 10 SDK here; API compilation and integration tests were not executed.
2. Frontend lacks package-lock.json; offline npm registry cache could not resolve dependencies. Run npm install with registry access, commit lock file, then npm ci and build.
3. Email verification and password recovery, abuse prevention, refresh/logout session revocation not complete.
4. Refund membership entitlement reversal, payment settlement ledger, dispute management, scheduled reconciliation, and exact gateway edge-case testing not complete. Alipay refund query state mapping requires sandbox and live verification.
5. Real merchant accounts, webhook signature/certificate rotation, production TLS, backups/restore drills, audit tests, load tests, legal pages and ICP/related regulatory review remain outstanding.
6. The website visuals and legal copy require production review; do not claim sample customers or metrics as verified.

## Suggested next commands
```
cd web
npm install
npm ci
npm run build
npm test
cd ../api
dotnet restore
dotnet build -c Release
cd ..
python tests/check.py
python tests/check_v41.py
```
Run actual provider sandbox and low-value merchant transactions after obtaining merchant IDs, keys and gateway callbacks. No gateway secrets are included.
