# V4.2 API contract / operational validation

All paths below have `/api` prefix. Request fields use camelCase; existing database read shapes retain snake_case. Dates are ISO-8601 UTC. Amounts are integer CNY fen. Unlimited project limits are **JSON null**, not zero or an omitted field.

## Frontend contract

- `GET /plans`: `[{code,name,price_fen,duration_days,project_limit:number|null}]`.
  Free is `{code:"free",name:"Free",price_fen:0,duration_days:0,project_limit:3}` and not purchasable.
  Creator month/year = `9900/95000` fen, 10 projects; FDE = `69900/671000`, unlimited.
  Old `pro-*`/`team-*` rows remain for historical references but are inactive.
- `GET /me`: `{id,email,display_name,user:{id,email,display_name,role,email_verified_at},membership:null|{plan_code,valid_until,project_limit,name,active},project_limit:number|null,quota:{active,plan_code,project_limit:number|null,project_used}}`.
  **Top-level `project_limit` is the effective limit**. Expired membership falls back to 3; historical membership stays visible with `active:false`.
- `GET /dashboards`: `[{id,title,prompt,created_at}]`.
  `POST {title,prompt?}` → `200 {id}`; `DELETE /dashboards/:id` → 204. Quota rejection 403 `project_limit_reached`; ownership errors 404.
- `POST /auth/register {email,password,name?,consent:true}` → `200 {message}` (email validation required).
  `POST /auth/login {email,password}` → `200 {token}`. Unverified → 403 `email_not_verified`.
  `POST /auth/verify-email {token}`, `/auth/resend-verification {email}`,
  `/auth/forgot-password {email}`, `/auth/reset-password {token,newPassword}` → `200 {message}`.
  `POST /auth/logout-all` → 204. Reset/logout invalidate prior tokens via server-side `token_version`.
- `GET /orders` and `GET /orders/:id`:
  array/object `{id,order_no,plan_code,amount_fen,provider,status,created_at,paid_at,expires_at,code_url,checkout_url,closed_reason}`.
  Nullable fields stay present. Status: `pending|paid|closed|refunding|refunded`.
  Every order also includes `entitlement_review_required:boolean` for unresolved manual entitlement review.
  Expired pending orders become `closed` with `closed_reason:"expired"` when queried.
  `POST /orders {planCode,provider:"wechat"|"alipay"}` → `200 {id,orderNo,provider,payUrl,amountFen,expiresAt}`.
  Server sets price and duration snapshot. No merchant configuration → **503 `payment_unavailable`**, no order inserted.
  While membership is active, only the same tier can renew (monthly/yearly may mix). Cross-tier purchase → **409 `membership_tier_conflict`**, no order or gateway request. Expired members may select a new tier.
  `POST /orders/:id/reconcile` → `{status,entitlement_review_required}` from persisted state, never browser-declared payment success.
  Verified late or concurrent cross-tier receipts record paid funds and create `cross_tier_payment_requires_review`, preserving the original tier and expiry; no grant is silently issued. Clients must not describe these paid orders as activated memberships. Existing cross-tier pending orders cannot resume from the UI.
- `POST /designer/ticket {dashboardId}` → `{url,ticket,expiresAt}` only when URL, signing secret and server secret are configured.
  Otherwise **503 `designer_unavailable`**, no nonce/ticket issued. Ticket is one-time and expires in two minutes.
  POST the ticket into the Designer integration; never put the long-lived bearer in any URL.
- `POST /leads {name,company,email,details,consent:true}` → `202 {id,message}` after real DB persistence.
- `GET /public-config` → `{legalReady:boolean,operatorName:string|null,contactEmail:string|null}`. No secret settings exposed.
- Errors: `{error:string,code:string,traceId:string|null}`; refund ambiguous submission additionally returns `{refundId,status:"processing",error,code:"refund_uncertain"}` with 502.
  Do not assume every non-2xx contains RFC7807 `detail`. Empty 401/404/etc and malformed JSON are normalized.

## Production gates and financial limits

`Legal:Ready=true` requires reviewed documents, valid `Legal:OperatorName` and `Legal:ContactEmail`; production registration and **new purchases** return 503 `legal_not_ready` otherwise. This flag is an operator attestation, not automatic legal review. Existing order reconciliation/refunds remain available.

Production SMTP is always TLS (the loopback testing option cannot disable it in Production). Port 465 uses implicit TLS; other TLS-enabled ports require STARTTLS. Plain SMTP is allowed only for a loopback host in Development. Production JWT signing key must be at least 40 characters. Rate limit defaults to eight account/lead requests per minute per client IP; only explicit trusted proxies are accepted.

