"""Module graph smoke tests."""

from __future__ import annotations

import asyncio
import json
import re
from pathlib import Path
from uuid import UUID

import httpx

from architoken_agent.state import (
    ACTIVE_MODULE_IDS,
    AgentRequest,
    ModuleState,
    Verdict,
)

REPO_ROOT = Path(__file__).resolve().parents[3]


def _module_ids_from_modules_doc() -> tuple[str, ...]:
    modules_doc = (REPO_ROOT / "02-architecture" / "MODULES.md").read_text(
        encoding="utf-8"
    )
    return tuple(
        match.group(1)
        for match in re.finditer(r"\|\s+\d+\s+\|\s+`([^`]+)`", modules_doc)
    )


def _quoted_ids_from_array(source: str, array_name: str) -> tuple[str, ...]:
    array_match = re.search(
        rf"{re.escape(array_name)}[^=]*=\s*\[(?P<body>.*?)\]",
        source,
        flags=re.DOTALL,
    )
    assert array_match is not None, f"{array_name} array must be present"
    return tuple(re.findall(r'"([a-z][a-z0-9_]*)"', array_match.group("body")))


def test_active_module_ids_are_registry_data() -> None:
    assert ACTIVE_MODULE_IDS
    assert len(ACTIVE_MODULE_IDS) == len(set(ACTIVE_MODULE_IDS))
    assert all(module_id.islower() and "-" not in module_id for module_id in ACTIVE_MODULE_IDS)


def test_module_registry_resolves_all() -> None:
    from architoken_agent.module_specs import list_module_specs
    from architoken_agent.modules import get_runner

    assert [spec.id for spec in list_module_specs()] == list(ACTIVE_MODULE_IDS)
    for module_id in ACTIVE_MODULE_IDS:
        runner = get_runner(module_id)
        assert callable(runner), f"runner for {module_id!r} must be callable"


def test_active_modules_have_compliance_profiles() -> None:
    from architoken_agent.compliance import (
        compliance_profile_for,
        validate_module_compliance,
    )

    for module_id in ACTIVE_MODULE_IDS:
        profile = compliance_profile_for(module_id)
        assert profile is not None
        assert validate_module_compliance(module_id) == []
        assert profile.professional_roles
        assert profile.standards_profile
        assert profile.rule_set
        assert profile.signoff_policy == "professional_review_required"


def test_python_registry_matches_modules_document_order() -> None:
    assert _module_ids_from_modules_doc() == ACTIVE_MODULE_IDS


def test_active_module_registry_order_matches_frontend_and_rust_sources() -> None:
    frontend_source = (
        REPO_ROOT / "03-frontend" / "lib" / "module-registry.ts"
    ).read_text(encoding="utf-8")
    rust_source = (
        REPO_ROOT / "04-backend" / "harness-core" / "src" / "module_registry.rs"
    ).read_text(encoding="utf-8")

    frontend_ids = _quoted_ids_from_array(frontend_source, "activeModuleIds")
    rust_ids = _quoted_ids_from_array(rust_source, "ACTIVE_MODULE_IDS")

    assert _module_ids_from_modules_doc() == ACTIVE_MODULE_IDS
    assert frontend_ids == ACTIVE_MODULE_IDS
    assert rust_ids == ACTIVE_MODULE_IDS


def test_python_registry_names_match_modules_document() -> None:
    modules_doc = (REPO_ROOT / "02-architecture" / "MODULES.md").read_text(
        encoding="utf-8"
    )
    documented_names = {
        match.group("id"): match.group("name")
        for match in re.finditer(
            r"\|\s+\d+\s+\|\s+`(?P<id>[^`]+)`\s+\|\s+(?P<name>[^|]+?)\s+\|",
            modules_doc,
        )
    }

    from architoken_agent.module_specs import list_module_specs

    assert {
        spec.id: spec.zh_name for spec in list_module_specs()
    } == documented_names


