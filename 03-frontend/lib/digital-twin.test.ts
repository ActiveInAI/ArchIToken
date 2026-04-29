// lib/digital-twin.test.ts - Heavy steel digital twin module contract tests
// License: Apache-2.0

import { describe, expect, it } from 'vitest';

import {
  getSteelTwinBlockingIssues,
  getSteelTwinReadinessScore,
  steelExportPackages,
  steelMembers,
  steelQualityGates,
  steelTwinLayers,
  steelTwinStages,
  steelSimulationThreads,
} from './digital-twin';

describe('heavy steel digital twin fixture contract', () => {
  it('covers the required heavy steel lifecycle chain', () => {
    expect(steelTwinStages.map((stage) => stage.name)).toEqual([
      '方案设计',
      '深化设计',
      '材料管理',
      '计量造价',
      '生产制造',
      '物流运输',
      '施工管理',
      '数据档案',
      '数字孪生',
    ]);
  });

  it('keeps the twin layer stack aligned with IFC, 3DGS, IoT, simulation, process, and risk', () => {
    expect(steelTwinLayers.map((layer) => layer.layerId)).toEqual([
      'semantic_ifc',
      'reality_splat',
      'iot_scada',
      'simulation',
      'process',
      'risk',
    ]);
  });

  it('keeps Gaussian Splatting and scan point-cloud semantics separated', () => {
    const realityLayer = steelTwinLayers.find((layer) => layer.layerId === 'reality_splat');
    const realityThread = steelSimulationThreads.find((thread) => thread.id === 'reality-thread');

    expect(realityLayer?.source).toContain('drone video');
    expect(realityLayer?.source).toContain('360 panorama');
    expect(realityLayer?.source).toContain('LiDAR/E57');
    expect(realityLayer?.source).toContain('control points');
    expect(realityThread?.engine).toContain('Gaussian Splatting');
    expect(realityThread?.engine).toContain('scan residual alignment');
  });

  it('models heavy steel members, inspections, standards, and editable handover packages', () => {
    expect(steelMembers.some((member) => member.kind === 'corridor')).toBe(true);
    expect(steelMembers.some((member) => member.boltSpec.includes('M30'))).toBe(true);
    expect(steelQualityGates.some((gate) => gate.standard.includes('AWS D1.1'))).toBe(true);
    expect(steelQualityGates.some((gate) => gate.standard.includes('EN 1090'))).toBe(true);
    expect(steelQualityGates.some((gate) => gate.standard.includes('AS/NZS 5131'))).toBe(true);
    expect(steelExportPackages.some((pkg) => pkg.format === 'IFC4.3')).toBe(true);
    expect(steelExportPackages.some((pkg) => pkg.format === 'STEP')).toBe(true);
    expect(steelExportPackages.some((pkg) => pkg.format === 'BOM')).toBe(true);
    expect(steelExportPackages.some((pkg) => pkg.format === 'Inspection')).toBe(true);
    expect(getSteelTwinReadinessScore()).toBeGreaterThan(80);
    expect(getSteelTwinBlockingIssues().length).toBeGreaterThan(0);
  });
});
