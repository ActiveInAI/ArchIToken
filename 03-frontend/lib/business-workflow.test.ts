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
import { MockModuleBackendAdapter } from './module-backend-adapter';
import { getModuleRootId } from './module-file-system';
import { getAllowedLifecycleEvents } from './module-lifecycle';
import { getModuleOperationalProfile } from './module-operations';
import { moduleAssistantSuggestions } from './ai-assistant-profile';

describe('module registry contract', () => {
  it('uses production_manufacturing as the active manufacturing module id', () => {
    expect(activeModuleIds).toContain('production_manufacturing');
    expect(activeModuleIds).not.toContain('manufacturing');
    expect(activeModuleIds).not.toContain('fabrication');
    expect(getModuleSpec('manufacturing').id).toBe('production_manufacturing');
    expect(getModuleSpec('fabrication').id).toBe('production_manufacturing');
  });

  it('covers all 14 modules with operational details', () => {
    expect(moduleSpecs).toHaveLength(14);
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
      '标准总库',
      '设计规范',
      'BIM与CDE标准',
      '造价合同标准',
      '材料供应链标准',
      '生产制造标准',
      '施工验收标准',
      '档案审计标准',
      '信息安全与AI治理',
    ]);
    expect(getModuleSpec('material_logistics').subdomains.map((item) => item.name)).toContain('批次追踪');
    expect(getModuleSpec('production_manufacturing').subdomains.map((item) => item.name)).toContain('CNC/数控文件');
    expect(getModuleSpec('construction_supervision').subdomains.map((item) => item.name)).toContain('建筑机器人 / IoT');
    expect(getModuleSpec('digital_twin').visualization.layers).toEqual(
      expect.arrayContaining(['WebGPU-ready', 'Three.js fallback', 'IFC', 'GLB', '点云', '360']),
    );
  });

  it('has interactive operation profiles and AI suggestions for every module', () => {
    for (const moduleId of activeModuleIds) {
      const profile = getModuleOperationalProfile(moduleId);
      expect(profile.features.length).toBeGreaterThanOrEqual(3);
      expect(profile.operations.length).toBeGreaterThanOrEqual(3);
      expect(moduleAssistantSuggestions[moduleId].length).toBeGreaterThanOrEqual(3);
    }
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

describe('mock backend adapter contract', () => {
  it('supports all required file context operations with state changes', () => {
    const adapter = new MockModuleBackendAdapter();
    const moduleId = 'standard_library';
    const rootId = getModuleRootId(moduleId);
    const folder = adapter.listFiles(moduleId, rootId).find((node) => node.type === 'folder');
    expect(folder).toBeDefined();

    const openedFolder = adapter.openFile(folder!.id);
    expect(openedFolder.node.type).toBe('folder');

    const created = adapter.createFile({
      moduleId,
      parentId: folder!.id,
      name: '右键新建资料夹',
      type: 'folder',
    });
    expect(created.node.name).toBe('右键新建资料夹');

    const uploaded = adapter.uploadFile({
      moduleId,
      parentId: folder!.id,
      name: '上传规范.pdf',
    });
    expect(uploaded.node.status).toBe('uploaded');

    const viewed = adapter.openFile(uploaded.node.id);
    expect(viewed.node.name).toBe('上传规范.pdf');

    const downloaded = adapter.downloadFile(uploaded.node.id);
    expect(downloaded.job.status).toBe('ready');

    const copied = adapter.copyFile(uploaded.node.id);
    expect(copied.clipboard.sourceFileId).toBe(uploaded.node.id);

    const pasted = adapter.pasteFile(moduleId, rootId);
    expect(pasted.nodes[0]?.status).toBe('copied');

    const renamed = adapter.renameFile(uploaded.node.id, '已重命名规范.pdf');
    expect(renamed.node.name).toBe('已重命名规范.pdf');

    const moved = adapter.moveFile(uploaded.node.id, rootId);
    expect(moved.node.parentId).toBe(rootId);

    const shared = adapter.shareFile(uploaded.node.id);
    expect(shared.link.url).toContain('/share/');

    const properties = adapter.getProperties(uploaded.node.id);
    expect(properties.node.permissions.length).toBeGreaterThan(0);

    const deleted = adapter.deleteFile(uploaded.node.id);
    expect(deleted.node.status).toBe('soft_deleted');
  });

  it('drives lifecycle transactions through the state machine and approvals', () => {
    const adapter = new MockModuleBackendAdapter();
    const moduleId = 'production_manufacturing';
    const created = adapter.createTransaction({
      moduleId,
      type: '生产工单审批事务',
    });
    expect(created.transaction.currentState).toBe('draft');
    expect(getAllowedLifecycleEvents(created.transaction.currentState)).toContain('submit');

    const submitted = adapter.transitionTransaction(created.transaction.id, 'submit');
    expect(submitted.transaction.currentState).toBe('submitted');

    const generated = adapter.transitionTransaction(created.transaction.id, 'generate');
    expect(generated.transaction.currentState).toBe('generating');

    const evaluated = adapter.transitionTransaction(created.transaction.id, 'evaluate');
    expect(evaluated.transaction.currentState).toBe('evaluating');

    const checked = adapter.transitionTransaction(created.transaction.id, 'rule_check');
    expect(checked.transaction.currentState).toBe('rule_checking');

    const validated = adapter.transitionTransaction(created.transaction.id, 'validate_schema');
    expect(validated.transaction.currentState).toBe('schema_validating');

    const approval = adapter.transitionTransaction(created.transaction.id, 'request_approval');
    expect(approval.transaction.currentState).toBe('pending_approval');

    const approved = adapter.approveTransaction(created.transaction.id, '生产负责人', '通过');
    expect(approved.transaction.currentState).toBe('approved');

    const archived = adapter.transitionTransaction(created.transaction.id, 'archive');
    expect(archived.transaction.currentState).toBe('archived');
  });
});