def test_default_role_models_are_architoken_aliases() -> None:
    from architoken_agent.inference import model_for_role
    from architoken_agent.settings import get_settings
    from architoken_agent.state import AgentRole

    cfg = get_settings()
    assert model_for_role(AgentRole.PLANNER) == "architoken-planner"
    assert model_for_role(AgentRole.GENERATOR) == "architoken-generator"
    assert model_for_role(AgentRole.EVALUATOR) == "architoken-evaluator"
    assert set(cfg.whitelisted_models) >= {
        "architoken-planner",
        "architoken-generator",
        "architoken-evaluator",
    }


def test_verdict_enum_is_tight() -> None:
    assert {v.value for v in Verdict} == {"approved", "revise", "rejected"}


def test_agent_request_defaults() -> None:
    req = AgentRequest(
        project_id=UUID("11111111-1111-4111-8111-111111111111"),
        tenant_id=UUID("22222222-2222-4222-8222-222222222222"),
        module_id="marketing_service",
        user_input="hi",
    )
    assert req.locale == "zh-CN"
    assert req.attachments == []
    assert req.module_id == "marketing_service"


def test_agent_request_normalizes_module_alias() -> None:
    req = AgentRequest(
        project_id=UUID("11111111-1111-4111-8111-111111111111"),
        tenant_id=UUID("22222222-2222-4222-8222-222222222222"),
        module_id="finance-hr",
        user_input="hi",
    )

    assert req.module_id == "finance_management"


def test_module_state_typeddict_accepts_partial() -> None:
    state: ModuleState = {"user_input": "hello"}
    assert state["user_input"] == "hello"


def test_tool_router_builds_governed_context() -> None:
    from architoken_agent.tool_router import ToolRouter

    routed = ToolRouter().route(
        {
            "module_id": "standard_library",
            "request_id": "req-1",
            "attachments": ["规范条文.pdf"],
        }
    )

    assert routed["tool_calls"][0].name == "module_registry.lookup"
    assert any(call.name == "cde.resolve_attachments" for call in routed["tool_calls"])
    assert routed["tool_results"][0].name == "module_registry.lookup"
    assert routed["tool_results"][0].ok is True
    assert routed["tool_results"][1].output["mode"] == "local_registry_fallback"
    assert routed["tool_results"][1].output["fallback_source_count"] >= 2
    assert any(result.name == "rag.retrieve" for result in routed["tool_results"])
    assert routed["rag_chunks"][0]["source"] == "module-registry://standard_library"
    assert routed["rag_chunks"][0]["source_kind"] == "module_registry"
    assert routed["rag_chunks"][1]["source"] == "module-compliance://standard_library"
    assert routed["rag_chunks"][-1]["source"] == "attachment://1"
    assert routed["module_compliance_profile"]["signoff_policy"] == (
        "professional_review_required"
    )


