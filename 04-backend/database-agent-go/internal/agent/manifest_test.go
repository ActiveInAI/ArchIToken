// License: Apache-2.0

package agent

import "testing"

func TestDefaultManifestUsesApache2AndReadOnlyDefaults(t *testing.T) {
	manifest := DefaultManifest()

	if manifest.License != "Apache-2.0" {
		t.Fatalf("expected Apache-2.0 license, got %s", manifest.License)
	}
	if len(manifest.Engines) == 0 {
		t.Fatal("expected default engine manifest entries")
	}

	for _, engine := range manifest.Engines {
		if engine.Safety != "read_only_default" {
			t.Fatalf("engine %s must default to read-only, got %s", engine.ID, engine.Safety)
		}
	}
}

func TestDefaultManifestIncludesInitialArchITokenTargets(t *testing.T) {
	manifest := DefaultManifest()
	ids := map[string]bool{}
	for _, engine := range manifest.Engines {
		ids[engine.ID] = true
	}

	for _, expected := range []string{"postgresql", "clickhouse", "valkey", "qdrant", "s3_compatible", "nats_jetstream"} {
		if !ids[expected] {
			t.Fatalf("expected engine %s in manifest", expected)
		}
	}
}
