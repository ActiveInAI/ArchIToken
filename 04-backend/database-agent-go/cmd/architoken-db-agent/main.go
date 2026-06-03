// License: Apache-2.0

package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"

	"github.com/ActiveInAI/ArchIToken/04-backend/database-agent-go/internal/agent"
)

const defaultAddr = "127.0.0.1:8752"

func main() {
	manifest := agent.DefaultManifest()
	if len(os.Args) > 1 && os.Args[1] == "serve" {
		addr := defaultAddr
		if envAddr := os.Getenv("ARCHITOKEN_DB_AGENT_ADDR"); envAddr != "" {
			addr = envAddr
		}
		if len(os.Args) > 3 && os.Args[2] == "--addr" {
			addr = os.Args[3]
		}

		_, _ = fmt.Fprintf(os.Stdout, "architoken-db-agent listening on http://%s\n", addr)
		if err := http.ListenAndServe(addr, agent.NewHTTPHandler(manifest)); err != nil {
			_, _ = fmt.Fprintf(os.Stderr, "failed to serve agent: %v\n", err)
			os.Exit(1)
		}
		return
	}

	encoder := json.NewEncoder(os.Stdout)
	encoder.SetIndent("", "  ")
	if err := encoder.Encode(manifest); err != nil {
		_, _ = fmt.Fprintf(os.Stderr, "failed to encode manifest: %v\n", err)
		os.Exit(1)
	}
}
