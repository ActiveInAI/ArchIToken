// components/ProjectPlanningStudio.tsx - Planning Management Project Planning Studio
// License: Apache-2.0
'use client';

import {
  CircleCheck as CheckCircleOutlined,
  ClipboardCheck as AuditOutlined,
  GitBranch as NodeIndexOutlined,
  GitFork as ForkOutlined,
  LayoutGrid as AppstoreOutlined,
  Link as LinkOutlined,
  PlusCircle as PlusCircleOutlined,
  Save as SaveOutlined,
  Trash2 as DeleteOutlined,
  TriangleAlert as WarningOutlined,
  UploadCloud as CloudUploadOutlined,
} from 'lucide-react';
import { Alert, Button, Input, InputNumber, Progress, Select, Slider, Table, Tag, Tooltip, type ColumnsType } from '@/components/pan-ui';
import { useMemo, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { createModuleAuditEvent } from '@/lib/module-actions';
import { moduleBackendAdapter } from '@/lib/module-backend-adapter';
import { createModuleFile } from '@/lib/module-file-api-client';
import type { ModuleAuditEvent } from '@/lib/module-file-system';
import { getModuleRootId } from '@/lib/module-file-system';
import {
  approveAndArchivePlanningVersion,
  applyPlanningScheduleAdjustment,
  createPlanningDiagramCanvas,
  createPlanningDiagramExport,
  createDefaultProjectPlanningModel,
  createDiagramFromTemplate,
  createPlanningExport,
  createPlanningVersion,
  deriveKanbanColumns,
  derivePlanningAnalytics,
  derivePlanningSummary,
  deriveResourceHistogram,
  deriveScheduleAlerts,
  deriveTaskPlannedProgress,
  planningDiagramTemplates,
  recordPlanningProgressFeedback,
  requestPlanningApproval,
  runPlanningAiAdvisor,
  toMermaidGantt,
  type PlanningDiagramFamily,
  type PlanningDiagramNodeKind,
  type PlanningDiagram,
  type PlanningDiagramCanvasNode,
  type PlanningDiagramExportKind,
  type PlanningResource,
  type PlanningScheduleAlert,
  type PlanningTask,
  type PlanningTaskStatus,
  type PlanningWbsNode,
} from '@/lib/project-planning-studio';

const taskStatusOptions = [
  { value: 'todo', label: '待办' },
  { value: 'doing', label: '进行中' },
  { value: 'review', label: '审阅' },
  { value: 'done', label: '完成' },
  { value: 'blocked', label: '阻断' },
] satisfies Array<{ value: PlanningTaskStatus; label: string }>;

const familyLabels: Record<PlanningDiagramFamily, string> = {
  schedule: '计划',
  flow: '流程',
  mind: '结构',
  matrix: '矩阵',
  network: '网络',
  analytics: '分析',
  uml: 'UML',
  lean: '精益',
  quality: '质量',
  strategy: '战略',
  agile: '敏捷',
  risk: '风险',
};

const nodeKindOptions = [
  { value: 'task', label: '任务' },
  { value: 'milestone', label: '里程碑' },
  { value: 'wbs', label: 'WBS' },
  { value: 'resource', label: '资源' },
  { value: 'risk', label: '风险' },
  { value: 'decision', label: '判断' },
  { value: 'approval', label: '审批' },
  { value: 'note', label: '便签' },
] satisfies Array<{ value: PlanningDiagramNodeKind; label: string }>;

type PlanningWorkspaceTab =
  | 'gantt-authoring'
  | 'flow-authoring'
  | 'mind-authoring'
  | 'visual'
  | 'tasks'
  | 'feedback'
  | 'analytics'
  | 'board'
  | 'export';

const planningPrimaryEntries: Array<{ key: PlanningWorkspaceTab; title: string; description: string }> = [
  { key: 'gantt-authoring', title: '编制甘特计划', description: '录入任务、工期、依赖和实际进度。' },
  { key: 'flow-authoring', title: '编制流程图', description: '拖拽节点和连线,形成可导出的流程。' },
  { key: 'mind-authoring', title: '拆解思维导图', description: '在线拆分 WBS、交付物和责任人。' },
  { key: 'analytics', title: '反馈预警调整', description: '登记进度反馈,分析偏差并调整计划。' },
];

const planningSecondaryTabs: Array<{ key: PlanningWorkspaceTab; label: string }> = [
  { key: 'visual', label: '更多图表' },
  { key: 'tasks', label: '任务 / WBS' },
  { key: 'feedback', label: '反馈 / 状态' },
  { key: 'board', label: '看板 / RACI' },
  { key: 'export', label: '导出 / AI' },
];

export function ProjectPlanningStudio({
  onAudit,
}: {
  onAudit?: (event: ModuleAuditEvent) => void;
}) {
  const [model, setModel] = useState(() => createDefaultProjectPlanningModel());
  const [selectedTemplateId, setSelectedTemplateId] = useState('gantt');
  const [selectedDiagramId, setSelectedDiagramId] = useState(model.diagrams[0]?.id ?? '');
  const [selectedNodeId, setSelectedNodeId] = useState(model.diagrams[0]?.canvas.nodes[0]?.id ?? '');
  const [connectorSourceId, setConnectorSourceId] = useState('');
  const [exportPreview, setExportPreview] = useState(() => createPlanningExport(model, 'json'));
  const [feedbackTaskId, setFeedbackTaskId] = useState(model.tasks[0]?.id ?? '');
  const [feedbackProgress, setFeedbackProgress] = useState(model.tasks[0]?.progress ?? 0);
  const [feedbackNote, setFeedbackNote] = useState('现场/设计/生产反馈已核对,待进入下一轮计划复核。');
  const [adjustTaskId, setAdjustTaskId] = useState(model.tasks[0]?.id ?? '');
  const [adjustShiftDays, setAdjustShiftDays] = useState(2);
  const [adjustReason, setAdjustReason] = useState('根据最新进度反馈调整后续任务窗口。');
  const [adjustWithSuccessors, setAdjustWithSuccessors] = useState<'yes' | 'no'>('yes');
  const [selectedWbsId, setSelectedWbsId] = useState(model.wbs[0]?.id ?? '');
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState<PlanningWorkspaceTab>('gantt-authoring');

  const summary = useMemo(() => derivePlanningSummary(model), [model]);
  const analytics = useMemo(() => derivePlanningAnalytics(model), [model]);
  const alerts = useMemo(() => deriveScheduleAlerts(model), [model]);
  const selectedDiagram = model.diagrams.find((diagram) => diagram.id === selectedDiagramId) ?? model.diagrams[0] ?? null;
  const selectedNode = selectedDiagram?.canvas.nodes.find((node) => node.id === selectedNodeId) ?? selectedDiagram?.canvas.nodes[0] ?? null;
  const aiAdvice = useMemo(() => runPlanningAiAdvisor(model), [model]);
  const resourceHistogram = useMemo(() => deriveResourceHistogram(model), [model]);
  const kanbanColumns = useMemo(() => deriveKanbanColumns(model), [model]);
  const selectedTemplate = planningDiagramTemplates.find((template) => template.id === selectedTemplateId) ?? planningDiagramTemplates[0];
  const ganttDiagram = model.diagrams.find((diagram) => diagram.templateId === 'gantt') ?? null;
  const flowchartDiagram = model.diagrams.find((diagram) => diagram.templateId === 'flowchart') ?? null;
  const flowchartNode = flowchartDiagram?.canvas.nodes.find((node) => node.id === selectedNodeId) ?? flowchartDiagram?.canvas.nodes[0] ?? null;

  function audit(summaryText: string) {
    const event = createModuleAuditEvent('planning-studio', 'ProjectPlanningStudio', summaryText);
    onAudit?.(event);
    return event;
  }

  function updateTask(taskId: string, patch: Partial<PlanningTask>) {
    setModel((current) => ({
      ...current,
      tasks: current.tasks.map((task) => (task.id === taskId ? { ...task, ...patch } : task)),
      auditTrail: [
        {
          id: `plan-task-edit-${Date.now()}`,
          at: new Date().toISOString(),
          actor: 'ProjectPlanningStudio',
          summary: `在线编辑任务 ${taskId}`,
        },
        ...current.auditTrail,
      ],
    }));
    audit(`计划任务在线编辑: ${taskId}`);
  }

  function selectFeedbackTask(taskId: string) {
    const task = model.tasks.find((item) => item.id === taskId);
    setFeedbackTaskId(taskId);
    setFeedbackProgress(task?.progress ?? 0);
  }

  function submitProgressFeedback(taskStatus?: PlanningTaskStatus) {
    const taskId = feedbackTaskId || model.tasks[0]?.id;
    if (!taskId) return;
    const input = {
      taskId,
      reporter: '计划工程师',
      progress: feedbackProgress,
      note: feedbackNote,
      evidenceRefs: [`task:${taskId}`, 'cde:progress-feedback'],
    };
    setModel((current) => recordPlanningProgressFeedback(current, taskStatus ? { ...input, taskStatus } : input));
    audit(`进度反馈登记: ${taskId} · ${feedbackProgress}%${taskStatus ? ` · ${taskStatus}` : ''}`);
  }

  function quickTaskFeedback(task: PlanningTask, progress: number, taskStatus?: PlanningTaskStatus) {
    setFeedbackTaskId(task.id);
    setFeedbackProgress(progress);
    const input = {
      taskId: task.id,
      reporter: '计划工程师',
      progress,
      note: taskStatus === 'blocked' ? '反馈为阻断,需要计划调整或责任人解除。' : '快速进度反馈。',
      evidenceRefs: [`task:${task.id}`],
    };
    setModel((current) => recordPlanningProgressFeedback(current, taskStatus ? { ...input, taskStatus } : input));
    audit(`快速反馈 ${task.code}: ${progress}%${taskStatus ? ` · ${taskStatus}` : ''}`);
  }

  function runScheduleAdjustment() {
    const taskId = adjustTaskId || model.tasks[0]?.id;
    if (!taskId || adjustShiftDays === 0) return;
    setModel((current) => applyPlanningScheduleAdjustment(current, {
      taskIds: [taskId],
      shiftDays: adjustShiftDays,
      reason: adjustReason,
      actor: '计划工程师',
      includeSuccessors: adjustWithSuccessors === 'yes',
    }));
    audit(`进度计划调整: ${taskId} ${adjustShiftDays > 0 ? '顺延' : '提前'} ${Math.abs(adjustShiftDays)} 天`);
  }

  function addTask() {
    setModel((current) => {
      const index = current.tasks.length + 1;
      const task: PlanningTask = {
        id: `task-${index}`,
        code: `T-${String(index).padStart(3, '0')}`,
        title: `新增计划任务 ${index}`,
        wbsId: current.wbs[0]?.id ?? 'wbs-1',
        owner: '计划工程师',
        start: '2026-06-14',
        end: '2026-06-18',
        progress: 0,
        dependencies: current.tasks.at(-1)?.id ? [current.tasks.at(-1)?.id ?? ''] : [],
        status: 'todo',
        resourceId: current.resources[0]?.id ?? 'res-pm',
        riskId: current.risks[0]?.id ?? 'risk-design',
      };
      return {
        ...current,
        tasks: [...current.tasks, task],
        auditTrail: [
          { id: `plan-task-add-${Date.now()}`, at: new Date().toISOString(), actor: 'ProjectPlanningStudio', summary: `新增任务 ${task.code}` },
          ...current.auditTrail,
        ],
      };
    });
    audit('新增计划任务并写入 Project Plan Token');
  }

  function deleteTask(taskId: string) {
    setModel((current) => ({
      ...current,
      tasks: current.tasks
        .filter((task) => task.id !== taskId)
        .map((task) => ({
          ...task,
          dependencies: task.dependencies.filter((dependencyId) => dependencyId !== taskId),
        })),
      milestones: current.milestones.map((milestone) => ({
        ...milestone,
        linkedTaskIds: milestone.linkedTaskIds.filter((linkedTaskId) => linkedTaskId !== taskId),
      })),
      auditTrail: [
        { id: `plan-task-delete-${Date.now()}`, at: new Date().toISOString(), actor: 'ProjectPlanningStudio', summary: `删除任务 ${taskId}` },
        ...current.auditTrail,
      ],
    }));
    audit(`删除计划任务: ${taskId}`);
  }

  function addWbsNode(parentId: string | null) {
    setModel((current) => {
      const siblings = current.wbs.filter((node) => node.parentId === parentId);
      const parent = parentId ? current.wbs.find((node) => node.id === parentId) : null;
      const index = siblings.length + 1;
      const code = parent ? `${parent.code}.${index}` : String(current.wbs.filter((node) => node.parentId === null).length + 1);
      const node: PlanningWbsNode = {
        id: `wbs-custom-${Date.now()}`,
        code,
        title: parent ? `${parent.title} · 子项 ${index}` : `新增 WBS ${index}`,
        owner: parent?.owner ?? '计划工程师',
        parentId,
        deliverable: '待定义交付物',
      };
      return {
        ...current,
        wbs: [...current.wbs, node],
        auditTrail: [
          { id: `plan-wbs-add-${Date.now()}`, at: new Date().toISOString(), actor: 'ProjectPlanningStudio', summary: `新增 WBS ${node.code}` },
          ...current.auditTrail,
        ],
      };
    });
    audit(`新增 WBS 节点: ${parentId ?? 'root'}`);
  }

  function updateWbsNode(nodeId: string, patch: Partial<PlanningWbsNode>) {
    setModel((current) => ({
      ...current,
      wbs: current.wbs.map((node) => (node.id === nodeId ? { ...node, ...patch } : node)),
      auditTrail: [
        { id: `plan-wbs-edit-${Date.now()}`, at: new Date().toISOString(), actor: 'ProjectPlanningStudio', summary: `编辑 WBS ${nodeId}` },
        ...current.auditTrail,
      ],
    }));
    audit(`编辑 WBS 节点: ${nodeId}`);
  }

  function deleteWbsNode(nodeId: string) {
    const descendantIds = collectWbsDescendantIds(model.wbs, nodeId);
    const ids = new Set([nodeId, ...descendantIds]);
    const fallbackWbsId = model.wbs.find((node) => !ids.has(node.id))?.id ?? '';
    setSelectedWbsId(fallbackWbsId);
    setModel((current) => {
      return {
        ...current,
        wbs: current.wbs.filter((node) => !ids.has(node.id)),
        tasks: current.tasks.map((task) => (ids.has(task.wbsId) ? { ...task, wbsId: fallbackWbsId } : task)),
        auditTrail: [
          { id: `plan-wbs-delete-${Date.now()}`, at: new Date().toISOString(), actor: 'ProjectPlanningStudio', summary: `删除 WBS ${nodeId}` },
          ...current.auditTrail,
        ],
      };
    });
    audit(`删除 WBS 节点: ${nodeId}`);
  }

  function addDiagram() {
    createTemplateDiagram(selectedTemplateId);
  }

  function createTemplateDiagram(templateId: string) {
    const template = planningDiagramTemplates.find((item) => item.id === templateId) ?? selectedTemplate;
    const diagram = createDiagramFromTemplate(templateId, model);
    const diagramId = `${diagram.id}-${Date.now()}`;
    setModel((current) => ({
      ...current,
      diagrams: [
        { ...diagram, id: diagramId, updatedAt: new Date().toISOString() },
        ...current.diagrams,
      ],
    }));
    setSelectedDiagramId(diagramId);
    setSelectedNodeId(diagram.canvas.nodes[0]?.id ?? '');
    audit(`从模板库新增图表: ${template.name}`);
  }

  function updateDiagram(diagramId: string, updater: (diagram: PlanningDiagram) => PlanningDiagram, recordAudit = true) {
    setModel((current) => ({
      ...current,
      diagrams: current.diagrams.map((diagram) => (
        diagram.id === diagramId
          ? {
              ...updater(diagram),
              revision: diagram.revision + 1,
              updatedAt: new Date().toISOString(),
            }
          : diagram
      )),
      auditTrail: recordAudit ? [
        {
          id: `plan-diagram-edit-${Date.now()}`,
          at: new Date().toISOString(),
          actor: 'ProjectPlanningStudio',
          summary: `在线编辑图表 ${diagramId}`,
        },
        ...current.auditTrail,
      ] : current.auditTrail,
    }));
  }

  function updateCanvasNode(diagramId: string, nodeId: string, patch: Partial<PlanningDiagramCanvasNode>, recordAudit = true) {
    updateDiagram(diagramId, (diagram) => ({
      ...diagram,
      canvas: {
        ...diagram.canvas,
        nodes: diagram.canvas.nodes.map((node) => (node.id === nodeId ? { ...node, ...patch } : node)),
      },
    }), recordAudit);
  }

  function addCanvasNode(kind: PlanningDiagramNodeKind) {
    if (!selectedDiagram) return;
    addCanvasNodeToDiagram(selectedDiagram.id, kind);
  }

  function addCanvasNodeToDiagram(diagramId: string, kind: PlanningDiagramNodeKind) {
    const targetDiagram = model.diagrams.find((diagram) => diagram.id === diagramId);
    if (!targetDiagram) return;
    const index = targetDiagram.canvas.nodes.length + 1;
    const node: PlanningDiagramCanvasNode = {
      id: `node-custom-${Date.now()}`,
      kind,
      label: `${nodeKindOptions.find((item) => item.value === kind)?.label ?? '节点'} ${index}`,
      objectRef: null,
      x: 96 + (index % 4) * 185,
      y: 96 + Math.floor(index / 4) * 108,
      width: 172,
      height: 56,
      fill: nodeFill(kind),
      stroke: nodeStroke(kind),
    };
    updateDiagram(targetDiagram.id, (diagram) => ({
      ...diagram,
      canvas: {
        ...diagram.canvas,
        nodes: [...diagram.canvas.nodes, node],
      },
    }));
    setSelectedNodeId(node.id);
    audit(`图表画布新增${nodeKindOptions.find((item) => item.value === kind)?.label ?? kind}节点`);
  }

  function deleteCanvasNode() {
    if (!selectedDiagram || !selectedNode) return;
    deleteCanvasNodeFromDiagram(selectedDiagram.id, selectedNode.id);
  }

  function deleteCanvasNodeFromDiagram(diagramId: string, nodeId: string) {
    const targetDiagram = model.diagrams.find((diagram) => diagram.id === diagramId);
    const targetNode = targetDiagram?.canvas.nodes.find((node) => node.id === nodeId);
    if (!targetDiagram || !targetNode) return;
    updateDiagram(targetDiagram.id, (diagram) => ({
      ...diagram,
      canvas: {
        ...diagram.canvas,
        nodes: diagram.canvas.nodes.filter((node) => node.id !== targetNode.id),
        edges: diagram.canvas.edges.filter((edge) => edge.sourceId !== targetNode.id && edge.targetId !== targetNode.id),
      },
    }));
    const fallback = targetDiagram.canvas.nodes.find((node) => node.id !== targetNode.id);
    setSelectedNodeId(fallback?.id ?? '');
    audit(`图表画布删除节点: ${targetNode.label}`);
  }

  function connectCanvasNode(targetId: string) {
    if (!selectedDiagram || !connectorSourceId || connectorSourceId === targetId) {
      setConnectorSourceId(targetId);
      return;
    }
    connectCanvasNodeInDiagram(selectedDiagram.id, targetId);
  }

  function connectCanvasNodeInDiagram(diagramId: string, targetId: string) {
    if (!connectorSourceId || connectorSourceId === targetId) {
      setConnectorSourceId(targetId);
      return;
    }
    const edge = {
      id: `edge-custom-${Date.now()}`,
      kind: 'flow' as const,
      sourceId: connectorSourceId,
      targetId,
      label: '连线',
    };
    updateDiagram(diagramId, (diagram) => ({
      ...diagram,
      canvas: {
        ...diagram.canvas,
        edges: [...diagram.canvas.edges, edge],
      },
    }));
    setConnectorSourceId('');
    audit('图表画布新增连线');
  }

  function relayoutActiveDiagram() {
    if (!selectedDiagram) return;
    const nextCanvas = createPlanningDiagramCanvas(selectedDiagram.templateId, model);
    updateDiagram(selectedDiagram.id, (diagram) => ({ ...diagram, canvas: nextCanvas }));
    setSelectedNodeId(nextCanvas.nodes[0]?.id ?? '');
    audit(`按模板数据重排图表: ${selectedDiagram.title}`);
  }

  async function exportDiagram(kind: PlanningDiagramExportKind) {
    if (!selectedDiagram) return;
    const exportDiagramModel = isDataChartTemplate(selectedDiagram.templateId)
      ? {
          ...selectedDiagram,
          canvas: createPlanningDiagramCanvas(selectedDiagram.templateId, model),
        }
      : selectedDiagram;
    const pkg = createPlanningDiagramExport(model, exportDiagramModel, kind);
    setExportPreview(pkg);
    await persistCdeFile(pkg.fileName, pkg.content, ['planning-diagram', kind, selectedDiagram.templateId]);
    audit(`导出在线图表 ${pkg.fileName} 并挂接 CDE 文件区`);
  }

  async function exportLiveDiagram(templateId: string, kind: PlanningDiagramExportKind) {
    const persisted = model.diagrams.find((diagram) => diagram.templateId === templateId);
    const diagram = persisted ?? createDiagramFromTemplate(templateId, model);
    const liveDiagram = templateId === 'gantt' || templateId === 'mindmap'
      ? { ...diagram, canvas: createPlanningDiagramCanvas(templateId, model), updatedAt: new Date().toISOString() }
      : diagram;
    const pkg = createPlanningDiagramExport(model, liveDiagram, kind);
    setExportPreview(pkg);
    await persistCdeFile(pkg.fileName, pkg.content, ['planning-diagram', kind, templateId]);
    audit(`导出${liveDiagram.title}: ${pkg.fileName}`);
  }

  async function persistCdeFile(fileName: string, content: string, tags: string[]) {
    try {
      const node = await createModuleFile({
        moduleId: 'planning_management',
        parentId: getModuleRootId('planning_management'),
        name: fileName,
        kind: 'file',
        content,
        sizeBytes: new TextEncoder().encode(content).byteLength,
        owner: '计划工程师',
        tags,
      });
      const event = createModuleAuditEvent('planning-studio-backend-cde', 'BackendModuleFileApiClient', `后端 CDE 已保存 ${node.name}`);
      onAudit?.(event);
    } catch {
      const { auditEvent } = moduleBackendAdapter.createFile({
        moduleId: 'planning_management',
        parentId: getModuleRootId('planning_management'),
        name: fileName,
        type: 'file',
      });
      onAudit?.(auditEvent);
      audit(`后端 CDE 暂不可用,已回落到 session CDE 文件节点: ${fileName}`);
    }
  }

  async function saveVersion() {
    const next = createPlanningVersion(model, 'ProjectPlanningStudio', `${selectedTemplate.name} 与计划数据在线编制保存`);
    setModel(next);
    const fileName = next.versions[0]?.cdeFileName ?? `${next.planId}-${next.currentVersion}.archiplan.json`;
    await persistCdeFile(fileName, JSON.stringify(next, null, 2), ['project-plan-token', 'planning-studio', 'version']);
    audit('保存 Project Plan Token 版本并创建 CDE 文件节点');
  }

  function submitForApproval() {
    setModel((current) => {
      const next = requestPlanningApproval(current, '项目经理');
      const transaction = moduleBackendAdapter.createTransaction({
        moduleId: 'planning_management',
        type: `Project Planning Studio ${next.currentVersion} 审批`,
        relatedArtifactIds: [next.planId, next.currentVersion],
      });
      onAudit?.(transaction.auditEvent);
      const transitioned = moduleBackendAdapter.transitionTransaction(transaction.transaction.id, 'request_approval');
      onAudit?.(transitioned.auditEvent);
      return next;
    });
    audit('Project Plan Token 提交审批');
  }

  function approveAndArchive() {
    setModel((current) => {
      const next = approveAndArchivePlanningVersion(current, '项目负责人');
      const archiveFile = moduleBackendAdapter.createFile({
        moduleId: 'planning_management',
        parentId: getModuleRootId('planning_management'),
        name: `${next.planId}-${next.currentVersion}-approved-archive.zip`,
        type: 'file',
      });
      onAudit?.(archiveFile.auditEvent);
      return next;
    });
    audit('审批通过并归档 Project Plan Token');
  }

  async function exportPlan(kind: 'json' | 'csv' | 'mermaid') {
    const pkg = createPlanningExport(model, kind);
    setExportPreview(pkg);
    await persistCdeFile(pkg.fileName, pkg.content, ['planning-export', kind]);
    audit(`导出 ${pkg.fileName} 并挂接 CDE 文件区`);
  }

  const taskColumns: ColumnsType<PlanningTask> = [
    {
      title: '编码',
      dataIndex: 'code',
      width: 84,
      render: (value: string, record) => (
        <span className="font-mono font-medium text-[var(--arch-primary)]" title={record.title}>
          {value}
        </span>
      ),
    },
    {
      title: '任务',
      dataIndex: 'title',
      render: (value: string, record) => (
        <Input
          value={value}
          onChange={(event) => updateTask(record.id, { title: event.target.value })}
          variant="borderless"
        />
      ),
    },
    {
      title: '负责人',
      dataIndex: 'owner',
      width: 130,
      render: (value: string, record) => (
        <Input value={value} onChange={(event) => updateTask(record.id, { owner: event.target.value })} variant="borderless" />
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 126,
      render: (value: PlanningTaskStatus, record) => (
        <Select value={value} options={taskStatusOptions} onChange={(status) => updateTask(record.id, { status })} className="w-full" />
      ),
    },
    {
      title: 'WBS',
      dataIndex: 'wbsId',
      width: 170,
      render: (value: string, record) => (
        <Select
          value={value}
          options={model.wbs.map((wbs) => ({ value: wbs.id, label: `${wbs.code} ${wbs.title}` }))}
          onChange={(wbsId) => updateTask(record.id, { wbsId })}
          className="w-full"
        />
      ),
    },
    {
      title: '起止',
      key: 'date-range',
      width: 220,
      render: (_, record) => (
        <div className="grid grid-cols-2 gap-1">
          <Input value={record.start} onChange={(event) => updateTask(record.id, { start: event.target.value })} variant="borderless" />
          <Input value={record.end} onChange={(event) => updateTask(record.id, { end: event.target.value })} variant="borderless" />
        </div>
      ),
    },
    {
      title: '依赖',
      dataIndex: 'dependencies',
      width: 180,
      render: (value: string[], record) => (
        <Input
          value={value.join(',')}
          onChange={(event) => updateTask(record.id, {
            dependencies: event.target.value
              .split(',')
              .map((item) => item.trim())
              .filter((item) => item && item !== record.id),
          })}
          variant="borderless"
        />
      ),
    },
    {
      title: '进度',
      dataIndex: 'progress',
      width: 180,
      render: (value: number, record) => (
        <Slider value={value} onChange={(progress) => updateTask(record.id, { progress })} />
      ),
    },
  ];

  function renderWorkspacePanel(tab: PlanningWorkspaceTab) {
    switch (tab) {
      case 'gantt-authoring':
        return (
          <GanttAuthoringPanel
            diagram={ganttDiagram}
            tasks={model.tasks}
            onUpdateTask={updateTask}
            onAddTask={addTask}
            onDeleteTask={deleteTask}
            onExport={(kind) => exportLiveDiagram('gantt', kind)}
          />
        );
      case 'flow-authoring':
        return flowchartDiagram ? (
          <DiagramEditor
            diagrams={[flowchartDiagram]}
            selectedDiagram={flowchartDiagram}
            selectedNode={flowchartNode}
            tasks={model.tasks}
            resources={model.resources}
            resourceLoads={resourceHistogram}
            connectorSourceId={connectorSourceId}
            onSelectDiagram={() => null}
            onSelectNode={setSelectedNodeId}
            onMoveNode={(nodeId, x, y) => updateCanvasNode(flowchartDiagram.id, nodeId, { x, y }, false)}
            onPatchNode={(nodeId, patch) => updateCanvasNode(flowchartDiagram.id, nodeId, patch)}
            onUpdateTask={updateTask}
            onAddNode={(kind) => addCanvasNodeToDiagram(flowchartDiagram.id, kind)}
            onDeleteNode={() => flowchartNode ? deleteCanvasNodeFromDiagram(flowchartDiagram.id, flowchartNode.id) : null}
            onConnectNode={(targetId) => connectCanvasNodeInDiagram(flowchartDiagram.id, targetId)}
            onSetConnectorSource={setConnectorSourceId}
            onRelayout={() => {
              const nextCanvas = createPlanningDiagramCanvas('flowchart', model);
              updateDiagram(flowchartDiagram.id, (diagram) => ({ ...diagram, canvas: nextCanvas }));
            }}
            onExport={(kind) => exportLiveDiagram('flowchart', kind)}
          />
        ) : (
          <section className="arch-card rounded-lg p-3">
            <Button type="primary" onClick={() => createTemplateDiagram('flowchart')}>创建流程图</Button>
          </section>
        );
      case 'mind-authoring':
        return (
          <MindMapAuthoringPanel
            wbs={model.wbs}
            selectedWbsId={selectedWbsId}
            onSelectWbs={setSelectedWbsId}
            onAddChild={addWbsNode}
            onUpdateWbs={updateWbsNode}
            onDeleteWbs={deleteWbsNode}
            onExport={(kind) => exportLiveDiagram('mindmap', kind)}
          />
        );
      case 'visual':
        return (
          <DiagramEditor
            diagrams={model.diagrams}
            selectedDiagram={selectedDiagram}
            selectedNode={selectedNode}
            tasks={model.tasks}
            resources={model.resources}
            resourceLoads={resourceHistogram}
            connectorSourceId={connectorSourceId}
            onSelectDiagram={(diagramId) => {
              const next = model.diagrams.find((diagram) => diagram.id === diagramId);
              setSelectedDiagramId(diagramId);
              setSelectedNodeId(next?.canvas.nodes[0]?.id ?? '');
              setConnectorSourceId('');
            }}
            onSelectNode={setSelectedNodeId}
            onMoveNode={(nodeId, x, y) => selectedDiagram ? updateCanvasNode(selectedDiagram.id, nodeId, { x, y }, false) : null}
            onPatchNode={(nodeId, patch) => selectedDiagram ? updateCanvasNode(selectedDiagram.id, nodeId, patch) : null}
            onUpdateTask={updateTask}
            onAddNode={addCanvasNode}
            onDeleteNode={deleteCanvasNode}
            onConnectNode={connectCanvasNode}
            onSetConnectorSource={setConnectorSourceId}
            onRelayout={relayoutActiveDiagram}
            onExport={exportDiagram}
          />
        );
      case 'tasks':
        return (
          <section className="arch-card rounded-lg p-3">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="arch-primary-text arch-module-eyebrow font-medium">工作项</p>
                <h3 className="arch-module-section-title arch-text font-medium">任务、WBS、依赖和进度在线编制</h3>
              </div>
              <Button type="primary" icon={<NodeIndexOutlined />} onClick={addTask}>新增任务</Button>
            </div>
            <Table
              rowKey="id"
              size="small"
              columns={taskColumns}
              dataSource={model.tasks}
              pagination={false}
              scroll={{ x: 1240 }}
            />
          </section>
        );
      case 'feedback':
        return (
          <ProgressFeedbackPanel
            model={model}
            analytics={analytics}
            selectedTaskId={feedbackTaskId}
            feedbackProgress={feedbackProgress}
            feedbackNote={feedbackNote}
            onSelectTask={selectFeedbackTask}
            onChangeProgress={setFeedbackProgress}
            onChangeNote={setFeedbackNote}
            onSubmitFeedback={submitProgressFeedback}
            onQuickFeedback={quickTaskFeedback}
          />
        );
      case 'analytics':
        return (
          <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_430px]">
            <PlanningAnalyticsPanel model={model} analytics={analytics} />
            <div className="grid gap-3">
              <ScheduleAlertPanel alerts={alerts} />
              <ScheduleAdjustmentPanel
                model={model}
                selectedTaskId={adjustTaskId}
                shiftDays={adjustShiftDays}
                reason={adjustReason}
                includeSuccessors={adjustWithSuccessors}
                onSelectTask={setAdjustTaskId}
                onChangeShiftDays={setAdjustShiftDays}
                onChangeReason={setAdjustReason}
                onChangeIncludeSuccessors={setAdjustWithSuccessors}
                onApply={runScheduleAdjustment}
              />
            </div>
          </div>
        );
      case 'board':
        return (
          <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_420px]">
            <KanbanBoard columns={kanbanColumns} />
            <RaciMatrix model={model} />
          </div>
        );
      case 'export':
        return (
          <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_420px]">
            <ExportPanel
              exportPreview={exportPreview}
              mermaid={toMermaidGantt(model)}
              onExport={exportPlan}
            />
            <AiAdvisorPanel advice={aiAdvice} />
          </div>
        );
      default:
        return null;
    }
  }

  return (
    <section className="grid gap-4 px-1 py-1" style={{ width: 'min(100%, calc(100vw - 330px))' }}>
      <header className="grid gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="arch-primary-text arch-module-eyebrow font-mono font-medium">PROJECT PLANNING STUDIO</p>
            <h2 className="arch-module-home-title arch-text mt-1 font-medium">计划管理 · 在线编制与审批归档闭环</h2>
            <p className="arch-module-description arch-muted mt-2 max-w-5xl">
              统一任务、WBS、里程碑、资源、风险和 RACI 数据模型;借鉴 Plane 的 work items / cycles / roadmaps / docs / triage 产品结构,用 PanUI、React Flow、D3、Mermaid 和 BPMN 适配路线承载项目管理图表。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Tooltip title="保存 Project Plan Token 版本并写入 CDE 文件节点">
              <Button type="primary" icon={<SaveOutlined />} onClick={saveVersion}>保存版本</Button>
            </Tooltip>
            <Button icon={<AuditOutlined />} onClick={submitForApproval}>提交审批</Button>
            <Button icon={<CheckCircleOutlined />} onClick={approveAndArchive}>审批归档</Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-x-5 gap-y-2 border-b border-[var(--arch-border)] pb-3">
          <Metric title="任务" value={summary.taskCount} suffix="项" />
          <Metric title="WBS" value={summary.wbsCount} suffix="个" />
          <Metric title="平均进度" value={summary.averageProgress} suffix="%" />
          <Metric title="计划应达" value={summary.plannedProgress} suffix="%" danger={summary.schedulePerformanceIndex < 0.9} />
          <Metric title="预警" value={summary.alertCount} suffix="条" danger={summary.alertCount > 0} />
          <Metric title="高风险" value={summary.criticalRiskCount} suffix="条" danger={summary.criticalRiskCount > 0} />
        </div>
      </header>

      <div className="grid min-w-0 max-w-full gap-3 overflow-hidden">
        <main className="grid min-w-0 max-w-full gap-3 overflow-hidden">
          <section className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--arch-border)] pb-3">
            <div className="min-w-0">
              <p className="arch-primary-text arch-module-eyebrow font-medium">图表模板库</p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <h3 className="arch-module-section-title arch-text font-medium">{selectedTemplate.name}</h3>
                <Tag color="green">{familyLabels[selectedTemplate.family]}</Tag>
                <Tag>{selectedTemplate.engine}</Tag>
                <Tag>{selectedTemplate.openSourceRoute}</Tag>
              </div>
              <p className="arch-module-description arch-muted mt-1">{selectedTemplate.purpose}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Select
                value={selectedTemplateId}
                onChange={setSelectedTemplateId}
                showSearch
                optionFilterProp="label"
                className="min-w-72"
                options={planningDiagramTemplates.map((template) => ({
                  value: template.id,
                  label: `${template.name} · ${familyLabels[template.family]}`,
                }))}
              />
              <Button icon={<AppstoreOutlined />} onClick={addDiagram}>加入画布</Button>
            </div>
          </section>

          <section className="grid min-w-0 max-w-full gap-3 overflow-hidden">
            <div className="arch-planning-entry-grid">
              {planningPrimaryEntries.map((entry) => (
                <PlanningWorkflowEntryCard
                  key={entry.key}
                  icon={planningEntryIcon(entry.key)}
                  title={entry.title}
                  description={entry.description}
                  active={activeWorkspaceTab === entry.key}
                  onClick={() => setActiveWorkspaceTab(entry.key)}
                />
              ))}
            </div>
            <div className="flex flex-wrap gap-2 border-b border-[var(--arch-border)] pb-3">
              {planningSecondaryTabs.map((tab) => (
                <Button
                  key={tab.key}
                  type={activeWorkspaceTab === tab.key ? 'primary' : 'text'}
                  onClick={() => setActiveWorkspaceTab(tab.key)}
                >
                  {tab.label}
                </Button>
              ))}
            </div>
            {renderWorkspacePanel(activeWorkspaceTab)}
          </section>
        </main>
      </div>
    </section>
  );
}

