// components/DetailedDesignCodeAsRoomWorkbench.tsx - Code-as-Room detailed design workbench
// License: Apache-2.0
"use client";

import {
  Button,
  Input,
  Progress,
  Segmented,
  Select,
  Table,
  Tag,
  Tooltip,
  type ColumnsType,
} from "@/components/pan-ui";
import {
  AlertTriangle,
  Box,
  Braces,
  Camera,
  CheckCircle2,
  CircleDashed,
  Code2,
  FileJson,
  GitBranch,
  ImageIcon,
  Layers3,
  Play,
  RotateCw,
  Save,
  ShieldCheck,
  Sparkles,
  Upload,
  Video,
  Wand2,
} from "lucide-react";
import { useMemo, useState, type ChangeEvent, type ReactNode } from "react";
import {
  buildCodeAsRoomRunManifest,
  codeAsRoomResultMedia,
  codeAsRoomScenes,
  generateCodeAsRoomDesignCandidates,
  type CodeAsRoomArtifact,
  type CodeAsRoomDesignBrief,
  type CodeAsRoomDesignCandidate,
  type CodeAsRoomObject,
  type CodeAsRoomStage,
  type CodeAsRoomStageStatus,
} from "@/lib/code-as-room";
import { createModuleAuditEvent } from "@/lib/module-actions";
import type { ModuleAuditEvent } from "@/lib/module-file-system";
import { moduleFileApiClient } from "@/lib/module-file-api-client";

type DetailTab = "graph" | "memory" | "artifacts" | "code" | "results";

const statusTone: Record<
  CodeAsRoomStageStatus,
  { text: string; className: string; tagColor: string }
> = {
  complete: {
    text: "完成",
    className: "border-emerald-300 bg-emerald-50 text-emerald-700",
    tagColor: "green",
  },
  running: {
    text: "运行中",
    className: "border-sky-300 bg-sky-50 text-sky-700",
    tagColor: "blue",
  },
  queued: {
    text: "排队",
    className: "border-slate-200 bg-slate-50 text-slate-600",
    tagColor: "default",
  },
  blocked: {
    text: "阻塞",
    className: "border-rose-300 bg-rose-50 text-rose-700",
    tagColor: "red",
  },
};

const artifactColumns: ColumnsType<CodeAsRoomArtifact> = [
  {
    title: "交付物",
    dataIndex: "name",
    key: "name",
    render: (value: string, item) => (
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold text-slate-900">
          {value}
        </div>
        <div className="text-xs text-slate-500">{item.sourceStage}</div>
      </div>
    ),
  },
  { title: "格式", dataIndex: "format", key: "format", width: 130 },
  { title: "责任边界", dataIndex: "owner", key: "owner", width: 160 },
  {
    title: "状态",
    dataIndex: "status",
    key: "status",
    width: 92,
    render: (value: CodeAsRoomStageStatus) => (
      <Tag color={statusTone[value].tagColor}>{statusTone[value].text}</Tag>
    ),
  },
];

