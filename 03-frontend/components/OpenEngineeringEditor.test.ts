// components/OpenEngineeringEditor.test.ts - Engineering editor utility tests
// License: Apache-2.0

import { describe, expect, it } from "vitest";
import {
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshStandardMaterial,
} from "three";
import {
  DEPRECATED_ENGINEERING_ROLE_LABELS,
  buildMlightCadCadFontMapping,
  buildExchangeObjectPropertyRows,
  buildEngineeringEditorCapabilityMap,
  buildEngineeringWorkbenchOutline,
  buildOpenEngineeringEditorPanAICapabilities,
  buildIfcLiteElementIndex,
  buildIfcPropertyRows,
  buildSketchUpThreeGroup,
  buildOcctGroup,
  decodeMlightCadCadTextEscapes,
  decodeMlightCadDxfSource,
  engineeringEditorCommandToFileAction,
  extractMlightCadDxfCodePage,
  extractMlightCadCadFontNames,
  ifcLiteMeshForProjectDisplay,
  findOpenUsdVisualFallbackCandidate,
  meshSelectionAggregationKey,
  mlightCadDxfEncodingForCodePage,
  mlightCadFallbackTargetForFontName,
  mlightCadToolbarCommandForWorkbenchTool,
  normalizeGltfSourceObjectForInspection,
  prepareMlightCadDxfSourceForOpen,
  resolveOpenEngineeringEditorLocalFileId,
  stlCoplanarFacePatchTriangleIndices,
  stlGeometryDisplayGroups,
  type EngineeringWorkbenchTreeNode,
} from "./OpenEngineeringEditor";

function findOutlineNode(
  nodes: readonly EngineeringWorkbenchTreeNode[],
  id: string,
): EngineeringWorkbenchTreeNode | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    const child = node.children ? findOutlineNode(node.children, id) : null;
    if (child) return child;
  }
  return null;
}

function concatBytes(...chunks: Uint8Array[]): ArrayBuffer {
  const bytes = new Uint8Array(
    chunks.reduce((total, chunk) => total + chunk.byteLength, 0),
  );
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes.buffer;
}

describe("OpenEngineeringEditor workbench outline", () => {
  it("builds a FreeCAD/Blender-style CAD tree from the source format", () => {
    const nodes = buildEngineeringWorkbenchOutline(
      {
        id: "cad-1",
        name: "floor-plan.dwg",
        mimeType: "application/acad",
        size: 2048,
        version: "v3",
      } as never,
      "DWG/DXF 图纸",
      [{ label: "格式", value: "DWG" }],
    );

    expect(findOutlineNode(nodes, "cad:layers")?.kind).toBe("layer");
    expect(findOutlineNode(nodes, "cad:blocks")?.kind).toBe("block");
    expect(findOutlineNode(nodes, "engineering:adapter-route")?.kind).toBe(
      "adapter",
    );
  });

  it("keeps IFC hierarchy, types, properties, and diagnostics in one outline", () => {
    const nodes = buildEngineeringWorkbenchOutline(
      {
        id: "ifc-1",
        name: "model.ifc",
        mimeType: "application/p21",
        size: 4096,
        version: "v1",
      } as never,
      "Prengine · IFC 原生源文件",
      [{ label: "构件", value: "12" }],
    );

    expect(findOutlineNode(nodes, "ifc:spatial")?.kind).toBe("collection");
    expect(findOutlineNode(nodes, "ifc:types")?.kind).toBe("type");
    expect(findOutlineNode(nodes, "engineering:diagnostics")?.kind).toBe(
      "metric",
    );
  });
});

