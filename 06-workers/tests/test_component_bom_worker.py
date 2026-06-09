from pathlib import Path

import pytest

from architoken_workers import ConversionJob, ConversionOperation
from architoken_workers.component_bom_worker import (
    import_component_bom,
    parse_bom_workbook,
    parse_component_naming_rules,
    parse_sjg157_categories,
)
from architoken_workers.worker_cli import DISPATCH, dispatch_payload

SJG157_PATH = Path("/home/insome/下载/建筑工程信息模型语义字典编码表_SJG157-2024.xlsx")
NAMING_RULE_PATH = Path("/home/insome/下载/装配式钢结构建筑构件标准化命名规则V1.0.xlsx")
BOM_PATH = Path("/home/insome/下载/应舍美居_构件物料清单.xlsx")


def _require_sources() -> None:
    missing = [path for path in (SJG157_PATH, NAMING_RULE_PATH, BOM_PATH) if not path.is_file()]
    if missing:
        pytest.skip(f"component BOM source workbooks are not available: {missing}")


def _job(tmp_path: Path) -> ConversionJob:
    return ConversionJob(
        job_id="job-component-bom-import",
        tenant_id="tenant-a",
        project_id="project-a",
        actor="component-bom-test",
        operation=ConversionOperation.COMPONENT_BOM_IMPORT,
        source_asset_id="asset-bom-1",
        source_file_id="file-bom-1",
        input={
            "sourcePath": str(BOM_PATH),
            "sjg157Path": str(SJG157_PATH),
            "namingRulePath": str(NAMING_RULE_PATH),
            "outputDir": str(tmp_path),
        },
    )


def test_component_bom_source_workbooks_parse_real_counts() -> None:
    _require_sources()
    categories = parse_sjg157_categories(SJG157_PATH)
    rules = parse_component_naming_rules(NAMING_RULE_PATH)
    bom = parse_bom_workbook(BOM_PATH)

    assert len(categories) == 5678
    assert {item["code"] for item in categories} >= {
        "30-03.70.20",
        "30-03.95.03.15",
        "30-03.95.33.20.15",
    }
    assert len(rules) == 41
    assert {item.get("prefix") for item in rules if item.get("prefix")} >= {
        "Beam",
        "Column",
        "Purlin",
        "Fastener",
    }
    assert bom["summary"]["lineCount"] == 14
    assert bom["summary"]["totalQuantity"] == 470
    assert bom["summary"]["totalWeightKg"] == 0
    assert bom["lines"][0]["sourceRow"] == 6
    assert bom["lines"][0]["componentName"].startswith("Column_Main_")
    assert len(bom["categoryReferences"]) == 135


def test_component_bom_worker_writes_review_required_artifacts(tmp_path: Path) -> None:
    _require_sources()
    result = import_component_bom(_job(tmp_path))

    assert result.status == "completed"
    assert result.output["schema"] == "architoken.component_bom_import_manifest.v1"
    assert result.output["reviewState"] == "professional_review_required"
    assert result.output["bomLines"] == 14
    assert result.output["totalQuantity"] == 470
    assert result.output["sjg157Categories"] == 5678
    assert result.output["namingRules"] == 41
    assert result.output["validationErrors"] == 0
    assert result.output["validationIssues"] >= 14
    assert {artifact.role for artifact in result.artifacts} >= {
        "component_bom_import_manifest",
        "component_bom_lines",
        "component_bom_validation_report",
        "sjg157_category_index",
        "component_naming_rules",
    }
    assert (tmp_path / "component_bom_import_manifest.json").is_file()
    assert (tmp_path / "component_bom_lines.jsonl").read_text(encoding="utf-8").count("\n") == 14
    validation_text = (tmp_path / "component_bom_validation_issues.json").read_text(encoding="utf-8")
    assert "weight_missing_in_source" in validation_text
    assert "component_prefix_category_conflict" in validation_text
    assert "length_token_source_mismatch" in validation_text


def test_component_bom_adapter_is_dispatchable(tmp_path: Path) -> None:
    _require_sources()
    assert DISPATCH["component_bom"] is import_component_bom

    response = dispatch_payload(
        {
            "job_id": "job-component-bom-dispatch",
            "tenant_id": "tenant-a",
            "project_id": "project-a",
            "actor": "component-bom-test",
            "operation": "component_bom_import",
            "source_asset_id": "asset-bom-1",
            "source_file_id": "file-bom-1",
            "input": {
                "adapter": "component_bom",
                "sourcePath": str(BOM_PATH),
                "sjg157Path": str(SJG157_PATH),
                "namingRulePath": str(NAMING_RULE_PATH),
                "outputDir": str(tmp_path),
            },
        }
    )

    assert response["status"] == "completed"
    assert response["output"]["adapterIsolation"]["adapter"] == "component_bom"
    assert response["output"]["adapterIsolation"]["isolation"] == "in_process_library"
