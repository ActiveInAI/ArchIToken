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
    assert "cad_convert" in values
    assert "pdf_parse" in values
    assert "pointcloud_tile" in values


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


def test_worker_result_is_manifest_only() -> None:
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
