// app/api/local-files/[fileId]/native-open/route.ts - Native source open manifest
// License: Apache-2.0

import { stat } from 'node:fs/promises';
import { NextResponse } from 'next/server';
import { fileTypeForFileName } from '@/lib/file-type-registry';
import {
  getLocalFileMetadata,
  resolveLocalUploadStoragePath,
} from '@/lib/local-file-runtime-server';

export const runtime = 'nodejs';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ fileId: string }> },
) {
  const { fileId } = await params;
  const metadata = await getLocalFileMetadata(fileId);

  if (!metadata) {
    return NextResponse.json({ error: 'file not found' }, { status: 404 });
  }

  const path = resolveLocalUploadStoragePath(metadata);
  const fileStat = await stat(path);
  const registry = fileTypeForFileName(metadata.originalName);
  const ext = metadata.ext.toLowerCase();
  const sourceUrl = `/api/local-files/${encodeURIComponent(metadata.fileId)}`;

  return NextResponse.json({
    schema: 'architoken.native-open.v1',
    fileId: metadata.fileId,
    originalName: metadata.originalName,
    extension: ext,
    mimeType: metadata.mimeType,
    size: fileStat.size,
    checksum: metadata.checksum,
    etag: `sha256-${metadata.checksum}`,
    sourceOfRecord: {
      url: sourceUrl,
      method: 'GET',
      rangeRequests: true,
      cache: 'ETag + Last-Modified + private revalidation',
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
  if (ext === '.pdf') {
    return [
      {
        id: 'pdf-native-stream',
        status: 'ready',
        viewer: 'browser-native-multipage-vector-pdf',
        sourceUrl,
        notes: [
          'PDF and 3D PDF stay bound to the original source bytes.',
          'PRC/U3D extraction is a worker adapter boundary; source streaming still works immediately.',
        ],
      },
    ];
  }

  if (ext === '.xml' || ext === '.gbxml' || ext === '.ids') {
    return [
      {
        id: 'xml-native-stream',
        status: 'ready',
        viewer: 'code-editor',
        sourceUrl,
        worker: 'xml/ids/gbxml parser when validation is requested',
      },
    ];
  }

  if (ext === '.3dxml') {
    return [
      {
        id: '3dxml-source-stream',
        status: 'ready',
        viewer: 'source-bound-engineering-object',
        sourceUrl,
      },
      {
        id: '3dxml-cad-kernel',
        status: 'adapter_required',
        worker: '3D XML / OCCT-compatible isolated adapter',
        outputs: ['glb', 'gltf', 'brep', 'properties-index'],
      },
    ];
  }

  if (ext === '.dxf') {
    return [
      {
        id: 'dxf-native-entities',
        status: 'ready',
        viewer: 'cad-native-svg-entities',
        sourceUrl,
        worker: 'ezdxf_extract_entities',
      },
    ];
  }

  if (ext === '.dwg') {
    return [
      {
        id: 'dwg-native-cad-vector-manifest',
        status: 'ready',
        viewer: 'dwg-native-adapter-to-cad-vector-entities',
        manifestUrl: `${sourceUrl}/cad-derivative?format=manifest`,
      },
    ];
  }

  if (ext === '.ifc' || ext === '.ifczip') {
    return [
      {
        id: 'ifc-source-stream',
        status: 'ready',
        viewer: 'web-ifc-source-open',
        sourceUrl,
      },
      {
        id: 'ifc-worker-cache',
        status: 'ready',
        worker: 'IfcOpenShell / ThatOpen fragments',
        manifestUrl: `${sourceUrl}/ifc-derivative?format=manifest`,
        propertiesIndexUrl: `${sourceUrl}/ifc-derivative?format=properties-index`,
        outputs: ['glb', 'fragments', 'tiles', 'properties-index'],
        cache: 'checksum-keyed derivatives + paginated properties index',
      },
    ];
  }

  if (['.stl', '.step', '.stp', '.iges', '.igs'].includes(ext)) {
    return [
      {
        id: 'occt-native-open',
        status: 'ready_in_worker_contract',
        viewer: 'occt-native-brep-mesh-property-editor',
        sourceUrl,
        worker: 'occt_adapter',
        outputs: ['brep', 'glb', 'properties-index'],
      },
    ];
  }

  if (ext === '.3dm') {
    return [
      {
        id: 'rhino3dm-opennurbs-native-open',
        status: 'adapter_required',
        viewer: 'rhino3dm-opennurbs-source-property-editor',
        sourceUrl,
        worker: 'rhino3dm/opennurbs worker',
        outputs: ['3dm', 'step', 'stp', 'ifc', 'glb', 'properties-index'],
      },
    ];
  }

  if (ext === '.skp') {
    return [
      {
        id: 'sketchup-native-open',
        status: 'licensed_adapter_required',
        viewer: 'sketchup-speckle-blender-source-editor',
        sourceUrl,
        worker: 'Speckle SketchUp / Blender isolated adapter / licensed SketchUp runtime',
        outputs: ['skp', 'ifc', 'glb', 'obj', 'properties-index'],
      },
    ];
  }

  if (ext === '.blend') {
    return [
      {
        id: 'blender-native-open',
        status: 'external_process_required',
        viewer: 'blender-external-scene-service',
        sourceUrl,
        worker: 'Blender Python/MCP isolated service',
        outputs: ['blend', 'glb', 'gltf', 'obj', 'stl', 'mp4', 'png'],
      },
    ];
  }

  if (['.docx', '.doc', '.xlsx', '.xls', '.pptx', '.ppt', '.odt', '.ods', '.odp'].includes(ext)) {
    return [
      {
        id: 'office-native-open',
        status: 'ready',
        viewer: 'office-document-runtime',
        sourceUrl,
        worker: 'libreoffice_headless when derivative/export is requested',
      },
    ];
  }

  return [
    {
      id: 'source-stream',
      status: 'ready',
      viewer: 'source-bound',
      sourceUrl,
    },
  ];
}
