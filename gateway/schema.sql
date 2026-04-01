-- ============================================================
-- banproof-core Gateway — D1 Schema (bp-core-prod)
-- Apply: wrangler d1 execute bp-core-prod --file=schema.sql
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
    id            TEXT     PRIMARY KEY,          -- crypto.randomUUID()
    email         TEXT     UNIQUE NOT NULL,
    password_hash TEXT     NOT NULL DEFAULT '',  -- PBKDF2 (never store plaintext)
    plan_tier     TEXT     NOT NULL DEFAULT 'free',   -- 'free' | 'pro' | 'agency'
    role          TEXT     NOT NULL DEFAULT 'user',   -- 'user' | 'admin' | 'sudo'
    discord_id    TEXT,
    created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);

CREATE TABLE IF NOT EXISTS sessions (
    id            TEXT     PRIMARY KEY,          -- crypto.randomUUID()
    user_id       TEXT     NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    access_token  TEXT     NOT NULL,             -- JWT (short-lived, 1 hour)
    refresh_token TEXT     NOT NULL UNIQUE,      -- UUID (30-day, stored for revocation)
    expires_at    DATETIME NOT NULL,             -- refresh token expiry
    revoked_at    DATETIME,                      -- NULL = active, set on logout
    ip_address    TEXT,
    user_agent    TEXT,
    created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id      ON sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_refresh_token ON sessions (refresh_token);

CREATE TABLE IF NOT EXISTS subscriptions (
    id                     TEXT     PRIMARY KEY,
    user_id                TEXT     NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    stripe_subscription_id TEXT,
    plan_tier              TEXT     NOT NULL DEFAULT 'free',
    status                 TEXT     NOT NULL DEFAULT 'active', -- 'active' | 'canceled' | 'past_due'
    current_period_start   DATETIME,
    current_period_end     DATETIME,
    auto_renew             INTEGER  NOT NULL DEFAULT 1, -- 0 = off, 1 = on
    created_at             DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions (user_id);

CREATE TABLE IF NOT EXISTS admin_audit_log (
    id             INTEGER  PRIMARY KEY AUTOINCREMENT,
    admin_id       TEXT     NOT NULL,
    action         TEXT     NOT NULL,  -- 'tier_change' | 'inquiry_quoted' | 'user_created'
    target_user_id TEXT,
    metadata       TEXT,               -- JSON blob
    ip_address     TEXT,
    created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_admin_id ON admin_audit_log (admin_id);

CREATE TABLE IF NOT EXISTS audit_log (
    id         INTEGER  PRIMARY KEY AUTOINCREMENT,
    user_id    TEXT,
    action     TEXT,
    metadata   TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS inquiries (
    id           TEXT     PRIMARY KEY,
    company      TEXT     NOT NULL,
    email        TEXT     NOT NULL,
    project_type TEXT     NOT NULL DEFAULT 'general',
    message      TEXT,
    status       TEXT     NOT NULL DEFAULT 'pending', -- 'pending' | 'quoted' | 'closed'
    created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_inquiries_status ON inquiries (status);
