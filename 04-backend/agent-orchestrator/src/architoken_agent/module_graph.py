"""Base graph for the three-role Harness pattern.

All module graphs reuse this runner shape, overriding only module prompts.

    user_input ──► tool_router ──► planner ──► generator ──► evaluator
                                    ▲             │
                                    └── revise ◄──┘   (up to N times)

        ──► rule_checker ──► schema_validator ──► approver ──► final

Constitution mapping:
- §1  Agent = Model + Harness       (this graph IS the Harness)
- §9  AI doesn't self-evaluate       (evaluator uses a different model)
- §12 Planner -> Generator -> Evaluator -> RuleChecker -> SchemaValidator -> Approver
- §14 Constraints > guidance         (gates reject, don't rewrite)
- §15 Rollback < 30 s                (gateway RollbackGuard handles it)
"""

from __future__ import annotations

import uuid
from collections.abc import Awaitable, Callable

from .compliance import compliance_profile_for, validate_module_compliance
from .inference import InferenceClient, model_for_role
from .logging import get_logger
from .prompts import load as load_prompt
from .state import AgentRole, GateFinding, ModuleId, ModuleState, Verdict
from .tool_router import ToolRouter

logger = get_logger(__name__)

MAX_REVISIONS = 2
"""Hard cap on revision loops; evaluator must approve or we give up."""

PROTECTED_READY_CLAIMS = (
    "合规",
    "不合规",
    "可施工",
    "可报审",
    "可验收",
    "可生产",
    "可归档",
    "submission-ready",
    "construction-ready",
    "acceptance-ready",
    "production-ready",
)

REQUIRED_REVIEW_STATE = "professional_review_required"


