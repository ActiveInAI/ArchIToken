"""Base graph for the three-role Harness pattern.

All 9 phase graphs reuse this skeleton, overriding only the
phase-specific prompts and tool sets.

    user_input ──► planner ──► generator ──► evaluator ──► final
                                    ▲             │
                                    └── revise ◄──┘   (up to N times)

Constitution mapping:
- §1  Agent = Model + Harness       (this graph IS the Harness)
- §9  AI doesn't self-evaluate       (evaluator uses a different model)
- §14 Constraints > guidance         (evaluator rejects, doesn't rewrite)
- §15 Rollback < 30 s                (gateway RollbackGuard handles it)
"""

from __future__ import annotations

import uuid
from collections.abc import Awaitable, Callable

import structlog
from langgraph.graph import END, START, StateGraph

from .inference import DEFAULT_ROLE_MODELS, InferenceClient
from .prompts import load as load_prompt
from .state import AgentRole, BusinessPhase, PhaseState, Verdict

logger = structlog.get_logger(__name__)

MAX_REVISIONS = 2
"""Hard cap on revision loops; evaluator must approve or we give up."""


def build_phase_graph(
    phase: BusinessPhase,
    *,
    planner_prompt_name: str,
    generator_prompt_name: str,
    evaluator_prompt_name: str,
    inference_client: InferenceClient | None = None,
) -> Callable[[PhaseState], Awaitable[PhaseState]]:
    """Compile a LangGraph for a single business phase."""

    ic = inference_client or InferenceClient()

    async def planner_node(state: PhaseState) -> PhaseState:
        """Break the user's request into 3-7 concrete subtasks."""
        system = load_prompt(planner_prompt_name)
        user = state.get("user_input", "")
        messages = [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ]
        planner_model = DEFAULT_ROLE_MODELS[AgentRole.PLANNER]
        output = await ic.chat(
            model=planner_model,
            messages=messages,
            temperature=0.1,
            role=AgentRole.PLANNER,
        )
        plan = _parse_plan(output)
        logger.info("planner.done", phase=phase.value, steps=len(plan))
        return {
            **state,
            "planner_model": planner_model,
            "plan": plan,
        }

    async def generator_node(state: PhaseState) -> PhaseState:
        """Execute the plan; produce the phase deliverable."""
        system = load_prompt(generator_prompt_name)
        plan_text = "\n".join(f"- {s}" for s in state.get("plan", []))
        previous = state.get("generator_output", "")
        revision_note = ""
        if previous:
            revision_note = (
                f"\n\n[REVISION {state.get('revision_count', 0) + 1}] "
                f"Previous output was rejected. Evaluator said:\n"
                f"{state.get('evaluator_notes', '')}\n\n"
                f"Please address the feedback and regenerate."
            )
        messages = [
            {"role": "system", "content": system},
            {
                "role": "user",
                "content": (
                    f"User request: {state.get('user_input', '')}\n\n"
                    f"Plan:\n{plan_text}{revision_note}"
                ),
            },
        ]
        generator_model = DEFAULT_ROLE_MODELS[AgentRole.GENERATOR]
        output = await ic.chat(
            model=generator_model,
            messages=messages,
            temperature=0.3,
            max_tokens=8192,
            role=AgentRole.GENERATOR,
        )
        logger.info("generator.done", phase=phase.value, len=len(output))
        return {
            **state,
            "generator_model": generator_model,
            "generator_output": output,
            "revision_count": state.get("revision_count", 0) + 1,
        }

    async def evaluator_node(state: PhaseState) -> PhaseState:
        """Independently judge the generator's output (§9)."""
        system = load_prompt(evaluator_prompt_name)
        messages = [
            {"role": "system", "content": system},
            {
                "role": "user",
                "content": (
                    f"Original request:\n{state.get('user_input', '')}\n\n"
                    f"Candidate output:\n{state.get('generator_output', '')}\n\n"
                    "Respond as JSON with keys: verdict (approved|revise|rejected), "
                    "notes (string)."
                ),
            },
        ]
        evaluator_model = DEFAULT_ROLE_MODELS[AgentRole.EVALUATOR]
        raw = await ic.chat(
            model=evaluator_model,
            messages=messages,
            temperature=0.0,
            role=AgentRole.EVALUATOR,
        )
        verdict, notes = _parse_verdict(raw)
        logger.info("evaluator.done", phase=phase.value, verdict=verdict.value)
        return {
            **state,
            "evaluator_model": evaluator_model,
            "evaluator_verdict": verdict,
            "evaluator_notes": notes,
        }

    async def finalize_node(state: PhaseState) -> PhaseState:
        return {
            **state,
            "final_output": state.get("generator_output"),
        }

    def route_after_evaluator(state: PhaseState) -> str:
        verdict = state.get("evaluator_verdict", Verdict.REJECTED)
        revisions = state.get("revision_count", 0)
        if verdict == Verdict.APPROVED:
            return "finalize"
        if verdict == Verdict.REVISE and revisions < MAX_REVISIONS:
            return "generator"
        return "finalize"

    graph: StateGraph[PhaseState, None, PhaseState, PhaseState] = StateGraph(PhaseState)
    graph.add_node("planner", planner_node)
    graph.add_node("generator", generator_node)
    graph.add_node("evaluator", evaluator_node)
    graph.add_node("finalize", finalize_node)

    graph.add_edge(START, "planner")
    graph.add_edge("planner", "generator")
    graph.add_edge("generator", "evaluator")
    graph.add_conditional_edges(
        "evaluator",
        route_after_evaluator,
        {"generator": "generator", "finalize": "finalize"},
    )
    graph.add_edge("finalize", END)

    compiled = graph.compile()

    async def run(state: PhaseState) -> PhaseState:
        state.setdefault("request_id", uuid.uuid4().hex)
        state["phase"] = phase
        state.setdefault("revision_count", 0)
        result = await compiled.ainvoke(state, version="v2")
        return result.value

    return run


def _parse_plan(text: str) -> list[str]:
    lines = [ln.strip(" -•\t") for ln in text.splitlines() if ln.strip()]
    return [ln for ln in lines if ln and not ln.startswith("#")][:7]


def _parse_verdict(text: str) -> tuple[Verdict, str]:
    import json

    try:
        obj = json.loads(text)
        verdict = Verdict(obj.get("verdict", "revise"))
        notes = str(obj.get("notes", ""))
        return verdict, notes
    except (ValueError, TypeError):
        # Fall back: keyword detection.
        lower = text.lower()
        if "approved" in lower:
            return Verdict.APPROVED, text[:800]
        if "rejected" in lower:
            return Verdict.REJECTED, text[:800]
        return Verdict.REVISE, text[:800]
