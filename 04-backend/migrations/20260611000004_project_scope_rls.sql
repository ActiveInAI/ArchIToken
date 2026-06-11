-- 20260611000004_project_scope_rls.sql
-- R4 (code audit 2026-06-11): RLS predicates were tenant-only; project isolation
-- relied on foreign keys/indexes, not policy. This adds DB-enforced PROJECT-level
-- isolation for sensitive project-scoped tables.
--
-- Design — permissive when unset, enforce when set:
--   * `current_project()` reads `app.current_project` (txn-local), NULL if unset/malformed.
--   * A RESTRICTIVE policy ANDs with the existing tenant policy. Its predicate
--     `current_project() IS NULL OR project_id = current_project()` means:
--       - no project context  -> permissive (tenant-wide queries keep working, zero regression),
--       - project context set  -> only that project's rows are visible/writable.
-- Activation: the Gateway sets `app.current_project` for project-scoped requests
-- (begin_tenant_tx). Paths that never set it are unaffected.
-- Idempotent.

CREATE OR REPLACE FUNCTION current_project() RETURNS UUID AS $$
DECLARE
    p TEXT;
BEGIN
    BEGIN
        p := current_setting('app.current_project', true);
    EXCEPTION WHEN OTHERS THEN
        RETURN NULL;
    END;
    IF p IS NULL OR p = '' THEN
        RETURN NULL;
    END IF;
    RETURN p::UUID;
EXCEPTION WHEN OTHERS THEN
    -- Malformed project context fails open to permissive (NULL), never errors a query.
    RETURN NULL;
END
$$ LANGUAGE plpgsql STABLE;

DO $$
DECLARE
    t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY[
        'boq_items',
        'bim_uploads',
        'compliance_findings',
        'agent_invocations'
    ] LOOP
        IF to_regclass('public.' || t) IS NOT NULL THEN
            EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_project_scope', t);
            EXECUTE format(
                'CREATE POLICY %I ON %I AS RESTRICTIVE '
                || 'USING (current_project() IS NULL OR project_id = current_project()) '
                || 'WITH CHECK (current_project() IS NULL OR project_id = current_project())',
                t || '_project_scope', t
            );
        END IF;
    END LOOP;
END
$$;
