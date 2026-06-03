// License: Apache-2.0

package agent

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

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

func TestHTTPHandlerServesReadinessAndManifest(t *testing.T) {
	handler := NewHTTPHandler(DefaultManifest())

	readyReq := httptest.NewRequest(http.MethodGet, "/readyz", nil)
	readyResp := httptest.NewRecorder()
	handler.ServeHTTP(readyResp, readyReq)

	if readyResp.Code != http.StatusOK {
		t.Fatalf("expected readyz 200, got %d", readyResp.Code)
	}
	var health HealthStatus
	if err := json.Unmarshal(readyResp.Body.Bytes(), &health); err != nil {
		t.Fatalf("failed to decode readyz body: %v", err)
	}
	if health.Status != "ready" || health.License != "Apache-2.0" || health.Implementation != "go-agent" {
		t.Fatalf("unexpected readyz payload: %#v", health)
	}

	manifestReq := httptest.NewRequest(http.MethodGet, "/manifest", nil)
	manifestResp := httptest.NewRecorder()
	handler.ServeHTTP(manifestResp, manifestReq)

	if manifestResp.Code != http.StatusOK {
		t.Fatalf("expected manifest 200, got %d", manifestResp.Code)
	}
	var manifest AgentManifest
	if err := json.Unmarshal(manifestResp.Body.Bytes(), &manifest); err != nil {
		t.Fatalf("failed to decode manifest body: %v", err)
	}
	if len(manifest.Engines) != len(DefaultManifest().Engines) {
		t.Fatalf("expected all engines in manifest, got %d", len(manifest.Engines))
	}
}

func TestHTTPHandlerProbeKeepsReadOnlyBoundary(t *testing.T) {
	handler := NewHTTPHandler(DefaultManifest())
	req := httptest.NewRequest(http.MethodGet, "/probe", nil)
	resp := httptest.NewRecorder()
	handler.ServeHTTP(resp, req)

	if resp.Code != http.StatusOK {
		t.Fatalf("expected probe 200, got %d", resp.Code)
	}
	var probe ProbeResult
	if err := json.Unmarshal(resp.Body.Bytes(), &probe); err != nil {
		t.Fatalf("failed to decode probe body: %v", err)
	}
	if probe.DefaultSafety != "read_only_default" {
		t.Fatalf("probe must preserve read-only default, got %s", probe.DefaultSafety)
	}
	if len(probe.SupportedEngines) < 6 {
		t.Fatalf("expected initial supported engines, got %d", len(probe.SupportedEngines))
	}
}
