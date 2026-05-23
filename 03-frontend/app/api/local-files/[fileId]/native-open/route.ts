// app/api/local-files/[fileId]/native-open/route.ts - Native source open manifest
// License: Apache-2.0

import { stat } from "node:fs/promises";
import { NextResponse } from "next/server";
import { fileTypeForFileName } from "@/lib/file-type-registry";
import {
  getLocalFileMetadata,
  resolveLocalUploadStoragePath,
} from "@/lib/local-file-runtime-server";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ fileId: string }> },
) {
  const { fileId } = await params;
  const metadata = await getLocalFileMetadata(fileId);

  if (!metadata) {
    return NextResponse.json({ error: "file not found" }, { status: 404 });
  }

  const path = resolveLocalUploadStoragePath(metadata);
  const fileStat = await stat(path);
  const registry = fileTypeForFileName(metadata.originalName);
  const ext = metadata.ext.toLowerCase();
  const sourceUrl = `/api/local-files/${encodeURIComponent(metadata.fileId)}`;

  return NextResponse.json({
    schema: "architoken.native-open.v1",
    fileId: metadata.fileId,
    originalName: metadata.originalName,
    extension: ext,
    mimeType: metadata.mimeType,
    size: fileStat.size,
    checksum: metadata.checksum,
    etag: `sha256-${metadata.checksum}`,
    sourceOfRecord: {
      url: sourceUrl,
      method: "GET",
      rangeRequests: true,
      cache: "ETag + Last-Modified + private revalidation",
      substitutePreview: false,
    },
    registry: registry
      ? {
          id: registry.id,
          logicalType: registry.logicalType,
          viewerKind: registry.viewerKind,
          productionRoute: registry.productionRoute,
          adapters: registry.adapters,
        }
      : null,
    routes: nativeRoutesFor(ext, sourceUrl),
  });
}

