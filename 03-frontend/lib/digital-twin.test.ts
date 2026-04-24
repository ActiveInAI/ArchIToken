// lib/digital-twin.test.ts - Digital Twin module contract tests
// License: Apache-2.0

import { describe, expect, it } from 'vitest';

import {
  getTwinBlockingIssues,
  getTwinReadinessScore,
  twinExportPackages,
  twinIntegrityGates,
  twinLayers,
  twinSceneNodes,
} from './digital-twin';

describe('digital twin module fixture contract', () => {
  it('keeps the required WebGPU digital twin layers visible', () => {
    expect(twinLayers.map((layer) => layer.layerId)).toEqual([
      'bim',
      'splat',
      'iot',
      'safety',
      'schedule',
    ]);
  });

  it('tracks editable geometry, properties, evidence, and export readiness', () => {
    expect(twinSceneNodes.some((node) => node.source === '3DGS')).toBe(true);
    expect(twinIntegrityGates.map((gate) => gate.id)).toEqual([
      'geometry',
      'properties',
      'evidence',
      'editable',
    ]);
    expect(twinExportPackages.some((pkg) => pkg.format === 'IFC')).toBe(true);
    expect(twinExportPackages.some((pkg) => pkg.format === 'BOQ')).toBe(true);
    expect(getTwinReadinessScore()).toBeGreaterThan(80);
    expect(getTwinBlockingIssues().length).toBeGreaterThan(0);
  });
});

