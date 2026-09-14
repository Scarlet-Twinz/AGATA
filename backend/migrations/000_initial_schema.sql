-- AGATA baseline schema. All statements are idempotent so existing development
-- databases can be adopted by the tracked migration runner without data loss.

CREATE TABLE IF NOT EXISTS companies (
    id UUID PRIMARY KEY,
    name VARCHAR(160) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(160) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_users_company_id ON users(company_id);
CREATE INDEX IF NOT EXISTS ix_users_email ON users(email);

CREATE TABLE IF NOT EXISTS contractors (
    id UUID PRIMARY KEY,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name VARCHAR(160) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(60),
    status VARCHAR(40) NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_contractors_company_id ON contractors(company_id);

CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name VARCHAR(160) NOT NULL,
    description TEXT,
    status VARCHAR(40) NOT NULL DEFAULT 'active'
);
CREATE INDEX IF NOT EXISTS ix_projects_company_id ON projects(company_id);

CREATE TABLE IF NOT EXISTS requirements (
    id UUID PRIMARY KEY,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name VARCHAR(160) NOT NULL,
    description TEXT
);
CREATE INDEX IF NOT EXISTS ix_requirements_company_id ON requirements(company_id);

CREATE TABLE IF NOT EXISTS project_requirements (
    id UUID PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    requirement_id UUID NOT NULL REFERENCES requirements(id) ON DELETE CASCADE,
    CONSTRAINT uq_project_requirement UNIQUE (project_id, requirement_id)
);
CREATE INDEX IF NOT EXISTS ix_project_requirements_project_id ON project_requirements(project_id);
CREATE INDEX IF NOT EXISTS ix_project_requirements_requirement_id ON project_requirements(requirement_id);

CREATE TABLE IF NOT EXISTS project_contractors (
    id UUID PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    contractor_id UUID NOT NULL REFERENCES contractors(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_project_contractor UNIQUE (project_id, contractor_id)
);
CREATE INDEX IF NOT EXISTS ix_project_contractors_project_id ON project_contractors(project_id);
CREATE INDEX IF NOT EXISTS ix_project_contractors_contractor_id ON project_contractors(contractor_id);

CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    contractor_id UUID REFERENCES contractors(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    document_type VARCHAR(100) NOT NULL,
    expires_at TIMESTAMPTZ,
    storage_key VARCHAR(500),
    status VARCHAR(40) NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_documents_company_id ON documents(company_id);
CREATE INDEX IF NOT EXISTS ix_documents_contractor_id ON documents(contractor_id);
CREATE INDEX IF NOT EXISTS ix_documents_expires_at ON documents(expires_at);

CREATE TABLE IF NOT EXISTS document_requirement_matches (
    id UUID PRIMARY KEY,
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    requirement_id UUID NOT NULL REFERENCES requirements(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_document_requirement_match UNIQUE (document_id, requirement_id)
);
CREATE INDEX IF NOT EXISTS ix_document_requirement_matches_document_id ON document_requirement_matches(document_id);
CREATE INDEX IF NOT EXISTS ix_document_requirement_matches_requirement_id ON document_requirement_matches(requirement_id);

CREATE TABLE IF NOT EXISTS compliance_checks (
    id UUID PRIMARY KEY,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    contractor_id UUID NOT NULL REFERENCES contractors(id) ON DELETE CASCADE,
    score INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(30) NOT NULL DEFAULT 'not_ready',
    explanation TEXT NOT NULL DEFAULT '',
    checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_compliance_checks_company_id ON compliance_checks(company_id);
CREATE INDEX IF NOT EXISTS ix_compliance_checks_project_id ON compliance_checks(project_id);
CREATE INDEX IF NOT EXISTS ix_compliance_checks_contractor_id ON compliance_checks(contractor_id);

CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    source_key VARCHAR(255) NOT NULL,
    kind VARCHAR(50) NOT NULL,
    severity VARCHAR(30) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    href VARCHAR(500) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'active',
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_notification_source UNIQUE (company_id, source_key)
);
CREATE INDEX IF NOT EXISTS ix_notifications_company_id ON notifications(company_id);
CREATE INDEX IF NOT EXISTS ix_notifications_source_key ON notifications(source_key);
CREATE INDEX IF NOT EXISTS ix_notifications_status ON notifications(status);
CREATE INDEX IF NOT EXISTS ix_notifications_created_at ON notifications(created_at);

CREATE TABLE IF NOT EXISTS audit_events (
    id UUID PRIMARY KEY,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(80) NOT NULL,
    entity_type VARCHAR(80) NOT NULL,
    entity_id UUID,
    description TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_audit_events_company_id ON audit_events(company_id);
CREATE INDEX IF NOT EXISTS ix_audit_events_user_id ON audit_events(user_id);
CREATE INDEX IF NOT EXISTS ix_audit_events_action ON audit_events(action);
CREATE INDEX IF NOT EXISTS ix_audit_events_entity_type ON audit_events(entity_type);
CREATE INDEX IF NOT EXISTS ix_audit_events_entity_id ON audit_events(entity_id);
CREATE INDEX IF NOT EXISTS ix_audit_events_created_at ON audit_events(created_at);

CREATE TABLE IF NOT EXISTS workspace_invitations (
    id UUID PRIMARY KEY,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    role VARCHAR(30) NOT NULL DEFAULT 'member',
    token VARCHAR(80) UNIQUE,
    token_hash VARCHAR(64) UNIQUE,
    status VARCHAR(30) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    accepted_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS ix_workspace_invitations_company_id ON workspace_invitations(company_id);
CREATE INDEX IF NOT EXISTS ix_workspace_invitations_email ON workspace_invitations(email);
CREATE INDEX IF NOT EXISTS ix_workspace_invitations_status ON workspace_invitations(status);
CREATE INDEX IF NOT EXISTS ix_workspace_invitations_expires_at ON workspace_invitations(expires_at);

CREATE TABLE IF NOT EXISTS workspace_permissions (
    id UUID PRIMARY KEY,
    key VARCHAR(100) NOT NULL UNIQUE,
    name VARCHAR(120) NOT NULL,
    description VARCHAR(255) NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS ix_workspace_permissions_key ON workspace_permissions(key);

CREATE TABLE IF NOT EXISTS workspace_roles (
    id UUID PRIMARY KEY,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    key VARCHAR(50) NOT NULL,
    name VARCHAR(80) NOT NULL,
    description VARCHAR(255) NOT NULL DEFAULT '',
    is_system BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_workspace_role_key UNIQUE (company_id, key)
);
CREATE INDEX IF NOT EXISTS ix_workspace_roles_company_id ON workspace_roles(company_id);
CREATE INDEX IF NOT EXISTS ix_workspace_roles_key ON workspace_roles(key);

CREATE TABLE IF NOT EXISTS workspace_role_permissions (
    id UUID PRIMARY KEY,
    role_id UUID NOT NULL REFERENCES workspace_roles(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES workspace_permissions(id) ON DELETE CASCADE,
    CONSTRAINT uq_workspace_role_permission UNIQUE (role_id, permission_id)
);
CREATE INDEX IF NOT EXISTS ix_workspace_role_permissions_role_id ON workspace_role_permissions(role_id);
CREATE INDEX IF NOT EXISTS ix_workspace_role_permissions_permission_id ON workspace_role_permissions(permission_id);

CREATE TABLE IF NOT EXISTS workspace_memberships (
    id UUID PRIMARY KEY,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES workspace_roles(id) ON DELETE RESTRICT,
    status VARCHAR(30) NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_workspace_membership UNIQUE (company_id, user_id)
);
CREATE INDEX IF NOT EXISTS ix_workspace_memberships_company_id ON workspace_memberships(company_id);
CREATE INDEX IF NOT EXISTS ix_workspace_memberships_user_id ON workspace_memberships(user_id);
CREATE INDEX IF NOT EXISTS ix_workspace_memberships_role_id ON workspace_memberships(role_id);
CREATE INDEX IF NOT EXISTS ix_workspace_memberships_status ON workspace_memberships(status);

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
CREATE INDEX IF NOT EXISTS ix_rumi_messages_role ON rumi_messages(role);
CREATE INDEX IF NOT EXISTS ix_rumi_messages_created_at ON rumi_messages(created_at);