def test_tool_router_collects_gateway_evidence() -> None:
    from architoken_agent.tool_router import GatewayHttpToolAdapter, ToolRouter

    seen_headers: list[httpx.Headers] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen_headers.append(request.headers)
        if request.url.path == "/v1/knowledge-sources":
            return httpx.Response(
                200,
                json={
                    "sources": [
                        {
                            "id": "gb-specs",
                            "kind": "standard_specification",
                            "name": "GB specification library",
                            "sourceUrl": "https://example.invalid/specs",
                            "license": "enterprise-internal",
                            "version": "2026.06",
                            "status": "approved",
                            "citationPolicy": {"citationRequired": True},
                        }
                    ]
                },
            )
        if request.url.path == "/v1/rag/retrieve":
            payload = json.loads(request.content.decode("utf-8"))
            assert payload["tenant_id"] == "tenant-a"
            assert payload["project_id"] == "project-a"
            assert payload["query"] == "请检索标准族库"
            return httpx.Response(
                200,
                json={
                    "schema": "architoken.rag.retrieve.v1",
                    "retrieval_status": "retrieved",
                    "tenant_id": "00000000-0000-4000-8000-000000000001",
                    "project_id": "00000000-0000-4000-8000-000000000002",
                    "top_k": 6,
                    "corpora": ["gb", "project"],
                    "chunks": [
                        {
                            "id": "00000000-0000-4000-8000-000000000003",
                            "source": "GB 50017",
                            "heading": "钢结构设计标准",
                            "content": "结构设计条文片段。",
                            "score": 0.91,
                            "metadata": {"standard": "GB 50017"},
                        }
                    ],
                    "metadata": {"provider": "postgres_pgvector"},
                },
            )
        if request.url.path == "/v1/modules/standard_library/files":
            return httpx.Response(
                200,
                json={
                    "files": [
                        {
                            "id": "file-1",
                            "moduleId": "standard_library",
                            "name": "规范条文.pdf",
                            "kind": "file",
                            "status": "active",
                            "metadata": {"owner": "standard-admin", "tags": ["gb"]},
                        }
                    ]
                },
            )
        if request.url.path == "/v1/audit-events":
            return httpx.Response(
                200,
                json={
                    "events": [
                        {
                            "id": "event-1",
                            "moduleId": "standard_library",
                            "actor": "standard-admin",
                            "action": "file_created",
                            "targetType": "file",
                            "targetId": "file-1",
                            "summary": "standard source indexed",
                            "createdAt": "2026-06-09T00:00:00Z",
                        }
                    ]
                },
            )
        return httpx.Response(404, json={})

    client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    adapter = GatewayHttpToolAdapter(
        base_url="http://gateway.test",
        timeout_s=0.2,
        actor="agent-test",
        roles="engineer,reviewer",
        client=client,
    )
    routed = asyncio.run(
        ToolRouter(gateway_adapter=adapter, gateway_enabled=True).route_async(
            {
                "module_id": "standard_library",
                "tenant_id": "tenant-a",
                "project_id": "project-a",
                "request_id": "req-a",
                "user_input": "请检索标准族库",
                "attachments": ["规范条文.pdf"],
            }
        )
    )
    asyncio.run(client.aclose())

    assert seen_headers
    assert seen_headers[0]["x-tenant-id"] == "tenant-a"
    assert seen_headers[0]["x-project-id"] == "project-a"
    assert routed["tool_results"][1].output["mode"] == "gateway_http"
    assert any(
        chunk["source"] == "knowledge-source://gb-specs"
        for chunk in routed["rag_chunks"]
    )
    assert any(
        chunk["source"] == "rag-chunk://00000000-0000-4000-8000-000000000003"
        and chunk["source_kind"] == "rag_chunk"
        for chunk in routed["rag_chunks"]
    )
    assert any(chunk["source"] == "cde-file://file-1" for chunk in routed["rag_chunks"])
    assert any(chunk["source"] == "audit-event://event-1" for chunk in routed["rag_chunks"])
    attachment_result = next(
        result
        for result in routed["tool_results"]
        if result.name == "cde.resolve_attachments"
    )
    assert attachment_result.output["resolved_count"] == 1


def test_tool_router_enforces_per_tool_permissions_for_auditor() -> None:
    """audit 2026-06-11: auditor lacks cde:read, so CDE tools are denied and their
    evidence must not leak into the governed source references."""
    from architoken_agent.tool_router import ToolRouter

    routed = ToolRouter().route(
        {
            "module_id": "standard_library",
            "request_id": "req-perm",
            "roles": "auditor",
            "attachments": ["规范条文.pdf"],
        }
    )

    calls = {call.name: call for call in routed["tool_calls"]}
    assert calls["cde.list_module_files"].arguments["permission_decision"] == "denied"
    assert calls["cde.resolve_attachments"].arguments["permission_decision"] == "denied"
    assert calls["audit_trail.list_events"].arguments["permission_decision"] == "allowed"
    assert calls["module_registry.lookup"].arguments["permission_decision"] == "allowed"

    results = {result.name: result for result in routed["tool_results"]}
    assert results["cde.list_module_files"].ok is False
    assert results["cde.list_module_files"].output["permission_decision"] == "denied"
    assert results["cde.resolve_attachments"].ok is False
    assert results["cde.resolve_attachments"].output["status"] == "permission_denied"
    # denied CDE evidence must be excluded from governed sources
    assert not any(
        chunk["source_kind"] in {"cde_file", "attachment_reference"}
        for chunk in routed["rag_chunks"]
    )
    assert "denied_tools" in routed["tool_router_notes"]


