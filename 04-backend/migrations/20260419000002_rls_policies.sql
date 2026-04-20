-- migrations/20260419000002_rls_policies.sql
-- Row Level Security · Constitution §16 (hard multi-tenant isolation)
--
-- The session variable `app.current_tenant` is set by the Gateway on every
-- connection via `SET LOCAL app.current_tenant = '<uuid>'` before running
-- any SQL. If absent, every policy denies.

-- =========================================================================
-- Enable RLS on every tenant-scoped table
-- =========================================================================
ALTER TABLE projects              ENABLE ROW LEVEL SECURITY;
ALTER TABLE bim_uploads           ENABLE ROW LEVEL SECURITY;
ALTER TABLE boq_items             ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_findings   ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_invocations     ENABLE ROW LEVEL SECURITY;
ALTER TABLE rag_chunks            ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_tenant_roles     ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log             ENABLE ROW LEVEL SECURITY;

-- Deny-by-default: policies below are the ONLY way to see rows.

-- =========================================================================
-- Helper function
-- =========================================================================
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

-- =========================================================================
-- Policies
-- =========================================================================

-- Projects ---------------------------------------------------------
CREATE POLICY projects_tenant_isolation ON projects
    USING (tenant_id = current_tenant())
    WITH CHECK (tenant_id = current_tenant());

-- BIM uploads ------------------------------------------------------
CREATE POLICY bim_uploads_tenant_isolation ON bim_uploads
    USING (tenant_id = current_tenant())
    WITH CHECK (tenant_id = current_tenant());

-- BOQ items --------------------------------------------------------
CREATE POLICY boq_tenant_isolation ON boq_items
    USING (tenant_id = current_tenant())
    WITH CHECK (tenant_id = current_tenant());

-- Compliance findings ---------------------------------------------
CREATE POLICY compliance_tenant_isolation ON compliance_findings
    USING (tenant_id = current_tenant())
    WITH CHECK (tenant_id = current_tenant());

-- Agent invocations -----------------------------------------------
CREATE POLICY agent_tenant_isolation ON agent_invocations
    USING (tenant_id = current_tenant())
    WITH CHECK (tenant_id = current_tenant());

-- RAG chunks ------------------------------------------------------
-- Shared corpora (gb / ibc / eurocode) readable across tenants;
-- `project` corpus is tenant-scoped.
CREATE POLICY rag_read ON rag_chunks
    FOR SELECT
    USING (
        corpus IN ('gb', 'ibc', 'eurocode')
        OR tenant_id = current_tenant()
    );

CREATE POLICY rag_write ON rag_chunks
    FOR INSERT
    WITH CHECK (tenant_id = current_tenant());

CREATE POLICY rag_update ON rag_chunks
    FOR UPDATE
    USING (tenant_id = current_tenant())
    WITH CHECK (tenant_id = current_tenant());

CREATE POLICY rag_delete ON rag_chunks
    FOR DELETE
    USING (tenant_id = current_tenant());

-- User-tenant roles ----------------------------------------------
CREATE POLICY utr_tenant_isolation ON user_tenant_roles
    USING (tenant_id = current_tenant())
    WITH CHECK (tenant_id = current_tenant());

-- Audit log ------------------------------------------------------
CREATE POLICY audit_tenant_read ON audit_log
    FOR SELECT
    USING (tenant_id = current_tenant());

-- Inserts to audit_log must match the current tenant.
CREATE POLICY audit_tenant_insert ON audit_log
    FOR INSERT
    WITH CHECK (tenant_id = current_tenant());

-- =========================================================================
-- Force RLS even for table owners (defense in depth)
-- =========================================================================
ALTER TABLE projects              FORCE ROW LEVEL SECURITY;
ALTER TABLE bim_uploads           FORCE ROW LEVEL SECURITY;
ALTER TABLE boq_items             FORCE ROW LEVEL SECURITY;
ALTER TABLE compliance_findings   FORCE ROW LEVEL SECURITY;
ALTER TABLE agent_invocations     FORCE ROW LEVEL SECURITY;
ALTER TABLE rag_chunks            FORCE ROW LEVEL SECURITY;
ALTER TABLE user_tenant_roles     FORCE ROW LEVEL SECURITY;
ALTER TABLE audit_log             FORCE ROW LEVEL SECURITY;
