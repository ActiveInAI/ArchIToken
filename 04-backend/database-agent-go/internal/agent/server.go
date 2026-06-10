// License: Apache-2.0

package agent

import (
	"encoding/json"
	"net/http"
	"time"
)

type HealthStatus struct {
	Status         string    `json:"status"`
	License        string    `json:"license"`
	Implementation string    `json:"implementation"`
	CheckedAt      time.Time `json:"checkedAt"`
}

type ProbeResult struct {
	Status           string   `json:"status"`
	DefaultSafety    string   `json:"defaultSafety"`
	SupportedEngines []string `json:"supportedEngines"`
}

func NewHTTPHandler(manifest AgentManifest) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/readyz", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			writeMethodNotAllowed(w)
			return
		}
		writeJSON(w, HealthStatus{
			Status:         "ready",
			License:        manifest.License,
			Implementation: "go-agent",
			CheckedAt:      time.Now().UTC(),
		})
	})
	mux.HandleFunc("/manifest", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			writeMethodNotAllowed(w)
			return
		}
		writeJSON(w, manifest)
	})
	mux.HandleFunc("/probe", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			writeMethodNotAllowed(w)
			return
		}
		writeJSON(w, DefaultProbe(manifest))
	})
	return mux
}

func DefaultProbe(manifest AgentManifest) ProbeResult {
	engines := make([]string, 0, len(manifest.Engines))
	for _, engine := range manifest.Engines {
		engines = append(engines, engine.ID)
	}
	return ProbeResult{
		Status:           "ready",
		DefaultSafety:    "read_only_default",
		SupportedEngines: engines,
	}
}

func writeJSON(w http.ResponseWriter, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(value)
}

func writeMethodNotAllowed(w http.ResponseWriter) {
	w.Header().Set("Allow", http.MethodGet)
	http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
}
