# Authentication and Payment Acceptance Specification

## Goal

Validate and, if necessary, correct the existing registration, login, online order, payment, entitlement, and refund flows using isolated local integration tests followed by explicitly approved low-value production transactions.

## Approved production acceptance

- Use two separate, newly registered acceptance accounts: one for WeChat and one for Alipay.
- Complete actual email verification and login for both accounts.
- Buy the existing Creator monthly plan at its catalog price of RMB 99 once per provider.
- Verify merchant-confirmed payment using a verified notification or authenticated merchant reconciliation. Verify the persisted order, payment event, entitlement grant, membership, and user-visible state.
- Only after payment and entitlement evidence is captured, request a full refund for each order.
- A refund is complete only after the merchant reports final success and the application state is checked. A submission response or `processing` state is not a successful refund.
- Do not use a shared account for both transactions; stacked or legacy grants require manual entitlement review.

## Existing architecture and trust boundaries

- Keep the existing Vue 3/TypeScript/Vite client, ASP.NET Core Minimal API, PostgreSQL, and SMTP integration.
- Registration requires consent, stores only a hash of a single-use verification token, and does not allow unverified login. Password-reset and session-revocation behavior must continue to invalidate old tokens.
- Order price and term come from the server-side plan catalog; browser return URLs do not grant entitlements.
- Only a merchant-verified callback or authenticated merchant query may confirm payment. Order, payment event, grant, and membership updates must remain transactional and idempotent.
- Merchant credentials, SMTP credentials, private keys, API v3 keys, and production tokens must stay in the approved local or external secret store. They must never be committed, pasted into chat, written into this specification, or printed by preflight checks.
- Production callback and site URLs must be publicly reachable HTTPS endpoints.
- The non-financial preflight must require `ASPNETCORE_ENVIRONMENT=Production` and reject a non-production `DOTNET_ENVIRONMENT` override, read the same effective production configuration source as the API, fail closed for missing/unavailable settings, require explicit SMTP TLS and reviewed legal readiness, reject IP-literal/loopback/malformed endpoints, bind merchant notifications to the public API origin and implemented provider route, and accept only Alipay's official HTTPS gateway and required verification key. It reports names/statuses only and does not establish actual endpoint reachability or merchant/certificate validity.
- The repository's local `start.sh` path is intentionally Development-only and rewrites payment base URLs to loopback. It must not be used as a production payment host or treated as evidence of production readiness.

## Validation stages and completion criteria

### Source and build baseline

- API Release build succeeds.
- Frontend production build and focused unit suite pass.
- Startup-script regression suite passes.
- Record the SDK version used; a preview SDK build is not by itself production acceptance.

### Isolated integration baseline

- Use only a dedicated database whose name begins `vizora_test`.
- Use the loopback SMTP capture service and a loopback API.
- Run the actual API integration suite and the 13-case commerce domain regression.
- Never point destructive integration fixtures at production or a shared database.
- These tests validate application behavior, not successful merchant transactions.

### Production integration

- The production deployment, secret store, HTTPS callbacks, SMTP, and merchant credentials must be available through the intended production runtime. Do not copy production secrets into source-controlled example files or use the local Development startup script.
- Verify actual SMTP delivery and token consumption for each new acceptance account.
- Verify each merchant transaction against the merchant's authoritative state and the application's persisted records.
- Verify each refund reaches final merchant success and reconcile the resulting membership/grant state.
- Run the provider acceptance sequentially: reconcile the WeChat payment and its full refund to final success before creating the Alipay order. If a confirmed payment has an entitlement mismatch, or its refund fails/cannot be reconciled, stop additional purchases, preserve non-secret evidence, and have the designated production operator with merchant-account access escalate through the authorized merchant/provider process. Do not leave a confirmed charge unaccounted or report acceptance completion with an unresolved charge.
- Stop without creating any order if production configuration, endpoint identity, callback reachability, amount, or acceptance-account isolation cannot be verified.

## Known constraints

- The current local workspace inspection did not find usable SMTP, WeChat, Alipay, or legal-operator values in `deploy/.env` or process environment. It found no WeChat platform-certificate mapping, and the configured base URLs were loopback rather than public HTTPS.
- Docker, the API, SMTP capture service, PostgreSQL client/server, and the documented isolated test runtime were unavailable during the last validation attempt. Therefore, live integration and isolated database tests remain unverified.
- Current source/build evidence: API Release build succeeded with zero warnings/errors using .NET SDK 11 preview; frontend production build succeeded; frontend regression passed 35/35; startup script tests passed 11/11.
- No source code defect has yet been demonstrated by the current test evidence. Any code change must be driven by a reproducible failing test and must preserve the trust boundaries above.
- This workspace is not a Git repository. Do not initialize Git or claim a commit was created.
