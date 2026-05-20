// components/ProjectPlanningStudio.tsx - Planning Management Project Planning Studio
// License: Apache-2.0
'use client';

import {
  AppstoreOutlined,
  AuditOutlined,
  CheckCircleOutlined,
  CloudUploadOutlined,
  DeleteOutlined,
  ForkOutlined,
  LinkOutlined,
  NodeIndexOutlined,
  PlusCircleOutlined,
  SaveOutlined,
} from '@ant-design/icons';
import { Button, Input, Select, Slider, Table, Tabs, Tag, Tooltip } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useMemo, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { createModuleAuditEvent } from '@/lib/module-actions';
import { moduleBackendAdapter } from '@/lib/module-backend-adapter';
import { createModuleFile } from '@/lib/module-file-api-client';
import type { ModuleAuditEvent } from '@/lib/module-file-system';
import { getModuleRootId } from '@/lib/module-file-system';
import {
  approveAndArchivePlanningVersion,
  createPlanningDiagramCanvas,
  createPlanningDiagramExport,
  createDefaultProjectPlanningModel,
  createDiagramFromTemplate,
  createPlanningExport,
  createPlanningVersion,
  deriveKanbanColumns,
  derivePlanningSummary,
  deriveResourceHistogram,
  planningDiagramTemplates,
  requestPlanningApproval,
  runPlanningAiAdvisor,
  toMermaidGantt,
  type PlanningDiagramFamily,
  type PlanningDiagramNodeKind,
  type PlanningDiagram,
  type PlanningDiagramCanvasNode,
  type PlanningDiagramExportKind,
  type PlanningResource,
  type PlanningTask,
  type PlanningTaskStatus,
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

  const summary = useMemo(() => derivePlanningSummary(model), [model]);
  const selectedDiagram = model.diagrams.find((diagram) => diagram.id === selectedDiagramId) ?? model.diagrams[0] ?? null;
  const selectedNode = selectedDiagram?.canvas.nodes.find((node) => node.id === selectedNodeId) ?? selectedDiagram?.canvas.nodes[0] ?? null;
  const aiAdvice = useMemo(() => runPlanningAiAdvisor(model), [model]);
  const resourceHistogram = useMemo(() => deriveResourceHistogram(model), [model]);
  const kanbanColumns = useMemo(() => deriveKanbanColumns(model), [model]);
  const selectedTemplate = planningDiagramTemplates.find((template) => template.id === selectedTemplateId) ?? planningDiagramTemplates[0];

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

  function addDiagram() {
    const diagram = createDiagramFromTemplate(selectedTemplateId, model);
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
    audit(`从模板库新增图表: ${selectedTemplate.name}`);
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
    const index = selectedDiagram.canvas.nodes.length + 1;
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
    updateDiagram(selectedDiagram.id, (diagram) => ({
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
    updateDiagram(selectedDiagram.id, (diagram) => ({
      ...diagram,
      canvas: {
        ...diagram.canvas,
        nodes: diagram.canvas.nodes.filter((node) => node.id !== selectedNode.id),
        edges: diagram.canvas.edges.filter((edge) => edge.sourceId !== selectedNode.id && edge.targetId !== selectedNode.id),
      },
    }));
    const fallback = selectedDiagram.canvas.nodes.find((node) => node.id !== selectedNode.id);
    setSelectedNodeId(fallback?.id ?? '');
    audit(`图表画布删除节点: ${selectedNode.label}`);
  }

  function connectCanvasNode(targetId: string) {
    if (!selectedDiagram || !connectorSourceId || connectorSourceId === targetId) {
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
    updateDiagram(selectedDiagram.id, (diagram) => ({
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
      title: '进度',
      dataIndex: 'progress',
      width: 180,
      render: (value: number, record) => (
        <Slider value={value} onChange={(progress) => updateTask(record.id, { progress })} />
      ),
    },
  ];

  return (
    <section className="grid gap-3">
      <header className="arch-card rounded-lg p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="arch-primary-text arch-module-eyebrow font-mono font-medium">PROJECT PLANNING STUDIO</p>
            <h2 className="arch-module-home-title arch-text mt-1 font-medium">计划管理 · 在线编制与审批归档闭环</h2>
            <p className="arch-module-description arch-muted mt-2 max-w-5xl">
              统一任务、WBS、里程碑、资源、风险和 RACI 数据模型;借鉴 Plane 的 work items / cycles / roadmaps / docs / triage 产品结构,用 Ant Design、AntV、D3、Mermaid 和 BPMN 适配路线承载项目管理图表。
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

        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <Metric title="任务" value={summary.taskCount} suffix="项" />
          <Metric title="WBS" value={summary.wbsCount} suffix="个" />
          <Metric title="平均进度" value={summary.averageProgress} suffix="%" />
          <Metric title="高风险" value={summary.criticalRiskCount} suffix="条" danger={summary.criticalRiskCount > 0} />
        </div>
      </header>

      <div className="grid gap-3">
        <main className="grid min-w-0 gap-3">
          <section className="arch-card rounded-lg p-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="arch-primary-text arch-module-eyebrow font-medium">图表模板库</p>
                <h3 className="arch-module-section-title arch-text font-medium">{selectedTemplate.name}</h3>
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
            </div>
            <p className="arch-module-description arch-muted mt-2">{selectedTemplate.purpose}</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <Tag color="green">{familyLabels[selectedTemplate.family]}</Tag>
              <Tag>{selectedTemplate.engine}</Tag>
              <Tag>{selectedTemplate.openSourceRoute}</Tag>
              {selectedTemplate.aliases.map((alias) => <Tag key={alias}>{alias}</Tag>)}
            </div>
          </section>

          <Tabs
            items={[
              {
                key: 'visual',
                label: '在线图表',
                children: (
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
                ),
              },
              {
                key: 'tasks',
                label: '任务 / WBS',
                children: (
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
                      scroll={{ x: 860 }}
                    />
                  </section>
                ),
              },
              {
                key: 'kanban',
                label: '看板 / RACI',
                children: (
                  <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_420px]">
                    <KanbanBoard columns={kanbanColumns} />
                    <RaciMatrix model={model} />
                  </div>
                ),
              },
              {
                key: 'export',
                label: '导出 / AI',
                children: (
                  <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_420px]">
                    <ExportPanel
                      exportPreview={exportPreview}
                      mermaid={toMermaidGantt(model)}
                      onExport={exportPlan}
                    />
                    <AiAdvisorPanel advice={aiAdvice} />
                  </div>
                ),
              },
            ]}
          />
        </main>
      </div>
    </section>
  );
}

function Metric({ title, value, suffix, danger = false }: { title: string; value: number; suffix: string; danger?: boolean }) {
  return (
    <div className="arch-card-muted rounded-lg p-3">
      <p className="arch-muted arch-type-caption font-medium">{title}</p>
      <p className={`arch-module-metric-value mt-1 font-medium ${danger ? 'text-red-600' : 'arch-primary-text'}`}>
        {value}<span className="arch-module-metric-suffix ml-1">{suffix}</span>
      </p>
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