def build_module_graph(
    module_id: ModuleId,
    *,
    planner_prompt_name: str,
    generator_prompt_name: str,
    evaluator_prompt_name: str,
    inference_client: InferenceClient | None = None,
) -> Callable[[ModuleState], Awaitable[ModuleState]]:
    """Compile a LangGraph for a single business module."""

    ic = inference_client or InferenceClient()
    tool_router = ToolRouter()

    async def tool_router_node(state: ModuleState) -> ModuleState:
        routed = await tool_router.route_async(state)
        logger.info(
            "tool_router.done",
            module_id=module_id,
            tool_calls=len(routed.get("tool_calls", [])),
            rag_chunks=len(routed.get("rag_chunks", [])),
        )
        return routed

    async def planner_node(state: ModuleState) -> ModuleState:
        """Break the user's request into 3-7 concrete subtasks."""
        system = load_prompt(planner_prompt_name)
        user = state.get("user_input", "")
        context = _format_governed_context(state)
        messages = [
            {"role": "system", "content": system},
            {
                "role": "user",
                "content": f"{user}\n\n{context}" if context else user,
            },
        ]
        planner_model = model_for_role(AgentRole.PLANNER)
        output = await ic.chat(
            model=planner_model,
            messages=messages,
            temperature=0.1,
            role=AgentRole.PLANNER,
        )
        plan = _parse_plan(output)
        logger.info("planner.done", module_id=module_id, steps=len(plan))
        return {
            **state,
            "planner_model": planner_model,
            "plan": plan,
        }

    async def generator_node(state: ModuleState) -> ModuleState:
        """Execute the plan and produce the module deliverable."""
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
                    f"{_format_governed_context(state)}\n\n"
                    f"Plan:\n{plan_text}{revision_note}"
                ),
            },
        ]
        generator_model = model_for_role(AgentRole.GENERATOR)
        output = await ic.chat(
            model=generator_model,
            messages=messages,
            temperature=0.3,
            max_tokens=8192,
            role=AgentRole.GENERATOR,
        )
        logger.info("generator.done", module_id=module_id, len=len(output))
        return {
            **state,
            "generator_model": generator_model,
            "generator_output": output,
            "revision_count": state.get("revision_count", 0) + 1,
        }

    async def evaluator_node(state: ModuleState) -> ModuleState:
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
        evaluator_model = model_for_role(AgentRole.EVALUATOR)
        raw = await ic.chat(
            model=evaluator_model,
            messages=messages,
            temperature=0.0,
            role=AgentRole.EVALUATOR,
        )
        verdict, notes = _parse_verdict(raw)
        logger.info("evaluator.done", module_id=module_id, verdict=verdict.value)
        return {
            **state,
            "evaluator_model": evaluator_model,
            "evaluator_verdict": verdict,
            "evaluator_notes": notes,
        }

    async def rule_checker_node(state: ModuleState) -> ModuleState:
        """Run deterministic professional and standards-boundary checks."""

        evaluator_verdict = state.get("evaluator_verdict", Verdict.REJECTED)
        output = state.get("generator_output", "") or ""
        rag_chunks = state.get("rag_chunks", [])
        notes: list[str] = []
        findings: list[GateFinding] = []

        def fail(
            code: str, severity: str, message: str, *, standard: str | None = None
        ) -> None:
            notes.append(message)
            findings.append(
                GateFinding(
                    code=code,
                    severity=severity,  # type: ignore[arg-type]
                    message=message,
                    standard=standard,
                )
            )

        verdict = Verdict.APPROVED
        compliance_errors = validate_module_compliance(module_id)
        compliance_profile = compliance_profile_for(module_id)
        if compliance_errors:
            verdict = Verdict.REJECTED
            fail(
                "compliance_profile_incomplete",
                "error",
                "Module compliance profile is incomplete: "
                + "; ".join(compliance_errors),
            )
        elif compliance_profile:
            notes.append(
                "Module compliance profile bound: roles="
                + ", ".join(compliance_profile.professional_roles[:3])
                + "; standards="
                + ", ".join(compliance_profile.standards_profile[:3])
                + "."
            )

        if evaluator_verdict != Verdict.APPROVED:
            verdict = evaluator_verdict
            fail(
                "evaluator_not_approved",
                "error" if evaluator_verdict == Verdict.REJECTED else "warning",
                "Evaluator did not approve the generated output.",
            )
        if not output.strip():
            verdict = Verdict.REJECTED
            fail("generator_output_empty", "error", "Generator output is empty.")

        lower_output = output.lower()
        has_review_boundary = (
            REQUIRED_REVIEW_STATE in lower_output
            or "专业复核" in output
            or "人工复核" in output
            or "待审批" in output
        )
        protected_hits = [
            claim
            for claim in PROTECTED_READY_CLAIMS
            if claim.lower() in lower_output or claim in output
        ]
        if protected_hits and not has_review_boundary:
            verdict = Verdict.REVISE if verdict == Verdict.APPROVED else verdict
            fail(
                "protected_claim_missing_review_boundary",
                "warning",
                "Protected professional readiness claims require explicit professional review "
                f"boundary: {', '.join(protected_hits[:5])}.",
            )
        if protected_hits and not _has_nonheuristic_source_evidence(rag_chunks):
            verdict = Verdict.REVISE if verdict == Verdict.APPROVED else verdict
            fail(
                "protected_claim_missing_source_evidence",
                "warning",
                "Protected professional claims require non-heuristic source evidence from "
                "knowledge registry, CDE, audit chain or module compliance profile.",
            )
        if protected_hits and not _has_citation_hint(output):
            verdict = Verdict.REVISE if verdict == Verdict.APPROVED else verdict
            fail(
                "protected_claim_missing_citation",
                "warning",
                "Protected professional claims require an explicit source, standard, "
                "contract, policy or evidence citation in the output.",
            )

        if verdict == Verdict.APPROVED:
            notes.append("Deterministic professional-boundary checks passed.")
        logger.info("rule_checker.done", module_id=module_id, verdict=verdict.value)
        return {
            **state,
            "rule_checker_verdict": verdict,
            "rule_checker_notes": " ".join(notes),
            "rule_checker_findings": findings,
        }

    async def schema_validator_node(state: ModuleState) -> ModuleState:
        """Validate module state, tool evidence and source-reference shape."""

        notes: list[str] = []
        findings: list[GateFinding] = []

        def invalid(code: str, message: str, field: str | None = None) -> None:
            notes.append(message)
            findings.append(
                GateFinding(
                    code=code, severity="error", message=message, field=field
                )
            )

        if not state.get("request_id"):
            invalid("request_id_required", "request_id is required.", "request_id")
        if state.get("module_id") != module_id:
            invalid(
                "module_id_mismatch",
                "module_id does not match compiled runner.",
                "module_id",
            )
        if validate_module_compliance(module_id):
            invalid(
                "compliance_profile_required",
                "module compliance profile is required for production registry use.",
                "module_compliance_profile",
            )
        if not isinstance(state.get("plan"), list) or not state.get("plan"):
            invalid("plan_empty", "plan must contain at least one step.", "plan")
        if not isinstance(state.get("generator_output"), str) or not state.get(
            "generator_output"
        ):
            invalid(
                "generator_output_invalid",
                "generator_output must be a non-empty string.",
                "generator_output",
            )
        if not _valid_tool_results(state.get("tool_results", [])):
            invalid(
                "tool_results_unstructured",
                "tool_results must contain structured ToolRouter evidence.",
                "tool_results",
            )
        for rag_note in _validate_rag_chunks(state.get("rag_chunks", [])):
            invalid("rag_chunk_invalid", rag_note, "rag_chunks")
        if state.get("rule_checker_verdict") == Verdict.REJECTED:
            invalid(
                "rule_checker_rejected",
                "rule_checker rejected this output.",
                "rule_checker_verdict",
            )

        verdict = Verdict.REJECTED if notes else Verdict.APPROVED
        logger.info("schema_validator.done", module_id=module_id, verdict=verdict.value)
        return {
            **state,
            "schema_validator_verdict": verdict,
            "schema_validator_notes": " ".join(notes)
            if notes
            else "Module state schema is valid for the approval gate.",
            "schema_validator_findings": findings,
        }

    async def approver_node(state: ModuleState) -> ModuleState:
        """Issue the final machine gate while preserving professional review state."""

        named_verdicts = {
            "Evaluator": state.get("evaluator_verdict", Verdict.REJECTED),
            "RuleChecker": state.get("rule_checker_verdict", Verdict.REJECTED),
            "SchemaValidator": state.get("schema_validator_verdict", Verdict.REJECTED),
        }
        gate_verdicts = list(named_verdicts.values())
        findings: list[GateFinding] = []
        if all(verdict == Verdict.APPROVED for verdict in gate_verdicts):
            verdict = Verdict.APPROVED
            output_status = REQUIRED_REVIEW_STATE
            notes = (
                "Machine gates passed. Output remains professional_review_required "
                "until the responsible human approver signs linked evidence."
            )
        elif any(verdict == Verdict.REJECTED for verdict in gate_verdicts):
            verdict = Verdict.REJECTED
            output_status = "draft_assist"
            blocking = [n for n, v in named_verdicts.items() if v == Verdict.REJECTED]
            notes = "Machine gates rejected the output; do not use as a downstream artifact."
            findings.append(
                GateFinding(
                    code="approver_blocked",
                    severity="error",
                    message=f"Rejected by upstream gate(s): {', '.join(blocking)}.",
                )
            )
        else:
            verdict = Verdict.REVISE
            output_status = "draft_assist"
            revising = [n for n, v in named_verdicts.items() if v == Verdict.REVISE]
            notes = "Machine gates require revision before approval."
            findings.append(
                GateFinding(
                    code="approver_needs_revision",
                    severity="warning",
                    message=f"Revision required by upstream gate(s): {', '.join(revising)}.",
                )
            )

        logger.info("approver.done", module_id=module_id, verdict=verdict.value)
        return {
            **state,
            "approver_verdict": verdict,
            "approver_notes": notes,
            "approver_findings": findings,
            "output_status": output_status,
        }

    async def finalize_node(state: ModuleState) -> ModuleState:
        return {
            **state,
            "final_output": state.get("generator_output"),
        }

    def route_after_evaluator(state: ModuleState) -> str:
        verdict = state.get("evaluator_verdict", Verdict.REJECTED)
        revisions = state.get("revision_count", 0)
        if verdict == Verdict.APPROVED:
            return "finalize"
        if verdict == Verdict.REVISE and revisions < MAX_REVISIONS:
            return "generator"
        return "finalize"

    async def run(state: ModuleState) -> ModuleState:
        state.setdefault("request_id", uuid.uuid4().hex)
        state["module_id"] = module_id
        state.setdefault("revision_count", 0)
        current = await tool_router_node(state)
        current = await planner_node(current)
        while True:
            current = await generator_node(current)
            current = await evaluator_node(current)
            if route_after_evaluator(current) != "generator":
                break
        current = await rule_checker_node(current)
        current = await schema_validator_node(current)
        current = await approver_node(current)
        return await finalize_node(current)

    return run