def test_tool_router_allows_cde_for_engineer() -> None:
    """Engineer holds cde:read, so CDE tools are permitted and contribute evidence."""
    from architoken_agent.tool_router import ToolRouter

    routed = ToolRouter().route(
        {
            "module_id": "standard_library",
            "request_id": "req-eng",
            "roles": "engineer",
            "attachments": ["规范条文.pdf"],
        }
    )

    results = {result.name: result for result in routed["tool_results"]}
    assert results["cde.list_module_files"].output["permission_decision"] == "allowed"
    assert results["cde.resolve_attachments"].ok is True
    assert any(chunk["source"] == "attachment://1" for chunk in routed["rag_chunks"])


def test_agent_response_gate_evidence_is_structured() -> None:
    from architoken_agent.main import _build_gate_results

    gates = _build_gate_results(
        {
            "plan": ["step one"],
            "generator_output": "draft",
            "planner_model": "architoken-planner",
            "generator_model": "architoken-generator",
            "evaluator_model": "architoken-evaluator",
            "evaluator_verdict": Verdict.APPROVED,
            "rule_checker_verdict": Verdict.APPROVED,
            "schema_validator_verdict": Verdict.APPROVED,
            "approver_verdict": Verdict.APPROVED,
            "tool_calls": [],
            "tool_router_notes": "No tools routed.",
        }
    )

    assert [gate.name for gate in gates] == [
        "ToolRouter",
        "Planner",
        "Generator",
        "Evaluator",
        "RuleChecker",
        "SchemaValidator",
        "Approver",
    ]
    assert gates[0].status == "blocked"
    assert gates[-1].verdict == Verdict.APPROVED


def test_agent_invoke_http_contract_returns_gateway_parseable_payload(monkeypatch) -> None:
    from fastapi.testclient import TestClient

    import architoken_agent.main as main_module
    from architoken_agent.state import ToolCall, ToolResult

    async def fake_runner(state: ModuleState) -> ModuleState:
        return {
            **state,
            "plan": ["resolve sources", "draft answer"],
            "planner_model": "architoken-planner",
            "generator_output": "依据 GB 50017 输出草稿，仍需专业复核。",
            "generator_model": "architoken-generator",
            "evaluator_model": "architoken-evaluator",
            "evaluator_verdict": Verdict.APPROVED,
            "evaluator_notes": "ok",
            "rule_checker_verdict": Verdict.APPROVED,
            "rule_checker_notes": "deterministic checks passed",
            "schema_validator_verdict": Verdict.APPROVED,
            "schema_validator_notes": "schema ok",
            "approver_verdict": Verdict.APPROVED,
            "approver_notes": "professional review required",
            "output_status": "professional_review_required",
            "final_output": {"summary": "draft"},
            "revision_count": 0,
            "tool_calls": [
                ToolCall(name="rag.retrieve", arguments={"top_k": 6}),
            ],
            "tool_results": [
                ToolResult(
                    name="rag.retrieve",
                    ok=True,
                    output={"retrieval_status": "retrieved", "chunk_count": 1},
                )
            ],
            "rag_chunks": [
                {
                    "source": "rag-chunk://00000000-0000-4000-8000-000000000003",
                    "source_kind": "rag_chunk",
                    "retrieval_status": "gateway_http",
                    "title": "GB 50017",
                    "content": "结构设计条文片段。",
                    "citation_required": True,
                    "score": 0.91,
                    "metadata": {"standard": "GB 50017"},
                }
            ],
            "tool_router_notes": "Routed 1 tool call, 1 tool result and 1 source.",
        }

    monkeypatch.setattr(main_module, "get_runner", lambda _module_id: fake_runner)

    with TestClient(main_module.app) as client:
        response = client.post(
            "/v1/agents/invoke",
            json={
                "tenant_id": "00000000-0000-4000-8000-000000000001",
                "project_id": "00000000-0000-4000-8000-000000000002",
                "module_id": "standard_library",
                "user_input": "生成标准条文草稿",
                "attachments": ["规范条文.pdf"],
            },
        )

    assert response.status_code == 200
    body = response.json()
    assert set(body) >= {
        "request_id",
        "module_id",
        "verdict",
        "final_output",
        "revision_count",
        "trace",
        "output_status",
        "gates",
        "tool_calls",
        "tool_results",
        "rag_chunks",
        "tool_router_notes",
        "planner_model",
        "generator_model",
        "evaluator_model",
    }
    assert body["module_id"] == "standard_library"
    assert body["verdict"] == "approved"
    assert body["output_status"] == "professional_review_required"
    assert body["tool_results"][0]["name"] == "rag.retrieve"
    assert body["rag_chunks"][0]["source_kind"] == "rag_chunk"
    # audit 2026-06-11 R1: model routing identities surface for the run ledger
    assert body["planner_model"] == "architoken-planner"
    assert body["generator_model"] == "architoken-generator"
    assert body["evaluator_model"] == "architoken-evaluator"
    assert [gate["name"] for gate in body["gates"]] == [
        "ToolRouter",
        "Planner",
        "Generator",
        "Evaluator",
        "RuleChecker",
        "SchemaValidator",
        "Approver",
    ]


