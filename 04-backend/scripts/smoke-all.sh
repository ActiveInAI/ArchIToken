#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

"${SCRIPT_DIR}/smoke-health.sh"
"${SCRIPT_DIR}/smoke-generation.sh"
"${SCRIPT_DIR}/smoke-artifacts.sh"
"${SCRIPT_DIR}/smoke-registries.sh"
"${SCRIPT_DIR}/smoke-viewer-commands.sh"

printf 'all ArchIToken Phase 4 API smoke checks passed\n'