def _parse_plan(text: str) -> list[str]:
    lines = [ln.strip(" -•\t") for ln in text.splitlines() if ln.strip()]
    return [ln for ln in lines if ln and not ln.startswith("#")][:7]


def _format_governed_context(state: ModuleState) -> str:
    """Format routed tool and RAG context for model prompts."""

    chunks = state.get("rag_chunks", [])
    tool_calls = state.get("tool_calls", [])
    lines: list[str] = []
    if chunks:
        lines.append("Governed RAG source references:")
        for chunk in chunks[:6]:
            lines.append(
                "- "
                f"{chunk.get('title', 'source')} "
                f"({chunk.get('source', 'unknown')}): "
                f"{chunk.get('content', '')}"
            )
    if tool_calls:
        lines.append("Routed tool intents:")
        for call in tool_calls[:6]:
            lines.append(f"- {call.name}")
    if not lines:
        return ""
    lines.append(
        "Do not claim compliance or readiness from routed context without human approval."
    )
    return "\n".join(lines)


def _has_nonheuristic_source_evidence(chunks: object) -> bool:
    if not isinstance(chunks, list):
        return False
    accepted_kinds = {
        "knowledge_source",
        "rag_chunk",
        "cde_file",
        "audit_event",
        "module_compliance_profile",
    }
    return any(
        isinstance(chunk, dict)
        and chunk.get("source_kind") in accepted_kinds
        and chunk.get("retrieval_status") not in {"unresolved_reference"}
        for chunk in chunks
    )


