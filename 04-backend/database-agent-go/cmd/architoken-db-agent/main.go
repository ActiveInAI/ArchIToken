// License: Apache-2.0

package main

import (
	"encoding/json"
	"fmt"
	"os"

	"github.com/ActiveInAI/ArchIToken/04-backend/database-agent-go/internal/agent"
)

func main() {
	manifest := agent.DefaultManifest()
	encoder := json.NewEncoder(os.Stdout)
	encoder.SetIndent("", "  ")
	if err := encoder.Encode(manifest); err != nil {
		_, _ = fmt.Fprintf(os.Stderr, "failed to encode manifest: %v\n", err)
		os.Exit(1)
	}
}
