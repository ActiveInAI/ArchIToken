// License: Apache-2.0

package agent

type EngineManifest struct {
	ID           string   `json:"id"`
	DisplayName  string   `json:"displayName"`
	Capabilities []string `json:"capabilities"`
	Safety       string   `json:"safety"`
	Boundary     string   `json:"boundary"`
}

type AgentManifest struct {
	Name    string           `json:"name"`
	License string           `json:"license"`
	Role    string           `json:"role"`
	Engines []EngineManifest `json:"engines"`
}

func DefaultManifest() AgentManifest {
	return AgentManifest{
		Name:    "architoken-db-agent",
		License: "Apache-2.0",
		Role:    "database-side probe, inventory and tunnel agent",
		Engines: []EngineManifest{
			{
				ID:           "postgresql",
				DisplayName:  "PostgreSQL",
				Capabilities: []string{"relational_sql", "schema_inventory"},
				Safety:       "read_only_default",
				Boundary:     "rust_manager_policy_required",
			},
			{
				ID:           "clickhouse",
				DisplayName:  "ClickHouse",
				Capabilities: []string{"analytics_sql", "table_inventory"},
				Safety:       "read_only_default",
				Boundary:     "rust_manager_policy_required",
			},
			{
				ID:           "valkey",
				DisplayName:  "Valkey",
				Capabilities: []string{"cache_keyspace", "ttl_inventory"},
				Safety:       "read_only_default",
				Boundary:     "rust_manager_policy_required",
			},
			{
				ID:           "mongo_compatible",
				DisplayName:  "MongoDB-compatible",
				Capabilities: []string{"document_store", "collection_inventory"},
				Safety:       "read_only_default",
				Boundary:     "isolated_connector_until_review",
			},
			{
				ID:           "qdrant",
				DisplayName:  "Qdrant",
				Capabilities: []string{"vector_collections", "collection_inventory"},
				Safety:       "read_only_default",
				Boundary:     "rust_manager_policy_required",
			},
			{
				ID:           "s3_compatible",
				DisplayName:  "S3-compatible object store",
				Capabilities: []string{"object_buckets", "object_inventory"},
				Safety:       "read_only_default",
				Boundary:     "storagerouter_ownership_required",
			},
			{
				ID:           "nats_jetstream",
				DisplayName:  "NATS JetStream",
				Capabilities: []string{"event_streams", "stream_inventory"},
				Safety:       "read_only_default",
				Boundary:     "rust_manager_policy_required",
			},
		},
	}
}
