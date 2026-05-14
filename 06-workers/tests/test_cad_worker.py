from architoken_workers import ConversionJob, ConversionOperation
from architoken_workers.cad_worker import (
    dxf_extract_entities,
    licensed_dwg_adapter,
    occt_adapter,
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


def test_open_cad_adapter_contracts() -> None:
    dxf = dxf_extract_entities(_job())
    step = step_metadata(_job())
    assert dxf.artifacts[0].name == "dxf_entities.jsonl"
    assert step.output["schema"] == "AP242"


def test_cadquery_and_freecad_adapters() -> None:
    cadquery = cadquery_generate(_job())
    freecad = freecad_headless_convert(_job())
    assert cadquery.output["engine"] == "cadquery"
    assert freecad.output["engine"] == "freecad_headless"


def test_adapter_boundaries_do_not_enable_dwg_core() -> None:
    occt = occt_adapter(_job())
    dwg = licensed_dwg_adapter(_job())
    assert occt.output["mode"] == "external_native_adapter"
    assert dwg.output["mode"] == "licensed_external_adapter"
