"""AI generation worker adapters for multimodal deliverables."""

from __future__ import annotations

from .adapter_requirements import missing_any_env
from .contract import ConversionJob, WorkerArtifact, WorkerResult, validate_job

PROVIDER_ENV_REQUIREMENTS: dict[str, tuple[str, ...]] = {
    "anthropic": ("ANTHROPIC_API_KEY",),
    "architoken-provider-router": ("ARCHITOKEN_AI_PROVIDER_ROUTER_URL",),
    "deepseek": ("DEEPSEEK_API_KEY",),
    "google": ("GOOGLE_API_KEY", "GEMINI_API_KEY"),
    "huggingface": ("HF_TOKEN", "HUGGINGFACE_API_TOKEN"),
    "lmstudio": ("LMSTUDIO_BASE_URL",),
    "ollama": ("OLLAMA_BASE_URL",),
    "openai": ("OPENAI_API_KEY",),
    "openrouter": ("OPENROUTER_API_KEY",),
    "unsloth": ("UNSLOTH_API_KEY", "UNSLOTH_BASE_URL"),
    "vllm": ("VLLM_BASE_URL",),
}


def route_generation(job: ConversionJob) -> WorkerResult:
    """Route a generation job to the configured production model provider."""

    validate_job(job)
    provider = str(job.input.get("provider", "architoken-provider-router"))
    provider_key = provider.strip().lower()
    env_names = PROVIDER_ENV_REQUIREMENTS.get(
        provider_key,
        (f"ARCHITOKEN_PROVIDER_{provider_key.upper().replace('-', '_')}_URL",),
    )
    if unavailable := missing_any_env(
        job,
        adapter=provider_key,
        names=env_names,
        install_hint=(
            "Configure the provider API key/base URL in the worker environment "
            "before enabling real AI generation."
        ),
    ):
        return unavailable

    output_name = str(job.input.get("output_name", f"{job.operation.value}.json"))
    media_type = str(job.input.get("media_type", "application/json"))
    return WorkerResult(
        job_id=job.job_id,
        status="queued",
        artifacts=(
            WorkerArtifact(
                name=output_name,
                media_type=media_type,
                role=job.operation.value,
                metadata={"provider": provider},
            ),
        ),
        output={
            "provider": provider,
            "operation": job.operation.value,
            "route": "ai_provider_adapter",
        },
    )
