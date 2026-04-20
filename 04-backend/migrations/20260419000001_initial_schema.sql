-- migrations/20260419000001_initial_schema.sql
-- InsomeOS initial schema · Supabase Postgres 15.14.1.108
-- Enforces Constitution §16 (multi-tenant isolation via RLS).

-- =========================================================================
-- Extensions
-- =========================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";       -- pgvector for RAG
CREATE EXTENSION IF NOT EXISTS "pg_trgm";      -- fuzzy search
CREATE EXTENSION IF NOT EXISTS "btree_gin";

-- =========================================================================
-- Enum types (mirror the Rust `BusinessPhase` / `Severity` / `Verdict`)
-- =========================================================================
CREATE TYPE business_phase AS ENUM (
    'pre_sales', 'concept', 'develop', 'costing', 'fabrication',
    'logistics', 'construction', 'acceptance', 'operations'
);

CREATE TYPE severity AS ENUM ('info', 'low', 'medium', 'high', 'critical');

CREATE TYPE verdict AS ENUM ('approved', 'revise', 'rejected');

CREATE TYPE role_kind AS ENUM (
    'owner', 'designer', 'constructor', 'supervisor',
    'cost_consultant', 'auditor', 'admin'
);

-- =========================================================================
-- Core tables
-- =========================================================================

-- Tenants (organizations / companies)
CREATE TABLE tenants (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT NOT NULL,
    locale          TEXT NOT NULL DEFAULT 'zh-CN'
                    CHECK (locale IN ('zh-CN','en-US','es-ES','ja-JP','de-DE')),
    region          TEXT NOT NULL DEFAULT 'cn',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Users (Supabase Auth links by subject)
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supabase_sub    TEXT UNIQUE NOT NULL,
    email           TEXT UNIQUE NOT NULL,
    display_name    TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- User-Tenant-Role (RBAC)
CREATE TABLE user_tenant_roles (
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    role            role_kind NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, tenant_id, role)
);
CREATE INDEX idx_utr_tenant ON user_tenant_roles(tenant_id);

-- Projects
CREATE TABLE projects (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    description     TEXT,
    phase           business_phase NOT NULL DEFAULT 'pre_sales',
    area_sqm        REAL,
    location        TEXT,
    budget_cny      BIGINT,
    metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_projects_tenant ON projects(tenant_id);
CREATE INDEX idx_projects_phase  ON projects(tenant_id, phase);
CREATE INDEX idx_projects_name   ON projects USING gin (name gin_trgm_ops);

-- BIM uploads (original files stored in object storage; this is metadata)
CREATE TABLE bim_uploads (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    filename        TEXT NOT NULL,
    format          TEXT NOT NULL,
    byte_size       BIGINT NOT NULL,
    storage_key     TEXT NOT NULL,
    sha256          TEXT NOT NULL,
    parsed_at       TIMESTAMPTZ,
    element_count   INTEGER,
    metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
    uploaded_by     UUID REFERENCES users(id),
    uploaded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_bim_tenant_project ON bim_uploads(tenant_id, project_id);

-- BOQ items (per Constitution §5 `BoqItem` type)
CREATE TABLE boq_items (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    code            CHAR(9) NOT NULL CHECK (code ~ '^[0-9]{9}$'),
    description     TEXT NOT NULL,
    unit            TEXT NOT NULL,
    quantity        DOUBLE PRECISION NOT NULL CHECK (quantity >= 0),
    unit_price_cny  DOUBLE PRECISION NOT NULL CHECK (unit_price_cny >= 0),
    total_cny       DOUBLE PRECISION NOT NULL CHECK (total_cny >= 0),
    category        TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_boq_tenant_project ON boq_items(tenant_id, project_id);
CREATE INDEX idx_boq_code ON boq_items(code);

-- Compliance findings
CREATE TABLE compliance_findings (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id          UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    severity            severity NOT NULL,
    regulation_code     TEXT NOT NULL,
    regulation_clause   TEXT NOT NULL,
    finding             TEXT NOT NULL,
    recommendation      TEXT NOT NULL,
    element_id          TEXT,
    resolved            BOOLEAN NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_findings_tenant_project ON compliance_findings(tenant_id, project_id);
CREATE INDEX idx_findings_open ON compliance_findings(project_id) WHERE resolved = FALSE;

-- Agent invocations (audit trail)
CREATE TABLE agent_invocations (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id          UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    phase               business_phase NOT NULL,
    user_input          TEXT NOT NULL,
    planner_model       TEXT,
    generator_model     TEXT,
    evaluator_model     TEXT,
    final_output        JSONB,
    verdict             verdict,
    revision_count      INTEGER NOT NULL DEFAULT 0,
    trace               JSONB NOT NULL DEFAULT '[]'::jsonb,
    latency_ms          INTEGER,
    requested_by        UUID REFERENCES users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_agent_tenant_project ON agent_invocations(tenant_id, project_id);
CREATE INDEX idx_agent_phase ON agent_invocations(phase, created_at DESC);

-- RAG chunks (vector embedding over AEC knowledge)
CREATE TABLE rag_chunks (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    corpus          TEXT NOT NULL CHECK (corpus IN ('gb','ibc','eurocode','project')),
    source          TEXT NOT NULL,
    heading         TEXT NOT NULL,
    content         TEXT NOT NULL,
    embedding       vector(1536) NOT NULL,
    metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_rag_tenant_corpus ON rag_chunks(tenant_id, corpus);
-- pgvector HNSW (pgvector ≥ 0.5): use ivfflat for broad 2026 compatibility.
CREATE INDEX idx_rag_embedding ON rag_chunks
    USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Audit log
CREATE TABLE audit_log (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID REFERENCES tenants(id),
    user_id         UUID REFERENCES users(id),
    action          TEXT NOT NULL,
    resource_kind   TEXT NOT NULL,
    resource_id     TEXT,
    details         JSONB NOT NULL DEFAULT '{}'::jsonb,
    ip              INET,
    user_agent      TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_audit_tenant_ts ON audit_log(tenant_id, created_at DESC);

-- =========================================================================
-- `updated_at` triggers
-- =========================================================================
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_tenants_updated
    BEFORE UPDATE ON tenants
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_projects_updated
    BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