export function DetailedDesignCodeAsRoomWorkbench({
  onAudit,
}: {
  onAudit?: (event: ModuleAuditEvent) => void;
}) {
  const [sceneId, setSceneId] = useState(codeAsRoomScenes[0]?.id ?? "");
  const [designPrompt, setDesignPrompt] = useState(
    "生成一个现代住宅客厅，保留俯视图主要布局，补齐柜体、茶几小物、绿植、灯光和可重渲染材质。",
  );
  const [designMode, setDesignMode] =
    useState<CodeAsRoomDesignBrief["mode"]>("render");
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
  const [uploadedImageName, setUploadedImageName] = useState<string | null>(
    null,
  );
  const [generatedCandidates, setGeneratedCandidates] = useState<
    CodeAsRoomDesignCandidate[]
  >([]);
  const [activeCandidateId, setActiveCandidateId] = useState<string | null>(
    null,
  );
  const [activeTab, setActiveTab] = useState<DetailTab>("graph");
  const [runState, setRunState] = useState(
    "就绪 · 输入设计意图后点击“AI 生成设计”",
  );

  const fallbackManifest = useMemo(
    () => buildCodeAsRoomRunManifest(sceneId),
    [sceneId],
  );
  const activeCandidate =
    generatedCandidates.find(
      (candidate) => candidate.id === activeCandidateId,
    ) ??
    generatedCandidates[0] ??
    null;
  const manifest = activeCandidate?.manifest ?? fallbackManifest;
  const scene = manifest.scene;
  const completeCount = manifest.stages.filter(
    (stage) => stage.status === "complete",
  ).length;
  const progress = Math.round((completeCount / manifest.stages.length) * 100);
  const phaseGroups = manifest.stages.reduce<Record<string, CodeAsRoomStage[]>>(
    (groups, stage) => {
      groups[stage.phase] = [...(groups[stage.phase] ?? []), stage];
      return groups;
    },
    {},
  );

  function emit(action: string, summary: string) {
    onAudit?.(
      createModuleAuditEvent(
        action,
        "DetailedDesignCodeAsRoomWorkbench",
        summary,
      ),
    );
  }

  function runPipeline() {
    if (!activeCandidate && generatedCandidates.length === 0) {
      generateDesign();
      return;
    }
    const summary = `Code-as-Room ${scene.name} 已登记 Stage0-12 流水线，输出保持 professional_review_required。`;
    setRunState(summary);
    emit("code-as-room-stage0-12-run", summary);
  }

  function generateDesign() {
    const candidates = generateCodeAsRoomDesignCandidates({
      prompt: designPrompt,
      sceneId,
      ...(uploadedImageUrl ? { sourceImageUrl: uploadedImageUrl } : {}),
      ...(uploadedImageName ? { sourceImageName: uploadedImageName } : {}),
      mode: designMode,
    });
    setGeneratedCandidates(candidates);
    setActiveCandidateId(candidates[0]?.id ?? null);
    const summary = `AI 已生成 ${candidates.length} 个 Code-as-Room 设计候选，已写入 scene graph、stage memory 和 Blender code 预览。`;
    setRunState(summary);
    emit("code-as-room-ai-generate-design", summary);
  }

  function selectCandidate(candidate: CodeAsRoomDesignCandidate) {
    setActiveCandidateId(candidate.id);
    const summary = `已选择 ${candidate.title} · ${candidate.score} 分，等待 Stage0-12 复核和 worker 执行。`;
    setRunState(summary);
    emit("code-as-room-ai-candidate-select", summary);
  }

  function handleImageUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : null;
      if (!result) return;
      setUploadedImageUrl(result);
      setUploadedImageName(file.name);
      const summary = `已载入俯视图 ${file.name}，下一次 AI 生成将以该图作为 Code-as-Room 输入。`;
      setRunState(summary);
      emit("code-as-room-input-image-loaded", summary);
    };
    reader.readAsDataURL(file);
  }

  function resumeFromStage5() {
    const summary =
      "已从 Stage5 对象画像续跑到 Stage12 渲染脚本，复用跨阶段 memory 和 scene graph。";
    setRunState(summary);
    emit("code-as-room-resume-stage5", summary);
  }

  async function archiveManifest() {
    const content = JSON.stringify(manifest, null, 2);
    const filename = `code-as-room-run-${scene.id}-${Date.now()}.json`;
    try {
      await moduleFileApiClient.createModuleFile({
        moduleId: "detailed_design",
        name: filename,
        kind: "file",
        mimeType: "application/json",
        sizeBytes: new Blob([content]).size,
        owner: "深化设计师",
        tags: [
          "code-as-room",
          "run-manifest",
          "blender-code",
          "professional_review_required",
        ],
        content,
      });
      const summary = `已归档 ${filename}，包含 scene graph、memory、stage artifacts 和 Blender 脚本预览。`;
      setRunState(summary);
      emit("code-as-room-manifest-archive", summary);
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown error";
      const summary = `Code-as-Room 运行清单归档失败: ${message}`;
      setRunState(summary);
      emit("code-as-room-manifest-archive-failed", summary);
    }
  }

  async function archiveRenderScript() {
    const filename = `render_output-${scene.id}-${Date.now()}.py`;
    try {
      await moduleFileApiClient.createModuleFile({
        moduleId: "detailed_design",
        name: filename,
        kind: "file",
        mimeType: "text/x-python",
        sizeBytes: new Blob([manifest.finalBlenderScript]).size,
        owner: "Blender Worker",
        tags: [
          "code-as-room",
          "stage12",
          "render_output.py",
          "worker_review_required",
        ],
        content: manifest.finalBlenderScript,
      });
      const summary = `已归档 ${filename}，等待 Blender worker 沙箱执行与安全审计。`;
      setRunState(summary);
      emit("code-as-room-render-script-archive", summary);
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown error";
      const summary = `Stage12 render_output.py 归档失败: ${message}`;
      setRunState(summary);
      emit("code-as-room-render-script-archive-failed", summary);
    }
  }

  return (
    <section
      className="open-cde-business-panel h-full min-h-0 overflow-auto bg-white p-4 text-slate-950"
      data-business-context-root="code-as-room"
    >
      <div className="flex min-w-0 flex-col gap-4">
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600 text-white">
                <Box size={18} />
              </span>
              <div>
                <h2 className="m-0 text-xl font-semibold tracking-normal text-slate-950">
                  深化设计 · Code-as-Room 工作台
                </h2>
                <p className="m-0 max-w-4xl text-sm text-slate-600">
                  单张俯视图输入，经过 scene graph、Blender layout
                  code、对象几何、 PBR 材质、纹理与灯光，生成可执行的 3D room
                  code。
                </p>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              icon={<Play size={16} />}
              type="primary"
              onClick={runPipeline}
            >
              运行 Stage0-12
            </Button>
            <Button icon={<RotateCw size={16} />} onClick={resumeFromStage5}>
              从 Stage5 续跑
            </Button>
            <Button icon={<FileJson size={16} />} onClick={archiveManifest}>
              归档运行清单
            </Button>
            <Button icon={<Save size={16} />} onClick={archiveRenderScript}>
              归档 render_output.py
            </Button>
          </div>
        </header>

        <section className="rounded-lg border border-emerald-200 bg-emerald-50/70 p-3">
          <div className="grid gap-3 xl:grid-cols-[1.1fr_0.9fr]">
            <div className="min-w-0">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-emerald-900">
                <Sparkles size={17} />
                <span>AI 生成设计</span>
                <Tag color="green">Code-as-Room</Tag>
              </div>
              <Input.TextArea
                value={designPrompt}
                onChange={(event) => setDesignPrompt(event.target.value)}
                autoSize={{ minRows: 3, maxRows: 5 }}
                placeholder="输入设计意图，例如：现代客厅、开放厨房、卧室带书桌、保留俯视图布局并生成可重渲染材质"
              />
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Segmented
                  value={designMode}
                  options={[
                    { label: "布局优先", value: "layout" },
                    { label: "细节增强", value: "detail" },
                    { label: "重渲染", value: "render" },
                  ]}
                  onChange={(value) =>
                    setDesignMode(value as CodeAsRoomDesignBrief["mode"])
                  }
                />
                <label className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:border-emerald-500">
                  <Upload size={15} />
                  <span>{uploadedImageName ?? "上传俯视图"}</span>
                  <input
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    type="file"
                    onChange={handleImageUpload}
                  />
                </label>
                <Button
                  type="primary"
                  icon={<Wand2 size={16} />}
                  onClick={generateDesign}
                >
                  AI 生成设计
                </Button>
              </div>
            </div>
            <div className="rounded-md border border-emerald-200 bg-white p-3">
              <div className="mb-2 text-xs font-semibold uppercase text-slate-500">
                Router job envelope
              </div>
              <div className="space-y-2 text-sm text-slate-700">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={15} className="text-emerald-600" />
                  <span>Planner: 解析设计意图与输入图</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={15} className="text-emerald-600" />
                  <span>Generator: Code-as-Room Stage0-12</span>
                </div>
                <div className="flex items-center gap-2">
                  <CircleDashed size={15} className="text-slate-500" />
                  <span>Blender Worker: 等待沙箱执行 render_output.py</span>
                </div>
                <div className="font-mono text-xs text-slate-500">
                  ModelRouter / InferenceRouter / CDE Audit / Approver
                </div>
              </div>
            </div>
          </div>
          {generatedCandidates.length > 0 ? (
            <div className="mt-3 grid gap-2 lg:grid-cols-3">
              {generatedCandidates.map((candidate) => (
                <button
                  key={candidate.id}
                  type="button"
                  onClick={() => selectCandidate(candidate)}
                  className={`rounded-md border p-3 text-left transition ${
                    candidate.id === activeCandidate?.id
                      ? "border-emerald-500 bg-white shadow-sm"
                      : "border-emerald-100 bg-white/70 hover:border-emerald-400"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-slate-900">
                      {candidate.title}
                    </span>
                    <Tag color={candidate.score >= 90 ? "green" : "gold"}>
                      {candidate.score}
                    </Tag>
                  </div>
                  <p className="m-0 mt-2 line-clamp-2 text-xs text-slate-600">
                    {candidate.designNotes[0]}
                  </p>
                  <div className="mt-2 truncate font-mono text-[11px] text-slate-500">
                    {candidate.route}
                  </div>
                </button>
              ))}
            </div>
          ) : null}
        </section>

        <div className="grid gap-3 lg:grid-cols-[1.1fr_1fr_1.1fr]">
          <MetricPanel
            icon={<ImageIcon size={18} />}
            title="Top-down input"
            value={activeCandidate ? "AI generated design" : scene.roomType}
            detail={`${scene.dimensions.widthM}m x ${scene.dimensions.depthM}m x ${scene.dimensions.heightM}m`}
          />
          <MetricPanel
            icon={<Layers3 size={18} />}
            title="Pipeline"
            value={`Stage0-12 · ${progress}%`}
            detail={`${completeCount}/${manifest.stages.length} stages complete, Stage11 texture running`}
          />
          <MetricPanel
            icon={<ShieldCheck size={18} />}
            title="CDE gate"
            value="professional_review_required"
            detail="Planner -> Generator -> Evaluator -> RuleChecker -> SchemaValidator -> Approver"
          />
        </div>

        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} />
            <span className="font-semibold">边界:</span>
            <span>
              这里接入的是 Code-as-Room 效果和运行清单壳层；真实推理必须经
              ModelRouter / InferenceRouter 与 Blender worker
              沙箱，不直接从前端调用模型。
            </span>
          </div>
        </div>

        <main className="grid gap-4 xl:grid-cols-[0.9fr_1.2fr_1fr]">
          <section className="rounded-lg border border-slate-200 bg-white p-3">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div>
                <h3 className="m-0 text-base font-semibold text-slate-950">
                  输入俯视图
                </h3>
                <p className="m-0 text-xs text-slate-500">
                  叠加对象框用于显示 Stage1/2 结构化结果。
                </p>
              </div>
              <Select
                className="min-w-48"
                value={sceneId}
                options={codeAsRoomScenes.map((item) => ({
                  value: item.id,
                  label: item.name,
                }))}
                onChange={setSceneId}
              />
            </div>
            <div className="relative overflow-hidden rounded-md border border-slate-200 bg-slate-50">
              <div className="relative aspect-[16/10]">
                {/* eslint-disable-next-line @next/next/no-img-element -- external research/demo images are not guaranteed in Next image remotePatterns. */}
                <img
                  alt={`${scene.name} top-down room input`}
                  className="absolute inset-0 h-full w-full object-contain"
                  src={scene.inputImageUrl}
                />
                {scene.objects.map((item) => (
                  <ObjectOverlay key={item.id} item={item} />
                ))}
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <SmallFact label="风格" value={scene.style} />
              <SmallFact label="对象" value={`${scene.objects.length} 个`} />
              <SmallFact label="区域" value={`${scene.sceneGraph.length} 个`} />
              <SmallFact label="输出" value="Blender Python" />
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-3">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="m-0 text-base font-semibold text-slate-950">
                  Cross-stage Pipeline
                </h3>
                <p className="m-0 text-xs text-slate-500">
                  五个阶段组按 memory 传递 typed stage output。
                </p>
              </div>
              <Progress
                percent={progress}
                size="small"
                className="max-w-48"
                strokeColor="#16a34a"
              />
            </div>
            <div className="flex flex-col gap-3">
              {Object.entries(phaseGroups).map(([phase, stages]) => (
                <div
                  key={phase}
                  className="rounded-md border border-slate-100 p-2"
                >
                  <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase text-slate-500">
                    <GitBranch size={14} />
                    <span>{phase}</span>
                  </div>
                  <div className="grid gap-2 md:grid-cols-2">
                    {stages.map((stage) => (
                      <div
                        key={stage.id}
                        className={`rounded-md border p-2 ${statusTone[stage.status].className}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold">
                            Stage{stage.index}
                          </span>
                          {stage.status === "complete" ? (
                            <CheckCircle2 size={14} />
                          ) : (
                            <CircleDashed size={14} />
                          )}
                        </div>
                        <div className="mt-1 text-sm font-semibold">
                          {stage.title}
                        </div>
                        <div className="mt-1 line-clamp-2 text-xs">
                          {stage.summary}
                        </div>
                        <div className="mt-2 truncate font-mono text-[11px]">
                          {stage.output}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-3">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div>
                <h3 className="m-0 text-base font-semibold text-slate-950">
                  生成 3D 场景
                </h3>
                <p className="m-0 text-xs text-slate-500">
                  以官方 walkthrough 作为效果参照，运行清单保存为 CDE 证据。
                </p>
              </div>
              <Tag color="green">CaR</Tag>
            </div>
            <div className="overflow-hidden rounded-md border border-slate-200 bg-slate-950">
              <video
                className="aspect-video w-full bg-black object-contain"
                controls
                muted
                playsInline
                preload="metadata"
                src={scene.videoUrl}
              />
            </div>
            <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-3">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900">
                <Wand2 size={16} />
                <span>Room-code preview</span>
              </div>
              <div className="relative aspect-[16/10] rounded border border-slate-200 bg-gradient-to-br from-slate-100 via-white to-emerald-50">
                <div className="absolute inset-[10%] rounded border-4 border-slate-300 bg-[#f5efe4] shadow-inner">
                  {scene.objects.map((item) => (
                    <div
                      key={item.id}
                      className="absolute rounded-sm border border-white/70 shadow-sm"
                      style={{
                        background: item.color,
                        height: `${Math.max(item.d, 3)}%`,
                        left: `${item.x - item.w / 2}%`,
                        top: `${item.y - item.d / 2}%`,
                        transform: `rotate(${item.rotationDeg}deg)`,
                        width: `${Math.max(item.w, 3)}%`,
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </section>
        </main>

        <section className="rounded-lg border border-slate-200 bg-white p-3">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm text-slate-700">
              <Code2 size={16} />
              <span>{runState}</span>
            </div>
            <Segmented
              value={activeTab}
              options={[
                { label: "Scene Graph", value: "graph" },
                { label: "Memory", value: "memory" },
                { label: "Artifacts", value: "artifacts" },
                { label: "Code", value: "code" },
                { label: "Results", value: "results" },
              ]}
              onChange={(value) => setActiveTab(value as DetailTab)}
            />
          </div>
          {activeCandidate ? (
            <div className="mb-3 grid gap-2 md:grid-cols-3">
              {activeCandidate.designNotes.map((note) => (
                <div
                  key={note}
                  className="rounded-md border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs text-emerald-900"
                >
                  {note}
                </div>
              ))}
            </div>
          ) : null}
          {activeTab === "graph" ? <SceneGraphView scene={scene} /> : null}
          {activeTab === "memory" ? (
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {manifest.memory.map((entry) => (
                <div
                  key={entry.id}
                  className="rounded-md border border-slate-200 bg-slate-50 p-3"
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-slate-900">
                      {entry.title}
                    </span>
                    <Tag>{entry.stage}</Tag>
                  </div>
                  <p className="m-0 text-sm text-slate-600">{entry.summary}</p>
                  <div className="mt-3 flex flex-wrap gap-1">
                    {entry.tags.map((tag) => (
                      <Tag key={tag}>{tag}</Tag>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
          {activeTab === "artifacts" ? (
            <Table
              columns={artifactColumns}
              dataSource={manifest.artifacts}
              pagination={false}
              rowKey="id"
              size="small"
            />
          ) : null}
          {activeTab === "code" ? (
            <pre className="max-h-96 overflow-auto rounded-md bg-slate-950 p-4 text-xs leading-5 text-emerald-100">
              {manifest.finalBlenderScript}
            </pre>
          ) : null}
          {activeTab === "results" ? <ResultMediaGrid /> : null}
        </section>
      </div>
    </section>
  );
}

function MetricPanel({
  icon,
  title,
  value,
  detail,
}: {
  icon: ReactNode;
  title: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase text-slate-500">
        {icon}
        <span>{title}</span>
      </div>
      <div className="truncate text-lg font-semibold text-slate-950">
        {value}
      </div>
      <div className="mt-1 line-clamp-2 text-xs text-slate-600">{detail}</div>
    </div>
  );
}

function SmallFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-slate-200 bg-white p-2">
      <div className="text-[11px] uppercase text-slate-500">{label}</div>
      <div className="truncate text-sm font-semibold text-slate-900">
        {value}
      </div>
    </div>
  );
}

function ObjectOverlay({ item }: { item: CodeAsRoomObject }) {
  return (
    <Tooltip title={`${item.label} · ${item.kind}`}>
      <span
        className="absolute rounded-sm border-2 border-emerald-500/80 bg-emerald-400/10 shadow-sm"
        style={{
          height: `${Math.max(item.d, 4)}%`,
          left: `${item.x - item.w / 2}%`,
          top: `${item.y - item.d / 2}%`,
          transform: `rotate(${item.rotationDeg}deg)`,
          width: `${Math.max(item.w, 4)}%`,
        }}
      />
    </Tooltip>
  );
}

function SceneGraphView({
  scene,
}: {
  scene: ReturnType<typeof buildCodeAsRoomRunManifest>["scene"];
}) {
  return (
    <div className="grid gap-3 lg:grid-cols-3">
      {scene.sceneGraph.map((zone) => (
        <div
          key={zone.zone}
          className="rounded-md border border-slate-200 bg-slate-50 p-3"
        >
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Braces size={16} />
            <span>{zone.zone}</span>
          </div>
          <div className="mb-2 text-xs font-semibold uppercase text-slate-500">
            objects
          </div>
          <div className="mb-3 flex flex-wrap gap-1">
            {zone.objects.map((item) => (
              <Tag key={item} color="blue">
                {item}
              </Tag>
            ))}
          </div>
          <div className="mb-2 text-xs font-semibold uppercase text-slate-500">
            relations
          </div>
          <ul className="m-0 list-disc space-y-1 pl-4 text-sm text-slate-600">
            {zone.relations.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function ResultMediaGrid() {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {codeAsRoomResultMedia.map((item) => (
        <div
          key={item.id}
          className="overflow-hidden rounded-md border border-slate-200 bg-slate-50"
        >
          <div className="flex items-center gap-2 border-b border-slate-200 px-3 py-2 text-sm font-semibold text-slate-900">
            {item.type === "video" ? <Video size={15} /> : <Camera size={15} />}
            <span>{item.title}</span>
          </div>
          {item.type === "video" ? (
            <video
              className="aspect-video w-full bg-black object-contain"
              controls
              muted
              playsInline
              preload="metadata"
              src={item.url}
            />
          ) : (
            /* eslint-disable-next-line @next/next/no-img-element -- result media can be external demo output or user-provided URLs. */
            <img
              alt={item.title}
              className="aspect-video w-full bg-white object-contain"
              src={item.url}
            />
          )}
        </div>
      ))}
    </div>
  );
}
