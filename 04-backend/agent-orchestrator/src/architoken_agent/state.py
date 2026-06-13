"""Shared LangGraph state schemas for module-native agent runs."""

from __future__ import annotations

from enum import StrEnum
from operator import add
from typing import Annotated, Any, Literal, TypedDict
from uuid import UUID

from pydantic import BaseModel, Field, field_validator

from . import module_specs

ModuleId = str
ACTIVE_MODULE_IDS = module_specs.ACTIVE_MODULE_IDS


class AgentRole(StrEnum):
    """Agent execution roles used by the Harness chain."""

    TOOL_ROUTER = "tool_router"
    PLANNER = "planner"
    GENERATOR = "generator"
    EVALUATOR = "evaluator"
    RULE_CHECKER = "rule_checker"
    SCHEMA_VALIDATOR = "schema_validator"
    APPROVER = "approver"


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


class GateFinding(BaseModel):
    """One machine-checkable finding emitted by a deterministic gate.

    Carries a stable ``code`` and ``severity`` so downstream systems (audit
    ledger, frontend, automated policy) can act on rule/schema results without
    parsing free-text notes.
    """

    code: str
    severity: Literal["error", "warning", "info"]
    message: str
    # Optional pointer at the offending state field (schema findings) or the
    # standard/policy a rule finding maps to.
    field: str | None = None
    standard: str | None = None


class AgentGateResult(BaseModel):
    """Structured evidence for one agent gate in the returned trace."""

    name: str
    status: Literal["passed", "needs_review", "blocked"]
    verdict: Verdict | None = None
    notes: str = ""
    findings: list[GateFinding] = Field(default_factory=list)
    model: str | None = None


class ModuleState(TypedDict, total=False):
    """Shared state threaded through a module graph."""

    project_id: str
    tenant_id: str
    module_id: ModuleId
    request_id: str
    user_input: str
    attachments: list[str]
    # Caller identity forwarded by the Gateway; ToolRouter resolves ``roles``
    # (comma-separated) to per-tool permissions and falls back to settings
    # defaults when absent.
    actor: str
    roles: str
    plan: list[str]
    planner_model: str
    generator_output: str
    generator_model: str
    tool_calls: list[ToolCall]
    tool_results: list[ToolResult]
    tool_router_notes: str
    module_compliance_profile: dict[str, Any] | None
    evaluator_verdict: Verdict
    evaluator_notes: str
    evaluator_model: str
    rule_checker_verdict: Verdict
    rule_checker_notes: str
    rule_checker_findings: list[GateFinding]
    schema_validator_verdict: Verdict
    schema_validator_notes: str
    schema_validator_findings: list[GateFinding]
    approver_verdict: Verdict
    approver_notes: str
    approver_findings: list[GateFinding]
    output_status: str
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
    # Comma-separated caller roles resolved by the Gateway from RBAC claims
    # (e.g. ``"engineer,reviewer"``). Optional for backward compatibility:
    # when omitted, ToolRouter falls back to the settings default roles.
    roles: str | None = None

    @field_validator("module_id")
    @classmethod
    def validate_registered_module_id(cls, value: str) -> str:
        """Accept registered module ids and migration aliases only."""

        normalized = module_specs.normalize_module_id(value)
        if normalized is None:
            raise ValueError(f"unknown module_id: {value}")
        return normalized


class AgentResponse(BaseModel):
    """Outbound response back through the Gateway."""

    request_id: str
    module_id: ModuleId
    verdict: Verdict
    final_output: Any
    revision_count: int
    trace: list[str]
    output_status: str
    gates: list[AgentGateResult]
    tool_calls: list[ToolCall]
    tool_results: list[ToolResult]
    rag_chunks: list[dict[str, Any]]
    tool_router_notes: str
    # Model routing identities for the agent_invocations run ledger (audit 2026-06-11 R1).
    planner_model: str | None = None
    generator_model: str | None = None
    evaluator_model: str | None = None