describe("OpenEngineeringEditor IFC property rows", () => {
  it("prefers IFC representation and quantity dimensions over mesh bounds", () => {
    const ifc = `ISO-10303-21;
DATA;
#1=IFCRECTANGLEPROFILEDEF(.AREA.,'Panel',$,62.,1190.);
#2=IFCEXTRUDEDAREASOLID(#1,$,$,790.);
#3=IFCSHAPEREPRESENTATION($,'Body','SweptSolid',(#2));
#4=IFCPRODUCTDEFINITIONSHAPE($,$,(#3));
#10=IFCPLATE('panel-guid',#42,'System Panel',$,'Panel Type',$,#4,'P-1',.CURTAIN_PANEL.);
#20=IFCPROPERTYSINGLEVALUE('Height',$,IFCPOSITIVELENGTHMEASURE(900.),$);
#21=IFCPROPERTYSINGLEVALUE('Width',$,IFCPOSITIVELENGTHMEASURE(1200.),$);
#22=IFCPROPERTYSINGLEVALUE('Length',$,IFCPOSITIVELENGTHMEASURE(2400.),$);
#30=IFCPROPERTYSET('pset-guid',#42,'Dimensions',$,(#20,#21,#22));
#31=IFCRELDEFINESBYPROPERTIES('rel-guid',#42,$,$,(#10),#30);
ENDSEC;
END-ISO-10303-21;`;

    const elements = buildIfcLiteElementIndex(new TextEncoder().encode(ifc));
    const element = elements.get(10);

    expect(element?.geometryDimensions).toEqual({
      x: 2400,
      y: 1200,
      z: 900,
    });
    expect(element?.geometrySource).toBe("ifc-quantity");
    expect(
      element?.properties.find(
        (property) => property.label === "Dimensions.Length",
      )?.value,
    ).toContain("2,400");
  });

  it("keeps repeated IFC representation dimensions and styled colors", () => {
    const ifc = `ISO-10303-21;
DATA;
#1=IFCCOLOURRGB('Bronze',0.5,0.25,0.);
#2=IFCSURFACESTYLERENDERING(#1,0.,$,$,$,$,$,$,.NOTDEFINED.);
#3=IFCSURFACESTYLE('Panel style',.BOTH.,(#2));
#4=IFCPRESENTATIONSTYLEASSIGNMENT((#3));
#5=IFCRECTANGLEPROFILEDEF(.AREA.,'Square panel',$,1190.,1190.);
#6=IFCEXTRUDEDAREASOLID(#5,$,$,62.);
#7=IFCSTYLEDITEM(#6,(#4),$);
#8=IFCSHAPEREPRESENTATION($,'Body','SweptSolid',(#6));
#9=IFCPRODUCTDEFINITIONSHAPE($,$,(#8));
#10=IFCPLATE('panel-guid',#42,'System Panel',$,'Panel Type',$,#9,'P-1',.CURTAIN_PANEL.);
ENDSEC;
END-ISO-10303-21;`;

    const elements = buildIfcLiteElementIndex(new TextEncoder().encode(ifc));
    const element = elements.get(10);

    expect(element?.geometryDimensions).toEqual({
      x: 1190,
      y: 1190,
      z: 62,
    });
    expect(element?.geometrySource).toBe("ifc-representation");
    expect(element?.styleColor).toEqual([0.5, 0.25, 0, 1]);
    expect(element?.sourceColor).toContain("rgb(128, 64, 0)");
  });

  it("falls back to IFC mesh bounds when semantic dimensions are unavailable", () => {
    const rows = buildIfcPropertyRows(
      {
        name: "proxy.ifc",
        mimeType: "application/p21",
        version: "v1.0",
        updatedAt: "2026-05-19T00:00:00.000Z",
      } as never,
      {
        lengthUnit: { label: "m", precision: 2, metersPerUnit: 1 },
        renderedFragments: 1,
        totalMeshes: 1,
        renderOffset: { x: 0, y: 0, z: 0 },
      } as never,
      {
        expressID: 48,
        sourceBound: true,
        type: "IFCBUILDINGELEMENTPROXY",
        globalId: "proxy-guid",
        name: "组件#48",
        objectType: "IFCBUILDINGELEMENTPROXY",
        tag: "",
        predefinedType: "",
        properties: [],
        geometryBounds: {
          min: { x: 0, y: 0, z: 0 },
          max: { x: 2.4, y: 0.3, z: 3.1 },
        },
        geometrySource: "mesh-bounds",
      } as never,
      {},
    );

    expect(rows.find((row) => row.label === "三维尺寸（m）")?.value).toContain(
      "长 2.40 m",
    );
    expect(rows.find((row) => row.label === "尺寸来源")?.value).toContain(
      "Mesh 包围盒",
    );
  });

  it("binds mapped IFC product metadata without indexing representation records", () => {
    const ifc = `ISO-10303-21;
DATA;
#6=IFCCARTESIANPOINT((0.,0.,0.));
#12=IFCDIRECTION((1.,0.,0.));
#16=IFCDIRECTION((0.,1.,0.));
#20=IFCDIRECTION((0.,0.,1.));
#105=IFCGEOMETRICREPRESENTATIONSUBCONTEXT('Body','Model',*,*,*,*,$,$,.MODEL_VIEW.,$);
#278=IFCMATERIAL(' <Unnamed>',$,$);
#293=IFCCARTESIANTRANSFORMATIONOPERATOR3D($,$,#6,1.,$);
#285758=IFCCOLOURRGB($,0.635294117647059,0.509803921568627,0.270588235294118);
#285759=IFCSURFACESTYLERENDERING(#285758,0.,$,$,$,$,$,$,.NOTDEFINED.);
#285760=IFCSURFACESTYLE('source style',.BOTH.,(#285759));
#285762=IFCPRESENTATIONSTYLEASSIGNMENT((#285760));
#921001=IFCMATERIALLAYER(#278,18.,$,' <Unnamed>',$,$,$);
#921002=IFCMATERIALLAYERSET((#921001),'System Panel:18mm\\X2\\963B71C3677F\\X0\\',$);
#937379=IFCRECTANGLEPROFILEDEF(.AREA.,'18mm\\X2\\963B71C3677F\\X0\\',$,18.,149.999999999988);
#937380=IFCCARTESIANPOINT((0.,-9.,0.));
#937382=IFCAXIS2PLACEMENT3D(#937380,#20,#16);
#937383=IFCEXTRUDEDAREASOLID(#937379,#937382,#20,2440.);
#937394=IFCSTYLEDITEM(#937383,(#285762),$);
#937397=IFCSHAPEREPRESENTATION(#105,'Body','SweptSolid',(#937383));
#937401=IFCAXIS2PLACEMENT3D(#6,$,$);
#937402=IFCREPRESENTATIONMAP(#937401,#937397);
#946787=IFCAXIS2PLACEMENT3D(#6,$,$);
#946788=IFCLOCALPLACEMENT($,#946787);
#946791=IFCMAPPEDITEM(#937402,#293);
#946792=IFCSHAPEREPRESENTATION(#105,'Body','MappedRepresentation',(#946791));
#946797=IFCPRODUCTDEFINITIONSHAPE($,$,(#946792));
#946805=IFCCARTESIANPOINT((48600.,10875.,125.));
#946807=IFCAXIS2PLACEMENT3D(#946805,#16,#12);
#946808=IFCLOCALPLACEMENT(#946788,#946807);
#946810=IFCPLATE('1C1UVzVzDBgPpD31G4$c_M',$,'System Panel:18mm\\X2\\963B71C3677F\\X0\\:4023116',$,'System Panel:18mm\\X2\\963B71C3677F\\X0\\',#946808,#946797,'4023116',.CURTAIN_PANEL.);
#946813=IFCMATERIALLAYERSETUSAGE(#921002,.AXIS3.,.POSITIVE.,-0.0295275590551181,$);
#1306519=IFCRELASSOCIATESMATERIAL('rel',$,$,$,(#946810),#946813);
ENDSEC;
END-ISO-10303-21;`;

    const elements = buildIfcLiteElementIndex(new TextEncoder().encode(ifc));
    const element = elements.get(946810);

    expect(elements.has(937383)).toBe(false);
    expect(elements.has(937402)).toBe(false);
    expect(element?.geometryDimensions?.x).toBeCloseTo(2440);
    expect(element?.geometryDimensions?.y).toBeCloseTo(149.999999999988);
    expect(element?.geometryDimensions?.z).toBeCloseTo(18);
    expect(element?.geometrySource).toBe("ifc-representation");
    expect(element?.styleColor).toEqual([
      0.635294117647059, 0.509803921568627, 0.270588235294118, 1,
    ]);
    expect(element?.sourceColor).toContain("rgb(162, 130, 69)");
    expect(element?.sourcePlacement).toEqual({ x: 48600, y: 10875, z: 125 });
    expect(
      element?.properties.find((property) => property.label === "Material")
        ?.value,
    ).toContain("阻燃板");
  });

  it("resolves IFC placement through rotated parent coordinate systems", () => {
    const ifc = `ISO-10303-21;
DATA;
#1=IFCCARTESIANPOINT((100.,200.,0.));
#2=IFCCARTESIANPOINT((10.,0.,5.));
#3=IFCDIRECTION((0.,0.,1.));
#4=IFCDIRECTION((0.,1.,0.));
#5=IFCAXIS2PLACEMENT3D(#1,#3,#4);
#6=IFCLOCALPLACEMENT($,#5);
#7=IFCAXIS2PLACEMENT3D(#2,$,$);
#8=IFCLOCALPLACEMENT(#6,#7);
#10=IFCBEAM('beam-guid',$,'Rotated beam',$,$,#8,$,'B-1',$);
ENDSEC;
END-ISO-10303-21;`;

    const elements = buildIfcLiteElementIndex(new TextEncoder().encode(ifc));

    expect(elements.get(10)?.sourcePlacement).toEqual({
      x: 100,
      y: 210,
      z: 5,
    });
  });

  it("uses separated engineering roles and commercial material fields", () => {
    const rows = buildIfcPropertyRows(
      {
        version: "v2.0",
        updatedAt: "2026-05-19T00:00:00.000Z",
      } as never,
      {
        renderedFragments: 12,
        totalMeshes: 8,
        renderOffset: { x: 0, y: 0, z: 0 },
      } as never,
      {
        expressID: 1,
        type: "IFCBEAM",
        globalId: "beam-guid",
        name: "主梁",
        objectType: "H型钢梁",
        tag: "B-01",
        predefinedType: "",
        properties: [
          { label: "源系统自定义字段", value: "原始属性应保留" },
          { label: "方案设计师", value: "王方案" },
          { label: "深化设计师", value: "李深化" },
          { label: "工艺工程师", value: "赵工艺" },
          { label: "材质", value: "Q355B" },
          { label: "密度", value: "7850 kg/m3" },
          { label: "重量", value: "2.5 t" },
          { label: "单位", value: "t" },
          { label: "单价", value: "6200" },
          { label: "总价", value: "15500" },
        ],
      } as never,
      {},
    );

    const labels = rows.map((row) => row.label);

    expect(labels).toContain("方案设计师");
    expect(labels).toContain("深化设计师");
    expect(labels).toContain("工艺工程师");
    expect(labels).toContain("源系统自定义字段");
    expect(labels).toContain("材质");
    expect(labels).toContain("密度");
    expect(labels).toContain("重量");
    expect(labels).toContain("单位");
    expect(labels).toContain("单价");
    expect(labels).toContain("总价");
    DEPRECATED_ENGINEERING_ROLE_LABELS.forEach((label) => {
      expect(labels).not.toContain(label);
    });
    expect(rows.find((row) => row.label === "密度")?.value).toBe("7850 kg/m3");
  });
});

