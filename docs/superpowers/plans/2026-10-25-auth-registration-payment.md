# Authentication and Payment Acceptance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Verify the existing registration, login, checkout, merchant-confirmation, entitlement, and refund flows locally and with approved real low-value transactions, fixing only reproducible defects.

**Architecture:** Retain the current Vue/Vite frontend, ASP.NET Core API, PostgreSQL data model, SMTP verification flow, and WeChat Native/Alipay page-pay integrations. Establish a safe isolated local test baseline first, then use the intended production runtime and secret store for two separate RMB 99 acceptance orders; never use browser redirects as payment evidence or the local Development startup script as a production payment host.

**Tech Stack:** Vue 3, TypeScript, Vite, ASP.NET Core 10 Minimal API, .NET SDK, Npgsql, PostgreSQL, Node.js test runners, SMTP capture, WeChat Pay v3 Native, Alipay page-pay.

---

## File map

- `api/Accounts.cs` — registration, email verification, login, password recovery, and token invalidation. Modify only if a failing test identifies a defect.
- `api/CommerceEndpoints.cs` — order creation, callbacks, reconciliation, refund endpoints. Modify only if a failing integration test identifies a defect.
- `api/Commerce.cs` — transactional payment completion, idempotency, entitlement grant and refund state. Modify only if a failing domain regression identifies a defect.
- `api/Payments.cs` — merchant request signing, response/callback validation, payment and refund queries. Modify only if the failure is reproducible and the merchant contract is confirmed.
- `web/src/components/AuthForm.vue`, `web/src/pages/Billing.vue`, `web/src/api.ts` — existing real API registration/login/checkout interaction. Modify only for a test-confirmed UI/API mismatch.
- `tests/api-integration.mjs` — real loopback API + PostgreSQL + SMTP account-flow tests; extend for a missing assertion when needed.
- `tests/api-integration/CommerceRegression.cs` — PostgreSQL-backed entitlement, concurrency, and refund domain regressions.
- `tests/api-smtp.mjs` — loopback-only SMTP capture.
- `scripts/production-readiness.mjs` — safe presence/format preflight for a production runtime; it must never print configuration values.
- `tests/production-readiness.test.mjs` — unit tests proving readiness diagnostics are value-free and fail closed.
- `tests/ui_auth_e2e.py`, `tests/ui_membership_e2e.py` — browser acceptance for account and billing flows.
- `api/CONTRACT.md`, `README.md` — update only to document verified behavior or a confirmed operational correction.
- `docs/superpowers/specs/2026-10-25-auth-registration-payment-acceptance.md` — approved acceptance and trust-boundary specification.

## Task 1: Re-establish an isolated local integration environment

**Files:**
- No application files unless environment startup exposes a reproducible product defect.
- Test environment only: dedicated `vizora_test*` PostgreSQL database, local API, and loopback SMTP capture.

- [ ] **Step 1: Confirm the local prerequisites without exposing credentials**

Run: `dotnet --list-sdks && node --version`

Expected: a usable SDK capable of building the `net10.0` API and Node.js 22.12+.

- [ ] **Step 2: Start or provision only the dedicated test services**

Use the documented project-local disposable PostgreSQL runtime if it is available; otherwise request an approved isolated test database and loopback SMTP setup. Do not install system software, start production-facing services, or create a database outside the `vizora_test*` namespace without explicit authorization.

Expected: PostgreSQL is reachable on the configured test connection and SMTP capture is available only on loopback.

- [ ] **Step 3: Apply the idempotent schema to the isolated database**

Run: `dotnet run --project tests/api-integration/Api.Integration.csproj -- sql db/schema.sql`

Environment: set `TEST_DB_CONNECTION` to the isolated database connection; the test helper rejects database names not beginning `vizora_test`.

Expected: `SQL applied to isolated test database`.

- [ ] **Step 4: Start the API in Development on loopback**

Use the exact test environment documented in `api/CONTRACT.md`: `ASPNETCORE_ENVIRONMENT=Development`, API bound to `127.0.0.1:8080`, `ConnectionStrings__Main` set only to the isolated database, and loopback SMTP capture configured. Do not place production credentials in the test environment.

