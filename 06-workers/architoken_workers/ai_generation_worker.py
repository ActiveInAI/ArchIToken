"""AI generation worker adapters for multimodal deliverables."""

from __future__ import annotations

import json
import os
import urllib.request

from .adapter_requirements import missing_any_env
from .contract import ConversionJob, WorkerResult, validate_job
from .io import artifact_for_path, output_dir, write_json_artifact

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

    if provider_key != "architoken-provider-router":
        return WorkerResult(
            job_id=job.job_id,
            status="blocked",
            error={
                "code": "provider_direct_adapter_not_configured",
                "message": f"direct provider adapter is disabled for {provider}; route through ARCHITOKEN_AI_PROVIDER_ROUTER_URL",
            },
            output={"provider": provider, "available": False},
        )

    response = _post_provider_router(job, os.environ["ARCHITOKEN_AI_PROVIDER_ROUTER_URL"].rstrip("/"))
    output_name = str(job.input.get("output_name", f"{job.operation.value}.json")).strip()
    media_type = str(response.get("mediaType") or job.input.get("media_type", "application/json"))
    if "contentBase64" in response:
        import base64

        target = output_dir(job) / output_name
        target.write_bytes(base64.b64decode(str(response["contentBase64"])))
        artifact = artifact_for_path(
            target,
            job=job,
            media_type=media_type,
            role=job.operation.value,
            metadata={"provider": provider, "router": "architoken-provider-router"},
        )
    else:
        artifact = write_json_artifact(
            job,
            output_name if output_name.endswith(".json") else f"{output_name}.json",
            response,
            role=job.operation.value,
            metadata={"provider": provider, "router": "architoken-provider-router"},
        )
    return WorkerResult(
        job_id=job.job_id,
        status="completed",
        artifacts=(artifact,),
        output={
            "provider": provider,
            "operation": job.operation.value,
            "route": "ai_provider_adapter",
            "mediaType": media_type,
        },
    )


def _post_provider_router(job: ConversionJob, base_url: str) -> dict[str, object]:
    payload = {
        "jobId": job.job_id,
        "tenantId": job.tenant_id,
        "projectId": job.project_id,
        "actor": job.actor,
        "operation": job.operation.value,
        "input": job.input,
    }
    request = urllib.request.Request(
        f"{base_url}/v1/generate",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json", "Accept": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=int(job.input.get("timeoutSeconds", 900))) as response:
        data = json.loads(response.read().decode("utf-8"))
    if not isinstance(data, dict):
        raise ValueError("provider router response must be a JSON object")
    return data