describe("OpenEngineeringEditor exchange mesh properties", () => {
  it("keeps neutral source-safe materials and exposes mm dimensions", () => {
    const preview = buildOcctGroup(
      [
        {
          name: "steel-beam-source-id",
          attributes: {
            position: {
              array: [0, 0, 0, 1000, 0, 0, 0, 500, 200],
            },
            normal: { array: [] },
          },
          index: { array: [0, 1, 2] },
        } as never,
      ],
      {
        sourceFormat: ".step",
        sourceName: "beam.step",
        routeLabel: "OCCT WASM CAD exchange 真实解析",
      },
    );

    const mesh = preview.group.children[0] as Mesh;
    const material = mesh.material as MeshStandardMaterial;

    expect(material.color.getHexString()).toBe("cbd5e1");
    expect(mesh.userData.materialSource).toBe(
      "源文件未声明颜色，使用可视化默认色",
    );

    const rows = buildExchangeObjectPropertyRows(
      mesh,
      {
        name: "beam.step",
        mimeType: "model/step",
        version: "v1.0",
        updatedAt: "2026-05-19T00:00:00.000Z",
      } as never,
      "OCCT WASM CAD exchange 真实解析",
    );

    expect(rows.find((row) => row.label === "构件ID")?.value).toBe(
      "steel-beam-source-id",
    );
    expect(rows.find((row) => row.label === "三维尺寸（mm）")?.value).toContain(
      "长 1,000 mm",
    );
    expect(rows.find((row) => row.label === "长度（mm）")?.value).toBe(
      "1,000 mm",
    );
    expect(rows.find((row) => row.label === "中心位置（mm）")?.value).toContain(
      "500 mm",
    );
    expect(preview.group.position.toArray()).toEqual([0, 0, 0]);
  });

  it("falls back to aggregate CAD bounds when selected surface dimensions collapse", () => {
    const preview = buildOcctGroup(
      [
        {
          name: "front-face",
          attributes: {
            position: {
              array: [0, 0, 0, 5600, 0, 0, 0, 0, 150],
            },
            normal: { array: [] },
          },
          index: { array: [0, 1, 2] },
        } as never,
        {
          name: "back-face",
          attributes: {
            position: {
              array: [0, 150, 0, 5600, 150, 0, 0, 150, 150],
            },
            normal: { array: [] },
          },
          index: { array: [0, 1, 2] },
        } as never,
      ],
      {
        sourceFormat: ".igs",
        sourceName: "beam.igs",
        routeLabel: "OCCT WASM CAD exchange 真实解析",
      },
    );

    const mesh = preview.group.children[0] as Mesh;
    const rows = buildExchangeObjectPropertyRows(
      mesh,
      {
        name: "beam.igs",
        mimeType: "model/iges",
        version: "v1.0",
        updatedAt: "2026-05-19T00:00:00.000Z",
      } as never,
      "OCCT WASM CAD exchange 真实解析",
    );

    expect(preview.group.position.toArray()).toEqual([0, 0, 0]);
    expect(rows.find((row) => row.label === "三维尺寸（mm）")?.value).toContain(
      "长 5,600 mm",
    );
    expect(rows.find((row) => row.label === "宽度（mm）")?.value).toBe(
      "150 mm",
    );
    expect(rows.find((row) => row.label === "尺寸来源")?.value).toContain(
      "整模包围盒",
    );
  });

  it("uses RVT component aggregate bounds when a selected derivative mesh is planar", () => {
    const root = new Group();
    const component = new Group();
    component.name = "Basic Wall 200mm";
    root.add(component);

    const frontFace = new Mesh(
      new BufferGeometry(),
      new MeshStandardMaterial(),
    );
    frontFace.name = "Basic Wall front face";
    frontFace.geometry.setAttribute(
      "position",
      new Float32BufferAttribute([0, 0, 0, 5600, 0, 0, 0, 0, 3200], 3),
    );
    frontFace.geometry.computeBoundingBox();
    frontFace.userData = {
      componentId: "revit-wall-42",
      sourceFormat: ".rvt",
      nativeBounds: {
        min: { x: 0, y: 0, z: 0 },
        max: { x: 5600, y: 0, z: 3200 },
      },
      nativeCenterMm: { x: 2800, y: 0, z: 1600 },
      dimensionsMm: { x: 5600, y: 0, z: 3200 },
    };

    const backFace = new Mesh(new BufferGeometry(), new MeshStandardMaterial());
    backFace.name = "Basic Wall back face";
    backFace.geometry.setAttribute(
      "position",
      new Float32BufferAttribute([0, 200, 0, 5600, 200, 0, 0, 200, 3200], 3),
    );
    backFace.geometry.computeBoundingBox();
    backFace.userData = {
      componentId: "revit-wall-42",
      sourceFormat: ".rvt",
      nativeBounds: {
        min: { x: 0, y: 200, z: 0 },
        max: { x: 5600, y: 200, z: 3200 },
      },
      nativeCenterMm: { x: 2800, y: 200, z: 1600 },
      dimensionsMm: { x: 5600, y: 0, z: 3200 },
    };

    component.add(frontFace, backFace);

    const rows = buildExchangeObjectPropertyRows(
      frontFace,
      {
        name: "model.rvt",
        mimeType: "application/vnd.autodesk.revit",
        version: "v1.0",
        updatedAt: "2026-05-19T00:00:00.000Z",
      } as never,
      "Prengine · RVT 真实解析",
    );

    expect(rows.find((row) => row.label === "三维尺寸（mm）")?.value).toContain(
      "宽 200 mm",
    );
    expect(rows.find((row) => row.label === "宽度（mm）")?.value).toBe(
      "200 mm",
    );
    expect(rows.find((row) => row.label === "尺寸来源")?.value).toContain(
      "构件聚合包围盒",
    );
  });

  it("falls back to model bounds only when degenerate mesh fallback is allowed", () => {
    const geometry = new BufferGeometry();
    geometry.setAttribute(
      "position",
      new Float32BufferAttribute([0, 0, 0, 700, 0, 0, 0, 0, 500], 3),
    );
    geometry.computeBoundingBox();
    const mesh = new Mesh(geometry, new MeshStandardMaterial());
    mesh.name = "GLB planar member";
    mesh.userData = {
      componentId: "glb-member-1",
      sourceFormat: ".glb",
      nativeBounds: {
        min: { x: 0, y: 0, z: 0 },
        max: { x: 700, y: 0, z: 500 },
      },
      dimensionsMm: { x: 700, y: 0, z: 500 },
      modelBounds: {
        min: { x: 0, y: 0, z: 0 },
        max: { x: 700, y: 120, z: 500 },
      },
      preferModelBoundsForDegenerateDimensions: true,
    };

    const rows = buildExchangeObjectPropertyRows(
      mesh,
      {
        name: "member.glb",
        mimeType: "model/gltf-binary",
        version: "v1.0",
        updatedAt: "2026-05-19T00:00:00.000Z",
      } as never,
      "Prengine · GLB 模型",
    );

    expect(rows.find((row) => row.label === "宽度（mm）")?.value).toBe(
      "120 mm",
    );
    expect(rows.find((row) => row.label === "尺寸来源")?.value).toContain(
      "整模包围盒",
    );
  });

  it("keeps SKP-style thin member dimensions instead of using whole-model fallback", () => {
    const geometry = new BufferGeometry();
    geometry.setAttribute(
      "position",
      new Float32BufferAttribute([0, 0, 0, 700, 0, 0, 0, 0, 500], 3),
    );
    geometry.computeBoundingBox();
    const mesh = new Mesh(geometry, new MeshStandardMaterial());
    mesh.name = "SKP thin member";
    mesh.userData = {
      componentId: "skp-member-1",
      sourceFormat: ".skp",
      nativeBounds: {
        min: { x: 0, y: 0, z: 0 },
        max: { x: 700, y: 0, z: 500 },
      },
      dimensionsMm: { x: 700, y: 0, z: 500 },
      modelBounds: {
        min: { x: 0, y: 0, z: 0 },
        max: { x: 700, y: 120, z: 500 },
      },
    };

    const rows = buildExchangeObjectPropertyRows(
      mesh,
      {
        name: "model.skp",
        mimeType: "application/vnd.koan",
        version: "v1.0",
        updatedAt: "2026-05-19T00:00:00.000Z",
      } as never,
      "Prengine · SKP 真实解析",
    );

    expect(rows.find((row) => row.label === "宽度（mm）")?.value).toBe("0 mm");
    expect(rows.find((row) => row.label === "尺寸来源")).toBeUndefined();
  });

  it("reports SKP GLB derivative meters as millimeters and aggregates split component faces", () => {
    const scene = new Group();
    scene.name = "SketchUpScene";
    const component = new Group();
    component.name = "WallPanel";
    scene.add(component);

    const frontGeometry = new BufferGeometry();
    frontGeometry.setAttribute(
      "position",
      new Float32BufferAttribute([0, 0, 0, 0, 4, 0, 0, 0, 3], 3),
    );
    frontGeometry.computeBoundingBox();
    const frontFace = new Mesh(frontGeometry, new MeshStandardMaterial());
    frontFace.name = "WallPanel front";

    const backGeometry = new BufferGeometry();
    backGeometry.setAttribute(
      "position",
      new Float32BufferAttribute([0.05, 0, 0, 0.05, 4, 0, 0.05, 0, 3], 3),
    );
    backGeometry.computeBoundingBox();
    const backFace = new Mesh(backGeometry, new MeshStandardMaterial());
    backFace.name = "WallPanel back";
    component.add(frontFace, backFace);

    const group = buildSketchUpThreeGroup(
      scene,
      {
        name: "model.skp",
        mimeType: "application/vnd.koan",
        version: "v1.0",
        updatedAt: "2026-05-19T00:00:00.000Z",
      } as never,
      { originalName: "model.skp" } as never,
    );

    expect(group.children.length).toBeGreaterThan(0);
    const rows = buildExchangeObjectPropertyRows(
      frontFace,
      {
        name: "model.skp",
        mimeType: "application/vnd.koan",
        version: "v1.0",
        updatedAt: "2026-05-19T00:00:00.000Z",
      } as never,
      "Prengine · SKP 真实解析",
    );

    expect(rows.find((row) => row.label === "三维尺寸（mm）")?.value).toBe(
      "长 50 mm / 宽 4,000 mm / 高 3,000 mm",
    );
    expect(rows.find((row) => row.label === "尺寸来源")?.value).toContain(
      "构件聚合包围盒",
    );
    expect(rows.find((row) => row.label === "单位换算")?.value).toContain(
      "meter",
    );
  });

  it("aggregates flattened SKP component mesh names when GLB hierarchy is shallow", () => {
    const scene = new Group();
    scene.name = "SketchUpScene";

    const leftGeometry = new BufferGeometry();
    leftGeometry.setAttribute(
      "position",
      new Float32BufferAttribute([0, 0, 0, 0, 4, 0, 0, 0, 3], 3),
    );
    leftGeometry.computeBoundingBox();
    const leftFace = new Mesh(leftGeometry, new MeshStandardMaterial());
    leftFace.name = "Geom3D_组件#73";

    const rightGeometry = new BufferGeometry();
    rightGeometry.setAttribute(
      "position",
      new Float32BufferAttribute([0.05, 0, 0, 0.05, 4, 0, 0.05, 0, 3], 3),
    );
    rightGeometry.computeBoundingBox();
    const rightFace = new Mesh(rightGeometry, new MeshStandardMaterial());
    rightFace.name = "Geom3D_组件#73_2";
    scene.add(leftFace, rightFace);

    buildSketchUpThreeGroup(
      scene,
      {
        name: "model.skp",
        mimeType: "application/vnd.koan",
        version: "v1.0",
        updatedAt: "2026-05-19T00:00:00.000Z",
      } as never,
      { originalName: "model.skp" } as never,
    );

    const rows = buildExchangeObjectPropertyRows(
      leftFace,
      {
        name: "model.skp",
        mimeType: "application/vnd.koan",
        version: "v1.0",
        updatedAt: "2026-05-19T00:00:00.000Z",
      } as never,
      "Prengine · SKP 真实解析",
    );

    expect(rows.find((row) => row.label === "三维尺寸（mm）")?.value).toBe(
      "长 50 mm / 宽 4,000 mm / 高 3,000 mm",
    );
    expect(rows.find((row) => row.label === "尺寸来源")?.value).toContain(
      "构件聚合包围盒",
    );
  });

  it("does not treat repeated CAD component ids as selection groups", () => {
    const mesh = new Mesh(new BufferGeometry(), new MeshStandardMaterial());
    mesh.userData = {
      componentId: "SOLID",
      componentGroupKey: "three:SOLID",
    };

    expect(meshSelectionAggregationKey(mesh)).toBe("");

    mesh.userData.selectionGroupKey = "rvt:123";
    expect(meshSelectionAggregationKey(mesh)).toBe("rvt:123");
  });

  it("does not aggregate generic STEP SOLID names into whole-model dimensions", () => {
    const root = new Group();
    const frontFace = new Mesh(
      new BufferGeometry(),
      new MeshStandardMaterial(),
    );
    frontFace.name = "SOLID";
    frontFace.userData = {
      componentId: "SOLID",
      sourceFormat: ".step",
      nativeBounds: {
        min: { x: 0, y: 0, z: 0 },
        max: { x: 5600, y: 0, z: 3200 },
      },
      dimensionsMm: { x: 5600, y: 0, z: 3200 },
    };

    const backFace = new Mesh(new BufferGeometry(), new MeshStandardMaterial());
    backFace.name = "SOLID";
    backFace.userData = {
      componentId: "SOLID",
      sourceFormat: ".step",
      nativeBounds: {
        min: { x: 0, y: 200, z: 0 },
        max: { x: 5600, y: 200, z: 3200 },
      },
      dimensionsMm: { x: 5600, y: 0, z: 3200 },
    };
    root.add(frontFace, backFace);

    const rows = buildExchangeObjectPropertyRows(
      frontFace,
      {
        name: "model.step",
        mimeType: "model/step",
        version: "v1.0",
        updatedAt: "2026-05-19T00:00:00.000Z",
      } as never,
      "Prengine · CAD 模型",
    );

    expect(rows.find((row) => row.label === "宽度（mm）")?.value).toBe("0 mm");
    expect(rows.find((row) => row.label === "尺寸来源")).toBeUndefined();
  });

  it("marks raw GLB scenes as meter-based before property dimensions are built", () => {
    const scene = new Group();
    const mesh = new Mesh(new BufferGeometry(), new MeshStandardMaterial());
    scene.add(mesh);

    normalizeGltfSourceObjectForInspection(scene, ".glb");

    expect(scene.userData.worldUnitsToMillimeters).toBe(1000);
    expect(
      mesh.userData.sourceProperties.find(
        (row: { label: string }) => row.label === "单位换算",
      )?.value,
    ).toContain("meter");
  });

  it("finds audited GLB visual fallback for incomplete OpenUSD folders", () => {
    const fallback = findOpenUsdVisualFallbackCandidate(
      {
        name: "测试后删除008.usdz",
        moduleId: "digital_archive",
        localFile: {
          fileId: "usdz-1",
          originalName: "测试后删除008.usdz",
          moduleId: "digital_archive",
          parentId: "folder-a",
        },
      } as never,
      [
        {
          fileId: "glb-1",
          originalName: "测试后删除003.glb",
          moduleId: "digital_archive",
          parentId: "folder-a",
          ext: ".glb",
          mimeType: "model/gltf-binary",
        },
      ],
    );

    expect(fallback?.fileId).toBe("glb-1");
    expect(fallback?.url).toBe("/api/local-files/glb-1");
  });

  it("prefers exact normalized OpenUSD visual fallback stems", () => {
    const fallback = findOpenUsdVisualFallbackCandidate(
      {
        name: "format-smoke-usdz.usdz",
        moduleId: "digital_twin",
        localFile: {
          fileId: "usdz-1",
          originalName: "format-smoke-usdz.usdz",
          moduleId: "digital_twin",
          parentId: "folder-a",
        },
      } as never,
      [
        {
          fileId: "skp-glb",
          originalName: "format-smoke-skp.glb",
          moduleId: "digital_twin",
          parentId: "folder-a",
          ext: ".glb",
        },
        {
          fileId: "openusd-glb",
          originalName: "format-smoke-glb.glb",
          moduleId: "digital_twin",
          parentId: "folder-a",
          ext: ".glb",
        },
      ],
    );

    expect(fallback?.fileId).toBe("openusd-glb");
  });

  it("keeps legacy OBJ/FBX unit policy inside the unified property panel", () => {
    const geometry = new BufferGeometry();
    geometry.setAttribute(
      "position",
      new Float32BufferAttribute([0, 0, 0, 1000, 0, 0, 0, 250, 0], 3),
    );
    geometry.computeBoundingBox();
    const mesh = new Mesh(geometry, new MeshStandardMaterial());
    mesh.name = "FBX legacy part";
    mesh.userData = {
      componentId: "fbx-part-1",
      sourceFormat: ".fbx",
      nativeBounds: {
        min: { x: 0, y: 0, z: 0 },
        max: { x: 1000, y: 250, z: 50 },
      },
      dimensionsMm: { x: 1000, y: 250, z: 50 },
      sourceProperties: [
        {
          label: "单位策略",
          value:
            "legacy OBJ/FBX 未提供可靠 BIM 单位；按源几何单位显示为 mm 草稿",
        },
      ],
    };

    const rows = buildExchangeObjectPropertyRows(
      mesh,
      {
        name: "legacy.fbx",
        mimeType: "application/octet-stream",
        version: "v1.0",
        updatedAt: "2026-05-19T00:00:00.000Z",
      } as never,
      "Prengine · legacy mesh",
    );

    expect(rows.find((row) => row.label === "三维尺寸（mm）")?.value).toContain(
      "长 1,000 mm",
    );
    expect(rows.find((row) => row.label === "单位策略")?.value).toContain(
      "legacy OBJ/FBX",
    );
  });
});

