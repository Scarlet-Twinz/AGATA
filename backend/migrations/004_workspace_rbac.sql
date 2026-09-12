-- AGATA Level 2A: persistent workspace roles, permissions and memberships.
-- Run this migration against an existing PostgreSQL database before enabling
-- persistent RBAC enforcement in a production environment.

CREATE TABLE IF NOT EXISTS workspace_permissions (
    id UUID PRIMARY KEY,
    key VARCHAR(100) NOT NULL UNIQUE,
    name VARCHAR(120) NOT NULL,
    description VARCHAR(255) NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS workspace_roles (
    id UUID PRIMARY KEY,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    key VARCHAR(50) NOT NULL,
    name VARCHAR(80) NOT NULL,
    description VARCHAR(255) NOT NULL DEFAULT '',
    is_system BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_workspace_role_key UNIQUE (company_id, key)
);

CREATE TABLE IF NOT EXISTS workspace_role_permissions (
    id UUID PRIMARY KEY,
    role_id UUID NOT NULL REFERENCES workspace_roles(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES workspace_permissions(id) ON DELETE CASCADE,
    CONSTRAINT uq_workspace_role_permission UNIQUE (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS workspace_memberships (
    id UUID PRIMARY KEY,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES workspace_roles(id) ON DELETE RESTRICT,
    status VARCHAR(30) NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_workspace_membership UNIQUE (company_id, user_id)
);

CREATE INDEX IF NOT EXISTS ix_workspace_permissions_key ON workspace_permissions(key);
CREATE INDEX IF NOT EXISTS ix_workspace_roles_company_id ON workspace_roles(company_id);
CREATE INDEX IF NOT EXISTS ix_workspace_roles_key ON workspace_roles(key);
CREATE INDEX IF NOT EXISTS ix_workspace_role_permissions_role_id ON workspace_role_permissions(role_id);
CREATE INDEX IF NOT EXISTS ix_workspace_role_permissions_permission_id ON workspace_role_permissions(permission_id);
CREATE INDEX IF NOT EXISTS ix_workspace_memberships_company_id ON workspace_memberships(company_id);
CREATE INDEX IF NOT EXISTS ix_workspace_memberships_user_id ON workspace_memberships(user_id);
CREATE INDEX IF NOT EXISTS ix_workspace_memberships_role_id ON workspace_memberships(role_id);
CREATE INDEX IF NOT EXISTS ix_workspace_memberships_status ON workspace_memberships(status);
