"""Shared LangGraph state schemas and enums.

Every 9-phase agent graph uses ``PhaseState`` as its base; fields specific
to a phase are merged in as a ``TypedDict`` extension.

Constitution compliance:
- §9 (AI does not self-evaluate): ``evaluator_verdict`` is populated by a
  *different* model than ``generator_output``.
- §13 (docs as environment): prompts are loaded from ``prompts/*.md``.
"""

from __future__ import annotations

from enum import Enum
from typing import Annotated, Any, Literal, TypedDict
from uuid import UUID

from pydantic import BaseModel, Field


class BusinessPhase(str, Enum):
    """Mirrors the Rust ``BusinessPhase`` in ``insomeos-shared``."""

    PRE_SALES = "pre_sales"
    CONCEPT = "concept"
    DEVELOP = "develop"
    COSTING = "costing"
    FABRICATION = "fabrication"
    LOGISTICS = "logistics"
    CONSTRUCTION = "construction"
    ACCEPTANCE = "acceptance"
    OPERATIONS = "operations"


class AgentRole(str, Enum):
    """The three Harness roles per Anthropic's Nov-2025 playbook."""

    PLANNER = "planner"
    GENERATOR = "generator"
    EVALUATOR = "evaluator"


class Verdict(str, Enum):
    APPROVED = "approved"
    REVISE = "revise"
    REJECTED = "rejected"


class ToolCall(BaseModel):
    """A structured tool invocation request."""

    name: str
    arguments: dict[str, Any]


class ToolResult(BaseModel):
    name: str
    ok: bool
    output: Any
    error: str | None = None


class PhaseState(TypedDict, total=False):
    """Shared state threaded through a phase graph."""

    # Identity
    project_id: str
    tenant_id: str
    phase: BusinessPhase
    request_id: str

    # User input
    user_input: str
    attachments: list[str]  # file storage keys

    # Planner output
    plan: list[str]
    planner_model: str

    # Generator output
    generator_output: str
    generator_model: str
    tool_calls: list[ToolCall]
    tool_results: list[ToolResult]

    # Evaluator output
    evaluator_verdict: Verdict
    evaluator_notes: str
    evaluator_model: str

    # RAG context
    rag_chunks: list[dict[str, Any]]

    # Final
    final_output: Any

    # Iteration control
    revision_count: int

    # Audit
    errors: Annotated[list[str], "append"]


class AgentRequest(BaseModel):
    """Inbound request from the L5 Gateway."""

    project_id: UUID
    tenant_id: UUID
    phase: BusinessPhase
    user_input: str
    attachments: list[str] = Field(default_factory=list)
    locale: Literal["zh-CN", "en-US", "es-ES", "ja-JP", "de-DE"] = "zh-CN"


class AgentResponse(BaseModel):
    """Outbound response back through the Gateway."""

    request_id: str
    phase: BusinessPhase
    verdict: Verdict
    final_output: Any
    revision_count: int
    trace: list[str]
