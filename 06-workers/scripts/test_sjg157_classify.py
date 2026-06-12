import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from sjg157_classify import classify_sjg157, classify_by_ifc_class

def test_steel_column():
    m = classify_sjg157("钢柱-0001")
    assert m and m["ifc"] == "IfcColumn" and m["code"] == "30-03.95.03"

def test_numbered_concrete_column():
    m = classify_sjg157("框架柱KZ3")
    assert m and m["ifc"] == "IfcColumn" and m["category"] == "混凝土结构柱"

def test_specific_beats_generic_raft():
    # 筏板基础 不应被泛化的"板"抢占
    m = classify_sjg157("筏板基础")
    assert m and m["ifc"] == "IfcFooting"

def test_layer_prefix_stripped():
    m = classify_sjg157("S-钢支撑")
    assert m and m["ifc"] == "IfcMember"

def test_gz_code_prefix_kept():
    m = classify_sjg157("GZ-1")
    assert m and m["ifc"] == "IfcColumn"

def test_unrelated_unclassified():
    assert classify_sjg157("XYZ无关层") is None
    assert classify_sjg157("") is None
    assert classify_sjg157(None) is None

def test_ifc_class_default():
    m = classify_by_ifc_class("IfcBeam")
    assert m and m["category"] == "混凝土构造梁"
    assert classify_by_ifc_class("IfcUnknownXYZ") is None

def test_name_first_then_ifc_fallback():
    # 名称命中优先
    assert classify_sjg157("钢梁")["code"] == "30-03.95.09"
