"""OpenAPI contract smoke tests."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import yaml

REPO_ROOT = Path(__file__).resolve().parents[3]
OPENAPI_PATH = REPO_ROOT / "04-backend" / "openapi.yaml"
OPENAPITOOLS_PATH = REPO_ROOT / "08-sdk" / "openapitools.json"


def _load_openapi() -> dict[str, Any]:
    payload = yaml.safe_load(OPENAPI_PATH.read_text(encoding="utf-8"))
    assert isinstance(payload, dict)
    return payload


def _resolve_json_pointer(document: dict[str, Any], ref: str) -> Any:
    assert ref.startswith("#/"), f"only local OpenAPI refs are allowed in smoke test: {ref}"
    value: Any = document
    for raw_part in ref[2:].split("/"):
        part = raw_part.replace("~1", "/").replace("~0", "~")
        assert isinstance(value, dict), f"ref {ref} traversed into non-object"
        assert part in value, f"unresolved OpenAPI ref: {ref}"
        value = value[part]
    return value


def _walk_refs(value: Any) -> list[str]:
    refs: list[str] = []
    if isinstance(value, dict):
        ref = value.get("$ref")
        if isinstance(ref, str):
            refs.append(ref)
        for child in value.values():
            refs.extend(_walk_refs(child))
    elif isinstance(value, list):
        for child in value:
            refs.extend(_walk_refs(child))
    return refs


def _load_openapitools_config() -> dict[str, Any]:
    json_text = "\n".join(
        line
        for line in OPENAPITOOLS_PATH.read_text(encoding="utf-8").splitlines()
        if not line.lstrip().startswith("#")
    )
    payload = json.loads(json_text)
    assert isinstance(payload, dict)
    return payload


def test_openapi_document_is_parseable_and_resolves_local_refs() -> None:
    document = _load_openapi()

    assert document["openapi"] == "3.1.0"
    assert document["info"]["title"] == "ArchIToken API"
    assert isinstance(document["info"]["version"], str)
    assert document["paths"]
    assert document["components"]["schemas"]
    assert "/v1/agents/invoke" in document["paths"]
    assert "/v1/rag/retrieve" in document["paths"]

    refs = _walk_refs(document)
    assert refs, "OpenAPI should use component refs"
    for ref in refs:
        _resolve_json_pointer(document, ref)


def test_openapi_module_id_stays_registry_validated_not_enum() -> None:
    module_id = _load_openapi()["components"]["schemas"]["ModuleId"]

    assert module_id["type"] == "string"
    assert "enum" not in module_id
    assert module_id["pattern"] == "^[a-z][a-z0-9_]*$"
    assert "Module Registry" in module_id["description"]


def test_openapi_agent_response_keeps_structured_gate_and_tool_evidence() -> None:
    schemas = _load_openapi()["components"]["schemas"]
    agent_response = schemas["AgentResponse"]

    assert set(agent_response["required"]) >= {
        "request_id",
        "module_id",
        "verdict",
        "trace",
        "output_status",
        "gates",
        "tool_calls",
        "tool_results",
        "rag_chunks",
        "tool_router_notes",
    }
    assert "AgentGateResult" in schemas
    assert schemas["AgentGateResult"]["properties"]["name"]["enum"] == [
        "ToolRouter",
        "Planner",
        "Generator",
        "Evaluator",
        "RuleChecker",
        "SchemaValidator",
        "Approver",
    ]
    rag_chunk = schemas["AgentRagChunk"]
    assert set(rag_chunk["required"]) >= {
        "source",
        "source_kind",
        "retrieval_status",
        "citation_required",
    }
    assert "knowledge_source" in rag_chunk["properties"]["source_kind"]["enum"]
    assert "rag_chunk" in rag_chunk["properties"]["source_kind"]["enum"]
    assert "gateway_http" in rag_chunk["properties"]["retrieval_status"]["enum"]


def test_openapi_rag_retrieve_contract_is_gateway_owned() -> None:
    document = _load_openapi()
    schemas = document["components"]["schemas"]
    operation = document["paths"]["/v1/rag/retrieve"]["post"]

    assert "rag" in operation["tags"]
    assert (
        operation["requestBody"]["content"]["application/json"]["schema"]["$ref"]
        == "#/components/schemas/RagRetrieveRequest"
    )
    assert (
        operation["responses"]["200"]["content"]["application/json"]["schema"]["$ref"]
        == "#/components/schemas/RagRetrieveResponse"
    )

    request = schemas["RagRetrieveRequest"]
    assert set(request["required"]) == {"tenant_id", "project_id", "query"}
    assert request["properties"]["top_k"]["minimum"] == 1
    assert request["properties"]["top_k"]["maximum"] == 50
    query_embedding = request["properties"]["query_embedding"]
    assert query_embedding["minItems"] == 1536
    assert query_embedding["maxItems"] == 1536

    response = schemas["RagRetrieveResponse"]
    assert set(response["properties"]["retrieval_status"]["enum"]) == {
        "retrieved",
        "embedding_required",
        "vector_store_unavailable",
    }
    assert (
        response["properties"]["chunks"]["items"]["$ref"]
        == "#/components/schemas/RagRetrievedChunk"
    )


def test_openapi_audit_contract_records_agent_invocation_closure() -> None:
    audit_kinds = _load_openapi()["components"]["schemas"]["AuditEventKind"]["enum"]

    assert "agent_invoked" in audit_kinds
    assert "agent_tool_context_resolved" in audit_kinds
    assert "agent_gate_decision_recorded" in audit_kinds


def test_openapi_generator_config_smoke_covers_all_sdk_languages() -> None:
    config = _load_openapitools_config()
    generators = config["generator-cli"]["generators"]

    assert config["generator-cli"]["version"] == "7.14.0"
    assert set(generators) == {
        "typescript-fetch",
        "python",
        "rust",
        "go",
        "java",
        "swift5",
        "kotlin",
    }
    for generator in generators.values():
        assert generator["inputSpec"] == "../04-backend/openapi.yaml"
        assert generator["output"].startswith("./")
        assert generator["generatorName"]
