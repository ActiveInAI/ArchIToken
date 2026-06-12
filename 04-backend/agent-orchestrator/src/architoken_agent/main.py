"""FastAPI application exposing the agent orchestrator to the Gateway."""

from __future__ import annotations

import uuid
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Literal

import structlog
import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from . import __version__
from .modules import get_runner, list_module_ids
from .settings import get_settings
from .state import AgentGateResult, AgentRequest, AgentResponse, ModuleState, Verdict

logger = structlog.get_logger(__name__)


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    cfg = get_settings()
    logger.info(
        "agent.starting",
        version=__version__,
        gateway=cfg.gateway_url,
        models=cfg.whitelisted_models,
    )
    yield
    logger.info("agent.shutdown")


app = FastAPI(
    title="ArchIToken Agent Orchestrator",
    version=__version__,
    description="L4 · LangGraph 3-role Harness for ArchIToken modules",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


@app.get("/healthz")
async def healthz() -> dict[str, str]:
    return {"status": "ok", "version": __version__}


@app.get("/readyz")
async def readyz() -> dict[str, str]:
    return {"status": "ready"}


@app.post("/v1/agents/invoke", response_model=AgentResponse)
async def invoke(req: AgentRequest) -> AgentResponse:
    """Run one business module end-to-end and return the verdict."""
    request_id = uuid.uuid4().hex
    try:
        runner = get_runner(req.module_id)
    except KeyError as exc:
        raise HTTPException(
            status_code=400, detail=f"unknown module_id: {req.module_id}"
        ) from exc

    initial: ModuleState = {
        "project_id": str(req.project_id),
        "tenant_id": str(req.tenant_id),
        "module_id": req.module_id,
        "user_input": req.user_input,
        "attachments": req.attachments,
        "request_id": request_id,
    }
    if req.roles:
        # Thread the Gateway-resolved caller roles into the run state so
        # ToolRouter enforces the caller's real permissions instead of the
        # settings default role union.
        initial["roles"] = req.roles

    logger.info(
        "agent.invoke.start",
        request_id=request_id,
        module_id=req.module_id,
        tenant_id=str(req.tenant_id),
    )

    try:
        final = await runner(initial)
    except Exception as exc:
        logger.exception("agent.invoke.error", request_id=request_id, error=str(exc))
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    verdict = final.get("approver_verdict", final.get("evaluator_verdict", Verdict.REVISE))
    trace = [
        (
            "tool_router="
            f"tool_calls:{len(final.get('tool_calls', []))};"
            f"rag_chunks:{len(final.get('rag_chunks', []))}"
        ),
        f"planner={final.get('planner_model', '?')}",
        f"generator={final.get('generator_model', '?')}",
        f"evaluator={final.get('evaluator_model', '?')}",
        f"evaluator_verdict={final.get('evaluator_verdict', '?')}",
        f"rule_checker={final.get('rule_checker_verdict', '?')}",
        f"schema_validator={final.get('schema_validator_verdict', '?')}",
        f"approver={final.get('approver_verdict', '?')}",
        f"output_status={final.get('output_status', '?')}",
        f"revisions={final.get('revision_count', 0)}",
    ]

    return AgentResponse(
        request_id=request_id,
        module_id=req.module_id,
        verdict=verdict,
        final_output=final.get("final_output"),
        revision_count=final.get("revision_count", 0),
        trace=trace,
        output_status=str(final.get("output_status", "draft_assist")),
        gates=_build_gate_results(final),
        tool_calls=final.get("tool_calls", []),
        tool_results=final.get("tool_results", []),
        rag_chunks=final.get("rag_chunks", []),
        tool_router_notes=str(final.get("tool_router_notes", "")),
        planner_model=final.get("planner_model"),
        generator_model=final.get("generator_model"),
        evaluator_model=final.get("evaluator_model"),
    )


@app.get("/v1/modules")
async def list_modules() -> dict[str, list[str]]:
    return {"modules": list(list_module_ids())}


GateStatus = Literal["passed", "needs_review", "blocked"]


def _gate_status(verdict: object | None) -> GateStatus:
    if verdict == Verdict.APPROVED:
        return "passed"
    if verdict == Verdict.REVISE:
        return "needs_review"
    return "blocked"


def _build_gate_results(final: ModuleState) -> list[AgentGateResult]:
    planner_status: GateStatus = "passed" if final.get("plan") else "blocked"
    generator_status: GateStatus = (
        "passed" if final.get("generator_output") else "blocked"
    )
    return [
        AgentGateResult(
            name="ToolRouter",
            status="passed" if final.get("tool_calls") else "blocked",
            notes=str(final.get("tool_router_notes", "")),
        ),
        AgentGateResult(
            name="Planner",
            status=planner_status,
            notes=f"{len(final.get('plan', []))} plan steps prepared.",
            model=final.get("planner_model"),
        ),
        AgentGateResult(
            name="Generator",
            status=generator_status,
            notes="Generated module output." if generator_status == "passed" else "No output.",
            model=final.get("generator_model"),
        ),
        AgentGateResult(
            name="Evaluator",
            status=_gate_status(final.get("evaluator_verdict")),
            verdict=final.get("evaluator_verdict"),
            notes=str(final.get("evaluator_notes", "")),
            model=final.get("evaluator_model"),
        ),
        AgentGateResult(
            name="RuleChecker",
            status=_gate_status(final.get("rule_checker_verdict")),
            verdict=final.get("rule_checker_verdict"),
            notes=str(final.get("rule_checker_notes", "")),
        ),
        AgentGateResult(
            name="SchemaValidator",
            status=_gate_status(final.get("schema_validator_verdict")),
            verdict=final.get("schema_validator_verdict"),
            notes=str(final.get("schema_validator_notes", "")),
        ),
        AgentGateResult(
            name="Approver",
            status=_gate_status(final.get("approver_verdict")),
            verdict=final.get("approver_verdict"),
            notes=str(final.get("approver_notes", "")),
        ),
    ]


def main() -> None:
    cfg = get_settings()
    uvicorn.run(
        "architoken_agent.main:app",
        host=cfg.host,
        port=cfg.port,
        log_level=cfg.log_level.lower(),
        access_log=True,
    )


if __name__ == "__main__":
    main()
