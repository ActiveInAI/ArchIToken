from architoken_workers import ConversionJob, ConversionOperation
from architoken_workers.build123d_worker import build123d_generate
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


def _job(input_payload: dict | None = None) -> ConversionJob:
    return ConversionJob(
        job_id="job-cad-1",
        tenant_id="tenant-a",
        project_id="project-a",
        actor="cad-worker-test",
        operation=ConversionOperation.CAD_CONVERT,
        source_asset_id="asset-cad-1",
        source_file_id="file-cad-1",
        input=input_payload or {},
    )


def test_open_cad_adapter_contracts() -> None:
    dxf = dxf_extract_entities(_job())
    step = step_metadata(_job())
    if _completed_or_blocked(dxf, "ezdxf"):
        assert dxf.artifacts[0].name == "dxf_entities.jsonl"
    if _completed_or_blocked(step, "ocp"):
        assert step.output["schema"] == "AP242"


def test_cadquery_and_freecad_adapters() -> None:
    build123d = build123d_generate(
        _job({"build123dSpec": {"shape": "box", "dimensions": {"length": 10, "width": 8, "height": 4}}})
    )
    cadquery = cadquery_generate(_job())
    freecad = freecad_headless_convert(_job())
    if _completed_or_blocked(build123d, "build123d"):
        assert build123d.output["engine"] == "build123d"
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
        assert dwg.output["mode"] in {"licensed_external_adapter", "local_sidecar_dwg_to_dxf"}


def test_local_dwg_sidecar_writes_real_dxf_derivative(monkeypatch, tmp_path) -> None:
    source = tmp_path / "source.dwg"
    source.write_bytes(b"AC1018\0real-dwg-test")
    converter = tmp_path / "dwgread"
    converter.write_text(
        "#!/usr/bin/env python3\n"
        "import sys\n"
        "sys.stdout.write('  0\\nSECTION\\n  2\\nHEADER\\n' + '999\\nlarge-dxf\\n' * 900 + '  0\\nENDSEC\\n  0\\nEOF\\n')\n",
        encoding="utf-8",
    )
    converter.chmod(0o755)
    monkeypatch.setenv("DWG_TO_DXF_PATH", str(converter))
    monkeypatch.delenv("DWG_ADAPTER_URL", raising=False)

    result = licensed_dwg_adapter(_job({"sourcePath": str(source), "outputDir": str(tmp_path / "out")}))

    assert result.status == "completed"
    assert result.output["mode"] == "local_sidecar_dwg_to_dxf"
    assert result.output["engine"] == "libredwg-dwgread"
    assert result.output["licenseBoundary"] == "isolated_sidecar"
    assert result.output["derivativeFormat"] == "dxf"
    assert result.artifacts[0].role == "dwg_dxf_derivative"
    assert result.artifacts[0].name == "source.dxf"
    assert "watermark" not in str(result.output).lower()
