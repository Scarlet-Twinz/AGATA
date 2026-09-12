-- AGATA Level 2A: persistent authentication security state.
-- Run this migration against an existing production PostgreSQL database before
-- enabling verified-email/password-recovery enforcement there.

CREATE TABLE IF NOT EXISTS user_security (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    email_verified_at TIMESTAMPTZ NULL,
    password_changed_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS auth_tokens (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    token_type VARCHAR(40) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS ix_auth_tokens_user_id ON auth_tokens(user_id);
CREATE INDEX IF NOT EXISTS ix_auth_tokens_token_hash ON auth_tokens(token_hash);
CREATE INDEX IF NOT EXISTS ix_auth_tokens_token_type ON auth_tokens(token_type);
CREATE INDEX IF NOT EXISTS ix_auth_tokens_expires_at ON auth_tokens(expires_at);

-- Existing accounts predate email verification. They remain usable until an
-- explicit verification policy is applied; new signups create UserSecurity
-- rows with email_verified_at unset.
INSERT INTO user_security (user_id, email_verified_at)
SELECT id, created_at
FROM users
WHERE NOT EXISTS (SELECT 1 FROM user_security us WHERE us.user_id = users.id);
