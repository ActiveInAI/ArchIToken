import subprocess
import sys
from pathlib import Path

import ifcopenshell
import rhino3dm


def test_3dm_to_ifc_sidecar_exports_mesh_geometry(tmp_path) -> None:
    source = tmp_path / "box.3dm"
    output = tmp_path / "box.ifc"
    _write_mesh_3dm(source)

    result = subprocess.run(
        [
            sys.executable,
            str(Path(__file__).parents[1] / "scripts" / "architoken_3dm_to_ifc.py"),
            "--input",
            str(source),
            "--output",
            str(output),
        ],
        check=False,
        capture_output=True,
        text=True,
    )

    assert result.returncode == 0, result.stderr
    assert output.is_file()
    text = output.read_text(encoding="latin-1")
    assert "ISO-10303-21" in text[:4096]
    assert "FILE_SCHEMA" in text

    model = ifcopenshell.open(str(output))
    assert model.schema == "IFC4"
    assert len(model.by_type("IfcBuildingElementProxy")) == 1
    assert len(model.by_type("IfcTriangulatedFaceSet")) == 1


def test_3dm_to_ifc_sidecar_preserves_material_color_and_cleans_names(tmp_path) -> None:
    source = tmp_path / "colored.3dm"
    output = tmp_path / "colored.ifc"
    _write_mesh_3dm(
        source,
        name="Plus������ / ESD115 panel",
        material_name="Orange panel",
        color=(255, 140, 0, 255),
    )

    result = subprocess.run(
        [
            sys.executable,
            str(Path(__file__).parents[1] / "scripts" / "architoken_3dm_to_ifc.py"),
            "--input",
            str(source),
            "--output",
            str(output),
        ],
        check=False,
        capture_output=True,
        text=True,
    )

    assert result.returncode == 0, result.stderr
    text = output.read_text(encoding="latin-1")
    assert "�" not in text
    assert "IFCSTYLEDITEM" in text
    assert "IFCCOLOURRGB" in text

    model = ifcopenshell.open(str(output))
    element = model.by_type("IfcBuildingElementProxy")[0]
    assert "�" not in (element.Name or "")
    assert model.by_type("IfcStyledItem")
    colors = model.by_type("IfcColourRgb")
    assert colors
    assert any(
        round(float(color.Red), 3) == 1.0
        and round(float(color.Green), 3) == round(140 / 255, 3)
        and round(float(color.Blue), 3) == 0.0
        for color in colors
    )


def test_3dm_to_ifc_sidecar_ignores_default_black_layer_as_material(tmp_path) -> None:
    source = tmp_path / "default-layer.3dm"
    output = tmp_path / "default-layer.ifc"
    _write_mesh_3dm(source)

    result = subprocess.run(
        [
            sys.executable,
            str(Path(__file__).parents[1] / "scripts" / "architoken_3dm_to_ifc.py"),
            "--input",
            str(source),
            "--output",
            str(output),
        ],
        check=False,
        capture_output=True,
        text=True,
    )

    assert result.returncode == 0, result.stderr
    model = ifcopenshell.open(str(output))
    assert not model.by_type("IfcStyledItem")
    assert not model.by_type("IfcColourRgb")
    assert not model.by_type("IfcMaterial")


def _write_mesh_3dm(
    path: Path,
    *,
    name: str = "Test Box",
    material_name: str | None = None,
    color: tuple[int, int, int, int] | None = None,
) -> None:
    mesh = rhino3dm.Mesh()
    for vertex in [
        (0.0, 0.0, 0.0),
        (1000.0, 0.0, 0.0),
        (1000.0, 1000.0, 0.0),
        (0.0, 1000.0, 0.0),
        (0.0, 0.0, 1000.0),
        (1000.0, 0.0, 1000.0),
        (1000.0, 1000.0, 1000.0),
        (0.0, 1000.0, 1000.0),
    ]:
        mesh.Vertices.Add(*vertex)
    for face in [
        (0, 1, 2, 3),
        (4, 7, 6, 5),
        (0, 4, 5, 1),
        (1, 5, 6, 2),
        (2, 6, 7, 3),
        (3, 7, 4, 0),
    ]:
        mesh.Faces.AddFace(*face)

    model = rhino3dm.File3dm()
    attributes = rhino3dm.ObjectAttributes()
    attributes.Name = name
    if material_name and color:
        material = rhino3dm.Material()
        material.Name = material_name
        material.DiffuseColor = color
        material_index = model.Materials.Add(material)
        attributes.MaterialIndex = material_index
        attributes.MaterialSource = rhino3dm.ObjectMaterialSource.MaterialFromObject
        attributes.ColorSource = rhino3dm.ObjectColorSource.ColorFromMaterial
    model.Objects.AddMesh(mesh, attributes)
    model.Write(str(path), 8)
