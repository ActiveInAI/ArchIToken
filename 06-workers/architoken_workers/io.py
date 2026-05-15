"""Worker filesystem IO helpers.

Production workers read source bytes from mounted object-store paths and write
derivatives to a job-scoped output directory. These helpers keep that contract
consistent across native adapters.
"""

from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
from typing import Any

from .adapter_requirements import blocked
from .contract import ConversionJob, WorkerArtifact, WorkerResult


def input_string(job: ConversionJob, *keys: str) -> str | None:
    """Return the first non-empty string value from a worker job input."""

    for key in keys:
        value = job.input.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return None


def source_path(job: ConversionJob) -> Path | None:
    """Return the mounted source-file path from the worker job input."""

    value = input_string(job, "sourcePath", "source_path", "sourceFilePath", "source_file_path")
    return Path(value) if value else None


def output_dir(job: ConversionJob) -> Path:
    """Return and create the job output directory."""

    value = input_string(job, "outputDir", "output_dir", "artifactDir", "artifact_dir")
    path = Path(value) if value else Path("/tmp/architoken-workers") / job.tenant_id / job.job_id
    path.mkdir(parents=True, exist_ok=True)
    return path


def require_source_file(job: ConversionJob, *, adapter: str, install_hint: str) -> tuple[Path | None, WorkerResult | None]:
    """Return a source file or a blocked result when the job is not executable."""

    path = source_path(job)
    if path is None and input_string(job, "sourceObjectKey", "source_object_key"):
        path, download_error = download_source_object(job, adapter=adapter)
        if download_error:
            return None, download_error
    if path is None:
        return None, blocked(
            job,
            adapter=adapter,
            reason="missing worker input: sourcePath",
            install_hint=install_hint,
        )
    if not path.is_file():
        return None, blocked(
            job,
            adapter=adapter,
            reason=f"sourcePath is not a readable file: {path}",
            install_hint=install_hint,
        )
    return path, None


def download_source_object(job: ConversionJob, *, adapter: str) -> tuple[Path | None, WorkerResult | None]:
    """Download a source object from S3-compatible storage into the job output dir."""

    object_key = input_string(job, "sourceObjectKey", "source_object_key")
    if object_key is None:
        return None, None
    try:
        from .runtime import WorkerRuntimeConfig, build_s3_client

        config = WorkerRuntimeConfig.from_env()
        client = build_s3_client(config)
        filename = input_string(job, "sourceFileName", "source_file_name") or Path(object_key).name or "source.bin"
        target = output_dir(job) / filename
        client.download_file(config.s3_bucket, object_key, str(target))
        return target, None
    except Exception as exc:  # noqa: BLE001 - production workers must return structured blocked results.
        return None, blocked(
            job,
            adapter=adapter,
            reason=f"failed to download source object {object_key}: {exc}",
            install_hint="Configure S3_ENDPOINT/S3_ACCESS_KEY/S3_SECRET_KEY/S3_BUCKET and pass sourceObjectKey.",
        )


def file_sha256(path: Path) -> str:
    """Return the SHA-256 checksum for a local artifact."""

    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def artifact_for_path(
    path: Path,
    *,
    job: ConversionJob | None = None,
    media_type: str,
    role: str,
    metadata: dict[str, Any] | None = None,
) -> WorkerArtifact:
    """Build a worker artifact record for a local output path."""

    artifact_metadata = {
        "path": str(path),
        "sizeBytes": path.stat().st_size,
        "sha256": file_sha256(path),
    }
    if metadata:
        artifact_metadata.update(metadata)
    if job is not None:
        artifact_metadata.update(persist_artifact_object(job, path, media_type))
    return WorkerArtifact(
        name=path.name,
        media_type=media_type,
        role=role,
        metadata=artifact_metadata,
    )


def persist_artifact_object(job: ConversionJob, path: Path, media_type: str) -> dict[str, Any]:
    """Upload an artifact to S3-compatible storage when production storage is configured."""

    upload_setting = os.getenv("ARCHITOKEN_WORKER_UPLOAD_ARTIFACTS", "").strip().lower()
    upload_disabled = upload_setting in {"0", "false", "no", "off"}
    production = os.getenv("ARCHITOKEN_PROFILE", "").strip().lower() == "production"
    has_s3_env = all(os.getenv(name, "").strip() for name in ("S3_ENDPOINT", "S3_ACCESS_KEY", "S3_SECRET_KEY", "S3_BUCKET"))
    if upload_disabled:
        if production:
            raise RuntimeError("ARCHITOKEN_WORKER_UPLOAD_ARTIFACTS cannot be disabled in production")
        return {"objectPersisted": False, "objectPersistence": "disabled"}
    if not has_s3_env:
        if production:
            raise RuntimeError("S3 object storage env is required for production worker artifacts")
        return {"objectPersisted": False, "objectPersistence": "not_configured"}

    from .runtime import WorkerRuntimeConfig, build_s3_client

    config = WorkerRuntimeConfig.from_env()
    client = build_s3_client(config)
    object_key = artifact_object_key(job, path.name)
    extra_args = {"ContentType": media_type}
    client.upload_file(str(path), config.s3_bucket, object_key, ExtraArgs=extra_args)
    return {
        "objectPersisted": True,
        "objectBucket": config.s3_bucket,
        "objectKey": object_key,
        "objectUri": f"s3://{config.s3_bucket}/{object_key}",
        "contentType": media_type,
    }


def artifact_object_key(job: ConversionJob, filename: str) -> str:
    """Return the canonical production object key for one worker artifact."""

    prefix = input_string(job, "artifactObjectPrefix", "artifact_object_prefix")
    if prefix:
        return f"{prefix.strip('/')}/{filename}"
    return "/".join(
        [
            "workers",
            sanitize_object_key_segment(job.tenant_id),
            sanitize_object_key_segment(job.project_id),
            sanitize_object_key_segment(job.job_id),
            sanitize_object_key_segment(filename),
        ]
    )


def sanitize_object_key_segment(value: str) -> str:
    """Keep object-store keys deterministic and path-safe."""

    return "".join(ch if ch.isalnum() or ch in {".", "-", "_"} else "_" for ch in value)


def write_json_artifact(
    job: ConversionJob,
    name: str,
    payload: Any,
    *,
    role: str,
    metadata: dict[str, Any] | None = None,
) -> WorkerArtifact:
    """Write a JSON artifact and return its artifact record."""

    path = output_dir(job) / name
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True), encoding="utf-8")
    return artifact_for_path(path, job=job, media_type="application/json", role=role, metadata=metadata)


def write_jsonl_artifact(
    job: ConversionJob,
    name: str,
    rows: list[dict[str, Any]],
    *,
    role: str,
    metadata: dict[str, Any] | None = None,
) -> WorkerArtifact:
    """Write a JSON Lines artifact and return its artifact record."""

    path = output_dir(job) / name
    with path.open("w", encoding="utf-8") as handle:
        for row in rows:
            handle.write(json.dumps(row, ensure_ascii=False, sort_keys=True))
            handle.write("\n")
    return artifact_for_path(path, job=job, media_type="application/jsonl", role=role, metadata=metadata)
