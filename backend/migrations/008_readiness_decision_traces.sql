CREATE TABLE IF NOT EXISTS readiness_traces (
    id UUID PRIMARY KEY,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    contractor_id UUID NOT NULL REFERENCES contractors(id) ON DELETE CASCADE,
    compliance_check_id UUID REFERENCES compliance_checks(id) ON DELETE SET NULL,
    engine_version VARCHAR(40) NOT NULL DEFAULT 'readiness-v2',
    score INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(30) NOT NULL,
    explanation TEXT NOT NULL DEFAULT '',
    requirements_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb,
    evidence_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb,
    blockers_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb,
    change_set_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb,
    fingerprint VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_readiness_traces_company_id ON readiness_traces(company_id);
CREATE INDEX IF NOT EXISTS ix_readiness_traces_project_id ON readiness_traces(project_id);
CREATE INDEX IF NOT EXISTS ix_readiness_traces_contractor_id ON readiness_traces(contractor_id);
CREATE INDEX IF NOT EXISTS ix_readiness_traces_compliance_check_id ON readiness_traces(compliance_check_id);
CREATE INDEX IF NOT EXISTS ix_readiness_traces_fingerprint ON readiness_traces(fingerprint);
CREATE INDEX IF NOT EXISTS ix_readiness_traces_created_at ON readiness_traces(created_at);
