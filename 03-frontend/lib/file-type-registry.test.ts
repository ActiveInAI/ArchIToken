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
  it('registers every requested extension', () => {
    for (const extension of requestedFileTypeExtensions) {
      expect(fileTypeForExtension(extension), extension).toBeDefined();
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
    expect(fileTypeForExtension('.glb')?.viewerKind).toBe('engineering');
    expect(fileTypeForExtension('.stl')?.viewerKind).toBe('engineering');

    expect(fileTypeForExtension('.rvt')?.productionRoute).toBe(
      'licensed_adapter_required',
    );
    expect(fileTypeForExtension('.dwg')?.productionRoute).toBe(
      'licensed_adapter_required',
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
    expect(fileTypeForExtension('.gcode')?.logicalType).toBe('robot.cnc');
    expect(fileTypeForExtension('.ts')?.logicalType).toBe('code.source');
    expect(fileTypeForFileName('Dockerfile')?.logicalType).toBe('code.infra');
    expect(fileTypeForFileName('.openapi.yaml')?.logicalType).toBe(
      'code.schema',
    );
  });
});
