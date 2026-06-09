from architoken_workers import (
    ConversionJob,
    ConversionOperation,
    WorkerArtifact,
    WorkerResult,
    validate_job,
)


def test_conversion_operation_contract_contains_required_operations() -> None:
    values = {operation.value for operation in ConversionOperation}
    assert "ifc_ingest" in values
    assert "ifc_to_3dtiles" in values
    assert "openbim_validate" in values
    assert "bcf_ingest" in values
    assert "idm_ingest" in values
    assert "bsdd_enrich" in values
    assert "ifcdb_index" in values
    assert "ifcdb_query" in values
    assert "ifcdb_export" in values
    assert "ifcdb_clash" in values
    assert "ifcdb_quantity" in values
    assert "cad_convert" in values
    assert "pdf_parse" in values
    assert "pointcloud_tile" in values
    assert "image_generate" in values
    assert "video_generate" in values
    assert "audio_generate" in values
    assert "floorplan_generate" in values
    assert "bim_generate" in values
    assert "component_bom_import" in values
    assert "mindmap_generate" in values


def test_validate_job_requires_runtime_context() -> None:
    job = ConversionJob(
        job_id="job-1",
        tenant_id="tenant-a",
        project_id="project-a",
        actor="worker-test",
        operation=ConversionOperation.IFC_INGEST,
        source_asset_id="asset-1",
        source_file_id="file-1",
    )
    validate_job(job)


def test_validate_job_rejects_missing_context() -> None:
    job = ConversionJob(
        job_id="job-1",
        tenant_id="",
        project_id="project-a",
        actor="worker-test",
        operation=ConversionOperation.IFC_INGEST,
        source_asset_id="asset-1",
        source_file_id="file-1",
    )
    try:
        validate_job(job)
    except ValueError as exc:
        assert "tenant_id" in str(exc)
    else:
        raise AssertionError("expected missing tenant_id to fail")


def test_worker_result_carries_adapter_artifacts() -> None:
    result = WorkerResult(
        job_id="job-1",
        status="completed",
        artifacts=(
            WorkerArtifact(
                name="model_manifest.json",
                media_type="application/json",
                role="manifest",
                metadata={"standard": "ifc4x3"},
            ),
        ),
        output={"files": ["model_manifest.json"]},
    )
    assert result.artifacts[0].role == "manifest"
    assert result.output["files"] == ["model_manifest.json"]
