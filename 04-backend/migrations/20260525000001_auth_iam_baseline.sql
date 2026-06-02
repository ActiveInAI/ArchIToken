-- 04-backend/migrations/20260525000001_auth_iam_baseline.sql
-- ArchIToken clean Auth/IAM baseline.
-- Scope: internal account/password sessions, personnel profiles, job-title registry,
-- role templates, fine-grained permissions, role bindings, and relationship tuples.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE OR REPLACE FUNCTION current_tenant() RETURNS UUID AS $$
DECLARE
    t TEXT;
BEGIN
    BEGIN
        t := current_setting('app.current_tenant', true);
    EXCEPTION WHEN OTHERS THEN
        RETURN NULL;
    END;
    IF t IS NULL OR t = '' THEN RETURN NULL; END IF;
    RETURN t::UUID;
END
$$ LANGUAGE plpgsql STABLE;

CREATE TABLE IF NOT EXISTS auth_accounts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    primary_email   TEXT,
    primary_phone   TEXT,
    primary_oauth_provider TEXT,
    primary_oauth_subject  TEXT,
    status          TEXT NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'pending_verification', 'locked', 'disabled')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT auth_accounts_contact_or_oauth_check
        CHECK (
            primary_email IS NOT NULL
            OR primary_phone IS NOT NULL
            OR (primary_oauth_provider IS NOT NULL AND primary_oauth_subject IS NOT NULL)
        )
);

ALTER TABLE auth_accounts
    ADD COLUMN IF NOT EXISTS primary_oauth_provider TEXT;
ALTER TABLE auth_accounts
    ADD COLUMN IF NOT EXISTS primary_oauth_subject TEXT;
ALTER TABLE auth_accounts
    DROP CONSTRAINT IF EXISTS auth_accounts_check;
ALTER TABLE auth_accounts
    DROP CONSTRAINT IF EXISTS auth_accounts_contact_or_oauth_check;
ALTER TABLE auth_accounts
    ADD CONSTRAINT auth_accounts_contact_or_oauth_check
    CHECK (
        primary_email IS NOT NULL
        OR primary_phone IS NOT NULL
        OR (primary_oauth_provider IS NOT NULL AND primary_oauth_subject IS NOT NULL)
    );

CREATE UNIQUE INDEX IF NOT EXISTS idx_auth_accounts_email_unique
    ON auth_accounts (lower(primary_email))
    WHERE primary_email IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_auth_accounts_phone_unique
    ON auth_accounts (primary_phone)
    WHERE primary_phone IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_auth_accounts_primary_oauth_unique
    ON auth_accounts (primary_oauth_provider, primary_oauth_subject)
    WHERE primary_oauth_provider IS NOT NULL AND primary_oauth_subject IS NOT NULL;