def _has_citation_hint(output: str) -> bool:
    citation_terms = (
        "依据",
        "来源",
        "证据",
        "标准",
        "规范",
        "合同",
        "条款",
        "policy",
        "standard",
        "source",
        "evidence",
        "contract",
        "GB ",
        "GB/T",
        "ISO",
        "JGJ",
    )
    return any(term in output for term in citation_terms)


def _valid_tool_results(results: object) -> bool:
    if not isinstance(results, list) or not results:
        return False
    required = {
        "module_registry.lookup",
        "knowledge_registry.retrieve",
        "rag.retrieve",
        "cde.list_module_files",
        "audit_trail.list_events",
        "audit_trail.prepare_event",
    }
    names = {
        item.name if hasattr(item, "name") else item.get("name")
        for item in results
        if hasattr(item, "name") or isinstance(item, dict)
    }
    return required.issubset(names)


def _validate_rag_chunks(chunks: object) -> list[str]:
    if not isinstance(chunks, list) or not chunks:
        return ["rag_chunks must contain governed source references."]
    notes: list[str] = []
    required_fields = {
        "source",
        "title",
        "content",
        "source_kind",
        "retrieval_status",
        "citation_required",
    }
    for index, chunk in enumerate(chunks[:12], start=1):
        if not isinstance(chunk, dict):
            notes.append(f"rag_chunks[{index}] must be an object.")
            continue
        missing = required_fields.difference(chunk)
        if missing:
            notes.append(
                f"rag_chunks[{index}] missing required fields: "
                + ", ".join(sorted(missing))
            )
    return notes


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
