// app/api/local-files/[fileId]/ai-actions/route.ts - AI generation and online edit action manifest
// License: Apache-2.0

import { NextResponse } from 'next/server';
import {
  adapterRequirementForExtension,
  adapterSourcesForFileName,
} from '@/lib/adapter-source-registry';
import { fileTypeForFileName } from '@/lib/file-type-registry';
import {
  getLocalFileViewerKind,
  type LocalFileViewerKind,
} from '@/lib/local-file-runtime';
import { getLocalFileMetadata } from '@/lib/local-file-runtime-server';

export const runtime = 'nodejs';

type FileAiAction = 'ai_generate' | 'online_edit';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ fileId: string }> },
) {
  const { fileId } = await params;
  const metadata = await getLocalFileMetadata(fileId);

  if (!metadata) {
    return NextResponse.json({ error: 'file not found' }, { status: 404 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    action?: unknown;
  };
  const action =
    body.action === 'online_edit' || body.action === 'ai_generate'
      ? body.action
      : null;

  if (!action) {
    return NextResponse.json(
      { error: 'action must be ai_generate or online_edit' },
      { status: 400 },
    );
  }

  const viewerKind = getLocalFileViewerKind(metadata);
  const ext = metadata.ext.toLowerCase();
  const registry = fileTypeForFileName(metadata.originalName);
  const requirement = adapterRequirementForExtension(ext);
  const sources = adapterSourcesForFileName(metadata.originalName);
  const capability = actionCapability(action, ext, viewerKind);
  const operationId = `${action}:${metadata.fileId}:${Date.now()}`;

  return NextResponse.json({
    schema: 'architoken.file-ai-action.v1',
    operationId,
    status: 'queued',
    action,
    fileId: metadata.fileId,
    originalName: metadata.originalName,
    extension: ext,
    mimeType: metadata.mimeType,
    checksum: metadata.checksum,
    logicalType: registry?.logicalType ?? 'unregistered',
    viewerKind,
    router:
      'InferenceRouter -> ToolRouter -> WorkflowRouter -> AuditTrail -> Approver',
    adapter: capability.adapter,
    editor: capability.editor,
    generator: capability.generator,
    outputs: capability.outputs,
    adapterRequirement: requirement
      ? {
          family: requirement.family,
          extensions: requirement.extensions,
          adapters: requirement.adapters,
          importRoute: requirement.importRoute,
          onlineEditRoute: requirement.onlineEditRoute,
          aiGenerationRoute: requirement.aiGenerationRoute,
          exportRoute: requirement.exportRoute,
          status: requirement.status,
        }
      : null,
    githubSources: sources.map((source) => ({
      id: source.id,
      label: source.label,
      url: source.url,
      decision: source.decision,
      license: source.license,
      formats: source.formats,
      capabilities: source.capabilities,
      note: source.note,
    })),
    audit: {
      sourceOfRecord: `/api/local-files/${encodeURIComponent(metadata.fileId)}`,
      substitutePreview: false,
      approvalRequired: true,
      schemaValidationRequired: true,
      professionalRuleCheckRequired: true,
    },
  });
}

function actionCapability(
  action: FileAiAction,
  ext: string,
  viewerKind: LocalFileViewerKind,
): {
  adapter: string;
  editor: string;
  generator: string;
  outputs: string[];
} {
  if (ext === '.dwg' || ext === '.dxf') {
    return {
      adapter:
        'CAD native drawing adapter: LibreDWG/QCAD/LibreCAD/ODA/ezdxf -> source entity graph -> SVG/vector editor',
      editor: 'CAD layer/entity/block/dimension/property editor',
      generator: 'OpenClaw + ForgeCAD + InferenceRouter CAD drafting workflow',
      outputs: ['dwg', 'dxf', 'pdf', 'svg', 'ifc', 'bom.xlsx'],
    };
  }

  if (ext === '.ifc' || ext === '.ifczip') {
    return {
      adapter: 'buildingSMART + IfcOpenShell + Bonsai/web-ifc/openBIM adapter',
      editor: 'IFC property set, Bonsai authoring, BCF issue and IDS rule editor',
      generator: 'OpenClaw + IfcOpenShell/Bonsai Text-to-BIM workflow',
      outputs: ['ifc', 'bcfzip', 'ids', 'xlsx', 'glb', 'blend'],
    };
  }

  if (['.step', '.stp', '.iges', '.igs', '.brep'].includes(ext)) {
    return {
      adapter: 'OCCT/OpenCascade/OCP/FreeCAD/CGAL CAD exchange adapter',
      editor: 'B-Rep topology, NURBS, material and property editor',
      generator: 'OpenClaw + ForgeCAD + CadQuery/build123d/OCCT/FreeCAD workflow',
      outputs: ['step', 'stp', 'iges', 'igs', 'brep', 'stl', 'glb', 'ifc', 'bom.xlsx'],
    };
  }

  if (ext === '.stl' || ext === '.obj' || ext === '.glb' || ext === '.gltf') {
    return {
      adapter: 'Three.js/Babylon.js mesh editor + Blender/CGAL/OCCT mesh worker',
      editor: 'mesh/material/metadata editor',
      generator: 'OpenClaw + Blender + mesh generation / repair workflow',
      outputs: ['stl', 'obj', 'glb', 'gltf', 'blend', 'bom.xlsx'],
    };
  }

  if (ext === '.skp') {
    return {
      adapter: 'SketchUp/Speckle/Blender isolated adapter',
      editor: 'scene/entity/material/property editor',
      generator: 'OpenClaw + Blender/Speckle scene generation workflow',
      outputs: ['skp', 'ifc', 'glb', 'gltf', 'obj', 'bom.xlsx'],
    };
  }

  if (ext === '.3dm' || ext === '.gh' || ext === '.ghx') {
    return {
      adapter: 'McNeel rhino3dm/OpenNURBS + Rhino/Grasshopper licensed sidecar',
      editor: 'NURBS/layer/material/property editor',
      generator: 'OpenClaw + rhino3dm/OpenNURBS/Grasshopper workflow',
      outputs: ['3dm', 'ifc', 'step', 'stp', 'glb', 'bom.xlsx'],
    };
  }

  if (ext === '.blend') {
    return {
      adapter: 'Blender external process/service adapter',
      editor: 'Blender scene/material/animation editor',
      generator: 'OpenClaw + Blender Python/MCP generation workflow',
      outputs: ['blend', 'glb', 'gltf', 'obj', 'stl', 'mp4', 'png'],
    };
  }

  if (viewerKind === 'office') {
    return {
      adapter: 'WOPI office adapter: Collabora/OnlyOffice/Univer',
      editor: 'online Office editor',
      generator: 'InferenceRouter document/spreadsheet/presentation workflow',
      outputs: ['docx', 'xlsx', 'pptx', 'pdf', 'html'],
    };
  }

  if (viewerKind === 'pdf') {
    return {
      adapter: 'PDF adapter: MuPDF/Stirling/PDF.js source stream',
      editor: 'PDF annotate/form/OCR/split-merge editor',
      generator: 'InferenceRouter PDF report and drawing-package workflow',
      outputs: ['pdf', 'pdfa', 'json', 'xlsx', 'png'],
    };
  }

  if (viewerKind === 'image') {
    return {
      adapter: 'Image adapter: browser editor/OpenCV/ImageMagick',
      editor: 'image annotate/crop/layer editor',
      generator: 'image generation provider behind InferenceRouter',
      outputs: ['png', 'jpg', 'webp', 'svg', 'json'],
    };
  }

  if (viewerKind === 'video') {
    return {
      adapter: 'Video adapter: browser player/FFmpeg/remotion',
      editor: 'timeline, trim, subtitle and transcode editor',
      generator: 'video generation provider behind InferenceRouter',
      outputs: ['mp4', 'webm', 'srt', 'json'],
    };
  }

  return {
    adapter: action === 'online_edit' ? 'source text editor' : 'generic generator',
    editor: 'source-bound editor',
    generator: 'InferenceRouter generic file generation workflow',
    outputs: ['source', 'json'],
  };
}
