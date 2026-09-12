-- Secure invitation lifecycle fields. Existing raw tokens remain nullable
-- for backward compatibility with development records; new invitations use
-- token_hash and expiration/acceptance timestamps.
ALTER TABLE workspace_invitations
    ADD COLUMN IF NOT EXISTS token_hash VARCHAR(64);

ALTER TABLE workspace_invitations
    ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

ALTER TABLE workspace_invitations
    ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ;

-- Legacy databases created before secure invitation tokens may still have
-- the raw token column marked NOT NULL. Secure invitations deliberately do
-- not persist raw tokens, so the legacy column must be nullable.
ALTER TABLE workspace_invitations
    ALTER COLUMN token DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_workspace_invitations_token_hash
    ON workspace_invitations (token_hash)
    WHERE token_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_workspace_invitations_expires_at
    ON workspace_invitations (expires_at);
