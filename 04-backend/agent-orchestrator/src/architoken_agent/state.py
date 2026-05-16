"""Shared LangGraph state schemas for module-native agent runs."""

from __future__ import annotations

from enum import StrEnum
from operator import add
from typing import Annotated, Any, Literal, TypedDict
from uuid import UUID

from pydantic import BaseModel, Field

ModuleId = Literal[
    "marketing_service",
    "planning_management",
    "concept_design",
    "standard_library",
    "detailed_design",
    "quantity_costing",
    "material_logistics",
    "production_manufacturing",
    "construction_management",
    "digital_twin",
    "digital_archive",
    "finance_hr",
    "ai_center",
    "settings_center",
]

ACTIVE_MODULE_IDS: tuple[ModuleId, ...] = (
    "marketing_service",
    "planning_management",
    "concept_design",
    "standard_library",
    "detailed_design",
    "quantity_costing",
    "material_logistics",
    "production_manufacturing",
    "construction_management",
    "digital_twin",
    "digital_archive",
    "finance_hr",
    "ai_center",
    "settings_center",
)


class AgentRole(StrEnum):
    """The three Harness roles per Anthropic's Nov-2025 playbook."""

    PLANNER = "planner"
    GENERATOR = "generator"
    EVALUATOR = "evaluator"


class Verdict(StrEnum):
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


class ModuleState(TypedDict, total=False):
    """Shared state threaded through a module graph."""

    project_id: str
    tenant_id: str
    module_id: ModuleId
    request_id: str
    user_input: str
    attachments: list[str]
    plan: list[str]
    planner_model: str
    generator_output: str
    generator_model: str
    tool_calls: list[ToolCall]
    tool_results: list[ToolResult]
    evaluator_verdict: Verdict
    evaluator_notes: str
    evaluator_model: str
    rag_chunks: list[dict[str, Any]]
    final_output: Any
    revision_count: int
    errors: Annotated[list[str], add]


class AgentRequest(BaseModel):
    """Inbound request from the L5 Gateway."""

    project_id: UUID
    tenant_id: UUID
    module_id: ModuleId
    user_input: str
    attachments: list[str] = Field(default_factory=list)
    locale: Literal["zh-CN", "en-US", "es-ES", "ja-JP", "de-DE"] = "zh-CN"


class AgentResponse(BaseModel):
    """Outbound response back through the Gateway."""

    request_id: str
    module_id: ModuleId
    verdict: Verdict
    final_output: Any
    revision_count: int
    trace: list[str]
