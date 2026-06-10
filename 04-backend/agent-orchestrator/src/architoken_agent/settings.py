"""Configuration for the ArchIToken agent orchestrator.

Loads from env vars (prefix ``ARCHITOKEN_``) and optional ``.env`` file.
"""

from __future__ import annotations

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """All runtime configuration, resolved once at startup."""

    model_config = SettingsConfigDict(
        env_prefix="ARCHITOKEN_",
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # Server
    host: str = "0.0.0.0"
    port: int = 7001
    log_level: str = "INFO"

    # Harness gateway (Rust L5)
    gateway_url: str = "http://architoken-gateway:8080"
    tool_router_gateway_enabled: bool = True
    tool_router_gateway_timeout_s: float = 1.5
    tool_router_actor: str = "architoken-agent-orchestrator"
    tool_router_roles: str = "engineer,reviewer,auditor"

    # Inference engines (OpenAI-compatible endpoints)
    vllm_url: str = "http://vllm:8000/v1"
    sglang_url: str = "http://sglang:30000/v1"
    trtllm_url: str = "http://trtllm:8000/v1"
    lmdeploy_url: str = "http://lmdeploy:23333/v1"
    ollama_url: str = "http://ollama:11434/v1"
    llamacpp_url: str = "http://llamacpp:8080/v1"

    # Database (Supabase Postgres 15.14.1)
    postgres_url: str = Field(
        default="postgresql://architoken:architoken@supabase-db:5432/architoken",
        description="Supabase PostgreSQL connection string",
    )

    # Cache (Valkey 9.0.3)
    valkey_url: str = "redis://valkey:6379/0"

    # Observability
    otlp_endpoint: str = "http://otel-collector:4317"
    service_name: str = "architoken-agent"

    # Model routing policy (Constitution §10)
    default_model: str = "architoken-generator"
    planner_model: str = "architoken-planner"
    generator_model: str = "architoken-generator"
    evaluator_model: str = "architoken-evaluator"
    whitelisted_models: list[str] = Field(
        default_factory=lambda: [
            "architoken-planner",
            "architoken-generator",
            "architoken-evaluator",
            "architoken-local-generation-adapter-v1",
        ]
    )

    # SLA budgets (seconds) — Constitution §8
    sla_text_to_image_s: int = 60
    sla_image_to_3d_s: int = 90
    sla_text_to_3d_s: int = 180
    sla_compliance_review_s: int = 180


_settings: Settings | None = None


def get_settings() -> Settings:
    """Return a process-wide settings singleton."""
    global _settings
    if _settings is None:
        _settings = Settings()
    return _settings
