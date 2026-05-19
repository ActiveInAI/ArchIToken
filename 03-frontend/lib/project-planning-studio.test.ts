// lib/project-planning-studio.test.ts - Project Planning Studio contract tests
// License: Apache-2.0

import { describe, expect, it } from 'vitest';
import {
  approveAndArchivePlanningVersion,
  createDefaultProjectPlanningModel,
  createPlanningExport,
  createPlanningVersion,
  deriveCriticalPath,
  derivePlanningSummary,
  planningDiagramTemplates,
  requestPlanningApproval,
  runPlanningAiAdvisor,
} from './project-planning-studio';

describe('project planning studio contract', () => {
  it('covers the requested planning chart families and mature open-source routes', () => {
    const names = planningDiagramTemplates.flatMap((template) => [template.name, ...template.aliases]);

    for (const expectedName of [
      '甘特图',
      '横道图',
      '流程图',
      '思维导图',
      'WBS 工作分解结构图',
      'RACI 责任分配矩阵',
      'PERT 图',
      '关键路径网络图',
      '资源直方图',
      '风险矩阵图',
      'BPMN 业务流程建模标注图',
      '鱼骨图',
      '燃尽图',
      '燃起图',
      '累积流图',
      '价值流图',
      'SIPOC 模型图',
      'SWOT 分析矩阵图',
      '蒙特卡洛模拟分布图',
    ]) {
      expect(names, expectedName).toContain(expectedName);
    }

    expect(new Set(planningDiagramTemplates.map((template) => template.engine))).toEqual(
      new Set(['d3-svg', 'antv-g6', 'ant-design', 'ant-design-charts', 'bpmn-js', 'simulation-worker', 'mermaid']),
    );
  });

  it('keeps every diagram template tied to plan data, approval and export policy', () => {
    for (const template of planningDiagramTemplates) {
      expect(template.dataObjects.length, template.id).toBeGreaterThan(0);
      expect(template.purpose.length, template.id).toBeGreaterThan(10);
      expect(template.openSourceRoute.length, template.id).toBeGreaterThan(5);
      expect(template.approvalGate, template.id).toContain('审批');
    }
  });

  it('creates a complete Project Plan Token model', () => {
    const model = createDefaultProjectPlanningModel();
    const summary = derivePlanningSummary(model);

    expect(model.schema).toBe('architoken.project_planning_studio.v1');
    expect(model.moduleId).toBe('planning_management');
    expect(model.tasks.length).toBeGreaterThan(0);
    expect(model.wbs.length).toBeGreaterThan(0);
    expect(model.milestones.length).toBeGreaterThan(0);
    expect(model.resources.length).toBeGreaterThan(0);
    expect(model.risks.length).toBeGreaterThan(0);
    expect(model.raci.length).toBeGreaterThan(0);
    expect(summary.criticalPathTaskIds.length).toBeGreaterThan(0);
  });

  it('supports version save, approval request, approval archive and export loop', () => {
    const model = createDefaultProjectPlanningModel();
    const versioned = createPlanningVersion(model, 'test', 'contract save');
    const pending = requestPlanningApproval(versioned, 'pm');
    const archived = approveAndArchivePlanningVersion(pending, 'owner');
    const path = deriveCriticalPath(archived.tasks);

    expect(versioned.currentVersion).not.toBe(model.currentVersion);
    expect(pending.approvalStatus).toBe('pending_approval');
    expect(archived.approvalStatus).toBe('archived');
    expect(path.at(-1)).toBe('task-5');
    expect(createPlanningExport(archived, 'json').fileName).toContain('.archiplan.json');
    expect(createPlanningExport(archived, 'csv').content).toContain('code,title,wbs');
    expect(createPlanningExport(archived, 'mermaid').content).toContain('gantt');
  });

  it('generates AI planning advice from deterministic plan evidence', () => {
    const model = createDefaultProjectPlanningModel();
    const advice = runPlanningAiAdvisor(model);

    expect(advice.length).toBeGreaterThan(0);
    expect(advice.every((item) => item.evidenceRefs.length > 0)).toBe(true);
  });
});
