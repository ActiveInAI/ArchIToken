// lib/file-type-registry.test.ts - Unified file type registry contract tests
// License: Apache-2.0

import { describe, expect, it } from 'vitest';
import {
  fileProcessingStages,
  fileTypeForExtension,
  fileTypeForFileName,
  fileTypeRegistry,
  logicalFileTypeRegistry,
  requestedExactFileTypeNames,
  requestedFileTypeExtensions,
  requestedLogicalFileTypes,
  stageRouteForFileName,
} from './file-type-registry';

describe('file type registry', () => {
  const userRequestedNativeAndLightweightExtensions = [
    '.dxf',
    '.dwg',
    '.rvt',
    '.stel',
    '.stl',
    '.iges',
    '.igs',
    '.ifc',
    '.skp',
    '.3dm',
    '.usd',
    '.usda',
    '.usdc',
    '.usdz',
    '.b3dm',
    '.i3dm',
    '.pnts',
    '.cmpt',
    '.gltf',
    '.glb',
    '.docx',
    '.doc',
    '.xlsx',
    '.xls',
    '.pptx',
    '.ppt',
    '.mp3',
    '.wav',
    '.m4a',
    '.flac',
    '.mp4',
    '.mkv',
    '.mov',
    '.avi',
    '.jpg',
    '.jpeg',
    '.png',
    '.webp',
    '.gif',
    '.pdf',
  ] as const;

  it('registers every requested extension', () => {
    for (const extension of requestedFileTypeExtensions) {
      expect(fileTypeForExtension(extension), extension).toBeDefined();
    }
  });

  it('covers the requested native, lightweight, Office, media, image, and PDF display set', () => {
    for (const extension of userRequestedNativeAndLightweightExtensions) {
      const entry = fileTypeForExtension(extension);
      expect(entry, extension).toBeDefined();
      expect(entry?.viewerKind, extension).not.toBe('unknown');
      expect(entry?.stages.store.status, extension).toBe('ready');
      expect(entry?.stages.preview.adapter, extension).toBeTruthy();
    }
  });

  it('registers every requested exact file name', () => {
    for (const fileName of requestedExactFileTypeNames) {
      expect(fileTypeForFileName(fileName), fileName).toBeDefined();
    }
  });

  it('keeps every requested logical type represented', () => {
    const logicalById = new Map(
      logicalFileTypeRegistry.map((entry) => [entry.id, entry]),
    );

    for (const logicalType of requestedLogicalFileTypes) {
      const entry = logicalById.get(logicalType);

      expect(entry, logicalType).toBeDefined();
      for (const stage of fileProcessingStages) {
        expect(entry?.stages[stage], `${logicalType}:${stage}`).toBeDefined();
      }
    }
  });

  it('defines all Store/Preview/Extract/Parse/Convert/Validate/Runtime stages', () => {
    for (const entry of fileTypeRegistry) {
      for (const stage of fileProcessingStages) {
        expect(entry.stages[stage], `${entry.id}:${stage}`).toBeDefined();
        expect(
          entry.stages[stage].mode,
          `${entry.id}:${stage}:mode`,
        ).toBeTruthy();
        expect(
          entry.stages[stage].status,
          `${entry.id}:${stage}:status`,
        ).toBeTruthy();
      }
    }
  });

  it('routes open and proprietary engineering formats honestly', () => {
    expect(fileTypeForExtension('.ifc')?.logicalType).toBe('aec.bim.ifc');
    expect(fileTypeForExtension('.ifc')?.productionRoute).toBe(
      'adapter_required',
    );
    expect(fileTypeForExtension('.usd')?.id).toBe('openusd-scene');
    expect(fileTypeForExtension('.usdz')?.id).toBe('openusd-scene');
    expect(fileTypeForFileName('tileset.json')?.id).toBe('aec-citymodel');
    expect(fileTypeForExtension('.b3dm')?.id).toBe('aec-citymodel');
    expect(requestedFileTypeExtensions).not.toContain('.obj');
    expect(requestedFileTypeExtensions).not.toContain('.fbx');
    expect(fileTypeForExtension('.obj')?.id).toBe('legacy-mesh-abandoned');
    expect(fileTypeForExtension('.fbx')?.id).toBe('legacy-mesh-abandoned');
    expect(fileTypeForExtension('.glb')?.viewerKind).toBe('engineering');
    expect(fileTypeForExtension('.glb')?.label).toContain('fallback');
    expect(fileTypeForExtension('.stl')?.viewerKind).toBe('engineering');

    expect(fileTypeForExtension('.rvt')?.productionRoute).toBe(
      'licensed_adapter_required',
    );
    expect(fileTypeForExtension('.dwg')?.productionRoute).toBe(
      'licensed_adapter_required',
    );
    expect(fileTypeForExtension('.stel')?.productionRoute).toBe(
      'licensed_adapter_required',
    );
    expect(fileTypeForExtension('.dxf')?.logicalType).toBe('cad.2d');
    expect(fileTypeForExtension('.dxf')?.productionRoute).toBe('ready');
    expect(stageRouteForFileName('drawing.dxf', 'preview')?.adapter).toBe(
      'Browser CAD SVG/vector entity viewer',
    );
    expect(fileTypeForExtension('.sldprt')?.productionRoute).toBe(
      'licensed_adapter_required',
    );
    expect(stageRouteForFileName('model.rvt', 'preview')?.mode).toBe(
      'licensed_adapter',
    );
  });

  it('routes Office, PDF, code, diagrams, GIS, scans, and robotics', () => {
    expect(fileTypeForExtension('.pdf')?.viewerKind).toBe('pdf');
    expect(fileTypeForExtension('.docx')?.logicalType).toBe('office.document');
    expect(stageRouteForFileName('contract.docx', 'preview')?.adapter).toBe(
      'Backend native Office runtime',
    );
    expect(stageRouteForFileName('contract.docx', 'convert')?.adapter).toBe(
      'Explicit Office export worker',
    );
    expect(fileTypeForExtension('.xlsx')?.logicalType).toBe(
      'office.spreadsheet',
    );
    expect(fileTypeForExtension('.mmd')?.logicalType).toBe('diagram.flowchart');
    expect(fileTypeForExtension('.geojson')?.logicalType).toBe('aec.gis');
    expect(fileTypeForExtension('.las')?.logicalType).toBe('scan.pointcloud');
    expect(fileTypeForExtension('.zip')?.viewerKind).toBe('archive');
    expect(stageRouteForFileName('handover.zip', 'preview')?.adapter).toBe(
      'ZIP central directory reader',
    );
    expect(fileTypeForExtension('.gcode')?.logicalType).toBe('robot.cnc');
    expect(fileTypeForExtension('.ts')?.logicalType).toBe('code.source');
    expect(fileTypeForFileName('Dockerfile')?.logicalType).toBe('code.infra');
    expect(fileTypeForFileName('.openapi.yaml')?.logicalType).toBe(
      'code.schema',
    );
  });
});
