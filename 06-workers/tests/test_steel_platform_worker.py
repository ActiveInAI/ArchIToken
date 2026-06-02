import json

from architoken_workers import ConversionJob, ConversionOperation
from architoken_workers.steel_platform_worker import generate_steel_platform
from architoken_workers.worker_cli import dispatch_payload


def _plan() -> dict:
    return {
        "projectName": "钢平台深化测试",
        "floors": 2,
        "outline_polygon": [[0, 0], [9600, 0], [9600, 7200], [0, 7200]],
        "blocks": [
            {
                "id": "R_客餐厅",
                "purpose": "客餐厅一体",
                "floor": 1,
                "polygon": [[0, 0], [4800, 0], [4800, 3600], [0, 3600]],
            },
            {
                "id": "R_厨房",
                "purpose": "厨房",
                "floor": 1,
                "polygon": [[4800, 0], [9600, 0], [9600, 3600], [4800, 3600]],
            },
            {
                "id": "R_主卧",
                "purpose": "主卧",
                "floor": 2,
                "polygon": [[0, 3600], [4800, 3600], [4800, 7200], [0, 7200]],
            },
        ],
    }


def _job(input_payload: dict | None = None) -> ConversionJob:
    return ConversionJob(
        job_id="job-steel-platform-1",
        tenant_id="tenant-a",
        project_id="project-a",
        actor="steel-platform-test",
        operation=ConversionOperation.MODEL_GENERATE,
        source_asset_id="asset-steel-platform-1",
        source_file_id="file-steel-platform-1",
        input=input_payload or {},
    )


def test_steel_platform_worker_writes_review_required_manifest(tmp_path) -> None:
    result = generate_steel_platform(
        _job(
            {
                "outputDir": str(tmp_path),
                "plan": {
                    **_plan(),
                    "exterior_openings": [
                        {
                            "id": "OP-1",
                            "wall_side": "south",
                            "center": 2400,
                            "width": 1200,
                            "height": 1500,
                            "sill": 900,
                            "opening_type": "window",
                            "frame_type": "4-edge",
                            "floor": 1,
                        }
                    ],
                    "interior_doors": [
                        {"wall_id": "IW-F1-1", "position": 2400, "flip": 0}
                    ],
                },
                "outputFormats": ["json"],
                "steelPlatform": {"maxSpanMm": 4800},
            }
        )
    )

    assert result.status == "completed"
    assert result.output["schema"] == "architoken.steel_platform_design_package.v1"
    assert result.output["reviewState"] == "professional_review_required"
    assert result.output["columnCount"] > 0
    assert result.output["beamCount"] > 0
    roles = {artifact.role for artifact in result.artifacts}
    assert {"steel_platform_design_package", "steel_platform_bom"} <= roles

    manifest_path = next(
        artifact.metadata["path"]
        for artifact in result.artifacts
        if artifact.role == "steel_platform_design_package"
    )
    manifest = json.loads(open(manifest_path, encoding="utf-8").read())
    assert manifest["aiGateChain"][-1]["name"] == "Approver"
    assert manifest["ruleChecks"][-1]["status"] == "professional_review_required"
    assert manifest["structuralLayout"]["wallBays"]
    assert manifest["structuralLayout"]["constructionColumnGroups"]
    assert manifest["structuralLayout"]["interiorWalls"]
    assert manifest["structuralLayout"]["exteriorOpenings"][0]["bayId"]
    assert manifest["bom"]["summary"]["totalSteelT"] > 0


def test_steel_platform_worker_rejects_missing_plan() -> None:
    result = generate_steel_platform(_job({"outputFormats": ["json"]}))

    assert result.status == "failed"
    assert result.error["code"] == "invalid_plan"


def test_steel_platform_worker_dispatches_through_cli(tmp_path) -> None:
    result = dispatch_payload(
        {
            "job_id": "job-steel-platform-2",
            "tenant_id": "tenant-a",
            "project_id": "project-a",
            "actor": "steel-platform-test",
            "operation": "model_generate",
            "source_asset_id": "asset-steel-platform-2",
            "source_file_id": "file-steel-platform-2",
            "input": {
                "adapter": "steel_platform",
                "outputDir": str(tmp_path),
                "plan": _plan(),
                "outputFormats": ["json"],
            },
        }
    )

    assert result["status"] == "completed"
    assert result["output"]["adapter"] == "steel_platform"
    assert result["output"]["adapterIsolation"]["adapter"] == "steel_platform"
