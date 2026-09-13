CREATE TABLE IF NOT EXISTS readiness_decisions (
    id UUID PRIMARY KEY,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    contractor_id UUID NOT NULL REFERENCES contractors(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    decided_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    decided_at TIMESTAMPTZ,
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_readiness_decision_assignment UNIQUE (project_id, contractor_id)
);

CREATE INDEX IF NOT EXISTS ix_readiness_decisions_company_id ON readiness_decisions(company_id);
CREATE INDEX IF NOT EXISTS ix_readiness_decisions_project_id ON readiness_decisions(project_id);
CREATE INDEX IF NOT EXISTS ix_readiness_decisions_contractor_id ON readiness_decisions(contractor_id);
CREATE INDEX IF NOT EXISTS ix_readiness_decisions_decided_by_user_id ON readiness_decisions(decided_by_user_id);
