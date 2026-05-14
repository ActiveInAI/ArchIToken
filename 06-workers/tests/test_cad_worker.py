from architoken_workers import ConversionJob, ConversionOperation
from architoken_workers.cad_worker import (
    dwg_legal_adapter_boundary,
    dxf_extract_entities,
    occt_adapter_boundary,
    step_metadata,
)
from architoken_workers.cadquery_worker import cadquery_generate
from architoken_workers.freecad_worker import freecad_headless_convert


def _job() -> ConversionJob:
    return ConversionJob(
        job_id="job-cad-1",
        tenant_id="tenant-a",
        project_id="project-a",
        actor="cad-worker-test",
        operation=ConversionOperation.CAD_CONVERT,
        source_asset_id="asset-cad-1",
        source_file_id="file-cad-1",
    )


def test_open_cad_contracts_are_manifest_only() -> None:
    dxf = dxf_extract_entities(_job())
    step = step_metadata(_job())
    assert dxf.artifacts[0].name == "dxf_entities.jsonl"
    assert step.output["schema"] == "AP242"


def test_cadquery_and_freecad_skeletons() -> None:
    cadquery = cadquery_generate(_job())
    freecad = freecad_headless_convert(_job())
    assert cadquery.output["engine"] == "cadquery"
    assert freecad.output["engine"] == "freecad_headless"


def test_adapter_boundaries_do_not_enable_dwg_core() -> None:
    occt = occt_adapter_boundary(_job())
    dwg = dwg_legal_adapter_boundary(_job())
    assert occt.output["mode"] == "boundary_only"
    assert dwg.output["mode"] == "legal_boundary_only"
    assert dwg.output["productionEnabled"] is False
