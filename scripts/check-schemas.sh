#!/usr/bin/env bash
# Schema source-of-truth guard (issue #4): the published schema set under
# schemas/ must be well-formed and must not drift from its producing code.
set -euo pipefail
cd "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

ORCH="04-backend/agent-orchestrator"

# 1. JSON schemas parse and declare a $schema dialect.
python3 - <<'PY'
import json
for f in ("schemas/agent-output.schema.json", "schemas/module.schema.json"):
    d = json.load(open(f, encoding="utf-8"))
    assert d.get("$schema"), f"{f}: missing $schema dialect"
    assert d.get("$id"), f"{f}: missing $id"
    print("ok json:", f)
PY

# 2. AsyncAPI document parses and is an AsyncAPI with channels.
( cd "${ORCH}" && uv run python - <<'PY'
import yaml
d = yaml.safe_load(open("../../schemas/asyncapi.yaml", encoding="utf-8"))
assert d.get("asyncapi"), "asyncapi.yaml: missing asyncapi version"
assert d.get("channels"), "asyncapi.yaml: missing channels"
print("ok yaml: schemas/asyncapi.yaml")
PY
)

# 3. IFC validation path doc is present and non-trivial.
[[ -s schemas/ifc-validation.md ]] && echo "ok doc: schemas/ifc-validation.md"

# 4. agent-output.schema.json must match a fresh export from the Pydantic source
#    of truth (doubles as the schema diff / backward-compatibility guard).
( cd "${ORCH}" && uv run python scripts/export_schema.py >/dev/null )
if ! git diff --quiet -- schemas/agent-output.schema.json; then
  {
    echo "schemas/agent-output.schema.json is stale (drifted from architoken_agent.state)."
    echo "Run: (cd ${ORCH} && uv run python scripts/export_schema.py) and commit the result."
    echo
    git --no-pager diff -- schemas/agent-output.schema.json
  } >&2
  exit 1
fi
echo "ok drift: schemas/agent-output.schema.json matches Pydantic source"

echo "Schema source-of-truth checks passed."
