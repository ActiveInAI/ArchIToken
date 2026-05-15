"""Adapter dependency checks for production workers."""

from __future__ import annotations

import importlib.util
import os
import shutil

from .contract import ConversionJob, WorkerResult


def missing_python_dependency(
    job: ConversionJob,
    *,
    adapter: str,
    import_name: str,
    install_hint: str,
) -> WorkerResult | None:
    """Return a blocked result when a required Python dependency is absent."""

    if importlib.util.find_spec(import_name) is not None:
        return None
    return blocked(job, adapter=adapter, reason=f"missing Python dependency: {import_name}", install_hint=install_hint)


def missing_binary(
    job: ConversionJob,
    *,
    adapter: str,
    binary: str,
    install_hint: str,
) -> WorkerResult | None:
    """Return a blocked result when a required executable is absent."""

    if shutil.which(binary):
        return None
    return blocked(job, adapter=adapter, reason=f"missing executable: {binary}", install_hint=install_hint)


def missing_env(
    job: ConversionJob,
    *,
    adapter: str,
    name: str,
    install_hint: str,
) -> WorkerResult | None:
    """Return a blocked result when an adapter service URL or credential is absent."""

    if os.getenv(name, "").strip():
        return None
    return blocked(job, adapter=adapter, reason=f"missing environment variable: {name}", install_hint=install_hint)


def blocked(job: ConversionJob, *, adapter: str, reason: str, install_hint: str) -> WorkerResult:
    """Build an explicit blocked result instead of pretending conversion succeeded."""

    return WorkerResult(
        job_id=job.job_id,
        status="blocked",
        output={
            "adapter": adapter,
            "available": False,
            "reason": reason,
            "installHint": install_hint,
        },
        error={
            "code": "adapter_not_configured",
            "message": reason,
        },
    )
