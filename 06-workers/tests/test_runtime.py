import os

from architoken_workers.runtime import WorkerRuntimeConfig, required_env


def test_required_env_uses_first_present_value() -> None:
    old_a = os.environ.get("ARCHITOKEN_TEST_EMPTY")
    old_b = os.environ.get("ARCHITOKEN_TEST_VALUE")
    try:
        os.environ["ARCHITOKEN_TEST_EMPTY"] = " "
        os.environ["ARCHITOKEN_TEST_VALUE"] = "configured"
        assert required_env("ARCHITOKEN_TEST_EMPTY", "ARCHITOKEN_TEST_VALUE") == "configured"
    finally:
        restore("ARCHITOKEN_TEST_EMPTY", old_a)
        restore("ARCHITOKEN_TEST_VALUE", old_b)


def test_worker_runtime_config_requires_production_services() -> None:
    values = {
        "DATABASE_URL": "postgres://architoken:secret@pgbouncer/architoken",
        "S3_ENDPOINT": "http://seaweed-s3:8333",
        "S3_ACCESS_KEY": "key",
        "S3_SECRET_KEY": "secret",
        "S3_BUCKET": "architoken-assets",
        "NATS_URL": "nats://nats:4222",
        "TEMPORAL_ADDRESS": "temporal:7233",
        "OTEL_EXPORTER_OTLP_ENDPOINT": "http://otel-collector:4317",
    }
    old_values = {key: os.environ.get(key) for key in values}
    try:
        os.environ.update(values)
        config = WorkerRuntimeConfig.from_env()
        assert config.s3_bucket == "architoken-assets"
        assert config.nats_url == "nats://nats:4222"
    finally:
        for key, value in old_values.items():
            restore(key, value)


def restore(key: str, value: str | None) -> None:
    if value is None:
        os.environ.pop(key, None)
    else:
        os.environ[key] = value
