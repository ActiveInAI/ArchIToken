"""FastAPI application exposing the agent orchestrator to the Gateway."""

from __future__ import annotations

import uuid
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

import structlog
import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from . import __version__
from .modules import get_runner, list_module_ids
from .settings import get_settings
from .state import AgentRequest, AgentResponse, ModuleState, Verdict

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

    verdict = final.get("evaluator_verdict", Verdict.REVISE)
    trace = [
        f"planner={final.get('planner_model', '?')}",
        f"generator={final.get('generator_model', '?')}",
        f"evaluator={final.get('evaluator_model', '?')}",
        f"revisions={final.get('revision_count', 0)}",
    ]

    return AgentResponse(
        request_id=request_id,
        module_id=req.module_id,
        verdict=verdict,
        final_output=final.get("final_output"),
        revision_count=final.get("revision_count", 0),
        trace=trace,
    )


@app.get("/v1/modules")
async def list_modules() -> dict[str, list[str]]:
    return {"modules": list(list_module_ids())}


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
