-- 20260611000001_audit_events_append_only.sql
-- Integrity fix (code audit 2026-06-11, finding 2.2/§3): audit_events and
-- cost_audit_events were "append-only by convention only" — nothing at the DB level
-- prevented UPDATE / DELETE / TRUNCATE, so the audit trail could be silently rewritten.
-- This makes append-only a real, enforced guarantee.
--
-- Safety: verified that NO code path issues UPDATE/DELETE against these tables
-- (writes are plain INSERT via harness-core/postgres_runtime_store.rs and seed
-- migrations), so this trigger cannot break an existing write path.
-- Idempotent: safe to re-run.

CREATE OR REPLACE FUNCTION reject_audit_mutation() RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'append-only ledger %: % is not permitted', TG_TABLE_NAME, TG_OP
        USING ERRCODE = 'restrict_violation';
END
$$ LANGUAGE plpgsql;

-- audit_events (durable runtime audit ledger)
DO $$
BEGIN
    IF to_regclass('public.audit_events') IS NOT NULL THEN
        EXECUTE 'DROP TRIGGER IF EXISTS audit_events_no_update_delete ON audit_events';
        EXECUTE 'CREATE TRIGGER audit_events_no_update_delete
                 BEFORE UPDATE OR DELETE ON audit_events
                 FOR EACH ROW EXECUTE FUNCTION reject_audit_mutation()';
        EXECUTE 'DROP TRIGGER IF EXISTS audit_events_no_truncate ON audit_events';
        EXECUTE 'CREATE TRIGGER audit_events_no_truncate
                 BEFORE TRUNCATE ON audit_events
                 FOR EACH STATEMENT EXECUTE FUNCTION reject_audit_mutation()';
    END IF;
END
$$;

-- cost_audit_events (quantity_costing audit ledger)
DO $$
BEGIN
    IF to_regclass('public.cost_audit_events') IS NOT NULL THEN
        EXECUTE 'DROP TRIGGER IF EXISTS cost_audit_events_no_update_delete ON cost_audit_events';
        EXECUTE 'CREATE TRIGGER cost_audit_events_no_update_delete
                 BEFORE UPDATE OR DELETE ON cost_audit_events
                 FOR EACH ROW EXECUTE FUNCTION reject_audit_mutation()';
        EXECUTE 'DROP TRIGGER IF EXISTS cost_audit_events_no_truncate ON cost_audit_events';
        EXECUTE 'CREATE TRIGGER cost_audit_events_no_truncate
                 BEFORE TRUNCATE ON cost_audit_events
                 FOR EACH STATEMENT EXECUTE FUNCTION reject_audit_mutation()';
    END IF;
END
$$;
