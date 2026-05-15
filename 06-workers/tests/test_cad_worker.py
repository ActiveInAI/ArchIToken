from architoken_workers import ConversionJob, ConversionOperation
from architoken_workers.cad_worker import (
    dxf_extract_entities,
    licensed_dwg_adapter,
    occt_adapter,
    step_metadata,
)
from architoken_workers.cadquery_worker import cadquery_generate
from architoken_workers.freecad_worker import freecad_headless_convert


def _completed_or_blocked(result, adapter: str) -> bool:
    assert result.status in {"completed", "blocked"}
    if result.status == "blocked":
        assert result.error["code"] == "adapter_not_configured"
        assert result.output["adapter"] == adapter
        assert result.output["available"] is False
        assert result.output["installHint"]
        return False
    return True


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
    if _completed_or_blocked(dxf, "ezdxf"):
        assert dxf.artifacts[0].name == "dxf_entities.jsonl"
    if _completed_or_blocked(step, "ocp"):
        assert step.output["schema"] == "AP242"


def test_cadquery_and_freecad_adapters() -> None:
    cadquery = cadquery_generate(_job())
    freecad = freecad_headless_convert(_job())
    if _completed_or_blocked(cadquery, "cadquery"):
        assert cadquery.output["engine"] == "cadquery"
    if _completed_or_blocked(freecad, "freecad_headless"):
        assert freecad.output["engine"] == "freecad_headless"


def test_adapter_boundaries_do_not_enable_dwg_core() -> None:
    occt = occt_adapter(_job())
    dwg = licensed_dwg_adapter(_job())
    if _completed_or_blocked(occt, "occt"):
        assert occt.output["mode"] == "external_native_adapter"
    if _completed_or_blocked(dwg, "dwg"):
        assert dwg.output["mode"] == "licensed_external_adapter"