describe("OpenEngineeringEditor PanAI actions", () => {
  it("maps online edit and AI generation to real file actions", () => {
    expect(engineeringEditorCommandToFileAction("edit")).toBe("online_edit");
    expect(engineeringEditorCommandToFileAction("ai-generate")).toBe(
      "ai_generate",
    );
    expect(engineeringEditorCommandToFileAction("save-version")).toBeNull();
  });

  it("keeps IFC capability coverage mandatory for PanAI", () => {
    const file = {
      name: "coordination.ifc",
      moduleId: "digital_twin",
      mimeType: "application/x-step",
    } as never;

    const capabilityMap = buildEngineeringEditorCapabilityMap(file);
    const panAICapabilities =
      buildOpenEngineeringEditorPanAICapabilities(file);

    expect(capabilityMap.family).toBe("openbim");
    expect(capabilityMap.adapters).toContain("IfcOpenShell worker");
    expect(capabilityMap.sourceLabels).toContain("buildingSMART");
    expect(capabilityMap.completeUseMandate).toContain("在线编辑");
    expect(capabilityMap.completeUseMandate).toContain("AI 生成");
    expect(panAICapabilities.map((capability) => capability.id)).toContain(
      "panai:open-engineering-editor",
    );
    expect(panAICapabilities.map((capability) => capability.id)).toContain(
      "panai:online-edit",
    );
    expect(panAICapabilities.map((capability) => capability.id)).toContain(
      "panai:ai-generate-engineering",
    );
  });

  it("resolves local file ids from file metadata or source URL", () => {
    expect(
      resolveOpenEngineeringEditorLocalFileId(
        { localFileId: "local-123" } as never,
        undefined,
      ),
    ).toBe("local-123");
    expect(
      resolveOpenEngineeringEditorLocalFileId(
        undefined,
        "/api/local-files/uploaded%2042/preview",
      ),
    ).toBe("uploaded 42");
  });
});

