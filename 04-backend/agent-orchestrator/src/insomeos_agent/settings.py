"""Configuration for the InsomeOS agent orchestrator.

Loads from env vars (prefix ``INSOMEOS_``) and optional ``.env`` file.
"""

from __future__ import annotations

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """All runtime configuration, resolved once at startup."""

    model_config = SettingsConfigDict(
        env_prefix="INSOMEOS_",
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # Server
    host: str = "0.0.0.0"
    port: int = 7001
    log_level: str = "INFO"

    # Harness gateway (Rust L5)
    gateway_url: str = "http://insomeos-gateway:8080"

    # Inference engines (OpenAI-compatible endpoints)
    vllm_url: str = "http://vllm:8000/v1"
    sglang_url: str = "http://sglang:30000/v1"
    trtllm_url: str = "http://trtllm:8000/v1"
    lmdeploy_url: str = "http://lmdeploy:23333/v1"
    ollama_url: str = "http://ollama:11434/v1"
    llamacpp_url: str = "http://llamacpp:8080/v1"

    # Database (Supabase Postgres 15.14.1)
    postgres_url: str = Field(
        default="postgresql://insomeos:insomeos@supabase-db:5432/insomeos",
        description="Supabase PostgreSQL connection string",
    )

    # Cache (Valkey 9.0.3)
    valkey_url: str = "redis://valkey:6379/0"

    # Observability
    otlp_endpoint: str = "http://otel-collector:4317"
    service_name: str = "insomeos-agent"

    # Default model whitelist (Constitution §10)
    default_model: str = "claude-4.7-sonnet"
    whitelisted_models: list[str] = Field(
        default_factory=lambda: [
            "claude-4.7-sonnet",
            "claude-4.7-opus",
            "gpt-5.2",
            "qwen-3.5-max",
            "glm-4.7-plus",
            "deepseek-v3.2",
            "gemma-4-27b",
            "kimi-k2-preview",
            "llama-4-70b",
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
