// lib/project-planning-studio.test.ts - Project Planning Studio contract tests
// License: Apache-2.0

import { describe, expect, it } from 'vitest';
import {
  applyPlanningScheduleAdjustment,
  approveAndArchivePlanningVersion,
  createDefaultProjectPlanningModel,
  createPlanningDiagramExport,
  createPlanningExport,
  createPlanningVersion,
  deriveCriticalPath,
  deriveEarnedValueMetrics,
  deriveNetworkSchedule,
  derivePlanningStandardsCoverage,
  derivePlanningAnalytics,
  deriveResourceLoadAnalysis,
  derivePlanningSummary,
  deriveScheduleAlerts,
  deriveTaskPlannedProgress,
  deriveWorkingCalendarMetrics,
  planningDiagramTemplates,
  recordPlanningProgressFeedback,
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
    expect(model.projectName).toContain('马来西亚柔佛');
    expect(model.dataDate).toBe('2026-05-21');
    expect(model.costBaselineCurrency).toBe('MYR');
    expect(model.calendars.some((calendar) => calendar.timezone === 'Asia/Kuala_Lumpur')).toBe(true);
    expect(model.tasks.length).toBeGreaterThan(0);
    expect(model.wbs.length).toBeGreaterThan(0);
    expect(model.milestones.length).toBeGreaterThan(0);
    expect(model.resources.length).toBeGreaterThan(0);
    expect(model.risks.length).toBeGreaterThan(0);
    expect(model.raci.length).toBeGreaterThan(0);
    expect(model.progressFeedback.length).toBeGreaterThan(0);
    expect(model.tasks.some((task) => (task.budgetAmount ?? 0) > 0)).toBe(true);
    expect(model.adjustments.length).toBe(0);
    expect(model.diagrams.some((diagram) => diagram.templateId === 'gantt')).toBe(true);
    expect(model.diagrams.some((diagram) => diagram.templateId === 'flowchart')).toBe(true);
    expect(model.diagrams.some((diagram) => diagram.templateId === 'mindmap')).toBe(true);
    expect(model.diagrams.every((diagram) => diagram.canvas.nodes.length > 0)).toBe(true);
    expect(model.diagrams.every((diagram) => diagram.revision >= 1)).toBe(true);
    expect(summary.averageProgress).toBeGreaterThan(summary.plannedProgress);
    expect(summary.alertCount).toBeGreaterThan(0);
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
    expect(path.at(-1)).toBe('task-19');
    expect(path).toEqual(expect.arrayContaining(['task-12', 'task-13', 'task-14']));
    expect(createPlanningExport(archived, 'json').fileName).toContain('.archiplan.json');
    expect(createPlanningExport(archived, 'csv').content).toContain('code,title,wbs');
    expect(createPlanningExport(archived, 'mermaid').content).toContain('gantt');
  });

  it('exports editable diagram canvases to native JSON, SVG, draw.io and Drawnix adapter payloads', () => {
    const model = createDefaultProjectPlanningModel();
    const diagram = model.diagrams[0];
    expect(diagram).toBeDefined();
    if (!diagram) throw new Error('expected seeded diagram');

    expect(createPlanningDiagramExport(model, diagram, 'json').content).toContain('architoken.planning_diagram_canvas.v1');
    expect(createPlanningDiagramExport(model, diagram, 'svg').content).toContain('<svg');
    expect(createPlanningDiagramExport(model, diagram, 'drawio').content).toContain('<mxfile');
    expect(createPlanningDiagramExport(model, diagram, 'drawnix').content).toContain('architoken.drawnix_adapter_payload.v1');
  });

  it('seeds direct authoring canvases for gantt, flowchart and mind map', () => {
    const model = createDefaultProjectPlanningModel();

    for (const templateId of ['gantt', 'flowchart', 'mindmap']) {
      const diagram = model.diagrams.find((item) => item.templateId === templateId);
      expect(diagram, templateId).toBeDefined();
      if (!diagram) throw new Error(`expected ${templateId} diagram`);
      expect(diagram.canvas.nodes.length, templateId).toBeGreaterThan(0);
      expect(createPlanningDiagramExport(model, diagram, 'svg').content).toContain('<svg');
      expect(createPlanningDiagramExport(model, diagram, 'drawio').content).toContain('<mxfile');
    }
  });

  it('generates AI planning advice from deterministic plan evidence', () => {
    const model = createDefaultProjectPlanningModel();
    const advice = runPlanningAiAdvisor(model);

    expect(advice.length).toBeGreaterThan(0);
    expect(advice.every((item) => item.evidenceRefs.length > 0)).toBe(true);
  });

  it('derives progress analytics and schedule warning evidence', () => {
    const model = createDefaultProjectPlanningModel();
    const analytics = derivePlanningAnalytics(model);
    const alerts = deriveScheduleAlerts(model);
    const completedKickoff = model.tasks.find((task) => task.id === 'task-2');
    expect(completedKickoff).toBeDefined();
    if (!completedKickoff) throw new Error('expected seeded kickoff task');

    expect(deriveTaskPlannedProgress(completedKickoff, model.dataDate)).toBe(100);
    expect(analytics.actualProgress).toBeGreaterThan(analytics.plannedProgress);
    expect(analytics.schedulePerformanceIndex).toBeGreaterThan(1);
    expect(analytics.costPerformanceIndex).toBeGreaterThan(0);
    expect(analytics.workingDayCount).toBeGreaterThan(0);
    expect(alerts.some((alert) => alert.category === 'risk')).toBe(true);
    expect(alerts.every((alert) => alert.evidenceRefs.length > 0)).toBe(true);
  });

  it('derives real network time parameters, float and standards coverage evidence', () => {
    const model = createDefaultProjectPlanningModel();
    const network = deriveNetworkSchedule(model.tasks);
    const task13 = network.taskAnalyses.find((analysis) => analysis.taskId === 'task-13');
    const coverage = derivePlanningStandardsCoverage(model);
    const calendar = deriveWorkingCalendarMetrics(model);
    const earnedValue = deriveEarnedValueMetrics(model);
    const resourceLoad = deriveResourceLoadAnalysis(model);

    expect(network.baseDate).toBe('2026-05-01');
    expect(network.criticalPathTaskIds.at(-1)).toBe('task-19');
    expect(network.projectDurationDays).toBeGreaterThan(180);
    expect(task13?.earlyStartDate).toBe('2026-07-06');
    expect(task13?.totalFloatDays).toBe(0);
    expect(calendar.workingDayCount).toBeGreaterThan(180);
    expect(calendar.weatherRiskDayCount).toBeGreaterThan(0);
    expect(earnedValue.budgetAtCompletion).toBeGreaterThan(1_000_000);
    expect(earnedValue.earnedValue).toBeGreaterThan(earnedValue.plannedValue);
    expect(earnedValue.costPerformanceIndex).toBeGreaterThan(0);
    expect(resourceLoad.buckets.length).toBeGreaterThan(0);
    expect(resourceLoad.peakUtilizationPercent).toBeGreaterThan(0);
    expect(coverage.some((item) => item.framework === 'MOHURD-PM' && item.domain.includes('流水施工'))).toBe(true);
    expect(coverage.some((item) => item.framework === 'MOHURD-PM' && item.status === 'gap')).toBe(true);
    expect(coverage.some((item) => item.framework === 'PMI-PMP' && item.status === 'partial')).toBe(true);
    expect(coverage.every((item) => item.evidenceRefs.length > 0)).toBe(true);
  });

  it('records progress feedback and applies downstream schedule adjustments', () => {
    const model = createDefaultProjectPlanningModel();
    const feedback = recordPlanningProgressFeedback(model, {
      taskId: 'task-2',
      reporter: 'test',
      progress: 88,
      note: 'test feedback',
      taskStatus: 'review',
    });
    const adjusted = applyPlanningScheduleAdjustment(feedback, {
      taskIds: ['task-2'],
      shiftDays: 2,
      reason: 'dependency slipped',
      actor: 'test',
      includeSuccessors: true,
    });

    expect(feedback.tasks.find((task) => task.id === 'task-2')?.progress).toBe(88);
    expect(feedback.progressFeedback[0]?.status).toBe('needs_review');
    expect(adjusted.adjustments[0]?.taskIds).toEqual(expect.arrayContaining(['task-2', 'task-4', 'task-5', 'task-19']));
    expect(adjusted.tasks.find((task) => task.id === 'task-5')?.start).toBe('2026-05-12');
    expect(adjusted.milestones.find((milestone) => milestone.id === 'ms-3')?.due).toBe('2026-06-07');
  });
});
