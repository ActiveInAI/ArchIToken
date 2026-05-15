from architoken_workers import ConversionJob, ConversionOperation
from architoken_workers.bsdd_worker import enrich_with_bsdd
from architoken_workers.ids_worker import validate_ids
from architoken_workers.openbim_worker import IFC_INGEST_OUTPUTS, ingest_ifc


def _completed_or_blocked(result, adapter: str) -> bool:
    assert result.status in {"completed", "blocked"}
    if result.status == "blocked":
        assert result.error["code"] == "adapter_not_configured"
        assert result.output["adapter"] == adapter
        assert result.output["available"] is False
        assert result.output["installHint"]
        return False
    return True


def _job(operation: ConversionOperation = ConversionOperation.IFC_INGEST) -> ConversionJob:
    return ConversionJob(
        job_id="job-openbim-1",
        tenant_id="tenant-a",
        project_id="project-a",
        actor="openbim-worker-test",
        operation=operation,
        source_asset_id="asset-ifc-1",
        source_file_id="file-ifc-1",
    )


def test_ifc_ingest_outputs_required_manifests() -> None:
    result = ingest_ifc(_job())
    if _completed_or_blocked(result, "ifcopenshell"):
        assert tuple(artifact.name for artifact in result.artifacts) == IFC_INGEST_OUTPUTS
        assert "ifc_entities.jsonl" in result.output["outputs"]
        assert result.output["standard"] == "IFC4x3"


def test_ifc_ingest_rejects_wrong_operation() -> None:
    try:
        ingest_ifc(_job(ConversionOperation.PDF_PARSE))
    except ValueError as exc:
        assert "unsupported openBIM operation" in str(exc)
    else:
        raise AssertionError("expected wrong operation to fail")


def test_ifc_derivative_operations_block_or_complete_explicitly() -> None:
    glb = ingest_ifc(_job(ConversionOperation.IFC_TO_GLB))
    tiles = ingest_ifc(_job(ConversionOperation.IFC_TO_3DTILES))

    assert glb.status in {"blocked", "completed"}
    assert tiles.status in {"blocked", "completed"}
    if glb.status == "blocked":
        assert glb.output["adapter"] == "ifcconvert"
    if tiles.status == "blocked":
        assert tiles.output["adapter"] in {"ifcconvert", "cesium_ion"}


def test_bsdd_and_ids_worker_adapters() -> None:
    bsdd = enrich_with_bsdd(_job())
    ids = validate_ids(_job())
    assert bsdd.output["networkPolicy"] == "scheduled_explicit_only"
    assert ids.output["standard"] == "IDS"
    assert ids.output["passed"] is None
    assert ids.artifacts[0].name == "ids_validation_report.json"
