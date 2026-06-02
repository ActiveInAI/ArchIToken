import pytest
import urllib.request
import json
import sys

from architoken_workers import ConversionJob, ConversionOperation
from architoken_workers.blender_plugin_worker import audit_blender_plugin, run_blender_plugin
from architoken_workers.blender_worker import blender_headless_convert
from architoken_workers.cad_worker import licensed_dwg_adapter
from architoken_workers.cesium_worker import cesium_ion_create_asset, complete_cesium_asset_upload
from architoken_workers.external_app_worker import licensed_bim_convert
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


def _minimal_glb_bytes() -> bytes:
    json_chunk = b'{"asset":{"version":"2.0"}}  '
    byte_length = 12 + 8 + len(json_chunk)
    return (
        b"glTF"
        + (2).to_bytes(4, "little")
        + byte_length.to_bytes(4, "little")
        + len(json_chunk).to_bytes(4, "little")
        + b"JSON"
        + json_chunk
    )


def _minimal_ifc_text() -> str:
    return "\n".join(
        [
            "ISO-10303-21;",
            "HEADER;",
            "FILE_DESCRIPTION(('ViewDefinition [CoordinationView]'),'2;1');",
            "FILE_NAME('model.ifc','2026-05-23T00:00:00',('architoken'),('architoken'),'skp-to-ifc-test','ArchIToken','');",
            "FILE_SCHEMA(('IFC4'));",
            "ENDSEC;",
            "DATA;",
            "#1=IFCPROJECT('0V5wYb1W9D_xSkpIfc00001',$,'SKP IFC Project',$,$,$,$,$,$);",
            "ENDSEC;",
            "END-ISO-10303-21;",
        ]
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


def test_blender_plugin_audit_reads_extension_manifest(tmp_path) -> None:
    addon = tmp_path / "architoken_blender_sample"
    addon.mkdir()
    (addon / "blender_manifest.toml").write_text(
        "\n".join(
            [
                'id = "architoken_blender_sample"',
                'name = "ArchIToken Blender Sample"',
                'version = "0.1.0"',
                'type = "add-on"',
                'license = ["SPDX:MIT"]',
                'blender_version_min = "4.2.0"',
            ]
        ),
        encoding="utf-8",
    )
    (addon / "__init__.py").write_text(
        "\n".join(
            [
                "bl_info = {'name': 'ArchIToken Blender Sample', 'version': (0, 1, 0), 'blender': (4, 2, 0)}",
                "import subprocess",
                "def register():",
                "    pass",
                "def unregister():",
                "    pass",
            ]
        ),
        encoding="utf-8",
    )

    result = audit_blender_plugin(
        ConversionJob(
            job_id="job-blender-plugin-audit",
            tenant_id="tenant-a",
            project_id="project-a",
            actor="engine-boundary-test",
            operation=ConversionOperation.BLENDER_PLUGIN_AUDIT,
            source_asset_id="asset-engine-1",
            source_file_id="file-engine-1",
            input={"sourcePath": str(addon), "outputDir": str(tmp_path / "out")},
        )
    )

    assert result.status == "completed"
    assert result.output["pluginId"] == "architoken_blender_sample"
    assert result.output["executionAllowed"] is False
    assert result.artifacts[0].role == "blender_plugin_audit"
    audit_payload = json.loads((tmp_path / "out" / "blender_plugin_audit.json").read_text(encoding="utf-8"))
    assert audit_payload["source"]["hasBlenderManifest"] is True
    assert audit_payload["entrypoints"][0]["register"] is True
    assert "subprocess" in " ".join(audit_payload["risks"])


def test_blender_plugin_run_requires_explicit_workflow_approval(tmp_path) -> None:
    addon = tmp_path / "architoken_blender_sample.py"
    addon.write_text("def register():\n    pass\n", encoding="utf-8")

    result = run_blender_plugin(
        ConversionJob(
            job_id="job-blender-plugin-run",
            tenant_id="tenant-a",
            project_id="project-a",
            actor="engine-boundary-test",
            operation=ConversionOperation.BLENDER_PLUGIN_RUN,
            source_asset_id="asset-engine-1",
            source_file_id="file-engine-1",
            input={"sourcePath": str(addon), "outputDir": str(tmp_path / "out")},
        )
    )

    assert result.status == "blocked"
    assert result.output["adapter"] == "blender_plugin"
    assert result.error["code"] == "adapter_not_configured"


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


def test_skp_command_adapter_persists_real_glb_derivative(monkeypatch, tmp_path) -> None:
    source = tmp_path / "model.skp"
    source.write_bytes(b"SketchUp source")
    script = tmp_path / "skp_command_adapter.py"
    glb_literal = repr(_minimal_glb_bytes())
    script.write_text(
        "\n".join(
            [
                "from pathlib import Path",
                "import sys",
                "output = Path(sys.argv[sys.argv.index('--output') + 1])",
                f"output.write_bytes({glb_literal})",
            ]
        ),
        encoding="utf-8",
    )
    monkeypatch.setenv("PRENGINE_SKP_CONVERTER_COMMAND", sys.executable)
    monkeypatch.setenv(
        "PRENGINE_SKP_CONVERTER_ARGS",
        json.dumps([str(script), "--input", "{source}", "--output", "{output}"]),
    )

    result = licensed_bim_convert(
        ConversionJob(
            job_id="job-skp-command",
            tenant_id="tenant-a",
            project_id="project-a",
            actor="engine-boundary-test",
            operation=ConversionOperation.CAD_CONVERT,
            source_asset_id="asset-engine-1",
            source_file_id="file-engine-1",
            input={
                "sourcePath": str(source),
                "sourceFileName": source.name,
                "outputDir": str(tmp_path / "out"),
            },
        )
    )

    assert result.status == "completed"
    assert result.output["engine"] == "Prengine"
    assert result.output["sourceFormat"] == "skp"
    assert result.artifacts[0].media_type == "model/gltf-binary"


def test_skp_to_ifc_command_adapter_persists_real_ifc_derivative(monkeypatch, tmp_path) -> None:
    source = tmp_path / "model.skp"
    source.write_bytes(b"SketchUp source")
    script = tmp_path / "skp_to_ifc_command_adapter.py"
    ifc_literal = repr(_minimal_ifc_text())
    script.write_text(
        "\n".join(
            [
                "from pathlib import Path",
                "import sys",
                "output = Path(sys.argv[sys.argv.index('--output') + 1])",
                f"output.write_text({ifc_literal}, encoding='utf-8')",
            ]
        ),
        encoding="utf-8",
    )
    monkeypatch.setenv("PRENGINE_SKP_TO_IFC_COMMAND", sys.executable)
    monkeypatch.setenv(
        "PRENGINE_SKP_TO_IFC_ARGS",
        json.dumps([str(script), "--input", "{source}", "--output", "{output}"]),
    )

    result = licensed_bim_convert(
        ConversionJob(
            job_id="job-skp-ifc-command",
            tenant_id="tenant-a",
            project_id="project-a",
            actor="engine-boundary-test",
            operation=ConversionOperation.CAD_CONVERT,
            source_asset_id="asset-engine-1",
            source_file_id="file-engine-1",
            input={
                "sourcePath": str(source),
                "sourceFileName": source.name,
                "targetFormat": "ifc",
                "outputFormats": ["ifc"],
                "outputDir": str(tmp_path / "out"),
            },
        )
    )

    assert result.status == "completed"
    assert result.output["engine"] == "Prengine"
    assert result.output["sourceFormat"] == "skp"
    assert result.output["targetFormat"] == "ifc"
    assert result.artifacts[0].media_type == "application/p21"
    assert result.artifacts[0].role == "openbim_ifc"
    assert "FILE_SCHEMA" in (tmp_path / "out" / "model.ifc").read_text(encoding="utf-8")


def test_skp_to_ifc_never_falls_back_to_glb_without_real_adapter(monkeypatch, tmp_path) -> None:
    for name in (
        "PRENGINE_SKP_TO_IFC_COMMAND",
        "SKP_TO_IFC_COMMAND",
        "SKETCHUP_TO_IFC_COMMAND",
        "SKP2IFC_BIN",
        "SKP_TO_IFC_BIN",
        "SKETCHUP_TO_IFC_BIN",
        "PRENGINE_SKP_CONVERTER_COMMAND",
        "SKP_CONVERTER_COMMAND",
        "SKP2GLB_BIN",
        "SKP_TO_GLB_BIN",
        "SKETCHUP_TO_GLTF_BIN",
        "SKETCHUP_ADAPTER_URL",
        "LICENSED_BIM_ADAPTER_URL",
    ):
        monkeypatch.delenv(name, raising=False)
    empty_path = tmp_path / "empty-path"
    empty_path.mkdir()
    monkeypatch.setenv("PATH", str(empty_path))
    source = tmp_path / "model.skp"
    fallback = tmp_path / "model.glb"
    source.write_bytes(b"SketchUp source")
    fallback.write_bytes(_minimal_glb_bytes())

    result = licensed_bim_convert(
        ConversionJob(
            job_id="job-skp-ifc-no-fallback",
            tenant_id="tenant-a",
            project_id="project-a",
            actor="engine-boundary-test",
            operation=ConversionOperation.CAD_CONVERT,
            source_asset_id="asset-engine-1",
            source_file_id="file-engine-1",
            input={
                "sourcePath": str(source),
                "sourceFileName": source.name,
                "targetFormat": "ifc",
                "outputFormats": ["ifc"],
                "outputDir": str(tmp_path / "out"),
                "glbFallbackPath": str(fallback),
            },
        )
    )

    assert result.status == "blocked"
    assert result.output["adapter"] == "licensed_bim_adapter"
    assert "PRENGINE_SKP_TO_IFC_COMMAND" in result.output["installHint"]
    assert "will not fall back to GLB" in result.output["installHint"]


def test_skp_glb_fallback_is_used_only_as_final_bound_derivative(monkeypatch, tmp_path) -> None:
    for name in (
        "PRENGINE_SKP_CONVERTER_COMMAND",
        "SKP_CONVERTER_COMMAND",
        "SKP2GLB_BIN",
        "SKP_TO_GLB_BIN",
        "SKETCHUP_TO_GLTF_BIN",
        "SKETCHUP_ADAPTER_URL",
        "LICENSED_BIM_ADAPTER_URL",
    ):
        monkeypatch.delenv(name, raising=False)
    source = tmp_path / "model.skp"
    fallback = tmp_path / "model.glb"
    output_dir = tmp_path / "out"
    source.write_bytes(b"SketchUp source")
    fallback.write_bytes(_minimal_glb_bytes())

    result = licensed_bim_convert(
        ConversionJob(
            job_id="job-skp-glb-fallback",
            tenant_id="tenant-a",
            project_id="project-a",
            actor="engine-boundary-test",
            operation=ConversionOperation.CAD_CONVERT,
            source_asset_id="asset-engine-1",
            source_file_id="file-engine-1",
            input={
                "sourcePath": str(source),
                "sourceFileName": source.name,
                "outputDir": str(output_dir),
                "glbFallbackPath": str(fallback),
            },
        )
    )

    assert result.status == "completed"
    assert result.output["fallback"] == "glb"
    assert result.artifacts[0].role == "skp_glb_fallback"
    assert (output_dir / "model.glb").read_bytes()[:4] == b"glTF"


def test_skp_glb_fallback_scans_shared_derivative_cache(monkeypatch, tmp_path) -> None:
    for name in (
        "PRENGINE_SKP_CONVERTER_COMMAND",
        "SKP_CONVERTER_COMMAND",
        "SKP2GLB_BIN",
        "SKP_TO_GLB_BIN",
        "SKETCHUP_TO_GLTF_BIN",
        "SKETCHUP_ADAPTER_URL",
        "LICENSED_BIM_ADAPTER_URL",
    ):
        monkeypatch.delenv(name, raising=False)
    empty_path = tmp_path / "empty-path"
    empty_path.mkdir()
    monkeypatch.setenv("PATH", str(empty_path))

    uploads_root = tmp_path / "uploads"
    source = uploads_root / "model.skp"
    source.parent.mkdir(parents=True)
    source.write_bytes(b"SketchUp source")
    checksum = "f" * 64
    derivative_dir = uploads_root / "derivatives" / "skp" / "v1-real-glb" / checksum[:16]
    derivative_dir.mkdir(parents=True)
    (derivative_dir / "viewer.glb").write_bytes(_minimal_glb_bytes())
    output_dir = tmp_path / "out"

    result = licensed_bim_convert(
        ConversionJob(
            job_id="job-skp-shared-glb-fallback",
            tenant_id="tenant-a",
            project_id="project-a",
            actor="engine-boundary-test",
            operation=ConversionOperation.CAD_CONVERT,
            source_asset_id="asset-engine-1",
            source_file_id="local-skp-file",
            input={
                "sourcePath": str(source),
                "sourceFileName": source.name,
                "sourceChecksum": checksum,
                "derivativesRoot": str(uploads_root),
                "outputDir": str(output_dir),
            },
        )
    )

    assert result.status == "completed"
    assert result.output["fallback"] == "glb"
    assert result.artifacts[0].role == "skp_glb_fallback"
    assert (output_dir / "model.glb").read_bytes()[:4] == b"glTF"


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
