CREATE TABLE IF NOT EXISTS rumi_conversations (
    id UUID PRIMARY KEY,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(160) NOT NULL DEFAULT 'New conversation',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_rumi_conversations_company_id ON rumi_conversations(company_id);
CREATE INDEX IF NOT EXISTS ix_rumi_conversations_user_id ON rumi_conversations(user_id);
CREATE INDEX IF NOT EXISTS ix_rumi_conversations_updated_at ON rumi_conversations(updated_at);

CREATE TABLE IF NOT EXISTS rumi_messages (
    id UUID PRIMARY KEY,
    conversation_id UUID NOT NULL REFERENCES rumi_conversations(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_rumi_messages_conversation_id ON rumi_messages(conversation_id);
CREATE INDEX IF NOT EXISTS ix_rumi_messages_created_at ON rumi_messages(created_at);
