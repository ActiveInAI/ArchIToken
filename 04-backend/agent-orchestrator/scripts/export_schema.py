#!/usr/bin/env python3
"""Export the agent I/O JSON Schema from the Pydantic source of truth.

The contract models in ``architoken_agent.state`` are the single source of truth
for the agent boundary. This regenerates ``schemas/agent-output.schema.json`` so
the published JSON Schema never drifts from the code. CI (scripts/check-schemas.sh)
re-runs this and fails on any diff.
"""

from __future__ import annotations

import json
from pathlib import Path

from pydantic.json_schema import models_json_schema

from architoken_agent.state import AgentRequest, AgentResponse

REPO_ROOT = Path(__file__).resolve().parents[3]
OUT = REPO_ROOT / "schemas" / "agent-output.schema.json"


def build() -> dict:
    _, shared = models_json_schema(
        [(AgentRequest, "validation"), (AgentResponse, "validation")],
        ref_template="#/$defs/{model}",
    )
    defs = shared.get("$defs", {})
    return {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "$id": "https://architoken.dev/schemas/agent-output.schema.json",
        "title": "ArchIToken Agent I/O",
        "description": (
            "Generated from architoken_agent.state (Pydantic source of truth). "
            "Do not edit by hand; run scripts/export_schema.py."
        ),
        "$defs": defs,
        "oneOf": [
            {"$ref": "#/$defs/AgentRequest"},
            {"$ref": "#/$defs/AgentResponse"},
        ],
    }


def main() -> int:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(
        json.dumps(build(), indent=2, ensure_ascii=False, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    print(f"wrote {OUT.relative_to(REPO_ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