CREATE TABLE IF NOT EXISTS auth_password_credentials (
    account_id          UUID PRIMARY KEY REFERENCES auth_accounts(id) ON DELETE CASCADE,
    password_hash       TEXT NOT NULL,
    algorithm           TEXT NOT NULL DEFAULT 'argon2id',
    params              JSONB NOT NULL DEFAULT '{}'::jsonb,
    password_changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS auth_verification_codes (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel         TEXT NOT NULL CHECK (channel IN ('email', 'phone')),
    destination     TEXT NOT NULL,
    purpose         TEXT NOT NULL CHECK (purpose IN ('register', 'login', 'reset_password')),
    code_hash       TEXT NOT NULL,
    attempts        INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
    expires_at      TIMESTAMPTZ NOT NULL,
    consumed_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata        JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_auth_verification_lookup
    ON auth_verification_codes(channel, destination, purpose, created_at DESC);

CREATE TABLE IF NOT EXISTS auth_sessions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id      UUID NOT NULL REFERENCES auth_accounts(id) ON DELETE CASCADE,
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    person_id       UUID,
    token_hash      TEXT NOT NULL UNIQUE,
    issued_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at      TIMESTAMPTZ NOT NULL,
    revoked_at      TIMESTAMPTZ,
    last_seen_at    TIMESTAMPTZ,
    user_agent      TEXT,
    ip_fingerprint  TEXT,
    metadata        JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_account
    ON auth_sessions(account_id, expires_at DESC);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_tenant
    ON auth_sessions(tenant_id, expires_at DESC);

CREATE TABLE IF NOT EXISTS auth_account_tenants (
    account_id      UUID NOT NULL REFERENCES auth_accounts(id) ON DELETE CASCADE,
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    person_id       UUID,
    status          TEXT NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'suspended', 'left')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (account_id, tenant_id)
);
CREATE INDEX IF NOT EXISTS idx_auth_account_tenants_tenant
    ON auth_account_tenants(tenant_id, status);

CREATE TABLE IF NOT EXISTS auth_oauth_states (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider        TEXT NOT NULL,
    state_hash      TEXT NOT NULL UNIQUE,
    account_type    TEXT NOT NULL DEFAULT 'personal'
                    CHECK (account_type IN ('personal', 'enterprise')),
    return_to       TEXT NOT NULL DEFAULT '/app/modules',
    code_verifier   TEXT,
    expires_at      TIMESTAMPTZ NOT NULL,
    consumed_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata        JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_auth_oauth_states_lookup
    ON auth_oauth_states(provider, expires_at DESC);

CREATE TABLE IF NOT EXISTS auth_oauth_identities (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider            TEXT NOT NULL,
    provider_subject    TEXT NOT NULL,
    account_id          UUID NOT NULL REFERENCES auth_accounts(id) ON DELETE CASCADE,
    email               TEXT,
    phone               TEXT,
    display_name        TEXT,
    avatar_url          TEXT,
    raw_profile         JSONB NOT NULL DEFAULT '{}'::jsonb,
    last_login_at       TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (provider, provider_subject)
);
CREATE INDEX IF NOT EXISTS idx_auth_oauth_identities_account
    ON auth_oauth_identities(account_id, provider);

CREATE TABLE IF NOT EXISTS iam_org_units (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    parent_id       UUID REFERENCES iam_org_units(id) ON DELETE SET NULL,
    unit_code       TEXT,
    name            TEXT NOT NULL,
    unit_type       TEXT NOT NULL DEFAULT 'department',
    status          TEXT NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'disabled')),
    sort_order      INTEGER NOT NULL DEFAULT 100,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, unit_code)
);

CREATE TABLE IF NOT EXISTS iam_person_profiles (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    account_id          UUID REFERENCES auth_accounts(id) ON DELETE SET NULL,
    org_unit_id         UUID REFERENCES iam_org_units(id) ON DELETE SET NULL,
    full_name           TEXT NOT NULL,
    display_name        TEXT,
    primary_phone       TEXT,
    primary_email       TEXT,
    employment_status   TEXT NOT NULL DEFAULT 'active'
                        CHECK (employment_status IN ('active', 'suspended', 'left')),
    credential_summary  JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_iam_person_profiles_tenant
    ON iam_person_profiles(tenant_id, employment_status, full_name);
CREATE UNIQUE INDEX IF NOT EXISTS idx_iam_person_profiles_account_tenant
    ON iam_person_profiles(tenant_id, account_id)
    WHERE account_id IS NOT NULL;

ALTER TABLE auth_sessions
    DROP CONSTRAINT IF EXISTS auth_sessions_person_id_fkey;
ALTER TABLE auth_sessions
    ADD CONSTRAINT auth_sessions_person_id_fkey
    FOREIGN KEY (person_id) REFERENCES iam_person_profiles(id) ON DELETE SET NULL;

ALTER TABLE auth_account_tenants
    DROP CONSTRAINT IF EXISTS auth_account_tenants_person_id_fkey;
ALTER TABLE auth_account_tenants
    ADD CONSTRAINT auth_account_tenants_person_id_fkey
    FOREIGN KEY (person_id) REFERENCES iam_person_profiles(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS auth_qr_login_challenges (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scan_token_hash     TEXT NOT NULL UNIQUE,
    poll_token_hash     TEXT NOT NULL UNIQUE,
    status              TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'scanned', 'approved', 'consumed', 'canceled', 'expired')),
    account_id          UUID REFERENCES auth_accounts(id) ON DELETE SET NULL,
    tenant_id           UUID REFERENCES tenants(id) ON DELETE SET NULL,
    person_id           UUID REFERENCES iam_person_profiles(id) ON DELETE SET NULL,
    account_type        TEXT NOT NULL DEFAULT 'personal'
                        CHECK (account_type IN ('personal', 'enterprise')),
    return_to           TEXT NOT NULL DEFAULT '/app/modules',
    expires_at          TIMESTAMPTZ NOT NULL,
    scanned_at          TIMESTAMPTZ,
    approved_at         TIMESTAMPTZ,
    consumed_at         TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata            JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_auth_qr_login_challenges_status
    ON auth_qr_login_challenges(status, expires_at DESC);

CREATE TABLE IF NOT EXISTS iam_job_titles (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID REFERENCES tenants(id) ON DELETE CASCADE,
    code            TEXT NOT NULL,
    name            TEXT NOT NULL,
    category        TEXT NOT NULL DEFAULT 'project',
    default_scope   TEXT NOT NULL DEFAULT 'tenant',
    is_system       BOOLEAN NOT NULL DEFAULT FALSE,
    sort_order      INTEGER NOT NULL DEFAULT 100,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, code),
    UNIQUE (tenant_id, name)
);
CREATE INDEX IF NOT EXISTS idx_iam_job_titles_lookup
    ON iam_job_titles(tenant_id, category, sort_order, name);
