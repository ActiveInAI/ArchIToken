// lib/business-workflow.test.ts - Module workflow action contract tests
// License: Apache-2.0

import { describe, expect, it } from 'vitest';
import {
  activeModuleIds,
  getModuleDependencyIssues,
  getModuleSpec,
  moduleSpecs,
} from './module-registry';
import { applyWorkbenchAction, createWorkbenchRuntime, describeAction } from './business-workflow';
import { generateArtifact, runRuleCheck, validateSchema } from './module-actions';

describe('module registry contract', () => {
  it('uses production_manufacturing as the active manufacturing module id', () => {
    expect(activeModuleIds).toContain('production_manufacturing');
    expect(activeModuleIds).not.toContain('manufacturing');
    expect(activeModuleIds).not.toContain('fabrication');
    expect(getModuleSpec('manufacturing').id).toBe('production_manufacturing');
    expect(getModuleSpec('fabrication').id).toBe('production_manufacturing');
  });

  it('covers all 11 modules with operational details', () => {
    expect(moduleSpecs).toHaveLength(11);
    expect(getModuleDependencyIssues()).toEqual([]);

    for (const spec of moduleSpecs) {
      expect(spec.subdomains.length).toBeGreaterThan(0);
      expect(spec.artifacts.length).toBeGreaterThan(0);
      expect(spec.workflowStates.length).toBeGreaterThanOrEqual(4);
      expect(spec.agentGates.map((gate) => gate.name)).toEqual([
        'Planner',
        'Generator',
        'Evaluator',
        'RuleChecker',
        'SchemaValidator',
        'Approver',
      ]);
      expect(spec.tasks.length).toBeGreaterThan(0);
      expect(spec.approvals.length).toBeGreaterThan(0);
      expect(spec.risks.length).toBeGreaterThan(0);
      expect(spec.fileTypes.length).toBeGreaterThan(0);
      expect(spec.visualization.layers.length).toBeGreaterThan(0);
      expect(spec.routeHref).toBe(`/app/modules/${spec.id}`);
    }
  });

  it('keeps required deep modules expanded', () => {
    expect(getModuleSpec('standard_library').subdomains.map((item) => item.name)).toEqual([
      '标准规范',
      '族库构件',
      '样板文件',
      '材质库',
      '图纸',
      '模型',
      '做法库',
      '规则库',
      '版本库',
    ]);
    expect(getModuleSpec('material_logistics').subdomains.map((item) => item.name)).toContain('批次追踪');
    expect(getModuleSpec('production_manufacturing').subdomains.map((item) => item.name)).toContain('CNC/数控文件');
    expect(getModuleSpec('construction_supervision').subdomains.map((item) => item.name)).toContain('建筑机器人 / IoT');
    expect(getModuleSpec('digital_twin').visualization.layers).toEqual(
      expect.arrayContaining(['WebGPU-ready', 'Three.js fallback', 'IFC', 'GLB', '点云', '360']),
    );
  });
});

describe('mock module actions', () => {
  it('changes artifact state for each workbench action', () => {
    const spec = getModuleSpec('digital_twin');
    const artifact = spec.artifacts[0];
    expect(artifact).toBeDefined();

    const generated = generateArtifact(spec.id, artifact!);
    expect(generated.artifact.status).toBe('generated');

    const checked = runRuleCheck(spec.id, generated.artifact);
    expect(checked.artifact.status).toBe('rule_checked');

    const validated = validateSchema(spec.id, checked.artifact);
    expect(validated.artifact.status).toBe('schema_validated');
  });

  it('updates runtime state and audit trail', () => {
    const state = createWorkbenchRuntime('construction_supervision');
    const firstArtifact = state.artifacts[0];
    expect(firstArtifact).toBeDefined();

    const generated = applyWorkbenchAction(state, firstArtifact!.id, 'generate');
    expect(generated.artifacts[0]?.status).toBe('generated');
    expect(generated.auditTrail).toHaveLength(1);
    expect(describeAction('approve')).toBe('审批');
  });
});
