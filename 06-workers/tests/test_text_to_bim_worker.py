import base64

import pytest
from fastapi import HTTPException

import engine_server
from architoken_workers.contract import ConversionJob, ConversionOperation
from architoken_workers.text_to_bim_worker import ifcopenshell_text_to_bim

ifcopenshell = pytest.importorskip("ifcopenshell")


def _job(tmp_path, spec) -> ConversionJob:
    return ConversionJob(
        job_id="job-text-to-bim",
        tenant_id="tenant-a",
        project_id="project-a",
        actor="tester",
        operation=ConversionOperation.BIM_GENERATE,
        source_asset_id="asset-a",
        source_file_id="file-a",
        input={"bimSpec": spec, "outputDir": str(tmp_path)},
    )


def test_worker_generates_semantic_classes_and_box_geometry(tmp_path):
    spec = {
        "name": "几何测试",
        "elements": [
            {"type": "Wall", "name": "墙", "position": [0, 0, 0], "size": [9.0, 0.12, 2.8]},
            {"type": "Slab", "name": "板", "position": [0, 0, -0.12], "size": [9.0, 6.0, 0.12]},
            {"type": "Space", "name": "主卧", "position": [0, 0, 0], "size": [4.0, 3.6, 2.8]},
            {"type": "GenericElement", "name": "无几何"},
        ],
    }
    result = ifcopenshell_text_to_bim(_job(tmp_path, spec))
    assert result.status == "completed"
    assert result.output["elementCount"] == 4
    assert result.output["geometricElementCount"] == 3
    assert result.output["spaceCount"] == 1
    assert result.output["ifcClassCounts"] == {
        "IfcWall": 1,
        "IfcSlab": 1,
        "IfcSpace": 1,
        "IfcBuildingElementProxy": 1,
    }

    ifc_artifact = next(a for a in result.artifacts if a.role == "generated_ifc")
    model = ifcopenshell.open(ifc_artifact.metadata["path"])
    project = model.by_type("IfcProject")[0]
    assert project.UnitsInContext is not None
    assert project.RepresentationContexts
    assert len(model.by_type("IfcWall")) == 1
    assert len(model.by_type("IfcSlab")) == 1
    assert len(model.by_type("IfcBuildingElementProxy")) == 1
    spaces = model.by_type("IfcSpace")
    assert len(spaces) == 1
    # Space 通过聚合挂在楼层下，产品通过包含关系挂载。
    aggregates = [
        rel
        for rel in model.by_type("IfcRelAggregates")
        if rel.RelatingObject.is_a("IfcBuildingStorey")
    ]
    assert spaces[0] in aggregates[0].RelatedObjects
    contained = model.by_type("IfcRelContainedInSpatialStructure")[0]
    assert len(contained.RelatedElements) == 3
    solids = model.by_type("IfcExtrudedAreaSolid")
    assert {round(solid.Depth, 2) for solid in solids} == {2.8, 0.12}


def test_worker_creates_openings_with_door_and_window_fills(tmp_path):
    spec = {
        "name": "洞口测试",
        "elements": [
            {
                "type": "Wall",
                "name": "南墙",
                "position": [0, 0, 0],
                "size": [9.0, 0.12, 2.8],
                "openings": [
                    {"kind": "door", "position": [4.0, 0, 0], "size": [0.9, 0.12, 2.1]},
                    {"kind": "window", "position": [1.0, 0, 0.9], "size": [1.5, 0.12, 1.5]},
                ],
            },
        ],
    }
    result = ifcopenshell_text_to_bim(_job(tmp_path, spec))
    assert result.status == "completed"
    assert result.output["openingCount"] == 2
    assert result.output["ifcClassCounts"]["IfcDoor"] == 1
    assert result.output["ifcClassCounts"]["IfcWindow"] == 1

    ifc_artifact = next(a for a in result.artifacts if a.role == "generated_ifc")
    model = ifcopenshell.open(ifc_artifact.metadata["path"])
    openings = model.by_type("IfcOpeningElement")
    assert len(openings) == 2
    voids = model.by_type("IfcRelVoidsElement")
    assert {v.RelatingBuildingElement.is_a() for v in voids} == {"IfcWall"}
    fills = model.by_type("IfcRelFillsElement")
    assert {f.RelatedBuildingElement.is_a() for f in fills} == {"IfcDoor", "IfcWindow"}
    door = model.by_type("IfcDoor")[0]
    assert round(door.OverallHeight, 2) == 2.1


def test_worker_ignores_malformed_vectors(tmp_path):
    spec = {
        "name": "容错测试",
        "elements": [{"type": "Wall", "position": [0, 0], "size": [1, "x", 2]}],
    }
    result = ifcopenshell_text_to_bim(_job(tmp_path, spec))
    assert result.status == "completed"
    assert result.output["geometricElementCount"] == 0


def test_endpoint_returns_downloadable_ifc(tmp_path, monkeypatch):
    monkeypatch.setattr(engine_server, "GENERATED_DIR", tmp_path)
    payload = {
        "bimSpec": {
            "name": "端点测试",
            "elements": [
                {"type": "Wall", "position": [0, 0, 0], "size": [3.0, 0.12, 2.8]},
            ],
        }
    }
    response = engine_server.generate_text_to_bim(payload)
    assert response["status"] == "completed"
    assert response["mediaType"] == "model/ifc"
    assert response["output"]["geometricElementCount"] == 1
    content = base64.b64decode(response["contentBase64"])
    assert content.startswith(b"ISO-10303-21")
    assert (tmp_path / response["fileName"]).read_bytes() == content


def test_endpoint_rejects_missing_spec():
    with pytest.raises(HTTPException) as excinfo:
        engine_server.generate_text_to_bim({"prompt": "只有自由文本"})
    assert excinfo.value.status_code == 400
    assert excinfo.value.detail["code"] == "invalid_bim_spec"


def test_endpoint_rejects_invalid_spec_elements(tmp_path, monkeypatch):
    monkeypatch.setattr(engine_server, "GENERATED_DIR", tmp_path)
    with pytest.raises(HTTPException) as excinfo:
        engine_server.generate_text_to_bim({"bimSpec": {"name": "坏", "elements": [{"name": "缺类型"}]}})
    assert excinfo.value.status_code == 400