describe("OpenEngineeringEditor MLightCAD fonts", () => {
  it("maps DWG/DXF toolbar tools to executable MLightCAD commands", () => {
    expect(mlightCadToolbarCommandForWorkbenchTool("select").script).toBe(
      "select",
    );
    expect(mlightCadToolbarCommandForWorkbenchTool("measure").script).toBe(
      "measuredistance",
    );
    expect(mlightCadToolbarCommandForWorkbenchTool("annotate").script).toBe(
      "revcloud",
    );
    expect(mlightCadToolbarCommandForWorkbenchTool("edit").script).toBe(
      "sketch",
    );
  });

  it("decodes ANSI_936 DXF source bytes before MLightCAD parses text", () => {
    const asciiDxf = new TextEncoder().encode(
      "0\nSECTION\n2\nHEADER\n9\n$DWGCODEPAGE\n3\nANSI_936\n0\nENDSEC\n0\nTEXT\n1\n",
    );
    const gb18030Chinese = new Uint8Array([0xd6, 0xd0, 0xce, 0xc4]);
    const decoded = decodeMlightCadDxfSource(
      concatBytes(asciiDxf, gb18030Chinese),
    );

    expect(extractMlightCadDxfCodePage(decoded)).toBe("ANSI_936");
    expect(mlightCadDxfEncodingForCodePage("ANSI_936")).toBe("gb18030");
    expect(decoded).toContain("中文");
    expect(decoded).not.toContain("����");
  });

  it("transcodes non-UTF-8 DXF bytes back to an ArrayBuffer for MLightCAD", () => {
    const asciiDxf = new TextEncoder().encode(
      "0\nSECTION\n2\nHEADER\n9\n$DWGCODEPAGE\n3\nANSI_936\n0\nENDSEC\n0\nTEXT\n1\n",
    );
    const gb18030Chinese = new Uint8Array([0xd6, 0xd0, 0xce, 0xc4]);
    const prepared = prepareMlightCadDxfSourceForOpen(
      concatBytes(asciiDxf, gb18030Chinese),
    );
    const preparedText = new TextDecoder().decode(prepared.content);

    expect(prepared.content).toBeInstanceOf(ArrayBuffer);
    expect(prepared.codePage).toBe("ANSI_936");
    expect(prepared.encoding).toBe("gb18030");
    expect(prepared.transcodedToUtf8).toBe(true);
    expect(extractMlightCadDxfCodePage(preparedText)).toBe("UTF-8");
    expect(preparedText).toContain("中文");
  });

  it("decodes AutoCAD CAD text unicode escapes before MLightCAD renders text", () => {
    expect(
      decodeMlightCadCadTextEscapes(
        "\\U+536B\\U+751F\\U+95F4\n\\U+9762\\U+79EF4.12m\\U+00B2",
      ),
    ).toBe("卫生间\n面积4.12m²");
    expect(decodeMlightCadCadTextEscapes("%%c25 %%p2%%d")).toBe("∅25 ±2°");
  });

  it("extracts CAD font names from SHX and mesh font manifests", () => {
    const fontNames = extractMlightCadCadFontNames([
      {
        file: "gbcbig.shx",
        name: ["gbcbig"],
        type: "shx",
        encoding: "gbk",
      },
      {
        file: "hztxt.shx",
        name: ["hztxt"],
        type: "shx",
        encoding: "gbk",
      },
      {
        file: "simsun.woff",
        name: ["simsun", "宋体"],
        type: "mesh",
      },
      {
        file: "simplex.shx",
        name: ["simplex"],
        type: "shx",
      },
    ]);

    expect(fontNames).toEqual(["gbcbig", "hztxt", "simsun", "simplex"]);
    expect(fontNames).not.toContain("HarmonyOS Sans SC");
  });

  it("maps common missing Chinese CAD fonts to loaded CAD font fallbacks", () => {
    const mapping = buildMlightCadCadFontMapping([
      "TSSDCHN.SHX",
      "HZFS",
      "仿宋_GB2312",
      "unknown-detail-font",
    ]);

    expect(mapping["TSSDCHN.SHX"]).toBe("hztxt");
    expect(mapping["tssdchn.shx"]).toBe("hztxt");
    expect(mapping.HZFS).toBe("hztxt");
    expect(mapping["仿宋_GB2312"]).toBe("simsun");
    expect(mapping["unknown-detail-font"]).toBe("txt");
  });

  it("chooses readable CAD fallback fonts by source font family", () => {
    expect(mlightCadFallbackTargetForFontName("黑体")).toBe("simhei");
    expect(mlightCadFallbackTargetForFontName("楷体_GB2312")).toBe("simkai");
    expect(mlightCadFallbackTargetForFontName("TSSDENG.SHX")).toBe("txt");
    expect(mlightCadFallbackTargetForFontName("ROMAND.SHX")).toBe("romans");
  });
});