function PlanningWorkflowEntryCard({
  icon,
  title,
  description,
  active,
  onClick,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`arch-huly-entry-card ${active ? 'is-active' : ''}`}
    >
      <span className="arch-huly-entry-icon">{icon}</span>
      <span className="arch-huly-entry-text">
        <strong>{title}</strong>
        <small>{description}</small>
      </span>
    </button>
  );
}

function planningEntryIcon(tab: PlanningWorkspaceTab) {
  switch (tab) {
    case 'gantt-authoring':
      return <NodeIndexOutlined />;
    case 'flow-authoring':
      return <ForkOutlined />;
    case 'mind-authoring':
      return <AppstoreOutlined />;
    case 'analytics':
      return <WarningOutlined />;
    default:
      return <AppstoreOutlined />;
  }
}

function Metric({ title, value, suffix, danger = false }: { title: string; value: number; suffix: string; danger?: boolean }) {
  return (
    <span className="inline-flex items-baseline gap-1 arch-type-caption">
      <span className="arch-muted font-medium">{title}</span>
      <strong className={danger ? 'text-red-600' : 'arch-primary-text'}>{value}</strong>
      <span className={danger ? 'text-red-600' : 'arch-muted'}>{suffix}</span>
    </span>
  );
}

function GanttAuthoringPanel({
  diagram,
  tasks,
  onUpdateTask,
  onAddTask,
  onDeleteTask,
  onExport,
}: {
  diagram: PlanningDiagram | null;
  tasks: PlanningTask[];
  onUpdateTask: (taskId: string, patch: Partial<PlanningTask>) => void;
  onAddTask: () => void;
  onDeleteTask: (taskId: string) => void;
  onExport: (kind: PlanningDiagramExportKind) => void;
}) {
  if (!diagram) {
    return (
      <section className="arch-card rounded-lg p-3">
        <Alert type="warning" showIcon message="甘特图模板未初始化,请保存计划后重新进入。" />
      </section>
    );
  }

  return (
    <div className="grid gap-3">
      <section className="arch-card rounded-lg p-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="arch-primary-text arch-module-eyebrow font-medium">进度计划在线编制</p>
            <h3 className="arch-module-section-title arch-text font-medium">甘特图任务、工期、依赖和进度</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="primary" icon={<PlusCircleOutlined />} onClick={onAddTask}>新增任务</Button>
            <Button onClick={() => onExport('svg')}>导出 SVG</Button>
            <Button onClick={() => onExport('drawio')}>导出 draw.io</Button>
          </div>
        </div>
        <div className="mt-3 grid gap-2">
          {tasks.map((task) => (
            <div key={task.id} className="grid items-center gap-2 rounded-md border border-[var(--arch-border)] p-2 lg:grid-cols-[92px_minmax(0,1.2fr)_120px_118px_118px_170px_120px_72px]">
              <span className="font-mono text-[var(--arch-primary)]">{task.code}</span>
              <Input value={task.title} onChange={(event) => onUpdateTask(task.id, { title: event.target.value })} />
              <Input value={task.owner} onChange={(event) => onUpdateTask(task.id, { owner: event.target.value })} />
              <Input value={task.start} onChange={(event) => onUpdateTask(task.id, { start: event.target.value })} />
              <Input value={task.end} onChange={(event) => onUpdateTask(task.id, { end: event.target.value })} />
              <Input
                value={task.dependencies.join(',')}
                onChange={(event) => onUpdateTask(task.id, {
                  dependencies: event.target.value
                    .split(',')
                    .map((item) => item.trim())
                    .filter((item) => item && item !== task.id),
                })}
              />
              <Select value={task.status} options={taskStatusOptions} onChange={(status) => onUpdateTask(task.id, { status })} />
              <Button danger size="small" icon={<DeleteOutlined />} onClick={() => onDeleteTask(task.id)}>删除</Button>
              <div className="lg:col-span-8">
                <Slider value={task.progress} onChange={(progress) => onUpdateTask(task.id, { progress })} />
              </div>
            </div>
          ))}
        </div>
      </section>

      <GanttDiagramEditor
        diagrams={[diagram]}
        selectedDiagram={diagram}
        tasks={tasks}
        onSelectDiagram={() => null}
        onUpdateTask={onUpdateTask}
        onRelayout={() => null}
        onExport={onExport}
      />
    </div>
  );
}

