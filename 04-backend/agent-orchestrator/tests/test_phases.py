"""Phase graph smoke tests.

These don't hit real LLMs; they verify the LangGraph wiring is sane.
"""

from __future__ import annotations

import pytest

from insomeos_agent.state import (
    AgentRequest,
    BusinessPhase,
    PhaseState,
    Verdict,
)


def test_all_phases_defined() -> None:
    """Constitution: exactly 9 business phases, in the documented order."""
    phases = [p.value for p in BusinessPhase]
    assert phases == [
        "pre_sales",
        "concept",
        "develop",
        "costing",
        "fabrication",
        "logistics",
        "construction",
        "acceptance",
        "operations",
    ]


def test_phase_registry_resolves_all() -> None:
    from insomeos_agent.phases import get_runner

    for phase in BusinessPhase:
        runner = get_runner(phase)
        assert callable(runner), f"runner for {phase!r} must be callable"


def test_verdict_enum_is_tight() -> None:
    assert {v.value for v in Verdict} == {"approved", "revise", "rejected"}


def test_agent_request_defaults() -> None:
    req = AgentRequest(
        project_id="11111111-1111-4111-8111-111111111111",
        tenant_id="22222222-2222-4222-8222-222222222222",
        phase=BusinessPhase.PRE_SALES,
        user_input="hi",
    )
    assert req.locale == "zh-CN"
    assert req.attachments == []


def test_phase_state_typeddict_accepts_partial() -> None:
    s: PhaseState = {"user_input": "hello"}
    assert s["user_input"] == "hello"


@pytest.mark.asyncio
async def test_parse_verdict_fallback() -> None:
    from insomeos_agent.phase_graph import _parse_verdict

    v, notes = _parse_verdict('{"verdict":"approved","notes":"all good"}')
    assert v == Verdict.APPROVED
    assert "all good" in notes

    v2, _ = _parse_verdict("Looks great — APPROVED overall")
    assert v2 == Verdict.APPROVED

    v3, _ = _parse_verdict("Some issues, but REVISE")
    assert v3 == Verdict.REVISE


def test_parse_plan_takes_seven() -> None:
    from insomeos_agent.phase_graph import _parse_plan

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
