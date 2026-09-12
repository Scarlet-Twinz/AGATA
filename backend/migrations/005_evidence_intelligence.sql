CREATE TABLE IF NOT EXISTS evidence_intelligence (
    id UUID PRIMARY KEY,
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    owner_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    verification_status VARCHAR(30) NOT NULL DEFAULT 'unverified',
    review_status VARCHAR(30) NOT NULL DEFAULT 'pending',
    source_type VARCHAR(30) NOT NULL DEFAULT 'manual',
    confidence INTEGER,
    issue_date TIMESTAMPTZ,
    rejection_reason TEXT,
    reviewed_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_evidence_intelligence_document UNIQUE (document_id),
    CONSTRAINT ck_evidence_intelligence_confidence CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 100))
);

CREATE INDEX IF NOT EXISTS ix_evidence_intelligence_document_id ON evidence_intelligence(document_id);
CREATE INDEX IF NOT EXISTS ix_evidence_intelligence_owner_user_id ON evidence_intelligence(owner_user_id);
CREATE INDEX IF NOT EXISTS ix_evidence_intelligence_reviewed_by_user_id ON evidence_intelligence(reviewed_by_user_id);
CREATE INDEX IF NOT EXISTS ix_evidence_intelligence_updated_at ON evidence_intelligence(updated_at);
