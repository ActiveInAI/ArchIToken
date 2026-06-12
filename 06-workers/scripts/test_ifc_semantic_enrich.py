import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

import ifcopenshell  # noqa: E402

from ifc_semantic_enrich import (  # noqa: E402
    attach_sjg_classifications,
    classify_component,
    pick_ifc_entity_type,
    upgrade_proxies_and_classify,
)


def test_pick_type_concrete_vs_proxy():
    assert pick_ifc_entity_type(classify_component("钢柱-1")) == "IfcColumn"
    assert pick_ifc_entity_type(classify_component("钢梁")) == "IfcBeam"
    assert pick_ifc_entity_type(classify_component("无关物")) == "IfcBuildingElementProxy"


def _empty_model():
    m = ifcopenshell.file(schema="IFC4")
    return m


def test_attach_classifications_groups_by_code():
    m = _empty_model()
    guid = ifcopenshell.guid.new
    a = m.create_entity("IfcColumn", GlobalId=guid(), Name="钢柱-1")
    b = m.create_entity("IfcColumn", GlobalId=guid(), Name="钢柱-2")
    c = m.create_entity("IfcBeam", GlobalId=guid(), Name="钢梁-1")
    classified = [
        (a, classify_component("钢柱-1")),
        (b, classify_component("钢柱-2")),
        (c, classify_component("钢梁-1")),
    ]
    code_count = attach_sjg_classifications(m, classified)
    assert code_count == 2  # 钢柱 + 钢梁
    refs = {r.Identification for r in m.by_type("IfcClassificationReference")}
    assert "30-03.95.03" in refs and "30-03.95.09" in refs
    assert m.by_type("IfcClassification")[0].Name.startswith("SJG 157")


def test_upgrade_proxy_to_real_type():
    m = _empty_model()
    guid = ifcopenshell.guid.new
    # 一个名为"钢柱"的 Proxy 应被升级为 IfcColumn 并保留 GlobalId
    proxy = m.create_entity(
        "IfcBuildingElementProxy", GlobalId=guid(), Name="钢柱-X1"
    )
    keep_gid = proxy.GlobalId
    # 一个无法分类的 Proxy 应保持 Proxy
    m.create_entity("IfcBuildingElementProxy", GlobalId=guid(), Name="无关物体")
    stats = upgrade_proxies_and_classify(m)
    assert stats["upgraded"] == 1
    cols = m.by_type("IfcColumn")
    assert len(cols) == 1 and cols[0].GlobalId == keep_gid
    assert len(m.by_type("IfcBuildingElementProxy")) == 1
    assert stats["classified"] >= 1
