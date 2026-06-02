// lib/digital-twin.test.ts - Heavy steel digital twin module contract tests
// License: Apache-2.0

import { describe, expect, it } from 'vitest';

import {
  buildSteelTwinWebGpuScene,
  getSteelMemberTwinGeometry,
  getSteelSensorTwinPosition,
  getSteelTwinBlockingIssues,
  getSteelTwinReadinessScore,
  steelExportPackages,
  steelMembers,
  steelQualityGates,
  steelSensors,
  steelTwinRuntimeCapabilities,
  steelTwinWebGpuAdapterManifest,
  steelTwinLayers,
  steelTwinStages,
  steelSimulationThreads,
  steelTwinViewportModes,
  steelTwinVisualizationReferences,
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

  it('binds the twin viewport to the required open visualization reference stack', () => {
    expect(steelTwinVisualizationReferences.map((reference) => reference.id)).toEqual([
      'cesium',
      'antv-g2',
      'mapbox-gl',
      'maptalks',
      'd3',
      'three',
      'echarts',
      'highcharts',
      'kepler',
      'maptalks-three',
    ]);
    expect(steelTwinVisualizationReferences.find((reference) => reference.id === 'three')?.bundledRuntime).toBe(true);
    expect(steelTwinVisualizationReferences.find((reference) => reference.id === 'highcharts')?.bundledRuntime).toBe(false);
    expect(steelTwinViewportModes.some((mode) => mode.references.includes('cesium'))).toBe(true);
    expect(steelTwinViewportModes.some((mode) => mode.references.includes('kepler'))).toBe(true);
    expect(steelTwinViewportModes.every((mode) => mode.focusLayerIds.length > 0)).toBe(true);
  });

  it('declares WebGPU as the primary digital twin renderer with Three.js as fallback', () => {
    expect(steelTwinWebGpuAdapterManifest).toMatchObject({
      preferredRuntime: 'webgpu',
      fallbackRuntime: 'three',
      requiredBrowserApi: 'navigator.gpu',
      shaderLanguage: 'wgsl',
    });
    expect(steelTwinWebGpuAdapterManifest.auditSignals).toEqual(
      expect.arrayContaining(['adapter_info', 'device_limits', 'fallback_reason']),
    );
  });

  it('keeps the digital twin runtime stack aligned with current best-practice layers', () => {
    expect(steelTwinRuntimeCapabilities.map((capability) => capability.id)).toEqual([
      'webgpu-wgsl-viewport',
      'ifc43-ids-bcf',
      'gltf-runtime-assets',
      'tiles-openusd-geospatial',
      'reality-3dgs-e57',
      'iot-process-twin',
    ]);
    expect(steelTwinRuntimeCapabilities.find((capability) => capability.id === 'webgpu-wgsl-viewport')?.status).toBe('implemented');
    expect(steelTwinRuntimeCapabilities.some((capability) => capability.standard.includes('OGC 3D Tiles'))).toBe(true);
    expect(steelTwinRuntimeCapabilities.some((capability) => capability.standard.includes('OpenUSD'))).toBe(true);
    expect(steelTwinRuntimeCapabilities.some((capability) => capability.standard.includes('ISO 23247'))).toBe(true);
  });

  it('keeps highlighted members and sensors aligned to the structural frame coordinate system', () => {
    const upperColumn = steelMembers.find((member) => member.id === 'col-b1');
    const westBeam = steelMembers.find((member) => member.id === 'beam-l2-west');
    const torqueSensor = steelSensors.find((sensor) => sensor.id === 'bolt-corridor');

    if (!upperColumn || !westBeam || !torqueSensor) {
      throw new Error('digital twin fixture must contain aligned member and sensor samples');
    }

    expect(getSteelMemberTwinGeometry(upperColumn).position).toEqual([-4.8, 3.9, 3]);
    expect(getSteelMemberTwinGeometry(westBeam).position).toEqual([0, 2.65, 3]);
    expect(getSteelSensorTwinPosition(torqueSensor)).toEqual([2.15, 4.66, 3.65]);
  });

  it('builds a WebGPU vertex scene with selectable steel members and separated layer counts', () => {
    const selectedMember = steelMembers.find((member) => member.risk === 'high') ?? steelMembers[0];
    if (!selectedMember) throw new Error('digital twin fixture must contain at least one steel member');

    const scene = buildSteelTwinWebGpuScene({
      activeLayerIds: ['semantic_ifc', 'reality_splat', 'iot_scada', 'simulation', 'process', 'risk'],
      selectedMemberId: selectedMember.id,
      progressPhase: 1.25,
    });

    expect(scene.vertexCount).toBeGreaterThan(steelMembers.length * 6);
    expect(scene.vertices.length).toBe(scene.vertexCount * 6);
    expect(scene.pickTargets).toHaveLength(steelMembers.length);
    expect(scene.pickTargets.find((target) => target.memberId === selectedMember.id)?.selected).toBe(true);
    expect(scene.layerVertexCounts.semantic_ifc).toBeGreaterThan(0);
    expect(scene.layerVertexCounts.reality_splat).toBeGreaterThan(0);
    expect(scene.layerVertexCounts.iot_scada).toBeGreaterThan(0);
    expect(scene.layerVertexCounts.process).toBeGreaterThan(0);
    expect(scene.layerVertexCounts.risk).toBeGreaterThan(0);
  });

  it('applies editable member geometry overrides and soft-hidden members to the WebGPU scene', () => {
    const baseScene = buildSteelTwinWebGpuScene({
      activeLayerIds: ['semantic_ifc', 'iot_scada', 'risk'],
      selectedMemberId: 'col-a1',
    });
    const editedScene = buildSteelTwinWebGpuScene({
      activeLayerIds: ['semantic_ifc', 'iot_scada', 'risk'],
      selectedMemberId: 'col-a2',
      hiddenMemberIds: ['col-a1'],
      geometryOverrides: {
        'col-a2': {
          position: [3.9, 1.6, -2.7],
          size: [0.24, 3.2, 0.24],
        },
      },
    });

    expect(baseScene.pickTargets.some((target) => target.memberId === 'col-a1')).toBe(true);
    expect(editedScene.pickTargets.some((target) => target.memberId === 'col-a1')).toBe(false);
    expect(editedScene.pickTargets.find((target) => target.memberId === 'col-a2')?.selected).toBe(true);
    expect(editedScene.vertexCount).toBeLessThan(baseScene.vertexCount);
  });
});
