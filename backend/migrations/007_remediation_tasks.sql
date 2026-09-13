CREATE TABLE IF NOT EXISTS remediation_tasks (
    id UUID PRIMARY KEY,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    contractor_id UUID NOT NULL REFERENCES contractors(id) ON DELETE CASCADE,
    requirement_id UUID REFERENCES requirements(id) ON DELETE SET NULL,
    assigned_to_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    priority VARCHAR(20) NOT NULL DEFAULT 'medium',
    status VARCHAR(20) NOT NULL DEFAULT 'open',
    source_key VARCHAR(255) NOT NULL,
    due_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_remediation_company_source UNIQUE (company_id, source_key)
);

CREATE INDEX IF NOT EXISTS ix_remediation_tasks_company_id ON remediation_tasks(company_id);
CREATE INDEX IF NOT EXISTS ix_remediation_tasks_project_id ON remediation_tasks(project_id);
CREATE INDEX IF NOT EXISTS ix_remediation_tasks_contractor_id ON remediation_tasks(contractor_id);
CREATE INDEX IF NOT EXISTS ix_remediation_tasks_requirement_id ON remediation_tasks(requirement_id);
CREATE INDEX IF NOT EXISTS ix_remediation_tasks_assigned_to_user_id ON remediation_tasks(assigned_to_user_id);
CREATE INDEX IF NOT EXISTS ix_remediation_tasks_status ON remediation_tasks(status);
