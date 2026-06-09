// License: Apache-2.0

package main

import (
	"encoding/json"
	"fmt"
	"os"

	"github.com/ActiveInAI/ArchIToken/04-backend/database-agent-go/internal/componentbom"
)

func main() {
	if len(os.Args) != 2 {
		_, _ = fmt.Fprintf(os.Stderr, "usage: architoken-bom-xlsx <component-bom.xlsx>\n")
		os.Exit(2)
	}

	manifest, err := componentbom.ReadWorkbookManifest(os.Args[1])
	if err != nil {
		_, _ = fmt.Fprintf(os.Stderr, "failed to read workbook: %v\n", err)
		os.Exit(1)
	}

	encoder := json.NewEncoder(os.Stdout)
	encoder.SetIndent("", "  ")
	if err := encoder.Encode(manifest); err != nil {
		_, _ = fmt.Fprintf(os.Stderr, "failed to encode manifest: %v\n", err)
		os.Exit(1)
	}
}