CREATE UNIQUE INDEX IF NOT EXISTS idx_iam_job_titles_global_code_unique
    ON iam_job_titles(code)
    WHERE tenant_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_iam_job_titles_global_name_unique
    ON iam_job_titles(name)
    WHERE tenant_id IS NULL;

ALTER TABLE iam_job_titles DISABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS iam_person_job_assignments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    person_id       UUID NOT NULL REFERENCES iam_person_profiles(id) ON DELETE CASCADE,
    job_title_id    UUID NOT NULL REFERENCES iam_job_titles(id) ON DELETE RESTRICT,
    project_id      UUID REFERENCES projects(id) ON DELETE CASCADE,
    is_primary      BOOLEAN NOT NULL DEFAULT FALSE,
    starts_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ends_at         TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_iam_person_job_assignments_person
    ON iam_person_job_assignments(tenant_id, person_id, is_primary DESC);

CREATE TABLE IF NOT EXISTS iam_permissions (
    id              TEXT PRIMARY KEY,
    category        TEXT NOT NULL,
    action          TEXT NOT NULL,
    resource_type   TEXT NOT NULL,
    description     TEXT NOT NULL,
    risk_level      TEXT NOT NULL DEFAULT 'normal'
                    CHECK (risk_level IN ('low', 'normal', 'high', 'critical')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS iam_roles (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    role_key        TEXT NOT NULL,
    name            TEXT NOT NULL,
    description     TEXT,
    runtime_role    TEXT NOT NULL DEFAULT 'auditor'
                    CHECK (runtime_role IN ('admin', 'engineer', 'reviewer', 'auditor')),
    role_type       TEXT NOT NULL DEFAULT 'tenant'
                    CHECK (role_type IN ('tenant', 'project', 'system')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, role_key)
);

CREATE TABLE IF NOT EXISTS iam_role_permissions (
    role_id         UUID NOT NULL REFERENCES iam_roles(id) ON DELETE CASCADE,
    permission_id   TEXT NOT NULL REFERENCES iam_permissions(id) ON DELETE CASCADE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS iam_role_bindings (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    role_id         UUID NOT NULL REFERENCES iam_roles(id) ON DELETE CASCADE,
    principal_type  TEXT NOT NULL CHECK (principal_type IN ('account', 'person', 'org_unit')),
    principal_id    UUID NOT NULL,
    resource_type   TEXT NOT NULL DEFAULT 'tenant',
    resource_id     UUID,
    starts_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at      TIMESTAMPTZ,
    granted_by      UUID,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_iam_role_bindings_principal
    ON iam_role_bindings(tenant_id, principal_type, principal_id);
CREATE INDEX IF NOT EXISTS idx_iam_role_bindings_resource
    ON iam_role_bindings(tenant_id, resource_type, resource_id);

CREATE TABLE IF NOT EXISTS iam_relationship_tuples (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    subject_type    TEXT NOT NULL,
    subject_id      UUID NOT NULL,
    relation        TEXT NOT NULL,
    object_type     TEXT NOT NULL,
    object_id       UUID NOT NULL,
    condition       JSONB NOT NULL DEFAULT '{}'::jsonb,
    expires_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, subject_type, subject_id, relation, object_type, object_id)
);
CREATE INDEX IF NOT EXISTS idx_iam_relationship_object
    ON iam_relationship_tuples(tenant_id, object_type, object_id, relation);

INSERT INTO iam_permissions (id, category, action, resource_type, description, risk_level) VALUES
    ('tenant.read', 'tenant', 'read', 'tenant', '查看企业与组织基础信息', 'normal'),
    ('tenant.admin', 'tenant', 'admin', 'tenant', '管理企业、人员、角色与安全策略', 'critical'),
    ('project.read', 'project', 'read', 'project', '查看项目基础信息', 'normal'),
    ('project.manage', 'project', 'manage', 'project', '管理项目计划、成员与执行状态', 'high'),
    ('finance.read', 'finance', 'read', 'contract_cost_payment', '查看合同、成本、付款与发票', 'high'),
    ('finance.approve', 'finance', 'approve', 'contract_cost_payment', '审批付款、合同、发票与成本事项', 'critical'),
    ('bim.read', 'bim', 'read', 'bim_model', '查看 BIM/CDE 模型与构件数据', 'normal'),
    ('bim.write', 'bim', 'write', 'bim_model', '上传、编辑、转换 BIM/CDE 模型与构件数据', 'high'),
    ('design.write', 'design', 'write', 'design_artifact', '创建设计、方案、深化图与工艺成果', 'high'),
    ('cost.write', 'cost', 'write', 'quantity_costing', '创建工程量、清单、预算与变更估算', 'high'),
    ('material.write', 'material', 'write', 'material_logistics', '管理材料、库存、采购、物流与签收', 'high'),
    ('safety.write', 'safety', 'write', 'safety_quality', '管理安全、质量、隐患和整改闭环', 'high'),
    ('archive.write', 'archive', 'write', 'digital_archive', '归档、收发文、版本和竣工资料管理', 'high'),
    ('ai.invoke', 'ai', 'invoke', 'ai_tool', '调用已授权 AI 工具和 Agent', 'high'),
    ('audit.read', 'audit', 'read', 'audit_event', '查看审计日志和操作证据', 'high')
ON CONFLICT (id) DO NOTHING;

INSERT INTO iam_job_titles (tenant_id, code, name, category, default_scope, is_system, sort_order) VALUES
    (NULL, 'chairperson', '董事长', 'executive', 'tenant', TRUE, 10),
    (NULL, 'executive_general_manager', '执行总经理', 'executive', 'tenant', TRUE, 20),
    (NULL, 'finance_director', '财务总监', 'finance', 'tenant', TRUE, 30),
    (NULL, 'project_director', '项目总监', 'project', 'tenant', TRUE, 40),
    (NULL, 'project_manager', '项目经理', 'project', 'project', TRUE, 50),
    (NULL, 'production_manager', '生产经理', 'production', 'project', TRUE, 60),
    (NULL, 'bim_engineer', 'BIM工程师', 'design', 'project', TRUE, 70),
    (NULL, 'concept_designer', '方案设计师', 'design', 'project', TRUE, 80),
    (NULL, 'detailed_designer', '深化设计师', 'design', 'project', TRUE, 90),
    (NULL, 'process_engineer', '工艺工程师', 'production', 'project', TRUE, 100),
    (NULL, 'cost_engineer', '造价工程师', 'cost', 'project', TRUE, 110),
    (NULL, 'material_engineer', '材料工程师', 'material', 'project', TRUE, 120),
    (NULL, 'logistics_engineer', '物流工程师', 'logistics', 'project', TRUE, 130),
    (NULL, 'safety_engineer', '安全工程师', 'safety', 'project', TRUE, 140),
    (NULL, 'construction_worker_manager', '施工员', 'construction', 'project', TRUE, 150),
    (NULL, 'supervisor', '监理员', 'supervision', 'project', TRUE, 160),
    (NULL, 'cost_clerk', '造价员', 'cost', 'project', TRUE, 170),
    (NULL, 'safety_clerk', '安全员', 'safety', 'project', TRUE, 180),
    (NULL, 'document_controller', '资料员', 'archive', 'project', TRUE, 190)
ON CONFLICT DO NOTHING;

ALTER TABLE iam_org_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE iam_person_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE iam_job_titles ENABLE ROW LEVEL SECURITY;
ALTER TABLE iam_person_job_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE iam_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE iam_role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE iam_role_bindings ENABLE ROW LEVEL SECURITY;
ALTER TABLE iam_relationship_tuples ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS iam_org_units_tenant ON iam_org_units;
CREATE POLICY iam_org_units_tenant ON iam_org_units
    USING (tenant_id = current_tenant())
    WITH CHECK (tenant_id = current_tenant());

DROP POLICY IF EXISTS iam_person_profiles_tenant ON iam_person_profiles;
CREATE POLICY iam_person_profiles_tenant ON iam_person_profiles
    USING (tenant_id = current_tenant())
    WITH CHECK (tenant_id = current_tenant());

DROP POLICY IF EXISTS iam_job_titles_read ON iam_job_titles;
CREATE POLICY iam_job_titles_read ON iam_job_titles
    FOR SELECT
    USING (tenant_id IS NULL OR tenant_id = current_tenant());

DROP POLICY IF EXISTS iam_job_titles_write ON iam_job_titles;
CREATE POLICY iam_job_titles_write ON iam_job_titles
    FOR ALL
    USING (tenant_id = current_tenant())
    WITH CHECK (tenant_id = current_tenant());

DROP POLICY IF EXISTS iam_person_job_assignments_tenant ON iam_person_job_assignments;
CREATE POLICY iam_person_job_assignments_tenant ON iam_person_job_assignments
    USING (tenant_id = current_tenant())
    WITH CHECK (tenant_id = current_tenant());

DROP POLICY IF EXISTS iam_roles_tenant ON iam_roles;
CREATE POLICY iam_roles_tenant ON iam_roles
    USING (tenant_id = current_tenant())
    WITH CHECK (tenant_id = current_tenant());

DROP POLICY IF EXISTS iam_role_permissions_tenant ON iam_role_permissions;
CREATE POLICY iam_role_permissions_tenant ON iam_role_permissions
    USING (
        EXISTS (
            SELECT 1 FROM iam_roles r
            WHERE r.id = role_id AND r.tenant_id = current_tenant()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM iam_roles r
            WHERE r.id = role_id AND r.tenant_id = current_tenant()
        )
    );

DROP POLICY IF EXISTS iam_role_bindings_tenant ON iam_role_bindings;
CREATE POLICY iam_role_bindings_tenant ON iam_role_bindings
    USING (tenant_id = current_tenant())
    WITH CHECK (tenant_id = current_tenant());

DROP POLICY IF EXISTS iam_relationship_tuples_tenant ON iam_relationship_tuples;
CREATE POLICY iam_relationship_tuples_tenant ON iam_relationship_tuples
    USING (tenant_id = current_tenant())
    WITH CHECK (tenant_id = current_tenant());

ALTER TABLE iam_org_units FORCE ROW LEVEL SECURITY;
ALTER TABLE iam_person_profiles FORCE ROW LEVEL SECURITY;
ALTER TABLE iam_job_titles FORCE ROW LEVEL SECURITY;
ALTER TABLE iam_person_job_assignments FORCE ROW LEVEL SECURITY;
ALTER TABLE iam_roles FORCE ROW LEVEL SECURITY;
ALTER TABLE iam_role_permissions FORCE ROW LEVEL SECURITY;
ALTER TABLE iam_role_bindings FORCE ROW LEVEL SECURITY;
ALTER TABLE iam_relationship_tuples FORCE ROW LEVEL SECURITY;
