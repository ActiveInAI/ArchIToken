-- Data-plane progressive split baseline.
-- Phase 1 keeps capability-shaped stores inside Postgres so later physical
-- splits can move behind StorageRouter without changing business tables.

CREATE TABLE IF NOT EXISTS data_plane_bindings (
    capability          TEXT PRIMARY KEY,
    current_provider    TEXT NOT NULL,
    fallback_provider   TEXT NOT NULL,
    split_phase         TEXT NOT NULL,
    external_url_env    TEXT[] NOT NULL DEFAULT '{}'::text[],
    enabled             BOOLEAN NOT NULL DEFAULT TRUE,
    metadata            JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO data_plane_bindings (
    capability,
    current_provider,
    fallback_provider,
    split_phase,
    external_url_env,
    metadata
) VALUES
    ('relational_store', 'postgres', 'memory', 'phase_1_postgres_trunk',
     ARRAY['ARCHITOKEN_DATABASE__URL', 'DATABASE_URL'],
     '{"rule":"Core business records stay in the primary relational store."}'::jsonb),
    ('object_store', 'seaweedfs_s3', 'memory', 'phase_1_object_store',
     ARRAY['S3_ENDPOINT', 'S3_ACCESS_KEY', 'S3_SECRET_KEY', 'S3_BUCKET'],
     '{"rule":"Large source bytes and derived artifacts route through ObjectStore."}'::jsonb),
    ('vector_store', 'postgres_pgvector', 'postgres_pgvector', 'phase_2_vector_split',
     ARRAY['ARCHITOKEN_VECTOR__URL', 'QDRANT_URL'],
     '{"rule":"RAG and semantic search route through VectorStore."}'::jsonb),
    ('time_series_store', 'postgres_partitioned', 'postgres_partitioned', 'phase_3_time_series_split',
     ARRAY['ARCHITOKEN_TIMESERIES__URL', 'ARCHITOKEN_TIME_SERIES__URL', 'CLICKHOUSE_URL'],
     '{"rule":"IoT, telemetry and progress points route through TimeSeriesStore."}'::jsonb),
    ('graph_store', 'postgres_adjacency', 'postgres_adjacency', 'phase_4_graph_split',
     ARRAY['ARCHITOKEN_GRAPH__URL'],
     '{"rule":"Component, workflow and knowledge relations route through GraphStore."}'::jsonb),
    ('event_store', 'postgres_outbox', 'postgres_outbox', 'phase_5_event_split',
     ARRAY['ARCHITOKEN_EVENT__URL', 'NATS_URL'],
     '{"rule":"Audit, workflow and integration events route through EventStore."}'::jsonb),
    ('cache_store', 'valkey', 'memory', 'phase_1_cache',
     ARRAY['ARCHITOKEN_CACHE__URL', 'REDIS_URL', 'VALKEY_URL'],
     '{"rule":"Ephemeral state routes through CacheStore."}'::jsonb),
    ('analytics_store', 'postgres_materialized_views', 'postgres_materialized_views', 'phase_6_analytics_split',
     ARRAY['ARCHITOKEN_ANALYTICS__URL', 'CLICKHOUSE_URL'],
     '{"rule":"Operational aggregates and product analytics route through AnalyticsStore."}'::jsonb)
ON CONFLICT (capability) DO UPDATE SET
    current_provider = EXCLUDED.current_provider,
    fallback_provider = EXCLUDED.fallback_provider,
    split_phase = EXCLUDED.split_phase,
    external_url_env = EXCLUDED.external_url_env,
    enabled = TRUE,
    metadata = EXCLUDED.metadata,
    updated_at = NOW();

CREATE TABLE IF NOT EXISTS data_graph_edges (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    project_id          UUID REFERENCES projects(id) ON DELETE CASCADE,
    module_id           TEXT REFERENCES modules(id) ON DELETE SET NULL,
    from_entity_type    TEXT NOT NULL,
    from_entity_id      TEXT NOT NULL,
    to_entity_type      TEXT NOT NULL,
    to_entity_id        TEXT NOT NULL,
    relationship_type   TEXT NOT NULL,
    properties          JSONB NOT NULL DEFAULT '{}'::jsonb,
    source              TEXT NOT NULL DEFAULT 'architoken',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (
        tenant_id,
        project_id,
        module_id,
        from_entity_type,
        from_entity_id,
        to_entity_type,
        to_entity_id,
        relationship_type
    )
);

CREATE INDEX IF NOT EXISTS idx_data_graph_edges_from
    ON data_graph_edges(tenant_id, project_id, from_entity_type, from_entity_id);
CREATE INDEX IF NOT EXISTS idx_data_graph_edges_to
    ON data_graph_edges(tenant_id, project_id, to_entity_type, to_entity_id);
CREATE INDEX IF NOT EXISTS idx_data_graph_edges_relationship
    ON data_graph_edges(tenant_id, relationship_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_data_graph_edges_properties
    ON data_graph_edges USING gin (properties);

CREATE TABLE IF NOT EXISTS data_timeseries_points (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    project_id      UUID REFERENCES projects(id) ON DELETE CASCADE,
    module_id       TEXT REFERENCES modules(id) ON DELETE SET NULL,
    series_key      TEXT NOT NULL,
    observed_at     TIMESTAMPTZ NOT NULL,
    value_numeric   DOUBLE PRECISION,
    value_text      TEXT,
    unit            TEXT,
    quality         TEXT NOT NULL DEFAULT 'raw',
    attributes      JSONB NOT NULL DEFAULT '{}'::jsonb,
    ingested_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (value_numeric IS NOT NULL OR value_text IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_data_timeseries_series_time
    ON data_timeseries_points(tenant_id, project_id, series_key, observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_data_timeseries_module_time
    ON data_timeseries_points(tenant_id, module_id, observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_data_timeseries_attributes
    ON data_timeseries_points USING gin (attributes);

CREATE TABLE IF NOT EXISTS data_event_outbox (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    project_id      UUID REFERENCES projects(id) ON DELETE CASCADE,
    module_id       TEXT REFERENCES modules(id) ON DELETE SET NULL,
    event_type      TEXT NOT NULL,
    target_type     TEXT NOT NULL,
    target_id       TEXT NOT NULL,
    payload         JSONB NOT NULL DEFAULT '{}'::jsonb,
    status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'publishing', 'published', 'failed', 'dead_letter')),
    attempt_count   INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
    occurred_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    published_at    TIMESTAMPTZ,
    last_error      TEXT
);

CREATE INDEX IF NOT EXISTS idx_data_event_outbox_pending
    ON data_event_outbox(status, occurred_at)
    WHERE status IN ('pending', 'failed');
CREATE INDEX IF NOT EXISTS idx_data_event_outbox_target
    ON data_event_outbox(tenant_id, target_type, target_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_data_event_outbox_payload
    ON data_event_outbox USING gin (payload);

CREATE TABLE IF NOT EXISTS data_analytics_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    project_id      UUID REFERENCES projects(id) ON DELETE CASCADE,
    module_id       TEXT REFERENCES modules(id) ON DELETE SET NULL,
    metric_name     TEXT NOT NULL,
    metric_value    DOUBLE PRECISION,
    dimensions      JSONB NOT NULL DEFAULT '{}'::jsonb,
    occurred_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ingested_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_data_analytics_metric_time
    ON data_analytics_events(tenant_id, metric_name, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_data_analytics_module_time
    ON data_analytics_events(tenant_id, module_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_data_analytics_dimensions
    ON data_analytics_events USING gin (dimensions);

ALTER TABLE data_graph_edges       ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_timeseries_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_event_outbox      ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_analytics_events  ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = current_schema()
          AND tablename = 'data_graph_edges'
          AND policyname = 'data_graph_edges_tenant_isolation'
    ) THEN
        CREATE POLICY data_graph_edges_tenant_isolation ON data_graph_edges
            USING (tenant_id = current_tenant())
            WITH CHECK (tenant_id = current_tenant());
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = current_schema()
          AND tablename = 'data_timeseries_points'
          AND policyname = 'data_timeseries_points_tenant_isolation'
    ) THEN
        CREATE POLICY data_timeseries_points_tenant_isolation ON data_timeseries_points
            USING (tenant_id = current_tenant())
            WITH CHECK (tenant_id = current_tenant());
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = current_schema()
          AND tablename = 'data_event_outbox'
          AND policyname = 'data_event_outbox_tenant_isolation'
    ) THEN
        CREATE POLICY data_event_outbox_tenant_isolation ON data_event_outbox
            USING (tenant_id = current_tenant())
            WITH CHECK (tenant_id = current_tenant());
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = current_schema()
          AND tablename = 'data_analytics_events'
          AND policyname = 'data_analytics_events_tenant_isolation'
    ) THEN
        CREATE POLICY data_analytics_events_tenant_isolation ON data_analytics_events
            USING (tenant_id = current_tenant())
            WITH CHECK (tenant_id = current_tenant());
    END IF;
END $$;

ALTER TABLE data_graph_edges       FORCE ROW LEVEL SECURITY;
ALTER TABLE data_timeseries_points FORCE ROW LEVEL SECURITY;
ALTER TABLE data_event_outbox      FORCE ROW LEVEL SECURITY;
ALTER TABLE data_analytics_events  FORCE ROW LEVEL SECURITY;