Expected: `GET http://127.0.0.1:8080/api/health` returns success and the database is the dedicated test database.

## Task 2: Run account, API, and commerce integration regressions

**Files:**
- Test: `tests/api-integration.mjs`
- Test: `tests/api-integration/CommerceRegression.cs`
- Test: `tests/api-smtp.mjs`

- [ ] **Step 1: Run the real account/API integration suite**

Run: `node tests/api-integration.mjs`

Expected: all assertions pass using actual PostgreSQL and the loopback SMTP capture. Confirm the suite asserts consent is required, unverified login is denied, the emailed verification token is single-use, password reset invalidates the old JWT, the reset token is single-use, logout-all invalidates the active bearer token, and unconfigured merchant providers create no fake checkout or order.

- [ ] **Step 2: Run the PostgreSQL commerce-domain regression**

Run: `dotnet run --project tests/api-integration/Api.Integration.csproj --no-restore -- commerce`

Expected: all 13 domain checks pass; fixtures are removed in `finally`.

- [ ] **Step 3: Run focused account and billing browser tests against the loopback UI/API**

Use the approved test Python environment and install the pinned dependency with `python -m pip install -r tests/requirements-ui.txt`; install its matching Chromium runtime once with `python -m playwright install chromium` if no compatible browser is already available. Start the loopback API and SMTP capture as described in Task 1. Start Vite in one terminal with `npm run dev --prefix web -- --host 127.0.0.1 --port 5187 --strictPort`, then run `UI_BASE_URL=http://127.0.0.1:5187 SMTP_CAPTURE_URL=http://127.0.0.1:55253/messages python tests/ui_auth_e2e.py`. For membership UI coverage, create/verify a dedicated empty Free test account through the isolated API and actual SMTP capture, restart Vite on port 5188 with `npm run dev --prefix web -- --host 127.0.0.1 --port 5188 --strictPort`, then run `UI_BASE_URL=http://127.0.0.1:5188 TEST_DB_CONNECTION="$TEST_DB_CONNECTION" UI_TEST_EMAIL="$UI_TEST_EMAIL" UI_TEST_PASSWORD="$UI_TEST_PASSWORD" python tests/ui_membership_e2e.py`.

Expected: both browser tests use only loopback test apps and dedicated non-production accounts; no merchant success is simulated or claimed.

- [ ] **Step 4: Stop and trace any failing assertion before editing**

Record the failing test, response/status or domain state, and the boundary where actual behavior diverges. Trace from the failing observable back through frontend/API, database, SMTP, or merchant adapter as appropriate. Do not change code based only on the prior configuration-preflight failure.

## Task 3: Correct only reproducible code defects

**Files:**
- Tests and source files selected from the evidence in Task 2; avoid broad refactors.

- [ ] **Step 1: Add a focused failing regression for the demonstrated defect**

Use the smallest suitable existing runner: Vitest for frontend behavior, `node --test`/API integration for endpoint behavior, or the `commerce` runner for PostgreSQL domain invariants.

Expected: the new assertion fails for the reproduced reason before the source change.

- [ ] **Step 2: Implement the smallest correction at the source of the defect**

Preserve these invariants: unverified email cannot log in; prices and durations are server-derived; callback/query evidence is merchant-authenticated; duplicate events are idempotent; payment return pages never grant entitlements; pending refunds are not reported as success; stacked or legacy grants remain explicitly reviewable.

- [ ] **Step 3: Re-run the focused failing regression and neighboring tests**

Expected: the new regression passes and no related assertion regresses.

- [ ] **Step 4: Re-run complete source baseline commands**

Run: `dotnet build api/Vizora.Api.csproj -c Release`

Run: `npm test --prefix web`

Run: `npm run build --prefix web`

Run: `node --test tests/startup.test.mjs`

Expected: all commands succeed. Record the SDK version and distinguish compile/test results from external integration.

## Task 4: Confirm production-runtime readiness without exposing secrets