describe("OpenEngineeringEditor STL selection", () => {
  it("splits STL shells by shared edges instead of shared points", () => {
    const geometry = new BufferGeometry();
    geometry.setAttribute(
      "position",
      new Float32BufferAttribute(
        [
          0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, -1, 0, -1, 0, 0, 1, 0, 0, 1, 1,
          0, 0, 1, 0,
        ],
        3,
      ),
    );

    const groups = stlGeometryDisplayGroups(geometry);

    expect(groups).toHaveLength(2);
    expect(groups.map((group) => group.triangleIndices?.length).sort()).toEqual(
      [1, 2],
    );
  });

  it("limits STL click highlight to the coplanar face patch", () => {
    const geometry = new BufferGeometry();
    geometry.setAttribute(
      "position",
      new Float32BufferAttribute(
        [
          0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, -1, 0, -1, 0, 0, 1, 0, 0, 1, 1,
          0, 0, 1, 0,
        ],
        3,
      ),
    );

    expect(stlCoplanarFacePatchTriangleIndices(geometry, 0).sort()).toEqual([
      0, 2,
    ]);
  });
});

describe("OpenEngineeringEditor IFC-Lite coordinates", () => {
  it("keeps IFC-Lite Y-up geometry instead of rotating it a second time", () => {
    const displayMesh = ifcLiteMeshForProjectDisplay(
      {
        expressId: 1,
        positions: new Float32Array([1, 2, 3, 4, 5, 6]),
        normals: new Float32Array([0, 0, 1, 0, 1, 0]),
        indices: new Uint32Array([0, 1, 2]),
      } as never,
      {
        label: "mm",
        precision: 0,
        metersPerUnit: 0.001,
      },
    );

    expect(Array.from(displayMesh.positions)).toEqual([
      1000, 2000, 3000, 4000, 5000, 6000,
    ]);
    expect(Array.from(displayMesh.normals ?? [])).toEqual([0, 0, 1, 0, 1, 0]);
  });
});
