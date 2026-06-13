-- ArchIToken module operation runtime — lifecycle audit advancement fix.
--
-- The module_operation_runs side-effect trigger appends an audit_events row keyed
-- by the run's audit_event_id with action 'module_operation_<status>'. Because
-- audit_events is append-only (20260611000001) the side-effect uses
-- `ON CONFLICT (id) DO NOTHING`, but the prepare trigger kept audit_event_id
-- stable across the run's lifecycle. The result: every status transition collided
-- with the original `requested` audit row and was silently dropped, so the run's
-- audit_event_id never advanced past `module_operation_requested`.
--
-- Fix: on every status transition, point the run at a fresh audit_event_id. Each
-- lifecycle state (requested → running → completed) then appends its own immutable
-- audit row, and the run references the latest. event_outbox / graph_edges already
-- advance correctly via DO UPDATE on stable keys and are left unchanged.

SELECT set_config('app.current_tenant', '11111111-1111-4111-8111-111111111111', false);

CREATE OR REPLACE FUNCTION module_operation_runs_prepare()
RETURNS TRIGGER AS $$
BEGIN
    NEW.operation_run_id := COALESCE(NEW.operation_run_id, gen_random_uuid());
    NEW.event_id := COALESCE(NEW.event_id, gen_random_uuid());
    NEW.audit_event_id := COALESCE(NEW.audit_event_id, gen_random_uuid());
    NEW.graph_edge_id := COALESCE(NEW.graph_edge_id, gen_random_uuid());
    NEW.updated_at := NOW();
    IF TG_OP = 'INSERT' THEN
        NEW.created_at := COALESCE(NEW.created_at, NOW());
    ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
        -- Append-only audit: advance to a fresh audit row for this transition
        -- instead of colliding with (and no-op'ing on) the prior state's row.
        NEW.audit_event_id := gen_random_uuid();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