def test_parse_verdict_fallback() -> None:
    from architoken_agent.module_graph import _parse_verdict

    verdict, notes = _parse_verdict('{"verdict":"approved","notes":"all good"}')
    assert verdict == Verdict.APPROVED
    assert "all good" in notes

    verdict2, _ = _parse_verdict("Looks great - APPROVED overall")
    assert verdict2 == Verdict.APPROVED

    verdict3, _ = _parse_verdict("Some issues, but REVISE")
    assert verdict3 == Verdict.REVISE


def test_parse_plan_takes_seven() -> None:
    from architoken_agent.module_graph import _parse_plan

    raw = """
    - step one
    - step two
    - step three
    - step four
    - step five
    - step six
    - step seven
    - step eight
    """
    plan = _parse_plan(raw)
    assert len(plan) == 7, "plan must cap at 7 steps"


def test_module_graph_runs_to_final_output_with_local_prompts() -> None:
    from architoken_agent.module_graph import build_module_graph
    from architoken_agent.state import AgentRole

    class FakeInferenceClient:
        async def chat(self, **kwargs: object) -> str:
            role = kwargs["role"]
            if role == AgentRole.PLANNER:
                return "step one\nstep two"
            if role == AgentRole.EVALUATOR:
                return '{"verdict":"approved","notes":"ok"}'
            return "generated"

    runner = build_module_graph(
        "marketing_service",
        planner_prompt_name="marketing_service/planner",
        generator_prompt_name="marketing_service/generator",
        evaluator_prompt_name="marketing_service/evaluator",
        inference_client=FakeInferenceClient(),  # type: ignore[arg-type]
    )
    result = asyncio.run(runner({"user_input": "draft a plan"}))

    assert result["final_output"] == "generated"
    assert result["tool_calls"][0].name == "module_registry.lookup"
    assert result["tool_results"][0].name == "module_registry.lookup"
    assert result["rag_chunks"][0]["source"] == "module-registry://marketing_service"
    assert result["evaluator_verdict"] == Verdict.APPROVED
    assert result["rule_checker_verdict"] == Verdict.APPROVED
    assert result["schema_validator_verdict"] == Verdict.APPROVED
    assert result["approver_verdict"] == Verdict.APPROVED
    assert result["output_status"] == "professional_review_required"


def test_module_graph_blocks_unreviewed_professional_readiness_claims() -> None:
    from architoken_agent.module_graph import build_module_graph
    from architoken_agent.state import AgentRole

    class FakeInferenceClient:
        async def chat(self, **kwargs: object) -> str:
            role = kwargs["role"]
            if role == AgentRole.PLANNER:
                return "step one"
            if role == AgentRole.EVALUATOR:
                return '{"verdict":"approved","notes":"ok"}'
            return "该深化设计结果合规，可施工。"

    runner = build_module_graph(
        "detailed_design",
        planner_prompt_name="detailed_design/planner",
        generator_prompt_name="detailed_design/generator",
        evaluator_prompt_name="detailed_design/evaluator",
        inference_client=FakeInferenceClient(),  # type: ignore[arg-type]
    )
    result = asyncio.run(runner({"user_input": "校核深化设计"}))

    assert result["rule_checker_verdict"] == Verdict.REVISE
    assert result["approver_verdict"] == Verdict.REVISE
    assert result["output_status"] == "draft_assist"
    assert "Protected professional readiness claims" in result["rule_checker_notes"]
