"""Production worker runtime configuration and adapter loading."""

from __future__ import annotations

import importlib
import os
from dataclasses import dataclass


@dataclass(frozen=True)
class WorkerRuntimeConfig:
    """External services required by production workers."""

    database_url: str
    s3_endpoint: str
    s3_access_key: str
    s3_secret_key: str
    s3_bucket: str
    nats_url: str
    temporal_address: str
    otel_endpoint: str

    @classmethod
    def from_env(cls) -> "WorkerRuntimeConfig":
        """Load production worker configuration from environment variables."""

        return cls(
            database_url=required_env("DATABASE_URL", "ARCHITOKEN_DATABASE__URL"),
            s3_endpoint=required_env("S3_ENDPOINT"),
            s3_access_key=required_env("S3_ACCESS_KEY"),
            s3_secret_key=required_env("S3_SECRET_KEY"),
            s3_bucket=required_env("S3_BUCKET"),
            nats_url=required_env("NATS_URL"),
            temporal_address=required_env("TEMPORAL_ADDRESS"),
            otel_endpoint=required_env("OTEL_EXPORTER_OTLP_ENDPOINT", "ARCHITOKEN_OTLP_ENDPOINT"),
        )


def required_env(*names: str) -> str:
    """Return the first non-empty environment value or raise a production error."""

    for name in names:
        value = os.getenv(name, "").strip()
        if value:
            return value
    joined = " or ".join(names)
    raise RuntimeError(f"missing required production worker environment: {joined}")


def require_python_package(import_name: str, install_hint: str) -> object:
    """Import an optional production adapter dependency with an actionable error."""

    try:
        return importlib.import_module(import_name)
    except ModuleNotFoundError as exc:
        raise RuntimeError(f"{install_hint} is required for production workers") from exc


def build_s3_client(config: WorkerRuntimeConfig) -> object:
    """Build a boto3 S3 client for S3-compatible object storage."""

    boto3 = require_python_package("boto3", "boto3")
    return boto3.client(
        "s3",
        endpoint_url=config.s3_endpoint,
        aws_access_key_id=config.s3_access_key,
        aws_secret_access_key=config.s3_secret_key,
        region_name="us-east-1",
    )
