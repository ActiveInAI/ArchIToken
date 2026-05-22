import json

from architoken_workers import ConversionJob, ConversionOperation
from architoken_workers.floorplan_worker import generate_floorplan_layout
from architoken_workers.worker_cli import dispatch_payload


def _job(input_payload: dict | None = None) -> ConversionJob:
    return ConversionJob(
        job_id="job-floorplan-1",
        tenant_id="tenant-a",
        project_id="project-a",
        actor="floorplan-test",
        operation=ConversionOperation.FLOORPLAN_GENERATE,
        source_asset_id="asset-floorplan-1",
        source_file_id="file-floorplan-1",
        input=input_payload or {},
    )


def test_floorplan_worker_writes_candidate_manifest(tmp_path) -> None:
    result = generate_floorplan_layout(
        _job(
            {
                "outputDir": str(tmp_path),
                "prompt": "135 平四室两厅双卫，客厅朝南，大餐厅",
                "mode": "furnish",
                "boundary": {
                    "polygon": [
                        {"x": 0, "y": 0},
                        {"x": 15000, "y": 0},
                        {"x": 15000, "y": 9000},
                        {"x": 0, "y": 9000},
                    ],
                    "entrance": {"x": 7500, "y": 9000},
                },
            }
        )
    )

    assert result.status == "completed"
    assert result.output["schema"] == "architoken.floorplan_candidate_manifest.v1"
    assert result.output["reviewState"] == "professional_review_required"
    assert result.output["candidateCount"] == 4
    artifact_path = result.artifacts[0].metadata["path"]
    manifest = json.loads(open(artifact_path, encoding="utf-8").read())
    assert manifest["plan"]["summary"]["envelope"] == [15000, 9000]
    assert manifest["evaluation"]["schema"] == "architoken.floorplan_evaluation_report.v1"
    assert manifest["aiGateChain"] == [
        "Planner",
        "Generator",
        "Evaluator",
        "RuleChecker",
        "SchemaValidator",
        "Approver",
    ]


def test_floorplan_worker_rejects_wrong_operation() -> None:
    job = ConversionJob(
        job_id="job-floorplan-2",
        tenant_id="tenant-a",
        project_id="project-a",
        actor="floorplan-test",
        operation=ConversionOperation.MODEL_GENERATE,
        source_asset_id="asset-floorplan-2",
        source_file_id="file-floorplan-2",
    )

    result = generate_floorplan_layout(job)

    assert result.status == "failed"
    assert result.error["code"] == "unsupported_operation"


def test_floorplan_worker_dispatches_through_cli(tmp_path) -> None:
    result = dispatch_payload(
        {
            "job_id": "job-floorplan-3",
            "tenant_id": "tenant-a",
            "project_id": "project-a",
            "actor": "floorplan-test",
            "operation": "floorplan_generate",
            "source_asset_id": "asset-floorplan-3",
            "source_file_id": "file-floorplan-3",
            "input": {
                "adapter": "floorplan_layout",
                "outputDir": str(tmp_path),
                "prompt": "110 平三室两厅双卫",
            },
        }
    )

    assert result["status"] == "completed"
    assert result["output"]["adapter"] == "floorplan_layout"
    assert result["output"]["adapterIsolation"]["adapter"] == "floorplan_layout"
