// components/ComponentBomWorkbench.tsx - Component material BOM import workbench
// License: Apache-2.0
"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Database,
  Download,
  FileSpreadsheet,
  Play,
  Save,
  Search,
  Send,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  Alert,
  Button,
  Input,
  InputNumber,
  Segmented,
  Table,
  Tag,
  Tooltip,
  type ColumnsType,
} from "@/components/pan-ui";
import {
  componentBomSourceWorkbooks,
  createComponentBomImportManifest,
  createComponentBomWorkflowState,
  issuesForLine,
  runComponentBomAction,
  type ComponentBomLine,
  type ComponentBomValidationIssue,
  type ComponentBomWorkflowAction,
} from "@/lib/component-bom";
import { createModuleAuditEvent } from "@/lib/module-actions";
import type { ModuleAuditEvent } from "@/lib/module-file-system";

type ComponentBomView = "lines" | "issues" | "sources";

const viewOptions: Array<{ label: string; value: ComponentBomView }> = [
  { label: "清单", value: "lines" },
  { label: "校验", value: "issues" },
  { label: "源表", value: "sources" },
];

const issueTone: Record<ComponentBomValidationIssue["severity"], string> = {
  error: "red",
  warning: "gold",
  info: "cyan",
};

export function ComponentBomWorkbench({
  onAudit,
}: {
  onAudit?: (event: ModuleAuditEvent) => void;
}) {
  const [workflow, setWorkflow] = useState(createComponentBomWorkflowState);
  const [activeView, setActiveView] = useState<ComponentBomView>("lines");
  const [query, setQuery] = useState("");
  const [selectedLineNo, setSelectedLineNo] = useState(1);

  const manifest = workflow.manifest;
  const selectedLine =
    manifest.lines.find((line) => line.lineNo === selectedLineNo) ??
    manifest.lines[0];
  const selectedIssues = selectedLine
    ? issuesForLine(manifest.issues, selectedLine.lineNo)
    : [];

  const filteredLines = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return manifest.lines;
    return manifest.lines.filter((line) =>
      [
        line.lineNo,
        line.categoryName,
        line.categoryCode,
        line.componentName,
        line.drawingNo,
        line.materialGrade,
      ]
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  }, [manifest.lines, query]);

  const filteredIssues = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return manifest.issues;
    return manifest.issues.filter((issue) =>
      [
        issue.lineNo,
        issue.code,
        issue.message,
        issue.componentName,
        issue.categoryCode,
      ]
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  }, [manifest.issues, query]);

  const lineIssueCounts = useMemo(() => {
    const counts = new Map<number, number>();
    for (const issue of manifest.issues) {
      counts.set(issue.lineNo, (counts.get(issue.lineNo) ?? 0) + 1);
    }
    return counts;
  }, [manifest.issues]);

  function emitAudit(action: string, message: string) {
    onAudit?.(
      createModuleAuditEvent(
        `component-bom-${action}`,
        "ComponentBomWorkbench",
        message,
      ),
    );
  }

  function handleAction(action: ComponentBomWorkflowAction) {
    setWorkflow((current) => {
      const next = runComponentBomAction(current, action);
      emitAudit(action, next.lastMessage);
      return next;
    });
  }

  function patchSelectedLine(patch: Partial<ComponentBomLine>) {
    if (!selectedLine) return;
    setWorkflow((current) => {
      const lines = current.manifest.lines.map((line) =>
        line.lineNo === selectedLine.lineNo ? { ...line, ...patch } : line,
      );
      const nextManifest = createComponentBomImportManifest(lines);
      return {
        ...current,
        manifest: nextManifest,
        workflowState: "professional_review_required",
        lastMessage: `第 ${selectedLine.lineNo} 行已编辑，等待重新校验。`,
        auditTrail: [
          ...current.auditTrail,
          `${new Date().toISOString()}: edit_line_${selectedLine.lineNo}`,
        ],
      };
    });
  }

  function handleSaveLine() {
    if (!selectedLine) return;
    emitAudit("save-line", `构件BOM第 ${selectedLine.lineNo} 行已保存为待复核草稿。`);
    setWorkflow((current) => ({
      ...current,
      lastMessage: `第 ${selectedLine.lineNo} 行已保存为待复核草稿。`,
    }));
  }

  const lineColumns: ColumnsType<ComponentBomLine> = [
    {
      title: "行",
      dataIndex: "lineNo",
      key: "lineNo",
      width: 56,
      render: (value: number) => <span className="font-mono">{value}</span>,
    },
    {
      title: "SJG类目",
      dataIndex: "categoryCode",
      key: "categoryCode",
      width: 168,
      render: (_, line) => (
        <div className="component-bom-table-cell">
          <span className="font-mono">{line.categoryCode}</span>
          <span>{line.categoryName}</span>
        </div>
      ),
    },
    {
      title: "构件名称",
      dataIndex: "componentName",
      key: "componentName",
      render: (value: string) => (
        <Tooltip title={value}>
          <span className="component-bom-mono-truncate">{value}</span>
        </Tooltip>
      ),
    },
    {
      title: "长度",
      dataIndex: "lengthMm",
      key: "lengthMm",
      width: 92,
      render: (value: number) => `${value} mm`,
    },
    {
      title: "数量",
      dataIndex: "totalQuantity",
      key: "totalQuantity",
      width: 78,
      render: (value: number, line) => `${value} ${line.unit}`,
    },
    {
      title: "校验",
      key: "issues",
      width: 86,
      render: (_, line) => {
        const count = lineIssueCounts.get(line.lineNo) ?? 0;
        return count > 0 ? (
          <Tag color="gold">{count}项</Tag>
        ) : (
          <Tag color="green">通过</Tag>
        );
      },
    },
  ];

  const issueColumns: ColumnsType<ComponentBomValidationIssue> = [
    {
      title: "级别",
      dataIndex: "severity",
      key: "severity",
      width: 84,
      render: (value: ComponentBomValidationIssue["severity"]) => (
        <Tag color={issueTone[value]}>{value}</Tag>
      ),
    },
    {
      title: "问题",
      dataIndex: "message",
      key: "message",
      render: (_, issue) => (
        <div className="component-bom-table-cell">
          <span>{issue.message}</span>
          <span className="font-mono text-[var(--arch-text-muted)]">
            {issue.code}
          </span>
        </div>
      ),
    },
    {
      title: "构件",
      dataIndex: "componentName",
      key: "componentName",
      render: (value: string) => (
        <Tooltip title={value}>
          <span className="component-bom-mono-truncate">{value}</span>
        </Tooltip>
      ),
    },
    {
      title: "源",
      key: "source",
      width: 128,
      render: (_, issue) => `${issue.source.sheet}!${issue.source.column}`,
    },
  ];

  return (
    <section className="open-cde-business-panel component-bom-workbench">
      <div className="component-bom-toolbar">
        <div className="component-bom-title">
          <FileSpreadsheet className="h-5 w-5" />
          <div>
            <h2>构件物料清单</h2>
            <p>应舍美居 · SJG 157 · 标准化命名规则</p>
          </div>
        </div>
        <div className="component-bom-actions">
          <Button icon={<Upload className="h-4 w-4" />} onClick={() => handleAction("import_sources")}>
            导入
          </Button>
          <Button icon={<Play className="h-4 w-4" />} onClick={() => handleAction("validate")}>
            校验
          </Button>
          <Button icon={<Send className="h-4 w-4" />} onClick={() => handleAction("submit_review")}>
            提交
          </Button>
          <Button icon={<ShieldCheck className="h-4 w-4" />} onClick={() => handleAction("approve")}>
            批准
          </Button>
          <Button icon={<CheckCircle2 className="h-4 w-4" />} onClick={() => handleAction("publish")}>
            发布
          </Button>
          <Button icon={<Download className="h-4 w-4" />} onClick={() => handleAction("export")}>
            导出
          </Button>
        </div>
      </div>

      <div className="component-bom-status-row">
        <Tag color="green">{manifest.schema}</Tag>
        <Tag color={workflow.workflowState === "blocked" ? "red" : "gold"}>
          {workflow.workflowState}
        </Tag>
        <Tag color="cyan">{manifest.adapter}</Tag>
        <span>{workflow.lastMessage}</span>
      </div>

      {workflow.blockedReason ? (
        <Alert
          showIcon
          type="warning"
          message="下游发布被阻止"
          description={workflow.blockedReason}
        />
      ) : (
        <Alert
          showIcon
          type="info"
          message={`${manifest.counts.validationWarnings} 个校验警告，${manifest.counts.validationErrors} 个错误`}
          description="BOM 保持 professional_review_required，重量缺失不自动估算。"
        />
      )}

      <div className="component-bom-kpi-grid">
        <Metric label="SJG 157 类目" value={manifest.counts.sjg157Categories} />
        <Metric label="命名规则" value={manifest.counts.namingRules} />
        <Metric label="BOM 行" value={manifest.counts.bomLines} />
        <Metric label="类目参照" value={manifest.counts.categoryReferences} />
        <Metric label="总数量" value={manifest.summary.totalQuantity} />
        <Metric label="总重量kg" value={manifest.summary.totalWeightKg} />
      </div>

      <div className="component-bom-main-grid">
        <div className="component-bom-section">
          <div className="component-bom-section-head">
            <Segmented
              options={viewOptions}
              value={activeView}
              onChange={setActiveView}
            />
            <Input
              aria-label="搜索构件BOM"
              className="component-bom-search"
              placeholder="搜索编码/构件/图号"
              prefix={<Search className="h-4 w-4" />}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>

          {activeView === "lines" ? (
            <Table
              columns={lineColumns}
              dataSource={filteredLines}
              rowKey="lineNo"
              rowClassName={(line) =>
                line.lineNo === selectedLine?.lineNo
                  ? "component-bom-row-selected"
                  : ""
              }
              onRow={(line) => ({
                onClick: () => setSelectedLineNo(line.lineNo),
              })}
            />
          ) : null}

          {activeView === "issues" ? (
            <Table
              columns={issueColumns}
              dataSource={filteredIssues}
              rowKey="id"
            />
          ) : null}

          {activeView === "sources" ? (
            <div className="component-bom-source-list">
              {Object.values(componentBomSourceWorkbooks).map((source) => (
                <div className="component-bom-source-row" key={source.key}>
                  <Database className="h-4 w-4" />
                  <div>
                    <strong>{source.name}</strong>
                    <span>{source.path}</span>
                  </div>
                  <Tag color="green">{source.expectedRows}</Tag>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        {selectedLine ? (
          <aside className="component-bom-editor">
            <div className="component-bom-editor-head">
              <span>第 {selectedLine.lineNo} 行</span>
              <Tag color={selectedIssues.length > 0 ? "gold" : "green"}>
                {selectedIssues.length > 0 ? `${selectedIssues.length}项` : "通过"}
              </Tag>
            </div>
            <label>
              <span>构件名称</span>
              <Input
                value={selectedLine.componentName}
                onChange={(event) =>
                  patchSelectedLine({ componentName: event.target.value })
                }
              />
            </label>
            <label>
              <span>SJG 编码</span>
              <Input
                value={selectedLine.categoryCode}
                onChange={(event) =>
                  patchSelectedLine({ categoryCode: event.target.value })
                }
              />
            </label>
            <div className="component-bom-editor-grid">
              <label>
                <span>长度mm</span>
                <InputNumber
                  value={selectedLine.lengthMm}
                  onChange={(value) =>
                    patchSelectedLine({ lengthMm: value ?? 0 })
                  }
                />
              </label>
              <label>
                <span>总数量</span>
                <InputNumber
                  value={selectedLine.totalQuantity}
                  onChange={(value) =>
                    patchSelectedLine({ totalQuantity: value ?? 0 })
                  }
                />
              </label>
            </div>
            <div className="component-bom-issue-list">
              {selectedIssues.length > 0 ? (
                selectedIssues.map((issue) => (
                  <div className="component-bom-issue-row" key={issue.id}>
                    <AlertTriangle className="h-4 w-4" />
                    <span>{issue.message}</span>
                  </div>
                ))
              ) : (
                <div className="component-bom-issue-row component-bom-issue-row-ok">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>当前行无校验问题</span>
                </div>
              )}
            </div>
            <Button
              block
              icon={<Save className="h-4 w-4" />}
              type="primary"
              onClick={handleSaveLine}
            >
              保存
            </Button>
          </aside>
        ) : null}
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="component-bom-kpi">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