Merchant responses and notifications are verified, including refund identifiers/amounts. Pending/refunding requests are idempotent per order under DB lock; uncertain submission remains processing and must be reconciled before another attempt. Final failed refund restores order to paid. Concurrent reconciliation cannot overwrite terminal success. A refunded sole tracked grant expires membership; stacked/legacy grants create an `entitlement_review` record and require operator resolution. **Automatic stacked-grant recalculation and actual merchant acceptance remain release blockers.**

Before a real transaction, run `node scripts/production-readiness.mjs` inside the same controlled runtime and process-environment configuration used by the API, with `ASPNETCORE_ENVIRONMENT=Production`; if `DOTNET_ENVIRONMENT` is set, it must also be `Production` because it can override the ASP.NET environment. The checker expects the ASP.NET environment-variable mapping (`:` becomes `__`), including the production SMTP/TLS, JWT, WeChat and Alipay values (including Alipay's public verification key), explicit public HTTPS URLs, legal-ready/operator values, and WeChat platform-certificate mappings. Merchant notification URLs must share the public API origin and target the implemented provider callback route. Alipay's configured gateway must be exactly `https://openapi.alipay.com/gateway.do`. It checks presence and limited structure only (including PEM markers and WeChat API v3 key byte length); it does not parse certificates cryptographically, contact any endpoint, or verify the human legal-review attestation. Output contains setting names/status only, never values. It does not load `.env` files. If API settings come from an additional configuration provider, adapt the checker to read that same provider or treat readiness as blocked; never compare different environments.

## Repeatable local validation

Requires .NET 10, a dedicated PostgreSQL cluster/database whose name starts `vizora_test`, and Node.

1. Set `TEST_DB_CONNECTION` to the dedicated test DB. Apply the idempotent schema:
   `dotnet run --project tests/api-integration/Api.Integration.csproj -- sql db/schema.sql`.
   The helper creates a missing `vizora_test*` database; it never drops a DB. Do not point at shared production instances.
2. Start capture: `node tests/api-smtp.mjs` (SMTP 55252; `GET http://127.0.0.1:55253/messages` returns `{to,text,receivedAt}[]`). Loopback only, test-only mail receiver.
3. Start from `api/` using `dotnet run --no-launch-profile`, with environment:
   `ASPNETCORE_ENVIRONMENT=Development`, `ASPNETCORE_URLS=http://127.0.0.1:8080`,
   `ConnectionStrings__Main=<isolated connection>`, `Payments__WebBaseUrl=http://localhost:5187`,
   `Mail__Host=127.0.0.1`, `Mail__Port=55252`, `Mail__EnableSsl=false`, `Mail__From=no-reply@vizora.test`,
   `RateLimits__AuthPerMinute=1000` (local test only).
   SMTP unit tests run with `dotnet test tests/api-unit/Api.UnitTests.csproj` and never connect to an external server.
4. `node tests/api-integration.mjs`. It registers a unique account, reads actual SMTP, verifies/reset passwords, tests concurrent quota/CRUD, persists a lead, and checks explicit unavailable merchant/Designer responses. It does **not** imitate merchant success.
5. `dotnet build api/Vizora.Api.csproj -c Release`.
6. `dotnet run --project tests/api-integration/Api.Integration.csproj --no-restore -- commerce`.
   Thirteen real-database domain regression checks exercise cross-tier receipts, duplicate callbacks, refunds, same-tier renewal, expiry and concurrent payments. These are isolated domain fixtures, not actual merchant payment acceptance.
7. With a verified empty Free fixture account, run `tests/ui_membership_e2e.py` using `UI_TEST_EMAIL`, `UI_TEST_PASSWORD`, `UI_BASE_URL` and `TEST_DB_CONNECTION`. It temporarily seeds a membership and pending order, checks real API guards and desktop/mobile UI, and removes its own fixtures in `finally`. Never use a real member account.

The current local services use dedicated cluster `tests/api-runtime/data`, PG 55439 (`vizora_test` user/database), API 8080, SMTP 55252/mailbox55253. The downloaded project-local native PostgreSQL distribution is a disposable test runtime, not an application dependency. Stop these exact owned processes before deleting its directory. Tests do not need this particular distribution if PostgreSQL is otherwise available.

Existing database deployments must explicitly apply `db/schema.sql` with backup and `psql -v ON_ERROR_STOP=1 --single-transaction -f`; the Docker init mount alone does not upgrade an existing volume.
