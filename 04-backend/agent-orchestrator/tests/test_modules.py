"""Module graph smoke tests."""

from __future__ import annotations

from uuid import UUID

import pytest

from architoken_agent.state import (
    ACTIVE_MODULE_IDS,
    AgentRequest,
    ModuleState,
    Verdict,
)


def test_all_modules_defined() -> None:
    assert ACTIVE_MODULE_IDS == (
        "marketing_service",
        "planning_management",
        "concept_design",
        "standard_library",
        "detailed_design",
        "quantity_costing",
        "material_logistics",
        "production_manufacturing",
        "construction_supervision",
        "digital_twin",
        "digital_archive",
        "finance_hr",
        "ai_center",
        "settings_center",
    )


def test_module_registry_resolves_all() -> None:
    from architoken_agent.modules import get_runner

    for module_id in ACTIVE_MODULE_IDS:
        runner = get_runner(module_id)
        assert callable(runner), f"runner for {module_id!r} must be callable"


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


def test_module_state_typeddict_accepts_partial() -> None:
    state: ModuleState = {"user_input": "hello"}
    assert state["user_input"] == "hello"


@pytest.mark.asyncio
async def test_parse_verdict_fallback() -> None:
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
