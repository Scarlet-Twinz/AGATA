-- AGATA Level 2A: account security and session persistence.
-- Run after the Level 2A workspace RBAC schema exists.
-- This migration is intentionally explicit; production deployments should run migrations before starting the API.

CREATE TABLE IF NOT EXISTS user_security_states (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    email_verified_at TIMESTAMPTZ NULL,
    password_changed_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    token_jti VARCHAR(64) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS ix_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS ix_user_sessions_company_id ON user_sessions(company_id);
CREATE INDEX IF NOT EXISTS ix_user_sessions_expires_at ON user_sessions(expires_at);
CREATE INDEX IF NOT EXISTS ix_user_sessions_revoked_at ON user_sessions(revoked_at);
CREATE UNIQUE INDEX IF NOT EXISTS ix_user_sessions_token_jti ON user_sessions(token_jti);
