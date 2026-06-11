-- 20260611000002_documented_name_compat_views.sql
-- Naming-drift fix (code audit 2026-06-11, §3): architecture docs reference table
-- names that exist in the schema under a DIFFERENT name. This adds read-only,
-- RLS-respecting compatibility VIEWs so doc-named queries/tools resolve to the real
-- tables, and records the mapping authoritatively in-schema.
--
-- security_invoker = true  -> the view enforces the CALLER's RLS, never bypasses it.
-- Defensive: each view is created only if its real backing table exists.
-- Idempotent: CREATE OR REPLACE.
--
-- IMPORTANT: documented names with NO real backing are deliberately NOT aliased here
-- (faking them would re-introduce the dishonesty this fix removes). The following are
-- NOT created and remain TARGET-STATE / NOT-IMPLEMENTED — see
-- docs/ARCHITOKEN_IMPLEMENTATION_RECONCILIATION_2026-06-11.md:
--   object_versions, schema_versions, business_objects,
--   operation_queue, resource_locks, workflow_runs,
--   price_evidence, agent_runs (ledger), agent_tool_calls.

DO $$
BEGIN
    IF to_regclass('public.data_event_outbox') IS NOT NULL THEN
        EXECUTE 'CREATE OR REPLACE VIEW event_outbox WITH (security_invoker = true)
                 AS SELECT * FROM data_event_outbox';
        COMMENT ON VIEW event_outbox IS
            'Compat alias of data_event_outbox (audit 2026-06-11 naming reconciliation).';
    END IF;

    IF to_regclass('public.semantic_dictionary_categories') IS NOT NULL THEN
        EXECUTE 'CREATE OR REPLACE VIEW sjg157_categories WITH (security_invoker = true)
                 AS SELECT * FROM semantic_dictionary_categories';
        COMMENT ON VIEW sjg157_categories IS
            'Compat alias of semantic_dictionary_categories (SJG157 semantic dictionary).';
    END IF;

    IF to_regclass('public.component_bom_naming_rules') IS NOT NULL THEN
        EXECUTE 'CREATE OR REPLACE VIEW naming_rules WITH (security_invoker = true)
                 AS SELECT * FROM component_bom_naming_rules';
        COMMENT ON VIEW naming_rules IS
            'Compat alias of component_bom_naming_rules.';
    END IF;

    IF to_regclass('public.component_bom_import_batches') IS NOT NULL THEN
        EXECUTE 'CREATE OR REPLACE VIEW import_batches WITH (security_invoker = true)
                 AS SELECT * FROM component_bom_import_batches';
        COMMENT ON VIEW import_batches IS
            'Compat alias of component_bom_import_batches.';
    END IF;
END
$$;