function MindMapAuthoringPanel({
  wbs,
  selectedWbsId,
  onSelectWbs,
  onAddChild,
  onUpdateWbs,
  onDeleteWbs,
  onExport,
}: {
  wbs: PlanningWbsNode[];
  selectedWbsId: string;
  onSelectWbs: (nodeId: string) => void;
  onAddChild: (parentId: string | null) => void;
  onUpdateWbs: (nodeId: string, patch: Partial<PlanningWbsNode>) => void;
  onDeleteWbs: (nodeId: string) => void;
  onExport: (kind: PlanningDiagramExportKind) => void;
}) {
  const layout = createMindMapLayout(wbs);
  const selected = wbs.find((node) => node.id === selectedWbsId) ?? wbs[0] ?? null;

  return (
    <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_360px]">
      <section className="arch-card rounded-lg p-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="arch-primary-text arch-module-eyebrow font-medium">思维导图在线编制</p>
            <h3 className="arch-module-section-title arch-text font-medium">WBS 结构、交付物和责任人</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="primary" icon={<PlusCircleOutlined />} onClick={() => onAddChild(null)}>新增根节点</Button>
            <Button onClick={() => onExport('svg')}>导出 SVG</Button>
            <Button onClick={() => onExport('drawio')}>导出 draw.io</Button>
          </div>
        </div>
        <div className="mt-3 overflow-auto rounded-md border border-[var(--arch-border)] bg-[var(--arch-surface-muted)]">
          <svg width={layout.width} height={layout.height} viewBox={`0 0 ${layout.width} ${layout.height}`} role="img" aria-label="WBS 思维导图在线编制" className="block">
            <rect width="100%" height="100%" fill="#f8fafc" />
            {layout.edges.map((edge) => (
              <path
                key={`${edge.source.id}-${edge.target.id}`}
                d={`M ${edge.source.x + edge.source.width} ${edge.source.y + edge.source.height / 2} C ${edge.source.x + edge.source.width + 70} ${edge.source.y + edge.source.height / 2}, ${edge.target.x - 70} ${edge.target.y + edge.target.height / 2}, ${edge.target.x} ${edge.target.y + edge.target.height / 2}`}
                fill="none"
                stroke="#94a3b8"
                strokeWidth="1.5"
              />
            ))}
            {layout.nodes.map((item) => (
              <g key={item.node.id} role="button" tabIndex={0} transform={`translate(${item.x},${item.y})`} className="cursor-pointer" onClick={() => onSelectWbs(item.node.id)}>
                <rect
                  width={item.width}
                  height={item.height}
                  rx="8"
                  fill={item.node.id === selected?.id ? '#dcfce7' : '#ffffff'}
                  stroke={item.node.id === selected?.id ? '#0f9d58' : '#cbd5e1'}
                  strokeWidth={item.node.id === selected?.id ? 2 : 1.2}
                />
                <text x="14" y="23" className="fill-slate-900 text-[12px] font-medium">{item.node.code} · {truncateText(item.node.title, 20)}</text>
                <text x="14" y="44" className="fill-slate-500 text-[10px]">{truncateText(item.node.deliverable, 26)}</text>
              </g>
            ))}
          </svg>
        </div>
      </section>

      <aside className="arch-card rounded-lg p-3">
        <p className="arch-primary-text arch-module-eyebrow font-medium">节点属性</p>
        {selected ? (
          <div className="mt-3 grid gap-2">
            <Input value={selected.code} onChange={(event) => onUpdateWbs(selected.id, { code: event.target.value })} />
            <Input value={selected.title} onChange={(event) => onUpdateWbs(selected.id, { title: event.target.value })} />
            <Input value={selected.owner} onChange={(event) => onUpdateWbs(selected.id, { owner: event.target.value })} />
            <Input value={selected.deliverable} onChange={(event) => onUpdateWbs(selected.id, { deliverable: event.target.value })} />
            <Select
              value={selected.parentId ?? '__root__'}
              options={[
                { value: '__root__', label: '根节点' },
                ...wbs
                  .filter((node) => node.id !== selected.id && !collectWbsDescendantIds(wbs, selected.id).includes(node.id))
                  .map((node) => ({ value: node.id, label: `${node.code} ${node.title}` })),
              ]}
              onChange={(parentId) => onUpdateWbs(selected.id, { parentId: parentId === '__root__' ? null : parentId })}
            />
            <div className="grid grid-cols-2 gap-2">
              <Button type="primary" onClick={() => onAddChild(selected.id)}>新增子节点</Button>
              <Button onClick={() => onAddChild(selected.parentId)}>新增同级</Button>
            </div>
            <Button danger icon={<DeleteOutlined />} disabled={wbs.length <= 1} onClick={() => onDeleteWbs(selected.id)}>删除节点</Button>
          </div>
        ) : (
          <p className="arch-muted mt-2 arch-type-caption">暂无 WBS 节点。</p>
        )}
      </aside>
    </div>
  );
}

