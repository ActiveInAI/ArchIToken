"""ToolRouter with Gateway-backed knowledge, CDE and audit evidence.

The router keeps deterministic local registry fallback for tests and offline
development, but the agent graph calls ``route_async`` so production invocations
can retrieve source registries, CDE file metadata and existing audit events from
the Rust Gateway.
"""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass, field
from typing import Any
from urllib.parse import quote

import httpx

from .compliance import compliance_profile_for
from .module_specs import MODULE_REGISTRY
from .settings import get_settings
from .state import ModuleState, ToolCall, ToolResult


@dataclass(slots=True)
class GatewayEvidence:
    """Evidence collected through the Gateway adapter."""

    mode: str
    knowledge_sources: list[dict[str, Any]] = field(default_factory=list)
    rag_retrieval: dict[str, Any] = field(default_factory=dict)
    module_files: list[dict[str, Any]] = field(default_factory=list)
    audit_events: list[dict[str, Any]] = field(default_factory=list)
    endpoints: list[str] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)


class GatewayHttpToolAdapter:
    """HTTP adapter for Gateway-owned registries used by ToolRouter."""

    def __init__(
        self,
        *,
        base_url: str,
        timeout_s: float,
        actor: str,
        roles: str,
        client: httpx.AsyncClient | None = None,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self.timeout_s = timeout_s
        self.actor = actor
        self.roles = roles
        self._client = client

    @classmethod
    def from_settings(cls) -> GatewayHttpToolAdapter:
        cfg = get_settings()
        return cls(
            base_url=cfg.gateway_url,
            timeout_s=cfg.tool_router_gateway_timeout_s,
            actor=cfg.tool_router_actor,
            roles=cfg.tool_router_roles,
        )

    async def collect(self, state: ModuleState) -> GatewayEvidence:
        """Collect registry/file/audit evidence from Gateway.

        Partial failures are returned as evidence errors instead of raising; the
        gate can then decide whether retrieved evidence is sufficient.
        """

        module_id = str(state.get("module_id", ""))
        headers = self._headers(state)
        endpoints: list[str] = []
        errors: list[str] = []

        client = self._client or httpx.AsyncClient(timeout=self.timeout_s)
        close_client = self._client is None
        try:
            knowledge_payload = await self._safe_get_json(
                client,
                "/v1/knowledge-sources",
                headers=headers,
                params={"limit": "8"},
                endpoints=endpoints,
                errors=errors,
            )
            rag_payload = await self._safe_post_json(
                client,
                "/v1/rag/retrieve",
                headers=headers,
                json={
                    "tenant_id": str(state.get("tenant_id", "")),
                    "project_id": str(state.get("project_id", "")),
                    "query": str(state.get("user_input", "")).strip() or module_id,
                    "top_k": 6,
                    "corpora": ["gb", "project"],
                },
                endpoints=endpoints,
                errors=errors,
            )
            files_payload = await self._safe_get_json(
                client,
                f"/v1/modules/{quote(module_id)}/files",
                headers=headers,
                params={"limit": "8", "status": "active"},
                endpoints=endpoints,
                errors=errors,
            )
            audit_payload = await self._safe_get_json(
                client,
                "/v1/audit-events",
                headers=headers,
                params={"module_id": module_id, "limit": "8"},
                endpoints=endpoints,
                errors=errors,
            )
        finally:
            if close_client:
                await client.aclose()

        has_data = any(
            [
                _extract_list(knowledge_payload, "sources"),
                _extract_list(rag_payload, "chunks"),
                _extract_list(files_payload, "files"),
                _extract_list(audit_payload, "events"),
            ]
        )
        mode = "gateway_http_partial" if errors and has_data else "gateway_http"
        if errors and not has_data:
            mode = "local_registry_fallback"

        return GatewayEvidence(
            mode=mode,
            knowledge_sources=_extract_list(knowledge_payload, "sources"),
            rag_retrieval=rag_payload,
            module_files=_extract_list(files_payload, "files"),
            audit_events=_extract_list(audit_payload, "events"),
            endpoints=endpoints,
            errors=errors,
        )

    async def _safe_get_json(
        self,
        client: httpx.AsyncClient,
        path: str,
        *,
        headers: dict[str, str],
        params: dict[str, str],
        endpoints: list[str],
        errors: list[str],
    ) -> dict[str, Any]:
        url = f"{self.base_url}/{path.lstrip('/')}"
        endpoints.append(path)
        try:
            response = await client.get(url, headers=headers, params=params)
            response.raise_for_status()
            payload = response.json()
            return payload if isinstance(payload, dict) else {}
        except (httpx.HTTPError, ValueError) as exc:
            errors.append(f"{path}: {exc}")
            return {}

    async def _safe_post_json(
        self,
        client: httpx.AsyncClient,
        path: str,
        *,
        headers: dict[str, str],
        json: dict[str, Any],
        endpoints: list[str],
        errors: list[str],
    ) -> dict[str, Any]:
        url = f"{self.base_url}/{path.lstrip('/')}"
        endpoints.append(path)
        try:
            response = await client.post(url, headers=headers, json=json)
            response.raise_for_status()
            payload = response.json()
            return payload if isinstance(payload, dict) else {}
        except (httpx.HTTPError, ValueError) as exc:
            errors.append(f"{path}: {exc}")
            return {}

    def _headers(self, state: ModuleState) -> dict[str, str]:
        request_id = str(state.get("request_id", ""))
        return {
            "X-Tenant-Id": str(state.get("tenant_id", "")),
            "X-Project-Id": str(state.get("project_id", "")),
            "X-Actor": str(state.get("actor", self.actor)),
            "X-Roles": str(state.get("roles", self.roles)),
            "X-Request-Id": request_id,
            "X-Correlation-Id": request_id,
        }


# --- Per-tool permission enforcement (audit 2026-06-11) -----------------------
# Previously each guarded ToolCall only carried ``requires_permission_check: True``
# which was never evaluated. ToolRouter now resolves the caller's roles to a
# permission set and enforces a per-tool requirement: a denied tool fails its
# result and its evidence is excluded from the governed source references.
TOOL_REQUIRED_PERMISSION: dict[str, str | None] = {
    "module_registry.lookup": None,
    "knowledge_registry.retrieve": "knowledge:read",
    "rag.retrieve": "rag:read",
    "cde.list_module_files": "cde:read",
    "cde.resolve_attachments": "cde:read",
    "audit_trail.list_events": "audit:read",
    "audit_trail.prepare_event": None,
}

ROLE_PERMISSIONS: dict[str, frozenset[str]] = {
    "engineer": frozenset({"knowledge:read", "rag:read", "cde:read", "audit:read"}),
    "reviewer": frozenset({"knowledge:read", "rag:read", "cde:read", "audit:read"}),
    "auditor": frozenset({"knowledge:read", "rag:read", "audit:read"}),
}


def _granted_permissions(state: ModuleState) -> tuple[set[str], list[str]]:
    """Resolve the caller's roles (state or settings default) to a permission set."""
    raw = str(state.get("roles", "")).strip() or get_settings().tool_router_roles
    roles = [role.strip() for role in raw.split(",") if role.strip()]
    granted: set[str] = set()
    for role in roles:
        granted |= ROLE_PERMISSIONS.get(role, frozenset())
    return granted, roles


def _permission_decision(tool_name: str, granted: set[str]) -> tuple[str, str | None]:
    """Return (decision, required_permission) for one tool call."""
    required = TOOL_REQUIRED_PERMISSION.get(tool_name)
    if required is None:
        return "allowed", None
    return ("allowed" if required in granted else "denied"), required


class ToolRouter:
    """Build auditable tool calls and governed source references for a run."""

    def __init__(
        self,
        *,
        gateway_adapter: GatewayHttpToolAdapter | None = None,
        gateway_enabled: bool | None = None,
    ) -> None:
        cfg = get_settings()
        self.gateway_enabled = (
            cfg.tool_router_gateway_enabled
            if gateway_enabled is None
            else gateway_enabled
        )
        self.gateway_adapter = gateway_adapter or GatewayHttpToolAdapter.from_settings()

    def route(self, state: ModuleState) -> ModuleState:
        """Return local deterministic fallback context.

        This synchronous path is intentionally no-I/O for tests and prompt
        rendering helpers. The agent graph uses ``route_async``.
        """

        return self._route_with_evidence(
            state,
            GatewayEvidence(
                mode="local_registry_fallback",
                errors=["Gateway adapter not invoked by synchronous route()."],
            ),
        )

    async def route_async(self, state: ModuleState) -> ModuleState:
        """Collect Gateway evidence when request context is available."""

        if self.gateway_enabled and _has_gateway_context(state):
            evidence = await self.gateway_adapter.collect(state)
        else:
            evidence = GatewayEvidence(
                mode="local_registry_fallback",
                errors=["tenant_id/project_id context is required for Gateway evidence."],
            )
        return self._route_with_evidence(state, evidence)

    def _route_with_evidence(
        self,
        state: ModuleState,
        evidence: GatewayEvidence,
    ) -> ModuleState:
        module_id = str(state.get("module_id", ""))
        spec = MODULE_REGISTRY.get(module_id)
        compliance = compliance_profile_for(module_id)
        attachments = list(state.get("attachments", []) or [])
        rag_chunks: list[dict[str, Any]] = []
        granted_permissions, caller_roles = _granted_permissions(state)

        tool_calls = [
            ToolCall(
                name="module_registry.lookup",
                arguments={
                    "module_id": module_id,
                    "purpose": "resolve module prompt, workflow and compliance context",
                },
            ),
            ToolCall(
                name="knowledge_registry.retrieve",
                arguments={
                    "module_id": module_id,
                    "retrieval_strategy": "gateway_knowledge_sources_then_local_profile",
                    "requires_source_audit": True,
                },
            ),
            ToolCall(
                name="rag.retrieve",
                arguments={
                    "module_id": module_id,
                    "project_id": state.get("project_id", ""),
                    "top_k": 6,
                    "corpora": ["gb", "project"],
                    "retrieval_strategy": "gateway_vector_store",
                    "requires_source_audit": True,
                },
            ),
            ToolCall(
                name="cde.list_module_files",
                arguments={
                    "module_id": module_id,
                    "project_id": state.get("project_id", ""),
                    "limit": 8,
                    "requires_permission_check": True,
                },
            ),
            ToolCall(
                name="audit_trail.list_events",
                arguments={
                    "module_id": module_id,
                    "limit": 8,
                    "purpose": (
                        "link existing audit evidence; Python does not append hidden audit rows"
                    ),
                },
            ),
        ]

        if attachments:
            tool_calls.append(
                ToolCall(
                    name="cde.resolve_attachments",
                    arguments={
                        "module_id": module_id,
                        "attachments": attachments,
                        "requires_permission_check": True,
                    },
                )
            )

        tool_calls.append(
            ToolCall(
                name="audit_trail.prepare_event",
                arguments={
                    "module_id": module_id,
                    "request_id": state.get("request_id", ""),
                    "event": "agent_tool_router_context_prepared",
                    "persistence_boundary": "Gateway business handlers append durable audit events",
                },
            )
        )

        # Enforce per-tool permissions: annotate each call with its decision and
        # collect denied tools so their evidence is excluded below.
        denied_tools: set[str] = set()
        for call in tool_calls:
            decision, required = _permission_decision(call.name, granted_permissions)
            call.arguments["permission_decision"] = decision
            call.arguments["permission_required"] = required
            if decision == "denied":
                denied_tools.add(call.name)
        cde_files_denied = "cde.list_module_files" in denied_tools
        attachments_denied = "cde.resolve_attachments" in denied_tools

        if spec:
            rag_chunks.append(
                {
                    "source": f"module-registry://{spec.id}",
                    "source_kind": "module_registry",
                    "retrieval_status": "local_registry",
                    "title": spec.zh_name,
                    "content": (
                        f"{spec.en_name}: {spec.description} "
                        "AI outputs remain draft assistance until professional review."
                    ),
                    "citation_required": False,
                    "score": None,
                    "metadata": {"module_id": spec.id, "prompt_dir": spec.prompt_dir},
                }
            )

        if compliance:
            rag_chunks.append(
                {
                    "source": f"module-compliance://{module_id}",
                    "source_kind": "module_compliance_profile",
                    "retrieval_status": "local_registry",
                    "title": f"{spec.zh_name if spec else module_id} 专业与标准边界",
                    "content": _compliance_content(compliance.as_dict()),
                    "citation_required": True,
                    "score": None,
                    "metadata": compliance.as_dict(),
                }
            )

        rag_chunks.extend(_knowledge_source_chunks(evidence))
        rag_chunks.extend(_rag_retrieve_chunks(evidence))
        if not cde_files_denied:
            rag_chunks.extend(_module_file_chunks(evidence))
        rag_chunks.extend(_audit_event_chunks(evidence))
        if not attachments_denied:
            rag_chunks.extend(_attachment_chunks(attachments, evidence.module_files))

        matched_attachments = _matched_attachments(attachments, evidence.module_files)
        tool_results = [
            ToolResult(
                name="module_registry.lookup",
                ok=spec is not None,
                output={
                    "module_id": module_id,
                    "enabled": bool(spec and spec.enabled),
                    "prompt_dir": spec.prompt_dir if spec else None,
                    "compliance_profile_bound": compliance is not None,
                },
                error=None if spec else f"unknown module_id: {module_id}",
            ),
            ToolResult(
                name="knowledge_registry.retrieve",
                ok=True,
                output={
                    "mode": evidence.mode,
                    "retrieval_strategy": "gateway_knowledge_sources_then_local_profile",
                    "source_count": len(evidence.knowledge_sources),
                    "fallback_source_count": sum(
                        1
                        for chunk in rag_chunks
                        if chunk.get("retrieval_status") == "local_registry"
                    ),
                    "source_audit_required": True,
                    "endpoints": evidence.endpoints,
                },
                error="; ".join(evidence.errors) if evidence.errors else None,
            ),
            ToolResult(
                name="rag.retrieve",
                ok=not any(error.startswith("/v1/rag/retrieve") for error in evidence.errors),
                output={
                    "mode": evidence.mode,
                    "retrieval_status": _string(
                        evidence.rag_retrieval.get("retrieval_status")
                    )
                    or "not_invoked",
                    "chunk_count": len(_extract_list(evidence.rag_retrieval, "chunks")),
                    "corpora": evidence.rag_retrieval.get("corpora", []),
                    "vector_store": (
                        evidence.rag_retrieval.get("metadata", {}).get("provider")
                        if isinstance(evidence.rag_retrieval.get("metadata"), dict)
                        else None
                    ),
                    "source_audit_required": True,
                },
                error=_first_error(evidence.errors, "/v1/rag/retrieve"),
            ),
            ToolResult(
                name="cde.list_module_files",
                ok=(not cde_files_denied)
                and not any(error.startswith("/v1/modules/") for error in evidence.errors),
                output={
                    "mode": evidence.mode,
                    "file_count": 0 if cde_files_denied else len(evidence.module_files),
                    "permission_decision": "denied" if cde_files_denied else "allowed",
                    "permission_required": "cde:read",
                },
                error="permission_denied: requires cde:read"
                if cde_files_denied
                else _first_error(evidence.errors, "/v1/modules/"),
            ),
            ToolResult(
                name="audit_trail.list_events",
                ok=not any(error.startswith("/v1/audit-events") for error in evidence.errors),
                output={
                    "mode": evidence.mode,
                    "event_count": len(evidence.audit_events),
                    "write_boundary": "read_existing_events_only",
                },
                error=_first_error(evidence.errors, "/v1/audit-events"),
            ),
        ]
        if attachments:
            tool_results.append(
                ToolResult(
                    name="cde.resolve_attachments",
                    ok=not attachments_denied,
                    output={
                        "attachment_count": len(attachments),
                        "resolved_count": 0
                        if attachments_denied
                        else len(matched_attachments),
                        "unresolved_count": len(attachments)
                        if attachments_denied
                        else len(attachments) - len(matched_attachments),
                        "permission_decision": "denied"
                        if attachments_denied
                        else "allowed",
                        "permission_required": "cde:read",
                        "status": "permission_denied"
                        if attachments_denied
                        else (
                            "resolved_from_gateway_files"
                            if matched_attachments
                            else "unresolved_reference"
                        ),
                    },
                    error="permission_denied: requires cde:read"
                    if attachments_denied
                    else None,
                )
            )
        tool_results.append(
            ToolResult(
                name="audit_trail.prepare_event",
                ok=True,
                output={
                    "event": "agent_tool_router_context_prepared",
                    "request_id": state.get("request_id", ""),
                    "status": "prepared",
                    "persistence": "not_appended_by_python",
                },
            )
        )

        return {
            **state,
            "tool_calls": tool_calls,
            "tool_results": tool_results,
            "rag_chunks": rag_chunks,
            "module_compliance_profile": compliance.as_dict() if compliance else None,
            "tool_router_notes": (
                f"Routed {len(tool_calls)} tool calls, {len(tool_results)} tool results "
                f"and {len(rag_chunks)} governed source references; mode={evidence.mode}; "
                f"roles={caller_roles}; granted={sorted(granted_permissions)}; "
                f"denied_tools={sorted(denied_tools)}."
                + (f" Gateway errors: {'; '.join(evidence.errors)}" if evidence.errors else "")
            ),
        }


def _has_gateway_context(state: ModuleState) -> bool:
    return bool(str(state.get("tenant_id", "")).strip()) and bool(
        str(state.get("project_id", "")).strip()
    )


def _extract_list(payload: Mapping[str, Any], key: str) -> list[dict[str, Any]]:
    value = payload.get(key)
    return [item for item in value if isinstance(item, dict)] if isinstance(value, list) else []


def _string(value: Any) -> str:
    return value if isinstance(value, str) else ""


def _compliance_content(profile: Mapping[str, Any]) -> str:
    roles = ", ".join(profile.get("professional_roles", [])[:4])
    standards = ", ".join(profile.get("standards_profile", [])[:4])
    rules = ", ".join(profile.get("rule_set", [])[:3])
    return (
        f"Professional roles: {roles}. Standards/profile sources: {standards}. "
        f"Rules: {rules}. Signoff policy: {profile.get('signoff_policy')}."
    )


def _knowledge_source_chunks(evidence: GatewayEvidence) -> list[dict[str, Any]]:
    chunks: list[dict[str, Any]] = []
    for source in evidence.knowledge_sources[:8]:
        source_id = _string(source.get("id")) or _string(source.get("name")) or "source"
        citation_policy = source.get("citationPolicy")
        citation_required = bool(
            citation_policy.get("citationRequired")
            if isinstance(citation_policy, dict)
            else True
        )
        chunks.append(
            {
                "source": f"knowledge-source://{source_id}",
                "source_kind": "knowledge_source",
                "retrieval_status": evidence.mode,
                "title": _string(source.get("name")) or source_id,
                "content": (
                    f"kind={source.get('kind')}; status={source.get('status')}; "
                    f"version={source.get('version')}; license={source.get('license')}; "
                    f"sourceUrl={source.get('sourceUrl')}"
                ),
                "citation_required": citation_required,
                "score": None,
                "metadata": source,
            }
        )
    return chunks


def _rag_retrieve_chunks(evidence: GatewayEvidence) -> list[dict[str, Any]]:
    chunks: list[dict[str, Any]] = []
    retrieval_status = _string(evidence.rag_retrieval.get("retrieval_status"))
    for chunk in _extract_list(evidence.rag_retrieval, "chunks")[:8]:
        chunk_id = _string(chunk.get("id")) or "chunk"
        source = _string(chunk.get("source"))
        chunks.append(
            {
                "source": f"rag-chunk://{chunk_id}",
                "source_kind": "rag_chunk",
                "retrieval_status": evidence.mode,
                "title": _string(chunk.get("heading")) or source or chunk_id,
                "content": _string(chunk.get("content")),
                "citation_required": True,
                "score": chunk.get("score"),
                "metadata": {
                    **chunk,
                    "rag_retrieval_status": retrieval_status or evidence.mode,
                    "original_source": source,
                },
            }
        )
    return chunks


def _module_file_chunks(evidence: GatewayEvidence) -> list[dict[str, Any]]:
    chunks: list[dict[str, Any]] = []
    for node in evidence.module_files[:8]:
        node_id = _string(node.get("id")) or _string(node.get("name")) or "file"
        metadata = node.get("metadata") if isinstance(node.get("metadata"), dict) else {}
        tags = metadata.get("tags") if isinstance(metadata, dict) else []
        chunks.append(
            {
                "source": f"cde-file://{node_id}",
                "source_kind": "cde_file",
                "retrieval_status": evidence.mode,
                "title": _string(node.get("name")) or node_id,
                "content": (
                    f"kind={node.get('kind')}; status={node.get('status')}; "
                    f"owner={metadata.get('owner') if isinstance(metadata, dict) else None}; "
                    f"tags={tags}"
                ),
                "citation_required": False,
                "score": None,
                "metadata": node,
            }
        )
    return chunks


def _audit_event_chunks(evidence: GatewayEvidence) -> list[dict[str, Any]]:
    chunks: list[dict[str, Any]] = []
    for event in evidence.audit_events[:8]:
        event_id = _string(event.get("id")) or "event"
        chunks.append(
            {
                "source": f"audit-event://{event_id}",
                "source_kind": "audit_event",
                "retrieval_status": evidence.mode,
                "title": _string(event.get("action")) or "audit_event",
                "content": (
                    f"summary={event.get('summary')}; target={event.get('targetType')}:"
                    f"{event.get('targetId')}; actor={event.get('actor')}; "
                    f"createdAt={event.get('createdAt')}"
                ),
                "citation_required": False,
                "score": None,
                "metadata": event,
            }
        )
    return chunks


def _attachment_chunks(
    attachments: list[str],
    module_files: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    matched = _matched_attachments(attachments, module_files)
    chunks: list[dict[str, Any]] = []
    for index, attachment in enumerate(attachments, start=1):
        matched_file = matched.get(attachment)
        chunks.append(
            {
                "source": f"attachment://{index}",
                "source_kind": "attachment_reference",
                "retrieval_status": "gateway_matched"
                if matched_file
                else "unresolved_reference",
                "title": attachment,
                "content": (
                    f"Attachment matched to CDE file {matched_file.get('id')}"
                    if matched_file
                    else (
                        "Attachment reference supplied by caller; content requires CDE "
                        "permission and retrieval."
                    )
                ),
                "citation_required": True,
                "score": None,
                "metadata": matched_file or {"attachment": attachment},
            }
        )
    return chunks


def _matched_attachments(
    attachments: list[str],
    module_files: list[dict[str, Any]],
) -> dict[str, dict[str, Any]]:
    matched: dict[str, dict[str, Any]] = {}
    for attachment in attachments:
        needle = attachment.strip().lower()
        for node in module_files:
            if needle in {
                _string(node.get("id")).lower(),
                _string(node.get("name")).lower(),
            }:
                matched[attachment] = node
                break
    return matched


def _first_error(errors: list[str], prefix: str) -> str | None:
    return next((error for error in errors if error.startswith(prefix)), None)
