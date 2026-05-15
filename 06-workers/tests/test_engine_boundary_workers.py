import pytest
import urllib.request
import json

from architoken_workers import ConversionJob, ConversionOperation
from architoken_workers.blender_worker import blender_headless_convert
from architoken_workers.cad_worker import licensed_dwg_adapter
from architoken_workers.cesium_worker import cesium_ion_create_asset, complete_cesium_asset_upload
from architoken_workers.cgal_worker import cgal_generate_volume_mesh
from architoken_workers.forgecad_worker import forgecad_generate
from architoken_workers.io import artifact_for_path
from architoken_workers.speckle_worker import speckle_send_metadata
from architoken_workers.text_to_bim_worker import ifcopenshell_text_to_bim
from architoken_workers.worker_cli import DISPATCH, dispatch_payload, production_self_check
from architoken_workers.engine_registry import ENGINE_POLICIES


def _job(operation: ConversionOperation = ConversionOperation.CAD_CONVERT) -> ConversionJob:
    return ConversionJob(
        job_id="job-engine-boundary-1",
        tenant_id="tenant-a",
        project_id="project-a",
        actor="engine-boundary-test",
        operation=operation,
        source_asset_id="asset-engine-1",
        source_file_id="file-engine-1",
    )


def _assert_blocked_or_completed(result, adapter: str) -> None:
    assert result.status in {"blocked", "completed"}
    if result.status == "blocked":
        assert result.output["adapter"] == adapter
        assert result.error["code"] == "adapter_not_configured"


def test_native_and_service_boundaries_block_without_runtime_prerequisites() -> None:
    _assert_blocked_or_completed(blender_headless_convert(_job()), "blender")
    _assert_blocked_or_completed(cgal_generate_volume_mesh(_job()), "cgal")
    _assert_blocked_or_completed(speckle_send_metadata(_job()), "speckle")
    _assert_blocked_or_completed(cesium_ion_create_asset(_job()), "cesium_ion")
    _assert_blocked_or_completed(forgecad_generate(_job()), "forgecad")


def test_text_to_bim_uses_ifcopenshell_or_blocks_explicitly() -> None:
    result = ifcopenshell_text_to_bim(_job(ConversionOperation.BIM_GENERATE))

    _assert_blocked_or_completed(result, "ifcopenshell_text_to_bim")
    if result.status == "completed":
        assert result.output["generated"] is True
        assert result.artifacts[0].name.endswith(".ifc")


def test_dwg_adapter_requires_real_source_even_when_service_is_configured(monkeypatch) -> None:
    monkeypatch.setenv("DWG_ADAPTER_URL", "http://127.0.0.1:9")
    result = licensed_dwg_adapter(_job())

    assert result.status == "blocked"
    assert result.output["adapter"] == "dwg"


def test_forgecad_service_must_return_real_artifact_bytes(monkeypatch) -> None:
    class EmptyResponse:
        def __enter__(self):
            return self

        def __exit__(self, *_args):
            return None

        def read(self):
            return b'{"status":"ok"}'

    monkeypatch.setenv("FORGECAD_URL", "http://forgecad.test")
    monkeypatch.setattr(urllib.request, "urlopen", lambda *_args, **_kwargs: EmptyResponse())

    result = forgecad_generate(_job(ConversionOperation.MODEL_GENERATE))

    assert result.status == "failed"
    assert result.error["code"] == "forgecad_service_missing_artifacts"


def test_forgecad_service_persists_returned_artifact_bytes(monkeypatch, tmp_path) -> None:
    class ArtifactResponse:
        def __enter__(self):
            return self

        def __exit__(self, *_args):
            return None

        def read(self):
            return json.dumps(
                {
                    "artifacts": [
                        {
                            "name": "model.step",
                            "mediaType": "model/step",
                            "contentBase64": "U1RFUA==",
                        }
                    ]
                }
            ).encode("utf-8")

    monkeypatch.setenv("FORGECAD_URL", "http://forgecad.test")
    monkeypatch.setattr(urllib.request, "urlopen", lambda *_args, **_kwargs: ArtifactResponse())

    result = forgecad_generate(
        ConversionJob(
            job_id="job-forgecad-service",
            tenant_id="tenant-a",
            project_id="project-a",
            actor="engine-boundary-test",
            operation=ConversionOperation.MODEL_GENERATE,
            source_asset_id="asset-engine-1",
            source_file_id="file-engine-1",
            input={
                "outputDir": str(tmp_path),
                "cadSpec": {"shape": "box", "dimensions": {}},
                "preferForgecadService": True,
            },
        )
    )

    assert result.status == "completed"
    assert any(artifact.name == "model.step" for artifact in result.artifacts)