function ProgressFeedbackPanel({
  model,
  analytics,
  selectedTaskId,
  feedbackProgress,
  feedbackNote,
  onSelectTask,
  onChangeProgress,
  onChangeNote,
  onSubmitFeedback,
  onQuickFeedback,
}: {
  model: ReturnType<typeof createDefaultProjectPlanningModel>;
  analytics: ReturnType<typeof derivePlanningAnalytics>;
  selectedTaskId: string;
  feedbackProgress: number;
  feedbackNote: string;
  onSelectTask: (taskId: string) => void;
  onChangeProgress: (progress: number) => void;
  onChangeNote: (note: string) => void;
  onSubmitFeedback: (taskStatus?: PlanningTaskStatus) => void;
  onQuickFeedback: (task: PlanningTask, progress: number, taskStatus?: PlanningTaskStatus) => void;
}) {
  const selectedTask = model.tasks.find((task) => task.id === selectedTaskId) ?? model.tasks[0] ?? null;

  return (
    <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_420px]">
      <section className="arch-card rounded-lg p-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="arch-primary-text arch-module-eyebrow font-medium">进度反馈与任务状态</p>
            <h3 className="arch-module-section-title arch-text font-medium">按任务登记实际进度、阻断和完成状态</h3>
          </div>
          <Tag color={analytics.schedulePerformanceIndex < 0.9 ? 'red' : 'green'}>
            SPI {analytics.schedulePerformanceIndex}
          </Tag>
        </div>
        <div className="mt-3 grid gap-2">
          {model.tasks.map((task) => {
            const planned = deriveTaskPlannedProgress(task, model.dataDate);
            const lag = planned - task.progress;
            return (
              <div key={task.id} className="rounded-md border border-[var(--arch-border)] p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="arch-text truncate arch-type-list font-medium">{task.code} · {task.title}</p>
                    <p className="arch-muted mt-1 arch-type-caption">
                      {task.owner} · {task.start} 至 {task.end} · 计划应达 {planned}%
                    </p>
                  </div>
                  <Tag color={taskStatusColor(task.status)}>{taskStatusOptions.find((item) => item.value === task.status)?.label}</Tag>
                </div>
                <div className="mt-2 grid gap-2 md:grid-cols-[minmax(0,1fr)_220px] md:items-center">
                  <Progress percent={task.progress} size="small" status={task.status === 'blocked' ? 'exception' : lag >= 25 ? 'active' : 'normal'} />
                  <div className="flex flex-wrap justify-end gap-1.5">
                    <Button size="small" onClick={() => onQuickFeedback(task, Math.min(100, task.progress + 10))}>+10%</Button>
                    <Button size="small" onClick={() => onQuickFeedback(task, 100, 'done')}>完成</Button>
                    <Button size="small" danger onClick={() => onQuickFeedback(task, task.progress, 'blocked')}>阻断</Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <aside className="grid gap-3">
        <section className="arch-card rounded-lg p-3">
          <p className="arch-primary-text arch-module-eyebrow font-medium">登记反馈</p>
          <div className="mt-3 grid gap-3">
            <Select
              value={selectedTask?.id ?? ''}
              options={model.tasks.map((task) => ({ value: task.id, label: `${task.code} ${task.title}` }))}
              onChange={onSelectTask}
            />
            <Slider value={feedbackProgress} onChange={onChangeProgress} />
            <Input.TextArea rows={4} value={feedbackNote} onChange={(event) => onChangeNote(event.target.value)} />
            <div className="grid grid-cols-3 gap-2">
              <Button type="primary" onClick={() => onSubmitFeedback()}>登记</Button>
              <Button onClick={() => onSubmitFeedback('review')}>送审</Button>
              <Button danger onClick={() => onSubmitFeedback('blocked')}>阻断</Button>
            </div>
          </div>
        </section>

        <section className="arch-card rounded-lg p-3">
          <p className="arch-primary-text arch-module-eyebrow font-medium">反馈记录</p>
          <div className="mt-2 grid gap-2">
            {model.progressFeedback.slice(0, 5).map((feedback) => {
              const task = model.tasks.find((item) => item.id === feedback.taskId);
              return (
                <div key={feedback.id} className="arch-card-muted rounded-md p-2">
                  <p className="arch-text arch-type-list font-medium">{task?.code ?? feedback.taskId} · {feedback.progress}%</p>
                  <p className="arch-muted mt-1 arch-type-caption">{feedback.reporter} · {feedback.reportedAt.slice(0, 10)} · {feedback.status}</p>
                  <p className="arch-muted mt-1 arch-type-caption leading-5">{feedback.note}</p>
                </div>
              );
            })}
          </div>
        </section>
      </aside>
    </div>
  );
}

function PlanningAnalyticsPanel({
  model,
  analytics,
}: {
  model: ReturnType<typeof createDefaultProjectPlanningModel>;
  analytics: ReturnType<typeof derivePlanningAnalytics>;
}) {
  return (
    <section className="arch-card rounded-lg p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="arch-primary-text arch-module-eyebrow font-medium">图表分析</p>
          <h3 className="arch-module-section-title arch-text font-medium">计划 / 实际 S 曲线与履约指标</h3>
          <p className="arch-muted mt-1 arch-type-caption">数据日期 {analytics.dataDate} · 预测完成 {analytics.forecastFinish}</p>
        </div>
        <Tag color={analytics.schedulePerformanceIndex < 0.9 ? 'red' : 'green'}>
          SPI {analytics.schedulePerformanceIndex}
        </Tag>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-4">
        <Metric title="计划进度" value={analytics.plannedProgress} suffix="%" danger={analytics.schedulePerformanceIndex < 0.9} />
        <Metric title="实际进度" value={analytics.actualProgress} suffix="%" danger={analytics.actualProgress < analytics.plannedProgress} />
        <Metric title="落后任务" value={analytics.delayedTaskCount} suffix="项" danger={analytics.delayedTaskCount > 0} />
        <Metric title="临期任务" value={analytics.dueSoonTaskCount} suffix="项" danger={analytics.dueSoonTaskCount > 0} />
      </div>
      <ProgressCurveSvg model={model} />
      <div className="mt-3 grid gap-2 md:grid-cols-3">
        <Alert className="arch-huly-alert" type={analytics.overdueTaskCount > 0 ? 'warning' : 'success'} showIcon message={`逾期任务 ${analytics.overdueTaskCount} 项`} />
        <Alert className="arch-huly-alert" type={analytics.blockedTaskCount > 0 ? 'error' : 'success'} showIcon message={`阻断任务 ${analytics.blockedTaskCount} 项`} />
        <Alert className="arch-huly-alert" type={analytics.adjustmentCount > 0 ? 'info' : 'success'} showIcon message={`计划调整 ${analytics.adjustmentCount} 次`} />
      </div>
    </section>
  );
}

function ScheduleAlertPanel({ alerts }: { alerts: PlanningScheduleAlert[] }) {
  return (
    <section className="arch-card rounded-lg p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="arch-primary-text arch-module-eyebrow font-medium">进度预警</p>
        <Tag color={alerts.length > 0 ? 'red' : 'green'}>{alerts.length} 条</Tag>
      </div>
      <div className="mt-3 grid max-h-[360px] gap-2 overflow-auto pr-1">
        {alerts.length === 0 ? (
          <Alert className="arch-huly-alert" type="success" showIcon message="当前没有进度预警。" />
        ) : alerts.map((alert) => (
          <div key={alert.id} className="rounded-md border border-[var(--arch-border)] p-3">
            <Tag color={alertSeverityColor(alert.severity)}>{alert.severity}</Tag>
            <Tag>{alert.category}</Tag>
            <p className="arch-text mt-2 arch-type-list font-medium">{alert.title}</p>
            <p className="arch-muted mt-1 arch-type-caption leading-5">{alert.message}</p>
            <p className="arch-muted mt-1 arch-type-caption leading-5">{alert.recommendation}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function ScheduleAdjustmentPanel({
  model,
  selectedTaskId,
  shiftDays,
  reason,
  includeSuccessors,
  onSelectTask,
  onChangeShiftDays,
  onChangeReason,
  onChangeIncludeSuccessors,
  onApply,
}: {
  model: ReturnType<typeof createDefaultProjectPlanningModel>;
  selectedTaskId: string;
  shiftDays: number;
  reason: string;
  includeSuccessors: 'yes' | 'no';
  onSelectTask: (taskId: string) => void;
  onChangeShiftDays: (days: number) => void;
  onChangeReason: (reason: string) => void;
  onChangeIncludeSuccessors: (value: 'yes' | 'no') => void;
  onApply: () => void;
}) {
  return (
    <section className="arch-card rounded-lg p-3">
      <p className="arch-primary-text arch-module-eyebrow font-medium">进度调整</p>
      <div className="mt-3 grid gap-3">
        <Select
          value={selectedTaskId}
          options={model.tasks.map((task) => ({ value: task.id, label: `${task.code} ${task.title}` }))}
          onChange={onSelectTask}
        />
        <div className="grid grid-cols-[120px_minmax(0,1fr)] gap-2">
          <InputNumber value={shiftDays} min={-30} max={30} onChange={(value) => onChangeShiftDays(Number(value ?? 0))} className="w-full" />
          <Select
            value={includeSuccessors}
            options={[
              { value: 'yes', label: '联动后续依赖任务' },
              { value: 'no', label: '仅调整当前任务' },
            ]}
            onChange={onChangeIncludeSuccessors}
          />
        </div>
        <Input.TextArea rows={3} value={reason} onChange={(event) => onChangeReason(event.target.value)} />
        <Button type="primary" icon={<ForkOutlined />} onClick={onApply}>应用调整</Button>
      </div>
      <div className="mt-3 grid gap-2">
        {model.adjustments.slice(0, 4).map((adjustment) => (
          <div key={adjustment.id} className="arch-card-muted rounded-md p-2">
            <p className="arch-text arch-type-list font-medium">{adjustment.summary}</p>
            <p className="arch-muted mt-1 arch-type-caption">{adjustment.actor} · {adjustment.createdAt.slice(0, 10)} · {adjustment.status}</p>
            <p className="arch-muted mt-1 arch-type-caption leading-5">{adjustment.reason}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function ProgressCurveSvg({ model }: { model: ReturnType<typeof createDefaultProjectPlanningModel> }) {
  const chartStart = minTaskDate(model.tasks, 'start') ?? model.dataDate;
  const chartEnd = maxTaskDate(model.tasks, 'end') ?? model.dataDate;
  const totalDays = Math.max(1, chartDaysBetween(chartStart, chartEnd) + 1);
  const dataDay = Math.max(0, Math.min(totalDays, chartDaysBetween(chartStart, model.dataDate)));
  const width = 980;
  const height = 280;
  const left = 58;
  const right = 28;
  const top = 24;
  const bottom = 42;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const step = Math.max(1, Math.ceil(totalDays / 10));
  const ticks = createDateTicks(chartStart, totalDays, step).slice(0, 12);
  const averageActual = model.tasks.length
    ? model.tasks.reduce((sum, task) => sum + task.progress, 0) / model.tasks.length
    : 0;
  const plannedPoints = ticks.map((date) => {
    const progress = model.tasks.length
      ? model.tasks.reduce((sum, task) => sum + deriveTaskPlannedProgress(task, date), 0) / model.tasks.length
      : 0;
    return pointFor(date, progress);
  });
  const actualPoints = ticks
    .filter((date) => chartDaysBetween(chartStart, date) <= dataDay)
    .map((date) => {
      const day = chartDaysBetween(chartStart, date);
      const progress = dataDay > 0 ? averageActual * Math.min(1, day / dataDay) : averageActual;
      return pointFor(date, progress);
    });

  function pointFor(date: string, progress: number): string {
    const x = left + chartDaysBetween(chartStart, date) / totalDays * plotWidth;
    const y = top + (100 - progress) / 100 * plotHeight;
    return `${Math.round(x)},${Math.round(y)}`;
  }

  return (
    <div className="mt-3 overflow-auto rounded-md border border-[var(--arch-border)] bg-[var(--arch-surface-muted)]">
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="计划实际进度 S 曲线">
        <rect width="100%" height="100%" fill="#f8fafc" />
        {[0, 25, 50, 75, 100].map((tick) => {
          const y = top + (100 - tick) / 100 * plotHeight;
          return (
            <g key={tick}>
              <line x1={left} y1={y} x2={width - right} y2={y} stroke="rgba(100,116,139,0.18)" />
              <text x="18" y={y + 4} className="fill-slate-500 text-[10px]">{tick}%</text>
            </g>
          );
        })}
        {ticks.map((tick) => {
          const x = left + chartDaysBetween(chartStart, tick) / totalDays * plotWidth;
          return (
            <g key={tick}>
              <line x1={x} y1={top} x2={x} y2={height - bottom} stroke="rgba(100,116,139,0.12)" />
              <text x={x} y={height - 16} textAnchor="middle" className="fill-slate-500 font-mono text-[10px]">{tick.slice(5)}</text>
            </g>
          );
        })}
        <polyline points={plannedPoints.join(' ')} fill="none" stroke="#4285f4" strokeWidth="2.5" />
        <polyline points={actualPoints.join(' ')} fill="none" stroke="#0f9d58" strokeWidth="2.5" strokeDasharray="6 4" />
        <circle cx={left + dataDay / totalDays * plotWidth} cy={top + (100 - averageActual) / 100 * plotHeight} r="5" fill="#0f9d58" />
        <text x={left} y="18" className="fill-slate-600 text-[11px]">蓝线: 计划 · 绿线: 反馈实际</text>
      </svg>
    </div>
  );
}

function DiagramEditor({
  diagrams,
  selectedDiagram,
  selectedNode,
  tasks,
  resources,
  resourceLoads,
  connectorSourceId,
  onSelectDiagram,
  onSelectNode,
  onMoveNode,
  onPatchNode,
  onUpdateTask,
  onAddNode,
  onDeleteNode,
  onConnectNode,
  onSetConnectorSource,
  onRelayout,
  onExport,
}: {
  diagrams: PlanningDiagram[];
  selectedDiagram: PlanningDiagram | null;
  selectedNode: PlanningDiagramCanvasNode | null;
  tasks: PlanningTask[];
  resources: PlanningResource[];
  resourceLoads: Array<{ resourceId: string; name: string; load: number; capacity: number }>;
  connectorSourceId: string;
  onSelectDiagram: (diagramId: string) => void;
  onSelectNode: (nodeId: string) => void;
  onMoveNode: (nodeId: string, x: number, y: number) => void;
  onPatchNode: (nodeId: string, patch: Partial<PlanningDiagramCanvasNode>) => void;
  onUpdateTask: (taskId: string, patch: Partial<PlanningTask>) => void;
  onAddNode: (kind: PlanningDiagramNodeKind) => void;
  onDeleteNode: () => void;
  onConnectNode: (targetId: string) => void;
  onSetConnectorSource: (nodeId: string) => void;
  onRelayout: () => void;
  onExport: (kind: PlanningDiagramExportKind) => void;
}) {
  const [drag, setDrag] = useState<{ nodeId: string; clientX: number; clientY: number } | null>(null);

  if (!selectedDiagram) {
    return (
      <section className="arch-card rounded-lg p-3">
        <p className="arch-muted arch-type-caption">暂无图表,请从模板库加入画布。</p>
      </section>
    );
  }

  function handleNodePointerDown(event: ReactPointerEvent<SVGGElement>, node: PlanningDiagramCanvasNode) {
    event.preventDefault();
    event.stopPropagation();
    onSelectNode(node.id);
    if (connectorSourceId && connectorSourceId !== node.id) {
      onConnectNode(node.id);
      return;
    }
    setDrag({ nodeId: node.id, clientX: event.clientX, clientY: event.clientY });
  }

  function handleCanvasPointerMove(event: ReactPointerEvent<SVGSVGElement>) {
    if (!drag) return;
    if (!selectedDiagram) return;
    const node = selectedDiagram.canvas.nodes.find((item) => item.id === drag.nodeId);
    if (!node) return;
    const nextX = Math.max(20, node.x + event.clientX - drag.clientX);
    const nextY = Math.max(20, node.y + event.clientY - drag.clientY);
    onMoveNode(node.id, Math.round(nextX), Math.round(nextY));
    setDrag({ nodeId: node.id, clientX: event.clientX, clientY: event.clientY });
  }

  if (selectedDiagram.templateId === 'gantt') {
    return (
      <GanttDiagramEditor
        diagrams={diagrams}
        selectedDiagram={selectedDiagram}
        tasks={tasks}
        onSelectDiagram={onSelectDiagram}
        onUpdateTask={onUpdateTask}
        onRelayout={onRelayout}
        onExport={onExport}
      />
    );
  }

  if (selectedDiagram.templateId === 'resource-histogram') {
    return (
      <ResourceHistogramDiagramEditor
        diagrams={diagrams}
        selectedDiagram={selectedDiagram}
        tasks={tasks}
        resources={resources}
        resourceLoads={resourceLoads}
        onSelectDiagram={onSelectDiagram}
        onUpdateTask={onUpdateTask}
        onRelayout={onRelayout}
        onExport={onExport}
      />
    );
  }

  return (
    <section className="arch-card rounded-lg p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="arch-primary-text arch-module-eyebrow font-medium">在线编辑画布 · 原生 SVG / draw.io / Drawnix 适配</p>
          <h3 className="arch-module-section-title arch-text mt-1 font-medium">{selectedDiagram.title}</h3>
          <p className="arch-muted mt-1 arch-type-caption">
            节点 {selectedDiagram.canvas.nodes.length} · 连线 {selectedDiagram.canvas.edges.length} · r{selectedDiagram.revision}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select
            value={selectedDiagram.id}
            onChange={onSelectDiagram}
            className="min-w-56"
            options={diagrams.map((diagram) => ({
              value: diagram.id,
              label: `${diagram.title} · r${diagram.revision}`,
            }))}
          />
          <Button icon={<ForkOutlined />} onClick={onRelayout}>按数据重排</Button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {nodeKindOptions.map((option) => (
          <Button key={option.value} size="small" icon={<PlusCircleOutlined />} onClick={() => onAddNode(option.value)}>
            {option.label}
          </Button>
        ))}
        <Button
          size="small"
          icon={<LinkOutlined />}
          disabled={!selectedNode}
          type={connectorSourceId ? 'primary' : 'default'}
          onClick={() => selectedNode ? onSetConnectorSource(selectedNode.id) : null}
        >
          连线
        </Button>
        <Button size="small" danger icon={<DeleteOutlined />} disabled={!selectedNode} onClick={onDeleteNode}>删除节点</Button>
      </div>

      <div className="mt-3 overflow-auto rounded-md border border-[var(--arch-border)] bg-[var(--arch-surface-muted)]">
        <svg
          width={selectedDiagram.canvas.width}
          height={selectedDiagram.canvas.height}
          viewBox={`0 0 ${selectedDiagram.canvas.width} ${selectedDiagram.canvas.height}`}
          role="img"
          aria-label={`${selectedDiagram.title} 在线编辑画布`}
          onPointerMove={handleCanvasPointerMove}
          onPointerUp={() => setDrag(null)}
          onPointerLeave={() => setDrag(null)}
          className="block cursor-default"
        >
          <defs>
            <marker id="planning-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
              <path d="M0,0 L0,6 L7,3 z" fill="#64748b" />
            </marker>
            <pattern id="planning-grid" width="24" height="24" patternUnits="userSpaceOnUse">
              <path d="M 24 0 L 0 0 0 24" fill="none" stroke="rgba(100,116,139,0.16)" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#planning-grid)" />
          {selectedDiagram.canvas.edges.map((edge) => (
            <DiagramEdgeView key={edge.id} diagram={selectedDiagram} edgeId={edge.id} />
          ))}
          {selectedDiagram.canvas.nodes.map((node) => (
            <CanvasNodeView
              key={node.id}
              node={node}
              selected={node.id === selectedNode?.id}
              connectorSource={node.id === connectorSourceId}
              onPointerDown={handleNodePointerDown}
            />
          ))}
        </svg>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(240px,0.7fr)]">
        <section className="rounded-md border border-[var(--arch-border)] p-3">
          <p className="arch-primary-text arch-module-eyebrow font-medium">节点属性</p>
          {selectedNode ? (
            <div className="mt-2 grid gap-2">
              <Input value={selectedNode.label} onChange={(event) => onPatchNode(selectedNode.id, { label: event.target.value })} />
              <div className="grid grid-cols-2 gap-2">
                <Select
                  value={selectedNode.kind}
                  options={nodeKindOptions}
                  onChange={(kind) => onPatchNode(selectedNode.id, { kind, fill: nodeFill(kind), stroke: nodeStroke(kind) })}
                />
                <Input value={selectedNode.objectRef ?? ''} placeholder="objectRef" onChange={(event) => onPatchNode(selectedNode.id, { objectRef: event.target.value || null })} />
              </div>
              <div className="grid grid-cols-4 gap-2">
                <Input value={selectedNode.x} onChange={(event) => onPatchNode(selectedNode.id, { x: numberFromInput(event.target.value, selectedNode.x) })} />
                <Input value={selectedNode.y} onChange={(event) => onPatchNode(selectedNode.id, { y: numberFromInput(event.target.value, selectedNode.y) })} />
                <Input value={selectedNode.width} onChange={(event) => onPatchNode(selectedNode.id, { width: numberFromInput(event.target.value, selectedNode.width) })} />
                <Input value={selectedNode.height} onChange={(event) => onPatchNode(selectedNode.id, { height: numberFromInput(event.target.value, selectedNode.height) })} />
              </div>
            </div>
          ) : (
            <p className="arch-muted mt-2 arch-type-caption">选择节点后编辑名称、类型、对象绑定和坐标。</p>
          )}
        </section>
        <section className="rounded-md border border-[var(--arch-border)] p-3">
          <p className="arch-primary-text arch-module-eyebrow font-medium">导出图表</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Button onClick={() => onExport('json')}>JSON</Button>
            <Button onClick={() => onExport('svg')}>SVG</Button>
            <Button onClick={() => onExport('drawio')}>draw.io</Button>
            <Button onClick={() => onExport('drawnix')}>Drawnix</Button>
          </div>
          <p className="arch-muted mt-2 arch-type-caption leading-5">
            导出会进入计划管理 CDE 文件区,并写入审计。Drawnix 当前为适配器载荷,后续接入运行时再映射为原生文档。
          </p>
        </section>
      </div>
    </section>
  );
}

function DiagramEdgeView({ diagram, edgeId }: { diagram: PlanningDiagram; edgeId: string }) {
  const edge = diagram.canvas.edges.find((item) => item.id === edgeId);
  if (!edge) return null;
  const source = diagram.canvas.nodes.find((node) => node.id === edge.sourceId);
  const target = diagram.canvas.nodes.find((node) => node.id === edge.targetId);
  if (!source || !target) return null;
  const sx = source.x + source.width;
  const sy = source.y + source.height / 2;
  const tx = target.x;
  const ty = target.y + target.height / 2;
  const mx = (sx + tx) / 2;
  const path = `M ${sx} ${sy} C ${mx} ${sy}, ${mx} ${ty}, ${tx} ${ty}`;
  return (
    <g>
      <path d={path} fill="none" stroke="#64748b" strokeWidth="1.5" markerEnd="url(#planning-arrow)" />
      <text x={mx} y={(sy + ty) / 2 - 6} className="fill-slate-500 text-[11px]">{edge.label}</text>
    </g>
  );
}

function CanvasNodeView({
  node,
  selected,
  connectorSource,
  onPointerDown,
}: {
  node: PlanningDiagramCanvasNode;
  selected: boolean;
  connectorSource: boolean;
  onPointerDown: (event: ReactPointerEvent<SVGGElement>, node: PlanningDiagramCanvasNode) => void;
}) {
  return (
    <g
      role="button"
      tabIndex={0}
      transform={`translate(${node.x}, ${node.y})`}
      onPointerDown={(event) => onPointerDown(event, node)}
      className="cursor-move"
    >
      <rect
        width={node.width}
        height={node.height}
        rx="8"
        fill={node.fill}
        stroke={connectorSource ? '#111827' : selected ? '#111827' : node.stroke}
        strokeWidth={selected || connectorSource ? 2.5 : 1.5}
      />
      <text x="12" y="22" className="pointer-events-none fill-slate-900 text-[12px] font-medium">
        {truncateText(node.label, 26)}
      </text>
      <text x="12" y="42" className="pointer-events-none fill-slate-500 font-mono text-[10px]">
        {truncateText(node.objectRef ?? node.kind, 28)}
      </text>
    </g>
  );
}

function GanttDiagramEditor({
  diagrams,
  selectedDiagram,
  tasks,
  onSelectDiagram,
  onUpdateTask,
  onRelayout,
  onExport,
}: {
  diagrams: PlanningDiagram[];
  selectedDiagram: PlanningDiagram;
  tasks: PlanningTask[];
  onSelectDiagram: (diagramId: string) => void;
  onUpdateTask: (taskId: string, patch: Partial<PlanningTask>) => void;
  onRelayout: () => void;
  onExport: (kind: PlanningDiagramExportKind) => void;
}) {
  const [selectedTaskId, setSelectedTaskId] = useState(tasks[0]?.id ?? '');
  const [drag, setDrag] = useState<{ taskId: string; clientX: number } | null>(null);
  const selectedTask = tasks.find((task) => task.id === selectedTaskId) ?? tasks[0] ?? null;
  const chartStart = minTaskDate(tasks, 'start') ?? '2026-05-20';
  const chartEnd = maxTaskDate(tasks, 'end') ?? chartStart;
  const totalDays = Math.max(1, chartDaysBetween(chartStart, chartEnd) + 1);
  const labelWidth = 210;
  const plotWidth = Math.max(1320, totalDays * (totalDays > 42 ? 22 : 30));
  const dayWidth = plotWidth / totalDays;
  const rowHeight = 46;
  const top = 58;
  const chartWidth = labelWidth + plotWidth + 120;
  const chartHeight = Math.max(360, top + tasks.length * rowHeight + 76);
  const ticks = createDateTicks(chartStart, totalDays, Math.max(1, Math.ceil(totalDays / 12)));

  function handleMove(event: ReactPointerEvent<SVGSVGElement>) {
    if (!drag) return;
    const deltaDays = Math.trunc((event.clientX - drag.clientX) / dayWidth);
    if (deltaDays === 0) return;
    const task = tasks.find((item) => item.id === drag.taskId);
    if (!task) return;
    onUpdateTask(task.id, {
      start: addIsoDays(task.start, deltaDays),
      end: addIsoDays(task.end, deltaDays),
    });
    setDrag({ taskId: task.id, clientX: drag.clientX + deltaDays * dayWidth });
  }

  return (
    <section className="arch-card rounded-lg p-3">
      <PlanningChartHeader
        eyebrow="甘特图 · 日期轴任务条"
        title={`${selectedDiagram.title} · r${selectedDiagram.revision}`}
        summary={`任务 ${tasks.length} · 日期 ${chartStart} 至 ${chartEnd} · 拖动任务条可调整起止窗口`}
        diagrams={diagrams}
        selectedDiagram={selectedDiagram}
        onSelectDiagram={onSelectDiagram}
        onRelayout={onRelayout}
        onExport={onExport}
      />
      <div className="mt-3 overflow-auto rounded-md border border-[var(--arch-border)] bg-[var(--arch-surface-muted)]">
        <svg
          width={chartWidth}
          height={chartHeight}
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          role="img"
          aria-label="甘特图日期轴任务条"
          onPointerMove={handleMove}
          onPointerUp={() => setDrag(null)}
          onPointerLeave={() => setDrag(null)}
          className="block"
        >
          <rect width="100%" height="100%" fill="#f8fafc" />
          {ticks.map((tick) => {
            const x = labelWidth + chartDaysBetween(chartStart, tick) * dayWidth;
            return (
              <g key={tick}>
                <line x1={x} y1="34" x2={x} y2={chartHeight - 30} stroke="rgba(100,116,139,0.18)" />
                <text x={x + 4} y="24" className="fill-slate-500 font-mono text-[10px]">{tick.slice(5)}</text>
              </g>
            );
          })}
          <line x1={labelWidth} y1="34" x2={labelWidth + plotWidth} y2="34" stroke="#94a3b8" />
          {tasks.map((task, index) => {
            const y = top + index * rowHeight;
            const x = labelWidth + Math.max(0, chartDaysBetween(chartStart, task.start)) * dayWidth;
            const width = Math.max(dayWidth, (chartDaysBetween(task.start, task.end) + 1) * dayWidth);
            const selected = selectedTask?.id === task.id;
            return (
              <g key={task.id}>
                <line x1="18" y1={y + 17} x2={labelWidth + plotWidth} y2={y + 17} stroke="rgba(148,163,184,0.14)" />
                <text x="18" y={y + 12} className="fill-slate-900 text-[12px] font-medium">{task.code}</text>
                <text x="72" y={y + 12} className="fill-slate-500 text-[11px]">{truncateText(task.title, 18)}</text>
                <rect
                  x={x}
                  y={y}
                  width={width}
                  height="26"
                  rx="7"
                  fill={task.status === 'blocked' ? '#fee2e2' : '#dbeafe'}
                  stroke={selected ? '#111827' : task.status === 'blocked' ? '#db4437' : '#4285f4'}
                  strokeWidth={selected ? 2.2 : 1.4}
                  className="cursor-ew-resize"
                  onPointerDown={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    setSelectedTaskId(task.id);
                    setDrag({ taskId: task.id, clientX: event.clientX });
                  }}
                />
                <rect
                  x={x}
                  y={y}
                  width={Math.max(4, width * task.progress / 100)}
                  height="26"
                  rx="7"
                  fill={task.status === 'blocked' ? '#f28b82' : '#0f9d58'}
                  opacity="0.58"
                  className="pointer-events-none"
                />
                <text x={x + 10} y={y + 17} className="pointer-events-none fill-slate-900 text-[11px] font-medium">
                  {task.progress}%
                </text>
                <text x={x + width + 8} y={y + 17} className="fill-slate-500 text-[10px]">
                  {task.start} → {task.end}
                </text>
              </g>
            );
          })}
          {tasks.flatMap((task) => task.dependencies.map((dependencyId) => {
            const source = tasks.find((item) => item.id === dependencyId);
            if (!source) return null;
            const sourceIndex = tasks.findIndex((item) => item.id === source.id);
            const targetIndex = tasks.findIndex((item) => item.id === task.id);
            const sx = labelWidth + (chartDaysBetween(chartStart, source.end) + 1) * dayWidth;
            const sy = top + sourceIndex * rowHeight + 13;
            const tx = labelWidth + chartDaysBetween(chartStart, task.start) * dayWidth;
            const ty = top + targetIndex * rowHeight + 13;
            const mid = sx + Math.max(20, (tx - sx) / 2);
            return (
              <path
                key={`${source.id}-${task.id}`}
                d={`M ${sx} ${sy} L ${mid} ${sy} L ${mid} ${ty} L ${tx} ${ty}`}
                fill="none"
                stroke="#64748b"
                strokeWidth="1.4"
                strokeDasharray="4 4"
              />
            );
          }))}
        </svg>
      </div>
      <section className="mt-3 rounded-md border border-[var(--arch-border)] p-3">
        <p className="arch-primary-text arch-module-eyebrow font-medium">任务条属性</p>
        {selectedTask ? (
          <div className="mt-2 grid gap-2">
            <Input value={selectedTask.title} onChange={(event) => onUpdateTask(selectedTask.id, { title: event.target.value })} />
            <div className="grid gap-2 md:grid-cols-[1fr_1fr_120px_160px]">
              <Input value={selectedTask.start} onChange={(event) => onUpdateTask(selectedTask.id, { start: event.target.value })} />
              <Input value={selectedTask.end} onChange={(event) => onUpdateTask(selectedTask.id, { end: event.target.value })} />
              <Select value={selectedTask.status} options={taskStatusOptions} onChange={(status) => onUpdateTask(selectedTask.id, { status })} />
              <Slider value={selectedTask.progress} onChange={(progress) => onUpdateTask(selectedTask.id, { progress })} />
            </div>
          </div>
        ) : (
          <p className="arch-muted mt-2 arch-type-caption">暂无任务。</p>
        )}
      </section>
    </section>
  );
}

function ResourceHistogramDiagramEditor({
  diagrams,
  selectedDiagram,
  tasks,
  resources,
  resourceLoads,
  onSelectDiagram,
  onUpdateTask,
  onRelayout,
  onExport,
}: {
  diagrams: PlanningDiagram[];
  selectedDiagram: PlanningDiagram;
  tasks: PlanningTask[];
  resources: PlanningResource[];
  resourceLoads: Array<{ resourceId: string; name: string; load: number; capacity: number }>;
  onSelectDiagram: (diagramId: string) => void;
  onUpdateTask: (taskId: string, patch: Partial<PlanningTask>) => void;
  onRelayout: () => void;
  onExport: (kind: PlanningDiagramExportKind) => void;
}) {
  const maxLoad = Math.max(1, ...resourceLoads.map((item) => item.load));
  const chartWidth = Math.max(1180, resourceLoads.length * 180 + 140);
  const chartHeight = 260;
  const left = 70;
  const bottom = 198;
  const plotHeight = 146;
  const barSlot = Math.max(110, (chartWidth - left - 70) / Math.max(1, resourceLoads.length));
  const barWidth = Math.min(76, barSlot * 0.56);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((ratio) => Math.round(maxLoad * ratio));

  return (
    <section className="arch-card rounded-lg p-3">
      <PlanningChartHeader
        eyebrow="资源直方图 · 负荷柱状图"
        title={`${selectedDiagram.title} · r${selectedDiagram.revision}`}
        summary={`资源 ${resourceLoads.length} · 柱高为任务占用天数,虚线为容量阈值`}
        diagrams={diagrams}
        selectedDiagram={selectedDiagram}
        onSelectDiagram={onSelectDiagram}
        onRelayout={onRelayout}
        onExport={onExport}
      />
      <div className="mt-3 overflow-auto rounded-md border border-[var(--arch-border)] bg-[var(--arch-surface-muted)]">
        <svg width={chartWidth} height={chartHeight} viewBox={`0 0 ${chartWidth} ${chartHeight}`} role="img" aria-label="资源负荷直方图">
          <rect width="100%" height="100%" fill="#f8fafc" />
          {ticks.map((tick) => {
            const y = bottom - tick / maxLoad * plotHeight;
            return (
              <g key={tick}>
                <line x1={left} y1={y} x2={chartWidth - 40} y2={y} stroke="rgba(100,116,139,0.18)" />
                <text x="20" y={y + 4} className="fill-slate-500 text-[10px]">{tick}天</text>
              </g>
            );
          })}
          <line x1={left} y1={bottom} x2={chartWidth - 40} y2={bottom} stroke="#94a3b8" />
          <line x1={left} y1={bottom - 1} x2={left} y2={bottom - plotHeight} stroke="#94a3b8" />
          {resourceLoads.map((item, index) => {
            const x = left + index * barSlot + (barSlot - barWidth) / 2;
            const barHeight = item.load / maxLoad * plotHeight;
            const capacityY = bottom - Math.min(maxLoad, item.capacity * 3) / maxLoad * plotHeight;
            const overloaded = item.load > item.capacity * 3;
            return (
              <g key={item.resourceId}>
                <line x1={x - 8} y1={capacityY} x2={x + barWidth + 8} y2={capacityY} stroke="#db4437" strokeDasharray="4 4" />
                <rect
                  x={x}
                  y={bottom - barHeight}
                  width={barWidth}
                  height={barHeight}
                  rx="8"
                  fill={overloaded ? '#fee2e2' : '#dbeafe'}
                  stroke={overloaded ? '#db4437' : '#4285f4'}
                  strokeWidth="1.5"
                />
                <rect
                  x={x}
                  y={bottom - barHeight}
                  width={barWidth}
                  height={Math.max(6, barHeight * 0.32)}
                  rx="8"
                  fill={overloaded ? '#f28b82' : '#0f9d58'}
                  opacity="0.62"
                />
                <text x={x + barWidth / 2} y={bottom - barHeight - 8} textAnchor="middle" className="fill-slate-900 text-[11px] font-medium">
                  {item.load}天
                </text>
                <text x={x + barWidth / 2} y={bottom + 22} textAnchor="middle" className="fill-slate-700 text-[11px]">
                  {item.name}
                </text>
                <text x={x + barWidth / 2} y={bottom + 40} textAnchor="middle" className="fill-slate-500 text-[10px]">
                  阈值 {item.capacity * 3}天
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <section className="mt-3 rounded-md border border-[var(--arch-border)] p-3">
        <p className="arch-primary-text arch-module-eyebrow font-medium">资源分配编辑</p>
        <div className="mt-2 grid gap-2">
          {tasks.map((task) => (
            <div key={task.id} className="grid items-center gap-2 md:grid-cols-[minmax(0,1fr)_180px_90px]">
              <span className="arch-text truncate arch-type-list">{task.code} · {task.title}</span>
              <Select
                value={task.resourceId}
                options={resources.map((resource) => ({ value: resource.id, label: resource.name }))}
                onChange={(resourceId) => onUpdateTask(task.id, { resourceId })}
              />
              <span className="arch-muted text-right arch-type-caption">{chartDaysBetween(task.start, task.end) + 1}天</span>
            </div>
          ))}
        </div>
      </section>
    </section>
  );
}

function PlanningChartHeader({
  eyebrow,
  title,
  summary,
  diagrams,
  selectedDiagram,
  onSelectDiagram,
  onRelayout,
  onExport,
}: {
  eyebrow: string;
  title: string;
  summary: string;
  diagrams: PlanningDiagram[];
  selectedDiagram: PlanningDiagram;
  onSelectDiagram: (diagramId: string) => void;
  onRelayout: () => void;
  onExport: (kind: PlanningDiagramExportKind) => void;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="arch-primary-text arch-module-eyebrow font-medium">{eyebrow}</p>
        <h3 className="arch-module-section-title arch-text mt-1 font-medium">{title}</h3>
        <p className="arch-muted mt-1 arch-type-caption">{summary}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Select
          value={selectedDiagram.id}
          onChange={onSelectDiagram}
          className="min-w-56"
          options={diagrams.map((diagram) => ({
            value: diagram.id,
            label: `${diagram.title} · r${diagram.revision}`,
          }))}
        />
        <Button icon={<ForkOutlined />} onClick={onRelayout}>按数据重排</Button>
        <Button onClick={() => onExport('svg')}>SVG</Button>
        <Button onClick={() => onExport('drawio')}>draw.io</Button>
      </div>
    </div>
  );
}

function KanbanBoard({ columns }: { columns: Record<PlanningTaskStatus, PlanningTask[]> }) {
  return (
    <section className="grid gap-2 md:grid-cols-5">
      {taskStatusOptions.map((status) => (
        <div key={status.value} className="arch-card rounded-lg p-3">
          <p className="arch-primary-text arch-module-eyebrow font-medium">{status.label}</p>
          <div className="mt-2 grid gap-2">
            {columns[status.value].map((task) => (
              <div key={task.id} className="arch-card-muted rounded-md p-2">
                <p className="arch-text arch-type-list font-medium">{task.title}</p>
                <p className="arch-muted mt-1 arch-type-caption">{task.owner} · {task.progress}%</p>
              </div>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}

function RaciMatrix({ model }: { model: ReturnType<typeof createDefaultProjectPlanningModel> }) {
  return (
    <section className="arch-card rounded-lg p-3">
      <p className="arch-primary-text arch-module-eyebrow font-medium">RACI 矩阵</p>
      <div className="mt-2 grid gap-2">
        {model.raci.map((entry) => {
          const wbs = model.wbs.find((item) => item.id === entry.workPackageId);
          return (
            <div key={entry.workPackageId} className="arch-card-muted rounded-md p-2">
              <p className="arch-text arch-type-list font-medium">{wbs?.code} · {wbs?.title}</p>
              <p className="arch-muted mt-1 arch-type-caption">R {entry.responsible} / A {entry.accountable}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function ExportPanel({
  exportPreview,
  mermaid,
  onExport,
}: {
  exportPreview: { fileName: string; content: string };
  mermaid: string;
  onExport: (kind: 'json' | 'csv' | 'mermaid') => void;
}) {
  return (
    <section className="arch-card rounded-lg p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="arch-primary-text arch-module-eyebrow font-medium">导出与 CDE 文件</p>
          <h3 className="arch-module-section-title arch-text font-medium">{exportPreview.fileName}</h3>
        </div>
        <div className="flex gap-2">
          <Button icon={<CloudUploadOutlined />} onClick={() => onExport('json')}>JSON</Button>
          <Button icon={<CloudUploadOutlined />} onClick={() => onExport('csv')}>CSV</Button>
          <Button icon={<CloudUploadOutlined />} onClick={() => onExport('mermaid')}>MMD</Button>
        </div>
      </div>
      <pre className="mt-3 max-h-80 overflow-auto rounded-md bg-[var(--arch-surface-muted)] p-3 arch-type-caption leading-5">
        {exportPreview.content.slice(0, 2600)}
      </pre>
      <pre className="mt-3 max-h-44 overflow-auto rounded-md bg-[var(--arch-surface-muted)] p-3 arch-type-caption leading-5">
        {mermaid}
      </pre>
    </section>
  );
}

function AiAdvisorPanel({ advice }: { advice: ReturnType<typeof runPlanningAiAdvisor> }) {
  return (
    <section className="arch-card rounded-lg p-3">
      <p className="arch-primary-text arch-module-eyebrow font-medium">AI 计划顾问</p>
      <div className="mt-3 grid gap-2">
        {advice.map((item) => (
          <div key={item.id} className="rounded-md border border-[var(--arch-border)] p-3">
            <Tag color={item.severity === 'high' || item.severity === 'critical' ? 'red' : 'gold'}>{item.severity}</Tag>
            <p className="arch-text mt-2 arch-type-list font-medium">{item.title}</p>
            <p className="arch-muted mt-1 arch-type-caption leading-5">{item.recommendation}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function nodeFill(kind: PlanningDiagramNodeKind): string {
  const fills: Record<PlanningDiagramNodeKind, string> = {
    task: '#dbeafe',
    milestone: '#fef3c7',
    wbs: '#dcfce7',
    resource: '#cffafe',
    risk: '#fee2e2',
    decision: '#f3e8ff',
    approval: '#ffedd5',
    note: '#f3f4f6',
  };
  return fills[kind];
}

function nodeStroke(kind: PlanningDiagramNodeKind): string {
  const strokes: Record<PlanningDiagramNodeKind, string> = {
    task: '#4285f4',
    milestone: '#f4b400',
    wbs: '#0f9d58',
    resource: '#00acc1',
    risk: '#db4437',
    decision: '#a142f4',
    approval: '#f4511e',
    note: '#6b7280',
  };
  return strokes[kind];
}

function numberFromInput(value: string, fallback: number): number {
  const next = Number.parseInt(value, 10);
  return Number.isFinite(next) ? next : fallback;
}

function truncateText(value: string, maxLength: number): string {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}...` : value;
}

function isDataChartTemplate(templateId: string): boolean {
  return templateId === 'gantt' || templateId === 'resource-histogram';
}

function taskStatusColor(status: PlanningTaskStatus): string {
  const colors: Record<PlanningTaskStatus, string> = {
    todo: 'default',
    doing: 'blue',
    review: 'gold',
    done: 'green',
    blocked: 'red',
  };
  return colors[status];
}

function alertSeverityColor(severity: PlanningScheduleAlert['severity']): string {
  const colors: Record<PlanningScheduleAlert['severity'], string> = {
    info: 'blue',
    warning: 'gold',
    high: 'volcano',
    critical: 'red',
  };
  return colors[severity];
}

function minTaskDate(tasks: PlanningTask[], key: 'start' | 'end'): string | null {
  const timestamps = tasks
    .map((task) => Date.parse(`${task[key]}T00:00:00Z`))
    .filter(Number.isFinite);
  if (timestamps.length === 0) return null;
  return new Date(Math.min(...timestamps)).toISOString().slice(0, 10);
}

function maxTaskDate(tasks: PlanningTask[], key: 'start' | 'end'): string | null {
  const timestamps = tasks
    .map((task) => Date.parse(`${task[key]}T00:00:00Z`))
    .filter(Number.isFinite);
  if (timestamps.length === 0) return null;
  return new Date(Math.max(...timestamps)).toISOString().slice(0, 10);
}

function chartDaysBetween(start: string, end: string): number {
  const startTime = Date.parse(`${start}T00:00:00Z`);
  const endTime = Date.parse(`${end}T00:00:00Z`);
  if (!Number.isFinite(startTime) || !Number.isFinite(endTime)) return 0;
  return Math.max(0, Math.round((endTime - startTime) / 86_400_000));
}

function addIsoDays(value: string, days: number): string {
  const timestamp = Date.parse(`${value}T00:00:00Z`);
  if (!Number.isFinite(timestamp)) return value;
  return new Date(timestamp + days * 86_400_000).toISOString().slice(0, 10);
}

function createDateTicks(start: string, totalDays: number, step: number): string[] {
  return Array.from({ length: Math.ceil(totalDays / step) + 1 }, (_, index) => addIsoDays(start, index * step));
}

interface MindMapLayoutNode {
  id: string;
  node: PlanningWbsNode;
  x: number;
  y: number;
  width: number;
  height: number;
  depth: number;
}

function collectWbsDescendantIds(wbs: PlanningWbsNode[], nodeId: string): string[] {
  const result: string[] = [];
  const queue = [nodeId];

  while (queue.length > 0) {
    const currentId = queue.shift();
    if (!currentId) continue;
    for (const child of wbs.filter((node) => node.parentId === currentId)) {
      result.push(child.id);
      queue.push(child.id);
    }
  }

  return result;
}

function createMindMapLayout(wbs: PlanningWbsNode[]): {
  width: number;
  height: number;
  nodes: MindMapLayoutNode[];
  edges: Array<{ source: MindMapLayoutNode; target: MindMapLayoutNode }>;
} {
  const childrenByParent = new Map<string | null, PlanningWbsNode[]>();
  for (const node of wbs) {
    const key = node.parentId ?? null;
    childrenByParent.set(key, [...(childrenByParent.get(key) ?? []), node]);
  }

  const roots = childrenByParent.get(null) ?? [];
  const orderedRoots = roots.length > 0 ? roots : wbs.filter((node) => !wbs.some((parent) => parent.id === node.parentId));
  const nodes: MindMapLayoutNode[] = [];
  let row = 0;

  function visit(node: PlanningWbsNode, depth: number, seen: Set<string>) {
    if (seen.has(node.id)) return;
    const nextSeen = new Set(seen);
    nextSeen.add(node.id);
    const width = depth === 0 ? 230 : 250;
    const height = 62;
    nodes.push({
      id: node.id,
      node,
      x: 48 + depth * 285,
      y: 42 + row * 84,
      width,
      height,
      depth,
    });
    row += 1;
    for (const child of childrenByParent.get(node.id) ?? []) {
      visit(child, depth + 1, nextSeen);
    }
  }

  for (const root of orderedRoots) {
    visit(root, 0, new Set<string>());
  }

  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const edges = nodes.flatMap((node) => {
    const parentId = node.node.parentId;
    const source = parentId ? nodeById.get(parentId) : null;
    return source ? [{ source, target: node }] : [];
  });

  const right = Math.max(980, ...nodes.map((node) => node.x + node.width + 72));
  const bottom = Math.max(620, ...nodes.map((node) => node.y + node.height + 64));
  return { width: right, height: bottom, nodes, edges };
}
