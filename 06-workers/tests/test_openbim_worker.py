from architoken_workers import ConversionJob, ConversionOperation
from architoken_workers.bsdd_worker import enrich_with_bsdd
from architoken_workers.ids_worker import validate_ids
from architoken_workers.openbim_worker import IFC_INGEST_OUTPUTS, ingest_ifc


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
    assert result.status == "completed"
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


def test_bsdd_and_ids_worker_adapters() -> None:
    bsdd = enrich_with_bsdd(_job())
    ids = validate_ids(_job())
    assert bsdd.output["networkPolicy"] == "scheduled_explicit_only"
    assert ids.output["standard"] == "IDS"
    assert ids.artifacts[0].name == "ids_validation_report.json"