function nativeRoutesFor(ext: string, sourceUrl: string) {
  if (ext === ".pdf") {
    return [
      {
        id: "pdf-native-stream",
        status: "ready",
        viewer: "browser-native-multipage-vector-pdf",
        sourceUrl,
        notes: [
          "PDF and 3D PDF stay bound to the original source bytes.",
          "PRC/U3D extraction is a worker adapter boundary; source streaming still works immediately.",
        ],
      },
    ];
  }

  if (ext === ".xml" || ext === ".gbxml" || ext === ".ids") {
    return [
      {
        id: "xml-native-stream",
        status: "ready",
        viewer: "code-editor",
        sourceUrl,
        worker: "xml/ids/gbxml parser when validation is requested",
      },
    ];
  }

  if (ext === ".3dxml") {
    return [
      {
        id: "3dxml-source-stream",
        status: "ready",
        viewer: "source-bound-engineering-object",
        sourceUrl,
      },
      {
        id: "3dxml-cad-kernel",
        status: "adapter_required",
        worker: "3D XML / OCCT-compatible isolated adapter",
        outputs: ["glb", "gltf", "brep", "properties-index"],
      },
    ];
  }

  if (ext === ".dxf") {
    return [
      {
        id: "dxf-native-entities",
        status: "ready",
        viewer: "cad-native-svg-entities",
        sourceUrl,
        worker: "ezdxf_extract_entities",
      },
    ];
  }

  if (ext === ".dwg") {
    return [
      {
        id: "dwg-native-cad-vector-manifest",
        status: "adapter_required",
        viewer: "dwg-native-adapter-to-cad-vector-entities",
        manifestUrl: `${sourceUrl}/cad-derivative?format=manifest`,
        note: "DWG 必须先由 ODA/LibreDWG/DWG 授权 sidecar 生成真实 DXF 实体派生；没有派生时不得显示截图、广告页或空白可用状态。",
      },
    ];
  }

  if (ext === ".ifc" || ext === ".ifczip") {
    return [
      {
        id: "ifc-native-ifclite",
        status: "ready",
        viewer: "ifc-lite-webgpu-native-ifc",
        sourceUrl,
        priority: ["prengine-native", "prengine-cache", "prengine-worker"],
        note: "IFC 从源文件原生打开，不走 3D Tiles。",
      },
      {
        id: "ifc-worker-cache",
        status: "available_for_background_cache",
        worker: "Prengine 后台缓存服务",
        manifestUrl: `${sourceUrl}/ifc-derivative?format=manifest`,
        propertiesIndexUrl: `${sourceUrl}/ifc-derivative?format=properties-index`,
        outputs: ["model-cache", "properties-index"],
        cache: "checksum-keyed background cache + paginated properties index",
        note: "3D Tiles 仅用于数字孪生场景派生，不作为 IFC 原生打开入口。",
      },
    ];
  }

  if ([".stl", ".step", ".stp", ".iges", ".igs"].includes(ext)) {
    return [
      {
        id: "occt-native-open",
        status: "ready",
        viewer: "occt-native-brep-mesh-property-editor",
        sourceUrl,
        worker:
          "browser OCCT WASM source parser; worker adapter when server derivative/export is requested",
        outputs: ["brep", "glb", "properties-index"],
      },
    ];
  }

  if (ext === ".3dm") {
    return [
      {
        id: "rhino3dm-opennurbs-native-open",
        status: "adapter_required",
        viewer: "rhino3dm-opennurbs-source-property-editor",
        sourceUrl,
        worker: "rhino3dm/opennurbs worker",
        outputs: ["3dm", "step", "stp", "ifc", "glb", "properties-index"],
      },
    ];
  }

  if (ext === ".rvt" || ext === ".rfa") {
    return [
      {
        id: "revit-prengine-derivative-open",
        status: "licensed_adapter_required",
        viewer: "prengine-rvt-true-model",
        sourceUrl,
        manifestUrl: `${sourceUrl}/rvt-derivative?format=manifest`,
        worker: "Prengine RVT 模型转换器",
        outputs: ["dae", "xlsx", "ifc"],
        note: "RVT/RFA 通过真实 Prengine 派生模型打开，不显示字节预览或伪模型。",
      },
    ];
  }

  if (ext === ".skp") {
    return [
      {
        id: "sketchup-native-open",
        status: "adapter_required",
        viewer: "prengine-skp-true-model",
        sourceUrl,
        manifestUrl: `${sourceUrl}/skp-derivative?format=manifest`,
        worker:
          "Prengine SKP 转 GLB 命令、授权模型适配器，或显式绑定的同源 GLB 最后兜底",
        outputs: ["glb", "model-cache", "properties-index"],
        note: "GLB 只作为最后查看兜底；源 SKP 仍是真源，不能用伪模型或字节预览冒充 SKP 解析。",
      },
    ];
  }

  if (ext === ".glb" || ext === ".gltf") {
    return [
      {
        id: "gltf-glb-source-runtime",
        status: "ready",
        viewer: "source-bound-gltf-glb-runtime",
        sourceUrl,
        note: "GLB/glTF 可作为浏览器真实模型运行时和私有格式最后兜底派生，但不得替代原始工程源文件、属性 Schema 或审计链。",
      },
    ];
  }

  if (ext === ".blend") {
    return [
      {
        id: "blender-native-open",
        status: "external_process_required",
        viewer: "blender-external-scene-service",
        sourceUrl,
        worker: "Blender Python/MCP isolated service",
        outputs: ["blend", "glb", "gltf", "obj", "stl", "mp4", "png"],
      },
    ];
  }

  if (
    [
      ".docx",
      ".doc",
      ".xlsx",
      ".xls",
      ".pptx",
      ".ppt",
      ".odt",
      ".ods",
      ".odp",
    ].includes(ext)
  ) {
    return [
      {
        id: "office-native-open",
        status: "ready",
        viewer: "office-document-runtime",
        sourceUrl,
        worker: "libreoffice_headless when derivative/export is requested",
      },
    ];
  }

  return [
    {
      id: "source-stream",
      status: "ready",
      viewer: "source-bound",
      sourceUrl,
    },
  ];
}
