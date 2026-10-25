CREATE TABLE IF NOT EXISTS users (id uuid PRIMARY KEY, email varchar(320) UNIQUE NOT NULL, password_hash text NOT NULL, display_name varchar(120) NOT NULL DEFAULT '', role varchar(20) NOT NULL DEFAULT 'user', created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS plans (code varchar(30) PRIMARY KEY, name varchar(60) NOT NULL, price_fen bigint NOT NULL CHECK(price_fen>=0), duration_days int NOT NULL CHECK(duration_days>0), project_limit int NOT NULL CHECK(project_limit>=0), active boolean NOT NULL DEFAULT true);
INSERT INTO plans(code,name,price_fen,duration_days,project_limit) VALUES ('pro-month','个人专业版（月）',6900,30,20),('pro-year','个人专业版（年）',59900,365,20),('team-month','团队商业版（月）',29900,30,100),('team-year','团队商业版（年）',299900,365,100) ON CONFLICT(code) DO NOTHING;
CREATE TABLE IF NOT EXISTS memberships (user_id uuid PRIMARY KEY REFERENCES users(id), plan_code varchar(30) REFERENCES plans(code), valid_until timestamptz, updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS dashboards (id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id), title varchar(200) NOT NULL, prompt text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now()); CREATE INDEX IF NOT EXISTS ix_dashboards_user ON dashboards(user_id);
CREATE TABLE IF NOT EXISTS orders (id uuid PRIMARY KEY, order_no varchar(45) UNIQUE NOT NULL, user_id uuid NOT NULL REFERENCES users(id), plan_code varchar(30) NOT NULL REFERENCES plans(code), amount_fen bigint NOT NULL CHECK(amount_fen>=0), provider varchar(20) NOT NULL, status varchar(20) NOT NULL DEFAULT 'pending', provider_trade_no varchar(150), code_url text, checkout_url text, created_at timestamptz NOT NULL DEFAULT now(), paid_at timestamptz, expires_at timestamptz NOT NULL DEFAULT (now()+interval '20 minutes'), CHECK(status IN ('pending','paid','closed','refunding','refunded'))); CREATE INDEX IF NOT EXISTS ix_orders_user ON orders(user_id);
CREATE TABLE IF NOT EXISTS payment_events (id bigserial PRIMARY KEY, provider varchar(20) NOT NULL, event_key varchar(200) NOT NULL, order_no varchar(45), created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(provider,event_key));
CREATE TABLE IF NOT EXISTS refunds (id uuid PRIMARY KEY, refund_no varchar(45) UNIQUE NOT NULL, order_id uuid NOT NULL REFERENCES orders(id), amount_fen bigint NOT NULL CHECK(amount_fen>0), reason varchar(200) NOT NULL, status varchar(20) NOT NULL DEFAULT 'pending', provider_refund_no varchar(150), created_at timestamptz NOT NULL DEFAULT now(), finished_at timestamptz, CHECK(status IN ('pending','processing','succeeded','failed'))); CREATE UNIQUE INDEX IF NOT EXISTS ux_order_refund ON refunds(order_id) WHERE status IN ('pending','processing','succeeded');
CREATE TABLE IF NOT EXISTS ticket_nonces (nonce uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id), dashboard_id uuid NOT NULL REFERENCES dashboards(id), expires_at timestamptz NOT NULL, used_at timestamptz);

-- V4.1: durable sales lead capture; explicit consent and retention bookkeeping
CREATE TABLE IF NOT EXISTS sales_leads (id uuid PRIMARY KEY, contact_name varchar(120) NOT NULL, company varchar(200) NOT NULL, email varchar(320) NOT NULL, requirements text NOT NULL, privacy_consented_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), status varchar(24) NOT NULL DEFAULT 'new');
CREATE INDEX IF NOT EXISTS ix_sales_leads_created ON sales_leads(created_at DESC);

-- V4.2 account security and refund entitlement audit. Safe to reapply.
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at timestamptz;
ALTER TABLE users ADD COLUMN IF NOT EXISTS disabled_at timestamptz;
ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version int NOT NULL DEFAULT 0;
CREATE TABLE IF NOT EXISTS account_tokens(id uuid PRIMARY KEY,user_id uuid NOT NULL REFERENCES users(id),purpose varchar(12) NOT NULL CHECK(purpose IN ('verify','reset')),token_hash varchar(64) UNIQUE NOT NULL,expires_at timestamptz NOT NULL,consumed_at timestamptz,created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS ix_account_tokens_user_purpose ON account_tokens(user_id,purpose);
CREATE TABLE IF NOT EXISTS entitlement_grants(order_id uuid PRIMARY KEY REFERENCES orders(id),user_id uuid NOT NULL REFERENCES users(id),plan_code varchar(30) NOT NULL REFERENCES plans(code),duration_days int NOT NULL,paid_at timestamptz NOT NULL,revoked_at timestamptz);
CREATE INDEX IF NOT EXISTS ix_entitlement_grants_user ON entitlement_grants(user_id,paid_at);
CREATE TABLE IF NOT EXISTS entitlement_review(order_id uuid PRIMARY KEY REFERENCES orders(id),reason varchar(200) NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),resolved_at timestamptz);

-- V4.2 approved catalogue. NULL is unlimited; legacy references remain valid.
ALTER TABLE plans ALTER COLUMN project_limit DROP NOT NULL;
UPDATE plans SET active=false WHERE code IN ('pro-month','pro-year','team-month','team-year');
INSERT INTO plans(code,name,price_fen,duration_days,project_limit,active) VALUES
 ('creator-month','Creator（月）',9900,30,10,true),
 ('creator-year','Creator（年）',95000,365,10,true),
 ('fde-month','FDE（月）',69900,30,NULL,true),
 ('fde-year','FDE（年）',671000,365,NULL,true)
ON CONFLICT(code) DO UPDATE SET name=excluded.name,price_fen=excluded.price_fen,
 duration_days=excluded.duration_days,project_limit=excluded.project_limit,active=true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS terms_consented_at timestamptz;
ALTER TABLE users ADD COLUMN IF NOT EXISTS privacy_consented_at timestamptz;
ALTER TABLE users ADD COLUMN IF NOT EXISTS consent_version varchar(30);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS duration_days int;
UPDATE orders o SET duration_days=p.duration_days FROM plans p WHERE p.code=o.plan_code AND o.duration_days IS NULL;
ALTER TABLE orders ALTER COLUMN duration_days SET NOT NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS closed_reason varchar(30);
CREATE INDEX IF NOT EXISTS ix_orders_pending_expiry ON orders(expires_at) WHERE status='pending';
CREATE INDEX IF NOT EXISTS ix_ticket_nonces_dashboard ON ticket_nonces(dashboard_id);