**Files:**
- Create: `scripts/production-readiness.mjs`
- Test: `tests/production-readiness.test.mjs`
- Production secret store and deployment environment are external prerequisites; do not write their values to repository files.
- Documentation updates, if needed: `api/CONTRACT.md`, `README.md`.

- [x] **Step 1: Write failing tests for a value-free readiness report**

Cover explicit Production environment (including a conflicting `DOTNET_ENVIRONMENT` override), missing required settings, SMTP TLS and legal readiness, valid/invalid HTTPS endpoints, normalized IP/loopback and malformed hostname rejection, notification callback origin/route binding and optional fallback, PEM markers, WeChat API v3 key byte length, WeChat platform certificate presence, all Alipay verification credentials and the exact official gateway, and SMTP credential pairing. Assert serialized output contains only setting names and statuses/reasons, never supplied values or key contents.

- [x] **Step 2: Implement the read-only production readiness checker**

Read only the API's effective production configuration values supplied to the same runtime. Require `ASPNETCORE_ENVIRONMENT=Production`; if `DOTNET_ENVIRONMENT` is set, require it to be `Production` too. For the environment-variable provider, use the API's canonical ASP.NET mapping (`Auth:SigningKey` → `Auth__SigningKey`, `Payments:Wechat:PrivateKeyPem` → `Payments__Wechat__PrivateKeyPem`, and equivalent double-underscore mappings for `Mail`, `Payments`, and `Legal`). Include SMTP host/port/user/password/from/TLS, JWT signing key, public API/web URLs, all required WeChat and Alipay credentials (including Alipay's public verification key), each active WeChat platform certificate mapping, and legal fields. Require explicit SMTP TLS and `Legal__Ready=true`; if SMTP authentication is enabled, require both username and password. Require the configured Alipay gateway to be `https://openapi.alipay.com/gateway.do`. The checker must run in the same deployment/runtime configuration boundary as the API. If production injects settings through a provider the checker cannot read, it must fail closed and require an operator-approved adapter to that same provider; it must never silently inspect a different source and claim readiness. Report only pass/fail and missing setting names. Validate non-sensitive structure, reject non-HTTPS, IP-literal, loopback, and malformed public/callback hostnames; require each merchant notification to use the public API origin and its implemented provider route. Require configured operator/contact fields. A separate human operator attestation confirms the legal materials and trading terms were actually reviewed. Do not make network requests, print values, print secret lengths, or dump the environment.

- [ ] **Step 3: Run the checker in the intended production runtime**

Run: `node scripts/production-readiness.mjs`

Before the production invocation, run: `node --test tests/production-readiness.test.mjs`

Expected: the focused readiness tests pass; the checker exits 0 only when all required effective runtime settings and structural/legal gates pass, otherwise exits nonzero with a value-free missing/invalid-setting report. Check public endpoint reachability separately using the approved monitoring/operations tool; do not pass callback URLs containing tokens or secrets.

Local result: `node --test tests/production-readiness.test.mjs tests/startup.test.mjs` passes. The current local process has no production configuration, so the CLI correctly exits nonzero with setting names only; the production-runtime invocation remains blocked pending the approved runtime configuration.

- [ ] **Step 4: Confirm the intended production endpoint and change window**

Use an operator-approved production URL and deployment/runtime. Confirm that the change is limited to the two acceptance accounts and the selected RMB 99 Creator-month plan. Confirm WeChat and Alipay callback paths reach the intended production API, TLS is valid, and payment response signing uses the configured active platform certificates.

- [ ] **Step 5: Stop if any readiness check fails**

Do not create a production order unless runtime, endpoint identity/reachability, merchant configuration, operator-reviewed legal gate, and acceptance-account isolation all pass. Do not use `bash ./start.sh` as the production host: that script forces Development and rewrites callback bases to loopback.

## Task 5: Execute and refund the WeChat acceptance

**Files:**
- No repository files should contain acceptance credentials, tokens, or merchant secrets.
- Record the outcome only in an approved non-secret operational record.

- [ ] **Step 1: Register and verify the dedicated WeChat acceptance account**

Use an operator-controlled mailbox, complete the actual SMTP-delivered one-time verification link, and confirm login succeeds only after verification.

- [ ] **Step 2: Create and pay the WeChat Creator-month order once**

Confirm the selected catalog plan and RMB 99 amount before redirect/scan. Complete WeChat Native checkout with an operator-controlled payment account.

- [ ] **Step 3: Verify authoritative WeChat payment and entitlement state**

Verify an authenticated notification or authenticated merchant reconciliation, then check order/provider/amount/currency, unique payment event, one entitlement grant, membership term, and frontend status. If payment is confirmed but entitlement is missing, mismatched, or review-required, stop new purchases, preserve non-secret evidence, and go directly to Step 4 for an authorized refund/reconciliation path; the designated production operator with merchant-account access requests the refund and escalates any unresolved state to the payment provider. Do not leave a charged order unaccounted or claim entitlement activation.

- [ ] **Step 4: Request and reconcile the WeChat refund before starting another paid test**

Request one full refund only after capturing the confirmed order and entitlement evidence. Do not retry an ambiguous submission until merchant reconciliation establishes its state. Wait for final merchant `SUCCESS`; verify the order, revoked grant, membership state, amount, and transaction/refund identifiers. If the refund reaches final failure or cannot be reconciled, the designated production operator escalates to the merchant/payment provider, stops all further production transactions, and does not proceed to Task 6 until the charge is resolved.

## Task 6: Execute and refund the Alipay acceptance; close the acceptance

**Files:**
- Documentation: `api/CONTRACT.md` and `README.md` only if verified operational behavior or release status needs updating.

- [ ] **Step 1: Register and verify the dedicated Alipay acceptance account**

Use a different operator-controlled account and repeat actual email verification and login.

- [ ] **Step 2: Create and pay the Alipay Creator-month order once**

Use the separate acceptance account, confirm the RMB 99 catalog amount, and complete Alipay page-pay with an operator-controlled payment account.

- [ ] **Step 3: Verify authoritative Alipay payment and entitlement state**

Verify signed merchant callback or signed query evidence, order/provider/amount/currency, unique payment event, one entitlement grant, membership term, and frontend status. If payment is confirmed but entitlement is missing, mismatched, or review-required, preserve non-secret evidence and go directly to Step 4 for an authorized refund/reconciliation path; the designated production operator with merchant-account access requests the refund and escalates any unresolved state to the payment provider. Do not leave a charged order unaccounted or claim entitlement activation.

- [ ] **Step 4: Request and reconcile the Alipay refund**

Request one full refund only after capturing the confirmed order and entitlement evidence. Do not retry an ambiguous submission until merchant reconciliation establishes its state. Wait for final merchant `SUCCESS`; verify the order, revoked grant, membership state, amount, and transaction/refund identifiers. If the refund reaches final failure or cannot be reconciled, the designated production operator escalates to the merchant/payment provider, stops further production transactions, reports the unresolved charge explicitly, and does not claim acceptance completion.

- [ ] **Step 5: Report verification stages separately**

Report source build, local isolated integration, real email delivery, each provider transaction, merchant refund finality, and entitlement reconciliation as separate pass/blocked outcomes. Keep non-secret evidence such as acceptance account labels, order IDs, provider transaction/refund identifiers, amounts, and final states in the approved operational record; do not record passwords, tokens, private keys, API secrets, or SMTP credentials. Never conflate local tests with production acceptance.

## Execution constraints

- This workspace currently has no Git metadata. Do not initialize a repository, create a commit, or represent the work as committed.
- At plan creation, local API/SMTP/PostgreSQL test services were unavailable and Docker preflight failed.
- At plan creation, required payment/SMTP/legal fields were not available in the inspected local `deploy/.env` or process environment; the local payment URLs were loopback and the WeChat platform certificate mapping was missing.
- Therefore Tasks 1–3 and 5–6 are blocked pending the specified environments; no production purchase or refund is authorized by this plan until Task 4 passes.