def test_artifact_metadata_marks_unpersisted_local_dev_output(tmp_path, monkeypatch) -> None:
    for name in ("S3_ENDPOINT", "S3_ACCESS_KEY", "S3_SECRET_KEY", "S3_BUCKET", "ARCHITOKEN_WORKER_UPLOAD_ARTIFACTS"):
        monkeypatch.delenv(name, raising=False)
    monkeypatch.setenv("ARCHITOKEN_PROFILE", "development")
    path = tmp_path / "artifact.txt"
    path.write_text("real output", encoding="utf-8")

    artifact = artifact_for_path(
        path,
        job=_job(),
        media_type="text/plain",
        role="test_artifact",
        metadata={"engine": "test"},
    )

    assert artifact.metadata["objectPersisted"] is False
    assert artifact.metadata["objectPersistence"] == "not_configured"


def test_artifact_upload_is_mandatory_in_production(tmp_path, monkeypatch) -> None:
    for name in ("S3_ENDPOINT", "S3_ACCESS_KEY", "S3_SECRET_KEY", "S3_BUCKET", "ARCHITOKEN_WORKER_UPLOAD_ARTIFACTS"):
        monkeypatch.delenv(name, raising=False)
    monkeypatch.setenv("ARCHITOKEN_PROFILE", "production")
    path = tmp_path / "artifact.txt"
    path.write_text("real output", encoding="utf-8")

    with pytest.raises(RuntimeError, match="S3 object storage env is required"):
        artifact_for_path(path, job=_job(), media_type="text/plain", role="test_artifact")


def test_worker_dispatch_reports_invalid_payload_without_crashing() -> None:
    result = dispatch_payload({"job_id": "broken"})

    assert result["status"] == "failed"
    assert result["error"]["code"] == "invalid_worker_payload"


def test_worker_dispatch_reports_unknown_adapter_without_crashing() -> None:
    result = dispatch_payload(
        {
            "job_id": "job-unknown-adapter",
            "tenant_id": "tenant-a",
            "project_id": "project-a",
            "actor": "test",
            "operation": "cad_convert",
            "source_asset_id": "asset-a",
            "source_file_id": "file-a",
            "input": {"adapter": "unknown"},
        }
    )

    assert result["status"] == "failed"
    assert result["error"]["code"] == "unknown_adapter"


def test_worker_dispatch_includes_isolation_policy() -> None:
    result = dispatch_payload(
        {
            "job_id": "job-policy",
            "tenant_id": "tenant-a",
            "project_id": "project-a",
            "actor": "test",
            "operation": "document_generate",
            "source_asset_id": "asset-a",
            "source_file_id": "file-a",
            "input": {"adapter": "markitdown"},
        }
    )

    assert result["output"]["adapterIsolation"]["adapter"] == "markitdown"
    assert result["output"]["adapterIsolation"]["isolation"] == "in_process_library"


def test_dispatch_adapters_have_isolation_policies() -> None:
    assert sorted(set(DISPATCH) - set(ENGINE_POLICIES)) == []
    checks = production_self_check()
    assert checks["isolation_policies"]["available"] is True
    assert "stirling_pdf" in checks["isolation_policies"]["adapters"]


def test_cesium_upload_manifest_records_absent_upload_location(tmp_path) -> None:
    source = tmp_path / "model.glb"
    source.write_bytes(b"glb")

    result = complete_cesium_asset_upload({"id": 123}, source, timeout_seconds=1)

    assert result == {"uploadPerformed": False, "reason": "upload_location_absent"}
