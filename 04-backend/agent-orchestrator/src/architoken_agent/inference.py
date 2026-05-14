"""Inference client — dispatches to the Rust Gateway's inference endpoint.

All LLM calls go through ``POST /v1/harness/invoke`` on the Rust L5
Gateway (Constitution §1). We never bypass the Harness.
"""

from __future__ import annotations

import httpx
import structlog
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

from .settings import get_settings
from .state import AgentRole

logger = structlog.get_logger(__name__)


class InferenceError(Exception):
    """Base for inference errors."""


class ModelNotWhitelisted(InferenceError):
    """Model was not on Constitution §10 whitelist."""


class InferenceClient:
    """HTTP client that speaks to the Rust Gateway."""

    def __init__(self, base_url: str | None = None) -> None:
        cfg = get_settings()
        self._base_url = (base_url or cfg.gateway_url).rstrip("/")
        self._client = httpx.AsyncClient(
            base_url=self._base_url,
            timeout=httpx.Timeout(60.0, connect=5.0),
            limits=httpx.Limits(max_connections=100, max_keepalive_connections=20),
        )

    async def close(self) -> None:
        await self._client.aclose()

    @retry(
        retry=retry_if_exception_type(httpx.TransportError),
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=0.5, min=0.5, max=4.0),
        reraise=True,
    )
    async def chat(
        self,
        *,
        model: str,
        messages: list[dict[str, str]],
        temperature: float = 0.2,
        max_tokens: int = 4096,
        role: AgentRole = AgentRole.GENERATOR,
    ) -> str:
        """Send a chat request; return the assistant content."""

        cfg = get_settings()
        if model not in cfg.whitelisted_models:
            raise ModelNotWhitelisted(
                f"model {model!r} is not on Constitution §10 whitelist"
            )

        payload = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "stream": False,
        }
        logger.info(
            "inference.chat",
            model=model,
            role=role.value,
            message_count=len(messages),
        )
        r = await self._client.post("/v1/harness/invoke", json=payload)

        if r.status_code == 422:
            raise ModelNotWhitelisted(r.text)
        r.raise_for_status()
        body = r.json()
        content = body.get("content", "")
        if not isinstance(content, str):
            raise InferenceError(f"non-string content: {content!r}")
        return content


def model_for_role(role: AgentRole) -> str:
    """Return the configured model alias for one Harness role."""
    cfg = get_settings()
    role_models = {
        AgentRole.PLANNER: cfg.planner_model,
        AgentRole.GENERATOR: cfg.generator_model,
        AgentRole.EVALUATOR: cfg.evaluator_model,
    }
    return role_models[role]
