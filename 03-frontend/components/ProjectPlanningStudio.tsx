// components/ProjectPlanningStudio.tsx - Planning Management Project Planning Studio
// License: Apache-2.0
'use client';

import {
  AppstoreOutlined,
  AuditOutlined,
  BranchesOutlined,
  CheckCircleOutlined,
  CloudUploadOutlined,
  DeleteOutlined,
  DownloadOutlined,
  ForkOutlined,
  LinkOutlined,
  NodeIndexOutlined,
  PlusCircleOutlined,
  SaveOutlined,
} from '@ant-design/icons';
import { Button, Input, Progress, Select, Slider, Table, Tabs, Tag, Tooltip } from 'antd';
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
  deriveRiskMatrix,
  planningDiagramTemplates,
  requestPlanningApproval,
  runPlanningAiAdvisor,
  toMermaidGantt,
  type PlanningDiagramFamily,
  type PlanningDiagramNodeKind,
  type PlanningDiagram,
  type PlanningDiagramCanvasNode,
  type PlanningDiagramExportKind,
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
  const [selectedTaskId, setSelectedTaskId] = useState(model.tasks[0]?.id ?? '');
  const [selectedDiagramId, setSelectedDiagramId] = useState(model.diagrams[0]?.id ?? '');
  const [selectedNodeId, setSelectedNodeId] = useState(model.diagrams[0]?.canvas.nodes[0]?.id ?? '');
  const [connectorSourceId, setConnectorSourceId] = useState('');
  const [exportPreview, setExportPreview] = useState(() => createPlanningExport(model, 'json'));

  const summary = useMemo(() => derivePlanningSummary(model), [model]);
  const selectedTask = model.tasks.find((task) => task.id === selectedTaskId) ?? model.tasks[0] ?? null;
  const selectedDiagram = model.diagrams.find((diagram) => diagram.id === selectedDiagramId) ?? model.diagrams[0] ?? null;
  const selectedNode = selectedDiagram?.canvas.nodes.find((node) => node.id === selectedNodeId) ?? selectedDiagram?.canvas.nodes[0] ?? null;
  const aiAdvice = useMemo(() => runPlanningAiAdvisor(model), [model]);
  const resourceHistogram = useMemo(() => deriveResourceHistogram(model), [model]);
  const riskMatrix = useMemo(() => deriveRiskMatrix(model), [model]);
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
      setSelectedTaskId(task.id);
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
    const pkg = createPlanningDiagramExport(model, selectedDiagram, kind);
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
        <button type="button" className="font-mono font-medium text-[var(--arch-primary)]" onClick={() => setSelectedTaskId(record.id)}>
          {value}
        </button>
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
            <p className="arch-primary-text font-mono text-[11px] font-medium">PROJECT PLANNING STUDIO</p>
            <h2 className="arch-text mt-1 text-xl font-medium">计划管理 · 在线编制与审批归档闭环</h2>
            <p className="arch-muted mt-2 max-w-5xl text-sm leading-6">
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

      <div className="grid gap-3 2xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.65fr)]">
        <main className="grid min-w-0 gap-3">
          <section className="arch-card rounded-lg p-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="arch-primary-text text-xs font-medium">图表模板库</p>
                <h3 className="arch-text text-lg font-medium">{selectedTemplate.name}</h3>
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
            <p className="arch-muted mt-2 text-sm leading-6">{selectedTemplate.purpose}</p>
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
                  <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_340px]">
                    <DiagramEditor
                      diagrams={model.diagrams}
                      selectedDiagram={selectedDiagram}
                      selectedNode={selectedNode}
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
                      onAddNode={addCanvasNode}
                      onDeleteNode={deleteCanvasNode}
                      onConnectNode={connectCanvasNode}
                      onSetConnectorSource={setConnectorSourceId}
                      onRelayout={relayoutActiveDiagram}
                      onExport={exportDiagram}
                    />
                    <div className="grid gap-3">
                      <RiskMatrix risks={riskMatrix} />
                      <ResourceLoad data={resourceHistogram} />
                    </div>
                  </div>
                ),
              },
              {
                key: 'tasks',
                label: '任务 / WBS',
                children: (
                  <section className="arch-card rounded-lg p-3">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <p className="arch-primary-text text-xs font-medium">工作项</p>
                        <h3 className="arch-text text-base font-medium">任务、WBS、依赖和进度在线编制</h3>
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

        <aside className="grid content-start gap-3">
          <section className="arch-card rounded-lg p-3">
            <p className="arch-primary-text text-xs font-medium">Project Plan Token</p>
            <h3 className="arch-text mt-1 text-base font-medium">{model.projectName}</h3>
            <div className="mt-3 grid gap-2">
              <InfoRow label="版本" value={model.currentVersion} />
              <InfoRow label="状态" value={model.approvalStatus} />
              <InfoRow label="周期" value={`${summary.plannedDurationDays} 天`} />
              <InfoRow label="阻断" value={`${summary.blockedTaskCount} 项`} />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="small" icon={<DownloadOutlined />} onClick={() => exportPlan('json')}>JSON</Button>
              <Button size="small" icon={<DownloadOutlined />} onClick={() => exportPlan('csv')}>CSV</Button>
              <Button size="small" icon={<BranchesOutlined />} onClick={() => exportPlan('mermaid')}>Mermaid</Button>
            </div>
          </section>

          <section className="arch-card rounded-lg p-3">
            <p className="arch-primary-text text-xs font-medium">当前任务</p>
            {selectedTask ? (
              <div className="mt-2 grid gap-2">
                <Input value={selectedTask.title} onChange={(event) => updateTask(selectedTask.id, { title: event.target.value })} />
                <div className="grid grid-cols-2 gap-2">
                  <Input value={selectedTask.start} onChange={(event) => updateTask(selectedTask.id, { start: event.target.value })} />
                  <Input value={selectedTask.end} onChange={(event) => updateTask(selectedTask.id, { end: event.target.value })} />
                </div>
                <Progress percent={selectedTask.progress} strokeColor="var(--arch-primary)" />
              </div>
            ) : (
              <p className="arch-muted mt-2 text-sm">暂无任务。</p>
            )}
          </section>

          <section className="arch-card rounded-lg p-3">
            <p className="arch-primary-text text-xs font-medium">版本 / 审计</p>
            <div className="mt-2 grid gap-2">
              {model.versions.slice(0, 4).map((version) => (
                <div key={version.id} className="arch-card-muted rounded-md px-3 py-2">
                  <p className="arch-text text-sm font-medium">{version.version} · {version.status}</p>
                  <p className="arch-muted mt-1 text-xs">{version.cdeFileName}</p>
                </div>
              ))}
            </div>
            <div className="mt-3 grid gap-2">
              {model.auditTrail.slice(0, 5).map((entry) => (
                <div key={entry.id} className="rounded-md border border-[var(--arch-border)] px-3 py-2">
                  <p className="arch-text text-xs font-medium">{entry.summary}</p>
                  <p className="arch-muted mt-1 text-[11px]">{entry.actor} · {entry.at}</p>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </section>
  );
}

function Metric({ title, value, suffix, danger = false }: { title: string; value: number; suffix: string; danger?: boolean }) {
  return (
    <div className="arch-card-muted rounded-lg p-3">
      <p className="arch-muted text-xs font-medium">{title}</p>
      <p className={`mt-1 text-2xl font-medium ${danger ? 'text-red-600' : 'arch-primary-text'}`}>
        {value}<span className="ml-1 text-sm">{suffix}</span>
      </p>
    </div>
  );
}

function DiagramEditor({
  diagrams,
  selectedDiagram,
  selectedNode,
  connectorSourceId,
  onSelectDiagram,
  onSelectNode,
  onMoveNode,
  onPatchNode,
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
  connectorSourceId: string;
  onSelectDiagram: (diagramId: string) => void;
  onSelectNode: (nodeId: string) => void;
  onMoveNode: (nodeId: string, x: number, y: number) => void;
  onPatchNode: (nodeId: string, patch: Partial<PlanningDiagramCanvasNode>) => void;
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
        <p className="arch-muted text-sm">暂无图表,请从模板库加入画布。</p>
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

  return (
    <section className="arch-card rounded-lg p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="arch-primary-text text-xs font-medium">在线编辑画布 · 原生 SVG / draw.io / Drawnix 适配</p>
          <h3 className="arch-text mt-1 text-base font-medium">{selectedDiagram.title}</h3>
          <p className="arch-muted mt-1 text-xs">
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
          <p className="arch-primary-text text-xs font-medium">节点属性</p>
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
            <p className="arch-muted mt-2 text-sm">选择节点后编辑名称、类型、对象绑定和坐标。</p>
          )}
        </section>
        <section className="rounded-md border border-[var(--arch-border)] p-3">
          <p className="arch-primary-text text-xs font-medium">导出图表</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Button onClick={() => onExport('json')}>JSON</Button>
            <Button onClick={() => onExport('svg')}>SVG</Button>
            <Button onClick={() => onExport('drawio')}>draw.io</Button>
            <Button onClick={() => onExport('drawnix')}>Drawnix</Button>
          </div>
          <p className="arch-muted mt-2 text-xs leading-5">
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

function RiskMatrix({ risks }: { risks: Array<{ id: string; title: string; probability: number; impact: number; exposure: number }> }) {
  return (
    <section className="arch-card rounded-lg p-3">
      <p className="arch-primary-text text-xs font-medium">D3 风险矩阵</p>
      <div className="mt-2 rounded-md border border-[var(--arch-border)] bg-[var(--arch-surface-muted)]">
        <svg width="300" height="220" role="img" aria-label="风险矩阵">
          <rect x="36" y="20" width="220" height="160" fill="#ecfdf5" stroke="var(--arch-border)" />
          <line x1="36" y1="100" x2="256" y2="100" stroke="var(--arch-border)" />
          <line x1="146" y1="20" x2="146" y2="180" stroke="var(--arch-border)" />
          {risks.map((risk) => (
            <circle
              key={risk.id}
              cx={36 + risk.probability * 220}
              cy={180 - risk.impact * 160}
              r={8 + risk.exposure * 16}
              fill={risk.exposure > 0.35 ? '#ef4444' : '#f59e0b'}
              opacity="0.78"
            />
          ))}
          <text x="116" y="206" className="fill-[var(--arch-muted)] text-[11px]">概率</text>
          <text x="4" y="98" className="fill-[var(--arch-muted)] text-[11px]">影响</text>
        </svg>
      </div>
    </section>
  );
}

function ResourceLoad({ data }: { data: Array<{ resourceId: string; name: string; load: number; capacity: number }> }) {
  const maxLoad = Math.max(1, ...data.map((item) => item.load));
  return (
    <section className="arch-card rounded-lg p-3">
      <p className="arch-primary-text text-xs font-medium">资源负荷</p>
      <div className="mt-3 grid gap-2">
        {data.map((item) => (
          <div key={item.resourceId}>
            <div className="flex justify-between text-xs font-medium">
              <span>{item.name}</span>
              <span>{item.load} 天</span>
            </div>
            <div className="mt-1 h-2 rounded-full bg-[var(--arch-surface-muted)]">
              <div className="h-2 rounded-full bg-[var(--arch-primary)]" style={{ width: `${Math.max(8, item.load / maxLoad * 100)}%` }} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function KanbanBoard({ columns }: { columns: Record<PlanningTaskStatus, PlanningTask[]> }) {
  return (
    <section className="grid gap-2 md:grid-cols-5">
      {taskStatusOptions.map((status) => (
        <div key={status.value} className="arch-card rounded-lg p-3">
          <p className="arch-primary-text text-xs font-medium">{status.label}</p>
          <div className="mt-2 grid gap-2">
            {columns[status.value].map((task) => (
              <div key={task.id} className="arch-card-muted rounded-md p-2">
                <p className="arch-text text-xs font-medium">{task.title}</p>
                <p className="arch-muted mt-1 text-[11px]">{task.owner} · {task.progress}%</p>
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
      <p className="arch-primary-text text-xs font-medium">RACI 矩阵</p>
      <div className="mt-2 grid gap-2">
        {model.raci.map((entry) => {
          const wbs = model.wbs.find((item) => item.id === entry.workPackageId);
          return (
            <div key={entry.workPackageId} className="arch-card-muted rounded-md p-2">
              <p className="arch-text text-xs font-medium">{wbs?.code} · {wbs?.title}</p>
              <p className="arch-muted mt-1 text-[11px]">R {entry.responsible} / A {entry.accountable}</p>
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
          <p className="arch-primary-text text-xs font-medium">导出与 CDE 文件</p>
          <h3 className="arch-text text-base font-medium">{exportPreview.fileName}</h3>
        </div>
        <div className="flex gap-2">
          <Button icon={<CloudUploadOutlined />} onClick={() => onExport('json')}>JSON</Button>
          <Button icon={<CloudUploadOutlined />} onClick={() => onExport('csv')}>CSV</Button>
          <Button icon={<CloudUploadOutlined />} onClick={() => onExport('mermaid')}>MMD</Button>
        </div>
      </div>
      <pre className="mt-3 max-h-80 overflow-auto rounded-md bg-[var(--arch-surface-muted)] p-3 text-xs leading-5">
        {exportPreview.content.slice(0, 2600)}
      </pre>
      <pre className="mt-3 max-h-44 overflow-auto rounded-md bg-[var(--arch-surface-muted)] p-3 text-xs leading-5">
        {mermaid}
      </pre>
    </section>
  );
}

function AiAdvisorPanel({ advice }: { advice: ReturnType<typeof runPlanningAiAdvisor> }) {
  return (
    <section className="arch-card rounded-lg p-3">
      <p className="arch-primary-text text-xs font-medium">AI 计划顾问</p>
      <div className="mt-3 grid gap-2">
        {advice.map((item) => (
          <div key={item.id} className="rounded-md border border-[var(--arch-border)] p-3">
            <Tag color={item.severity === 'high' || item.severity === 'critical' ? 'red' : 'gold'}>{item.severity}</Tag>
            <p className="arch-text mt-2 text-sm font-medium">{item.title}</p>
            <p className="arch-muted mt-1 text-xs leading-5">{item.recommendation}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 rounded-md border border-[var(--arch-border)] px-3 py-2 text-sm">
      <span className="arch-muted">{label}</span>
      <span className="arch-text font-medium">{value}</span>
    </div>
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
