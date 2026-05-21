// components/DetailedDesignPlanFinderWorkbench.tsx - AI residential plan studio for detailed design
// License: Apache-2.0
"use client";

import { OrbitControls } from "@react-three/drei";
import { Canvas, useThree } from "@react-three/fiber";
import { Button, Input, InputNumber, Select, Switch, Tag, Tooltip } from "antd";
import {
  Armchair,
  BoxSelect,
  ChevronLeft,
  ChevronRight,
  DoorOpen,
  Grid3X3,
  Home,
  Layers3,
  Library,
  PencilRuler,
  RefreshCw,
  Save,
  Sparkles,
  Trash2,
  Wand2,
} from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  buildAxisPositions,
  buildFurniture,
  buildGridLines,
  buildPlanCdePayload,
  candidateSummary,
  computeLiveSummary,
  createPlanCandidates,
  evaluatePlan,
  generatePlan,
  initialIntent,
  normalizePlanFromBlocks,
  paletteDefaults,
  parsePromptToIntent,
  rectFromBlock,
  rectToPolygon,
  roomColors,
  roomDefinitions,
  roundArea,
  safeFileName,
  scorePlan,
  snap,
  templates,
  type BlockRect,
  type FurnitureItem,
  type GeneratedPlan,
  type PlanBlock,
  type PlanCandidate,
  type PlanFinderMode,
  type RoomKey,
  type RoomRequirement,
  type StudioIntent,
  type TemplateRegistry,
} from "@/lib/architoken/floorplan-layout";
import { createModuleAuditEvent } from "@/lib/module-actions";
import type { ModuleAuditEvent } from "@/lib/module-file-system";
import { moduleFileApiClient } from "@/lib/module-file-api-client";

type SidePanelTab = "requirements" | "rooms" | "furnish" | "checks";

const planFinderModes: Array<{
  id: PlanFinderMode;
  label: string;
  icon: ReactNode;
}> = [
  { id: "generate", label: "Generate", icon: <Sparkles size={14} /> },
  { id: "fit", label: "Fit", icon: <BoxSelect size={14} /> },
  { id: "furnish", label: "Furnish", icon: <Armchair size={14} /> },
  { id: "manage", label: "Manage", icon: <Library size={14} /> },
];

const sidePanelTabs: Array<{ id: SidePanelTab; label: string }> = [
  { id: "requirements", label: "需求" },
  { id: "rooms", label: "房间" },
  { id: "furnish", label: "家具" },
  { id: "checks", label: "校核" },
];

export function DetailedDesignPlanFinderWorkbench({
  onAudit,
}: {
  onAudit?: (event: ModuleAuditEvent) => void;
}) {
  const [intent, setIntent] = useState<StudioIntent>(initialIntent);
  const [mode, setMode] = useState<PlanFinderMode>("generate");
  const [aiPrompt, setAiPrompt] = useState(
    "110 平三室两厅，主卧带卫生间，客厅朝南，大餐厅",
  );
  const [candidates, setCandidates] = useState<PlanCandidate[]>(() =>
    createPlanCandidates(initialIntent),
  );
  const [activeCandidateId, setActiveCandidateId] = useState("generate-a");
  const [sideTab, setSideTab] = useState<SidePanelTab>("requirements");
  const [currentFloor, setCurrentFloor] = useState<1 | 2>(1);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<BlockRect | null>(null);
  const [built3d, setBuilt3d] = useState(true);
  const [showFurniture, setShowFurniture] = useState(false);
  const [constructionColumn, setConstructionColumn] = useState(true);
  const [saving, setSaving] = useState(false);
  const addedRoomSequence = useRef(0);
  const [status, setStatus] = useState(
    "就绪 · 调整参数后点“生成布局”，3D 预览会同步更新。",
  );
  const [plan, setPlan] = useState<GeneratedPlan>(() =>
    generatePlan(initialIntent),
  );

  const liveSummary = useMemo(() => computeLiveSummary(intent), [intent]);
  const activeCandidate =
    candidates.find((candidate) => candidate.id === activeCandidateId) ??
    candidates[0] ??
    null;
  const furniture = useMemo(() => buildFurniture(plan), [plan]);
  const evaluation = useMemo(
    () => evaluatePlan(plan, intent, furniture),
    [plan, intent, furniture],
  );
  const furnitureVisible = showFurniture || mode === "furnish";
  const visibleBlocks = plan.blocks.filter(
    (block) => plan.floors === 1 || block.floor === currentFloor,
  );
  const visibleFurniture = furniture.filter(
    (item) => plan.floors === 1 || item.floor === currentFloor,
  );
  const selectedBlock =
    plan.blocks.find((block) => block.id === selectedBlockId) ?? null;

  function emit(action: string, summary: string) {
    setStatus(summary);
    onAudit?.(
      createModuleAuditEvent(action, "DetailedDesignAiPlanStudio", summary),
    );
  }

  function commitPlan(nextPlan: GeneratedPlan) {
    setPlan(nextPlan);
    setCandidates((current) =>
      current.map((candidate) =>
        candidate.id === activeCandidateId
          ? {
              ...candidate,
              plan: nextPlan,
              score: scorePlan(nextPlan),
              summary: candidateSummary(nextPlan),
            }
          : candidate,
      ),
    );
  }

  function activateCandidate(candidate: PlanCandidate) {
    const nextMode = candidate.command.toLowerCase() as PlanFinderMode;
    setActiveCandidateId(candidate.id);
    setPlan(candidate.plan);
    setMode(nextMode);
    if (nextMode === "furnish") setShowFurniture(true);
    setSideTab(nextMode === "furnish" ? "furnish" : "requirements");
    setCurrentFloor(1);
    setSelectedBlockId(null);
    setEditDraft(null);
    setBuilt3d(true);
    emit(
      "detailed-design-planfinder-candidate-select",
      `已切换到 ${candidate.title} · ${candidate.score} 分。`,
    );
  }

  function stepCandidate(direction: -1 | 1) {
    if (candidates.length === 0) return;
    const currentIndex = Math.max(
      0,
      candidates.findIndex((candidate) => candidate.id === activeCandidateId),
    );
    const nextIndex =
      (currentIndex + direction + candidates.length) % candidates.length;
    const nextCandidate = candidates[nextIndex];
    if (nextCandidate) activateCandidate(nextCandidate);
  }

  function switchMode(nextMode: PlanFinderMode) {
    const command = candidateCommandForMode(nextMode);
    const nextCandidate = command
      ? candidates.find((candidate) => candidate.command === command)
      : null;
    setMode(nextMode);
    if (nextMode === "furnish") setShowFurniture(true);
    setSideTab(nextMode === "furnish" ? "furnish" : "requirements");
    if (nextCandidate) {
      setActiveCandidateId(nextCandidate.id);
      setPlan(nextCandidate.plan);
      setCurrentFloor(1);
      setSelectedBlockId(null);
      setEditDraft(null);
      setBuilt3d(true);
    }
    emit(
      "detailed-design-planfinder-mode-change",
      nextCandidate
        ? `已进入 ${nextModeLabel(nextMode)} 模式 · 当前 ${nextCandidate.title}。`
        : `已进入 ${nextModeLabel(nextMode)} 模式。`,
    );
  }

  function updateRoom(
    key: RoomKey,
    field: keyof RoomRequirement,
    value: number | null,
  ) {
    if (value === null || Number.isNaN(value)) return;
    setIntent((current) => ({
      ...current,
      rooms: {
        ...current.rooms,
        [key]: {
          ...current.rooms[key],
          [field]: value,
        },
      },
    }));
  }

  function updateIntent<K extends keyof StudioIntent>(
    key: K,
    value: StudioIntent[K],
  ) {
    setIntent((current) => ({ ...current, [key]: value }));
  }

  function applyTemplate(templateId: string) {
    const template = templates[templateId];
    if (!template) return;
    const nextIntent: StudioIntent = {
      ...intent,
      totalAreaSqm: template.total,
      floors: template.floors,
      publicSplit: template.split,
      rooms: roomDefinitions.reduce(
        (acc, def) => {
          acc[def.key] = template.rooms[def.key] ?? intent.rooms[def.key];
          return acc;
        },
        {} as Record<RoomKey, RoomRequirement>,
      ),
    };
    const nextCandidates = createPlanCandidates(nextIntent);
    const fitCandidate =
      nextCandidates.find((candidate) => candidate.command === "Fit") ??
      nextCandidates[0];
    setIntent(nextIntent);
    setCandidates(nextCandidates);
    setActiveCandidateId(fitCandidate?.id ?? nextCandidates[0]?.id ?? "");
    if (fitCandidate) setPlan(fitCandidate.plan);
    setMode("fit");
    setSideTab("requirements");
    setCurrentFloor(1);
    emit("detailed-design-planfinder-fit", `已套用模板：${template.title}`);
  }

  function generateLayout(nextIntent = intent) {
    const generatedCandidates = createPlanCandidates(nextIntent);
    const firstCandidate = generatedCandidates[0];
    if (!firstCandidate) return;
    setCandidates(generatedCandidates);
    setActiveCandidateId(firstCandidate.id);
    setPlan(firstCandidate.plan);
    setMode("generate");
    setSideTab("requirements");
    setCurrentFloor(1);
    setSelectedBlockId(null);
    setEditDraft(null);
    setBuilt3d(true);
    emit(
      "detailed-design-planfinder-generate",
      `已生成 ${generatedCandidates.length} 个户型候选 · 当前 ${firstCandidate.title}。`,
    );
  }

  function runAiPrompt() {
    const parsed = parsePromptToIntent(aiPrompt, intent);
    setIntent(parsed);
    generateLayout(parsed);
    emit(
      "detailed-design-ai-prompt",
      "已按自然语言描述生成户型参数和 2D/3D 预览。",
    );
  }

  function build3D() {
    setBuilt3d(true);
    emit(
      "detailed-design-ai-plan-build-3d",
      `3D 已生成 · 外轮廓 ${plan.summary.envelope[0]}×${plan.summary.envelope[1]}mm · ${plan.floors} 层。`,
    );
  }

  function selectBlock(block: PlanBlock) {
    setSelectedBlockId(block.id);
    setEditDraft(rectFromBlock(block));
    setSideTab("rooms");
  }

  function applyEditDraft() {
    if (!selectedBlock || !editDraft) return;
    const nextBlocks = plan.blocks.map((block) =>
      block.id === selectedBlock.id
        ? {
            ...block,
            polygon: rectToPolygon(editDraft),
            areaSqm: roundArea((editDraft.w * editDraft.h) / 1e6),
          }
        : block,
    );
    const nextPlan = normalizePlanFromBlocks(plan, nextBlocks, intent.rooms);
    commitPlan(nextPlan);
    setBuilt3d(true);
    emit(
      "detailed-design-ai-plan-edit",
      `已更新 ${selectedBlock.purpose} 尺寸。`,
    );
  }

  function deleteSelectedBlock() {
    if (!selectedBlock) return;
    const nextBlocks = plan.blocks.filter(
      (block) => block.id !== selectedBlock.id,
    );
    commitPlan(normalizePlanFromBlocks(plan, nextBlocks, intent.rooms));
    setSelectedBlockId(null);
    setEditDraft(null);
    emit(
      "detailed-design-ai-plan-delete-room",
      `已删除 ${selectedBlock.purpose}。`,
    );
  }

  function addPaletteRoom(purpose: string) {
    const defaults = paletteDefaults[purpose] ?? { w: 3000, h: 3000 };
    const [envW, envH] = plan.summary.envelope;
    const x0 = snap(Math.max(0, envW - defaults.w - 600));
    const y0 = snap(Math.max(0, envH - defaults.h - 600));
    const samePurposeCount =
      plan.blocks.filter((block) => block.purpose === purpose).length + 1;
    addedRoomSequence.current += 1;
    const block: PlanBlock = {
      id: `R_${purpose}_${samePurposeCount}_${addedRoomSequence.current}`,
      purpose,
      polygon: rectToPolygon({
        x0,
        y0,
        x1: x0 + defaults.w,
        y1: y0 + defaults.h,
        w: defaults.w,
        h: defaults.h,
      }),
      areaSqm: roundArea((defaults.w * defaults.h) / 1e6),
      floor: currentFloor,
      ...(defaults.stairKind ? { stairKind: defaults.stairKind } : {}),
    };
    commitPlan(normalizePlanFromBlocks(plan, [...plan.blocks, block], intent.rooms));
    selectBlock(block);
    emit("detailed-design-ai-plan-add-room", `已加入 ${purpose} 色块。`);
  }

  async function savePlan() {
    setSaving(true);
    try {
      const payload = buildPlanCdePayload({
        moduleId: "detailed_design",
        mode,
        intent,
        plan,
        activeCandidate,
        candidates,
        furniture: furnitureVisible ? furniture : [],
        constructionColumn,
      });
      const content = JSON.stringify(payload, null, 2);
      await moduleFileApiClient.createModuleFile({
        moduleId: "detailed_design",
        parentId: null,
        name: `AI户型工作室-${safeFileName(plan.projectName)}-${new Date().toISOString().slice(0, 10)}.json`,
        kind: "file",
        mimeType: "application/json",
        sizeBytes: new TextEncoder().encode(content).byteLength,
        owner: "深化设计",
        tags: [
          "ai-floor-plan-studio",
          "2d-to-3d",
          "professional-review-required",
        ],
        content,
      });
      emit(
        "detailed-design-ai-plan-save",
        "已保存 AI 户型工作室方案到深化设计 CDE。",
      );
    } catch (error) {
      emit(
        "detailed-design-ai-plan-save-failed",
        `保存失败：${error instanceof Error ? error.message : "未知错误"}`,
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="ai-plan-studio flex h-[calc(100dvh-84px)] min-h-[760px] flex-col overflow-hidden rounded-md border border-slate-800 bg-slate-950 text-slate-200 shadow-sm">
      <style>{`
        .ai-plan-studio .ant-input,
        .ai-plan-studio .ant-input-number,
        .ai-plan-studio .ant-input-number-input,
        .ai-plan-studio .ant-select-selector {
          background: #0f172a !important;
          border-color: #334155 !important;
          color: #e2e8f0 !important;
        }
        .ai-plan-studio .ant-input::placeholder {
          color: #64748b !important;
        }
        .ai-plan-studio .ant-input-number-disabled,
        .ai-plan-studio .ant-input-number-disabled .ant-input-number-input {
          background: #111827 !important;
          color: #64748b !important;
        }
        .ai-plan-studio .ant-select-selection-item,
        .ai-plan-studio .ant-select-selection-placeholder {
          color: #e2e8f0 !important;
        }
        .ai-plan-studio .ant-select-arrow {
          color: #94a3b8 !important;
        }
      `}</style>
      <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950 px-4 py-2">
        <div className="flex items-center gap-2">
          <Home size={16} className="text-cyan-300" />
          <h2 className="m-0 text-sm font-semibold text-slate-100">
            AI 户型工作室
          </h2>
          <Tag color="cyan">Generate · Fit · Furnish · Manage</Tag>
        </div>
        <div className="flex items-center gap-2">
          <Tooltip title="把当前方案保存为深化设计 CDE 文件">
            <Button
              size="small"
              icon={<Save size={14} />}
              loading={saving}
              onClick={() => void savePlan()}
            >
              保存到 CDE
            </Button>
          </Tooltip>
          <Button
            size="small"
            type="primary"
            icon={<RefreshCw size={14} />}
            onClick={() => generateLayout()}
          >
            重新生成
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 bg-slate-900 px-4 py-1.5">
        <div className="inline-flex overflow-hidden rounded-md border border-slate-700 bg-slate-950">
          {planFinderModes.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => switchMode(item.id)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition ${
                mode === item.id
                  ? "bg-cyan-400 text-slate-950"
                  : "text-slate-400 hover:bg-slate-800 hover:text-slate-100"
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
        <div className="flex min-w-0 items-center gap-2 text-[11px] text-slate-400">
          <span className="truncate">{modeDescription(mode)}</span>
          {activeCandidate ? (
            <Tag color={activeCandidate.score >= 90 ? "green" : "gold"}>
              {activeCandidate.score} 分
            </Tag>
          ) : null}
        </div>
      </div>

      <div className="flex items-center gap-2 border-b border-slate-800 bg-slate-900 px-4 py-2">
        <Sparkles size={16} className="text-violet-300" />
        <span className="shrink-0 text-xs text-slate-400">智能生成</span>
        <Input
          value={aiPrompt}
          onChange={(event) => setAiPrompt(event.target.value)}
          placeholder="例：110 平三室两厅，主卧带卫生间，客厅朝南，大餐厅"
          className="border-slate-700 bg-slate-800 text-slate-100 placeholder:text-slate-500"
        />
        <Button
          type="primary"
          icon={<Wand2 size={14} />}
          onClick={runAiPrompt}
          className="bg-violet-500"
        >
          AI 生成
        </Button>
        <span className="text-[10px] text-slate-500">
          ModelRouter / 本地预览
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 bg-slate-950 px-4 py-1.5">
        <Button
          size="small"
          icon={<ChevronLeft size={14} />}
          onClick={() => stepCandidate(-1)}
        >
          上一个
        </Button>
        <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto">
          {candidates.map((candidate) => (
            <button
              key={candidate.id}
              type="button"
              onClick={() => activateCandidate(candidate)}
              className={`min-w-44 rounded-md border px-3 py-1.5 text-left text-xs transition ${
                candidate.id === activeCandidateId
                  ? "border-cyan-300 bg-cyan-400/15 text-cyan-100"
                  : "border-slate-800 bg-slate-900 text-slate-400 hover:border-slate-600"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-slate-100">
                  {candidate.title}
                </span>
                <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-cyan-300">
                  {candidate.command}
                </span>
              </div>
              <div className="mt-1 truncate text-[11px]">
                {candidate.summary}
              </div>
            </button>
          ))}
        </div>
        <Button
          size="small"
          icon={<ChevronRight size={14} />}
          onClick={() => stepCandidate(1)}
        >
          下一个
        </Button>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 bg-slate-950 xl:grid-cols-[minmax(620px,1.05fr)_minmax(560px,0.95fr)_320px]">
        <div className="flex min-h-0 min-w-0 flex-col border-r border-slate-800">
          <StageLabel>2D 平面图</StageLabel>
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 bg-slate-900 px-3 py-2">
            <Button size="small" icon={<PencilRuler size={14} />}>
              画户型轮廓
            </Button>
            <Button size="small" icon={<Trash2 size={14} />}>
              清除轮廓
            </Button>
            <span className="text-[10px] text-slate-500">画板</span>
            <Select
              size="small"
              value="20000"
              options={[
                { value: "10000", label: "10m × 10m" },
                { value: "20000", label: "20m × 20m" },
                { value: "30000", label: "30m × 30m" },
              ]}
              className="w-28"
            />
            {plan.floors === 2 ? (
              <div className="ml-1 inline-flex overflow-hidden rounded border border-slate-700">
                {[1, 2].map((floor) => (
                  <button
                    key={floor}
                    type="button"
                    onClick={() => setCurrentFloor(floor as 1 | 2)}
                    className={`px-3 py-1 text-xs ${
                      currentFloor === floor
                        ? "bg-cyan-400 font-semibold text-slate-950"
                        : "bg-slate-800 text-slate-400"
                    }`}
                  >
                    {floor}F
                  </button>
                ))}
              </div>
            ) : null}
            <Button size="small" type="primary" icon={<BoxSelect size={14} />}>
              编辑中
            </Button>
          </div>

          <div className="border-b border-slate-800 bg-slate-900 px-3 py-2">
            <div className="flex flex-wrap items-center gap-1">
              <span className="mr-1 text-[10px] text-slate-500">输入 →</span>
              {[
                "主卧",
                "次卧",
                "主卫",
                "卫生间",
                "客厅",
                "餐厅",
                "客餐厅一体",
                "厨房",
                "阳台",
                "楼梯",
                "储藏",
              ].map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => addPaletteRoom(name)}
                  className="rounded px-2 py-1 text-[11px] font-semibold text-slate-950"
                  style={{ background: roomColors[name] ?? "#cbd5e1" }}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>

          <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-slate-950 p-3">
            <PlanSvg
              plan={plan}
              blocks={visibleBlocks}
              furniture={visibleFurniture}
              showFurniture={furnitureVisible}
              selectedBlockId={selectedBlockId}
              onSelect={selectBlock}
            />
            {selectedBlock && editDraft ? (
              <FloatingEditPanel
                block={selectedBlock}
                draft={editDraft}
                onDraftChange={setEditDraft}
                onApply={applyEditDraft}
                onDelete={deleteSelectedBlock}
                onClose={() => {
                  setSelectedBlockId(null);
                  setEditDraft(null);
                }}
              />
            ) : null}
          </div>
        </div>

        <div className="flex min-h-0 min-w-0 flex-col border-r border-slate-800">
          <StageLabel>
            3D 模型
            <span className="ml-2 text-slate-500">
              · 外轮廓 {plan.summary.envelope[0]}×{plan.summary.envelope[1]}mm
            </span>
          </StageLabel>
          <div className="relative min-h-0 flex-1 bg-gradient-to-br from-slate-950 to-slate-800">
            {built3d ? (
              <PlanModel3D
                plan={plan}
                furniture={furniture}
                showFurniture={furnitureVisible}
                constructionColumn={constructionColumn}
              />
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-slate-500">
                先生成 3D 模型
              </div>
            )}
            <div className="absolute right-3 top-3 rounded border border-slate-700 bg-slate-950/90 px-3 py-1 font-mono text-[11px] text-cyan-300">
              尺度: mm · 外轮廓 {plan.summary.envelope[0]}×
              {plan.summary.envelope[1]}mm
            </div>
          </div>
        </div>

        <aside className="flex min-h-0 min-w-0 flex-col border-l border-slate-800 bg-slate-900">
          <div className="border-b border-slate-800 bg-slate-950 p-2">
            <div className="grid grid-cols-4 overflow-hidden rounded border border-slate-800 bg-slate-900">
              {sidePanelTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setSideTab(tab.id)}
                  className={`px-2 py-1.5 text-[11px] font-semibold transition ${
                    sideTab === tab.id
                      ? "bg-cyan-400 text-slate-950"
                      : "text-slate-400 hover:bg-slate-800 hover:text-slate-100"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {sideTab === "requirements" ? (
              <div className="space-y-3">
                <div>
                  <PanelTitle>Requirements</PanelTitle>
                  <div className="space-y-2 text-xs">
                    <DarkField label="建筑面积">
                      <InputNumber
                        min={40}
                        max={500}
                        step={5}
                        controls={false}
                        value={intent.totalAreaSqm}
                        onChange={(value) =>
                          updateIntent("totalAreaSqm", Number(value ?? 100))
                        }
                        className="w-24"
                      />
                      <span className="text-slate-500">㎡</span>
                    </DarkField>
                    <DarkField label="朝向">
                      <Select
                        value={intent.south}
                        onChange={(value) => updateIntent("south", value)}
                        options={[
                          { value: "-Y", label: "南 = -Y" },
                          { value: "+Y", label: "南 = +Y" },
                        ]}
                        className="w-36"
                      />
                    </DarkField>
                    <DarkField label="楼层数">
                      <Select
                        value={intent.floors}
                        onChange={(value) => {
                          updateIntent("floors", value);
                          setCurrentFloor(1);
                        }}
                        options={[
                          { value: 1, label: "1 层" },
                          { value: 2, label: "2 层（含楼梯）" },
                        ]}
                        className="w-36"
                      />
                    </DarkField>
                    <DarkField label="公共区">
                      <Select
                        value={intent.publicSplit}
                        onChange={(value) => updateIntent("publicSplit", value)}
                        options={[
                          { value: "auto", label: "自动" },
                          { value: "lk_sep", label: "客厅 + 餐厅" },
                          { value: "lk", label: "客餐厅一体" },
                        ]}
                        className="w-36"
                      />
                    </DarkField>
                    <DarkField label="屋顶">
                      <Select
                        value={intent.roofType}
                        onChange={(value) => updateIntent("roofType", value)}
                        options={[
                          { value: "双坡", label: "双坡" },
                          { value: "单坡", label: "单坡" },
                          { value: "平", label: "平顶" },
                        ]}
                        className="w-36"
                      />
                    </DarkField>
                    <DarkField label="模板">
                      <Select
                        placeholder="选择模板"
                        onChange={applyTemplate}
                        options={Object.entries(templates).map(
                          ([value, item]) => ({
                            value,
                            label: item.title,
                          }),
                        )}
                        className="w-40"
                      />
                    </DarkField>
                  </div>
                </div>

                <div>
                  <PanelTitle>Room Counts</PanelTitle>
                  <div className="space-y-1">
                    {roomDefinitions.map((room) => (
                      <div
                        key={room.key}
                        className="rounded border border-slate-800 bg-slate-950 p-2 text-[11px]"
                      >
                        <div className="mb-1 flex items-center justify-between text-slate-300">
                          <span className="font-semibold text-slate-100">
                            {room.key}
                            {room.locked ? (
                              <span className="ml-1 text-cyan-300">锁定</span>
                            ) : null}
                          </span>
                          <span className="text-slate-500">
                            ≥ {room.short}mm {room.hint ? `· ${room.hint}` : ""}
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <label className="space-y-1">
                            <span className="block text-slate-500">数量</span>
                            <InputNumber
                              min={0}
                              max={5}
                              controls={false}
                              disabled={room.locked}
                              value={intent.rooms[room.key].count}
                              onChange={(value) =>
                                updateRoom(
                                  room.key,
                                  "count",
                                  Number(value ?? 0),
                                )
                              }
                              size="small"
                              className="w-full"
                            />
                          </label>
                          <label className="space-y-1">
                            <span className="block text-slate-500">最小</span>
                            <InputNumber
                              min={0}
                              max={80}
                              step={0.5}
                              controls={false}
                              value={intent.rooms[room.key].min}
                              onChange={(value) =>
                                updateRoom(room.key, "min", Number(value ?? 0))
                              }
                              size="small"
                              className="w-full"
                            />
                          </label>
                          <label className="space-y-1">
                            <span className="block text-slate-500">最大</span>
                            <InputNumber
                              min={0}
                              max={90}
                              step={0.5}
                              controls={false}
                              value={intent.rooms[room.key].max}
                              onChange={(value) =>
                                updateRoom(room.key, "max", Number(value ?? 0))
                              }
                              size="small"
                              className="w-full"
                            />
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {mode !== "furnish" ? (
                  <ModeSidePanel
                    mode={mode}
                    activeCandidate={activeCandidate}
                    candidates={candidates}
                    templates={templates}
                    showFurniture={furnitureVisible}
                    furnitureCount={visibleFurniture.length}
                    onTemplate={applyTemplate}
                    onCandidate={activateCandidate}
                    onFurnitureChange={(checked) => {
                      if (checked) {
                        switchMode("furnish");
                      } else {
                        setShowFurniture(false);
                        switchMode("generate");
                      }
                    }}
                  />
                ) : null}
              </div>
            ) : null}

            {sideTab === "rooms" ? (
              <div className="space-y-3">
                <div>
                  <PanelTitle>Rooms</PanelTitle>
                  <div className="space-y-1">
                    {visibleBlocks.map((block) => (
                      <button
                        key={block.id}
                        type="button"
                        onClick={() => selectBlock(block)}
                        className={`flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-[11px] font-medium text-slate-950 ${
                          selectedBlockId === block.id
                            ? "ring-2 ring-cyan-300"
                            : ""
                        }`}
                        style={{
                          background: roomColors[block.purpose] ?? "#cbd5e1",
                        }}
                      >
                        <span>{block.purpose}</span>
                        <span>{block.areaSqm.toFixed(1)}㎡</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <PanelTitle>快速加入</PanelTitle>
                  <div className="flex flex-wrap gap-1">
                    {[
                      "主卧",
                      "次卧",
                      "主卫",
                      "卫生间",
                      "客厅",
                      "餐厅",
                      "客餐厅一体",
                      "厨房",
                      "阳台",
                      "楼梯",
                      "储藏",
                    ].map((name) => (
                      <button
                        key={name}
                        type="button"
                        onClick={() => addPaletteRoom(name)}
                        className="rounded px-2 py-1 text-[11px] font-semibold text-slate-950"
                        style={{ background: roomColors[name] ?? "#cbd5e1" }}
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <PanelTitle>门窗</PanelTitle>
                  <div className="rounded border border-slate-800 bg-slate-950 p-2 text-[11px] text-slate-400">
                    <div className="flex items-center gap-2 text-amber-300">
                      <DoorOpen size={13} />+ 加门窗
                    </div>
                    <p className="mt-2 leading-5">
                      外墙门窗按房间外墙推定，后续进入门窗深化校核。
                    </p>
                  </div>
                </div>
              </div>
            ) : null}

            {sideTab === "furnish" ? (
              <div className="space-y-3">
                <ModeSidePanel
                  mode="furnish"
                  activeCandidate={activeCandidate}
                  candidates={candidates}
                  templates={templates}
                  showFurniture={furnitureVisible}
                  furnitureCount={visibleFurniture.length}
                  onTemplate={applyTemplate}
                  onCandidate={activateCandidate}
                  onFurnitureChange={(checked) => {
                    if (checked) {
                      switchMode("furnish");
                    } else {
                      setShowFurniture(false);
                      switchMode("generate");
                    }
                  }}
                />

                <div>
                  <PanelTitle>Furniture Items</PanelTitle>
                  <div className="space-y-1">
                    {visibleFurniture.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between rounded border border-slate-800 bg-slate-950 px-2 py-1.5 text-[11px] text-slate-300"
                      >
                        <span>{item.label}</span>
                        <span className="text-slate-500">
                          {roundArea((item.w * item.h) / 1e6).toFixed(1)}㎡
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}

            {sideTab === "checks" ? (
              <div className="space-y-3">
                <div>
                  <PanelTitle>Summary</PanelTitle>
                  <div className="rounded-md bg-slate-800 p-3 text-xs">
                    <SummaryRow
                      label="私密区（min~max）"
                      value={liveSummary.privateRange}
                    />
                    <SummaryRow
                      label="私密区房间数"
                      value={String(liveSummary.privateCount)}
                    />
                    <SummaryRow
                      label="公共区预算"
                      value={liveSummary.publicRange}
                    />
                    <SummaryRow
                      label="建筑面积"
                      value={`${intent.totalAreaSqm} ㎡`}
                    />
                    <SummaryRow
                      label="校验"
                      value={liveSummary.check}
                      tone={liveSummary.tone}
                    />
                    <SummaryRow
                      label="Evaluator 分数"
                      value={`${evaluation.score} / 100`}
                      tone={evaluation.passed ? "ok" : "warn"}
                    />
                  </div>
                </div>

                <div>
                  <PanelTitle>AI Gate 评估</PanelTitle>
                  <div className="space-y-1 text-[11px] leading-5">
                    {evaluation.gates.map((gate) => (
                      <div
                        key={gate.name}
                        className="flex items-center justify-between rounded border border-slate-800 bg-slate-950 px-2 py-1.5 text-slate-300"
                      >
                        <span>{gate.name}</span>
                        <span
                          className={
                            gate.status === "passed"
                              ? "text-emerald-300"
                              : gate.status === "blocked"
                                ? "text-red-300"
                                : "text-amber-300"
                          }
                        >
                          {gate.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <PanelTitle>面积偏差</PanelTitle>
                  <div className="space-y-1 text-[11px] leading-5">
                    {plan.warnings.length ? (
                      plan.warnings.map((warning) => (
                        <div
                          key={`${warning.room}-${warning.msg}`}
                          className="border-l-2 border-amber-400 bg-slate-950 p-2 text-amber-300"
                        >
                          {warning.msg}
                          <div className="mt-1 text-[10px] text-slate-500">
                            {warning.reason}
                          </div>
                        </div>
                      ))
                    ) : (
                      <span className="text-emerald-300">
                        所有房间面积符合 min~max 范围
                      </span>
                    )}
                  </div>
                </div>

                <div>
                  <PanelTitle>设计笔记</PanelTitle>
                  <div className="space-y-1 text-[11px] leading-5 text-slate-300">
                    {plan.designNotes.map((note) => (
                      <div
                        key={note}
                        className="border-b border-slate-800 pb-1"
                      >
                        • {note}
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <PanelTitle>构建日志</PanelTitle>
                  <pre className="max-h-36 overflow-auto rounded bg-slate-950 p-2 font-mono text-[10px] leading-5 text-slate-400">
                    {`[layout_planner] ${plan.projectId}
[2D] blocks=${plan.summary.blockCount}, floors=${plan.floors}
[3D] construction_column=${constructionColumn ? "on" : "off"}
[review] professional_review_required`}
                  </pre>
                </div>
              </div>
            ) : null}
          </div>
        </aside>
      </div>

      <div className="flex items-center gap-3 border-t border-slate-800 bg-slate-950 px-4 py-3">
        <Button
          type="primary"
          icon={<Grid3X3 size={14} />}
          onClick={() => generateLayout()}
        >
          生成布局（2D）
        </Button>
        <Button type="primary" icon={<Layers3 size={14} />} onClick={build3D}>
          生成 3D 模型
        </Button>
        <label className="flex items-center gap-2 text-xs text-slate-400">
          <Switch
            size="small"
            checked={constructionColumn}
            onChange={setConstructionColumn}
          />
          外墙构造柱
        </label>
        <label className="flex items-center gap-2 text-xs text-slate-400">
          <Switch
            size="small"
            checked={furnitureVisible}
            onChange={(checked) => {
              if (checked) {
                switchMode("furnish");
              } else {
                setShowFurniture(false);
                switchMode("generate");
              }
            }}
          />
          家具层
        </label>
        <div className="min-w-0 flex-1 truncate text-xs text-slate-400">
          {status}
        </div>
      </div>
    </section>
  );
}

function PanelTitle({ children }: { children: ReactNode }) {
  return (
    <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
      {children}
    </h3>
  );
}

function StageLabel({ children }: { children: ReactNode }) {
  return (
    <div className="border-b border-slate-800 bg-slate-950 px-3 py-2 text-[11px] uppercase tracking-wide text-slate-500">
      {children}
    </div>
  );
}

function DarkField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="flex items-center gap-2">
      <span className="w-20 shrink-0 text-slate-400">{label}</span>
      {children}
    </label>
  );
}

function SummaryRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "ok" | "warn" | "err";
}) {
  const color =
    tone === "ok"
      ? "text-emerald-300"
      : tone === "warn"
        ? "text-amber-300"
        : tone === "err"
          ? "text-red-300"
          : "text-slate-100";
  return (
    <div className="flex justify-between gap-4 py-1">
      <span className="text-slate-400">{label}</span>
      <span className={`font-semibold ${color}`}>{value}</span>
    </div>
  );
}

function ModeSidePanel({
  mode,
  activeCandidate,
  candidates,
  templates,
  showFurniture,
  furnitureCount,
  onTemplate,
  onCandidate,
  onFurnitureChange,
}: {
  mode: PlanFinderMode;
  activeCandidate: PlanCandidate | null;
  candidates: PlanCandidate[];
  templates: TemplateRegistry;
  showFurniture: boolean;
  furnitureCount: number;
  onTemplate: (templateId: string) => void;
  onCandidate: (candidate: PlanCandidate) => void;
  onFurnitureChange: (checked: boolean) => void;
}) {
  if (mode === "fit") {
    return (
      <div className="mb-3">
        <PanelTitle>Fit 模板库</PanelTitle>
        <div className="space-y-1">
          {Object.entries(templates).map(([id, template]) => (
            <button
              key={id}
              type="button"
              onClick={() => onTemplate(id)}
              className="w-full rounded border border-slate-800 bg-slate-950 p-2 text-left text-[11px] text-slate-300 hover:border-cyan-400"
            >
              <div className="font-semibold text-slate-100">
                {template.title}
              </div>
              <div className="mt-1 text-slate-500">
                {template.total}㎡ · {template.floors} 层 ·{" "}
                {template.split === "lk" ? "客餐厅一体" : "客厅+餐厅"}
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (mode === "furnish") {
    return (
      <div className="mb-3">
        <PanelTitle>Furnish 家具布置</PanelTitle>
        <div className="rounded border border-slate-800 bg-slate-950 p-2 text-[11px] text-slate-300">
          <div className="flex items-center justify-between">
            <span>自动家具层</span>
            <Switch
              size="small"
              checked={showFurniture}
              onChange={onFurnitureChange}
            />
          </div>
          <div className="mt-2 text-slate-500">
            当前层已布置 {furnitureCount}{" "}
            个家具块，按房间类型自动放置床、沙发、餐桌、厨柜和卫浴洁具。
          </div>
        </div>
      </div>
    );
  }

  if (mode === "manage") {
    return (
      <div className="mb-3">
        <PanelTitle>Manage 方案库</PanelTitle>
        <div className="space-y-1">
          {candidates.map((candidate) => (
            <button
              key={candidate.id}
              type="button"
              onClick={() => onCandidate(candidate)}
              className="w-full rounded border border-slate-800 bg-slate-950 p-2 text-left text-[11px] text-slate-300 hover:border-cyan-400"
            >
              <div className="flex justify-between gap-2">
                <span className="font-semibold text-slate-100">
                  {candidate.title}
                </span>
                <span>{candidate.score}</span>
              </div>
              <div className="mt-1 text-slate-500">{candidate.summary}</div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mb-3">
      <PanelTitle>Generate 候选</PanelTitle>
      <div className="rounded border border-slate-800 bg-slate-950 p-2 text-[11px] text-slate-300">
        <div className="font-semibold text-slate-100">
          {activeCandidate?.title ?? "未选择候选"}
        </div>
        <div className="mt-1 text-slate-500">
          {activeCandidate?.summary ?? "设置边界和需求后生成多个方案。"}
        </div>
      </div>
    </div>
  );
}

function FloatingEditPanel({
  block,
  draft,
  onDraftChange,
  onApply,
  onDelete,
  onClose,
}: {
  block: PlanBlock;
  draft: BlockRect;
  onDraftChange: (draft: BlockRect) => void;
  onApply: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  function patch(key: "x0" | "y0" | "w" | "h", value: number | null) {
    if (value === null || Number.isNaN(value)) return;
    const next = { ...draft, [key]: snap(value) };
    if (key === "x0" || key === "w") next.x1 = next.x0 + next.w;
    if (key === "y0" || key === "h") next.y1 = next.y0 + next.h;
    onDraftChange(next);
  }

  return (
    <div className="absolute right-6 top-16 z-10 w-44 rounded-md border border-cyan-400 bg-slate-950/95 p-3 text-[11px] text-slate-200 shadow-xl">
      <div className="mb-2 border-b border-slate-800 pb-2 text-sm font-semibold text-cyan-300">
        {block.purpose}
      </div>
      <div className="grid grid-cols-[24px_1fr] items-center gap-2">
        <span className="text-slate-500">X</span>
        <InputNumber
          size="small"
          step={300}
          value={draft.x0}
          onChange={(value) => patch("x0", Number(value ?? 0))}
        />
        <span className="text-slate-500">Y</span>
        <InputNumber
          size="small"
          step={300}
          value={draft.y0}
          onChange={(value) => patch("y0", Number(value ?? 0))}
        />
        <span className="text-slate-500">宽</span>
        <InputNumber
          size="small"
          min={300}
          step={300}
          value={draft.w}
          onChange={(value) => patch("w", Number(value ?? 300))}
        />
        <span className="text-slate-500">高</span>
        <InputNumber
          size="small"
          min={300}
          step={300}
          value={draft.h}
          onChange={(value) => patch("h", Number(value ?? 300))}
        />
      </div>
      <div className="my-2 rounded bg-slate-800 p-2 text-center font-semibold text-emerald-300">
        {roundArea((draft.w * draft.h) / 1e6).toFixed(2)} ㎡
      </div>
      <div className="grid grid-cols-3 gap-1">
        <Button size="small" type="primary" onClick={onApply}>
          应用
        </Button>
        <Button size="small" danger onClick={onDelete}>
          删
        </Button>
        <Button size="small" onClick={onClose}>
          ×
        </Button>
      </div>
    </div>
  );
}

function PlanSvg({
  plan,
  blocks,
  furniture,
  showFurniture,
  selectedBlockId,
  onSelect,
}: {
  plan: GeneratedPlan;
  blocks: PlanBlock[];
  furniture: FurnitureItem[];
  showFurniture: boolean;
  selectedBlockId: string | null;
  onSelect: (block: PlanBlock) => void;
}) {
  const width = 760;
  const height = 560;
  const margin = 54;
  const [envW, envH] = plan.summary.envelope;
  const scale = Math.min(
    (width - margin * 2) / envW,
    (height - margin * 2) / envH,
  );
  const x = (value: number) => margin + value * scale;
  const y = (value: number) => height - margin - value * scale;
  const gridLines = buildGridLines(envW, envH, 1500);
  const minorLines = buildGridLines(envW, envH, 300);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMin meet"
      role="img"
      aria-label="AI 生成二维户型平面"
      className="h-full max-h-full w-full rounded-md bg-slate-50 shadow-2xl"
    >
      <rect x={0} y={0} width={width} height={height} fill="#f8fafc" />
      {minorLines.x.map((value) => (
        <line
          key={`mx-${value}`}
          x1={x(value)}
          y1={y(0)}
          x2={x(value)}
          y2={y(envH)}
          stroke="#e2e8f0"
          strokeWidth={0.7}
        />
      ))}
      {minorLines.y.map((value) => (
        <line
          key={`my-${value}`}
          x1={x(0)}
          y1={y(value)}
          x2={x(envW)}
          y2={y(value)}
          stroke="#e2e8f0"
          strokeWidth={0.7}
        />
      ))}
      {gridLines.x.map((value) => (
        <g key={`gx-${value}`}>
          <line
            x1={x(value)}
            y1={y(0)}
            x2={x(value)}
            y2={y(envH)}
            stroke="#94a3b8"
            strokeWidth={1}
          />
          <text
            x={x(value)}
            y={y(envH) - 8}
            textAnchor="middle"
            fontSize={10}
            fill="#64748b"
          >
            {value}
          </text>
        </g>
      ))}
      {gridLines.y.map((value) => (
        <g key={`gy-${value}`}>
          <line
            x1={x(0)}
            y1={y(value)}
            x2={x(envW)}
            y2={y(value)}
            stroke="#94a3b8"
            strokeWidth={1}
          />
          <text
            x={x(0) - 8}
            y={y(value) + 4}
            textAnchor="end"
            fontSize={10}
            fill="#64748b"
          >
            {value}
          </text>
        </g>
      ))}
      <rect
        x={x(0)}
        y={y(envH)}
        width={envW * scale}
        height={envH * scale}
        fill="none"
        stroke="#334155"
        strokeWidth={2}
      />
      {blocks.map((block) => {
        const rect = rectFromBlock(block);
        const selected = selectedBlockId === block.id;
        return (
          <g
            key={block.id}
            role="button"
            tabIndex={0}
            onClick={() => onSelect(block)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") onSelect(block);
            }}
            className="cursor-pointer"
          >
            <rect
              x={x(rect.x0)}
              y={y(rect.y1)}
              width={rect.w * scale}
              height={rect.h * scale}
              fill={roomColors[block.purpose] ?? "#cbd5e1"}
              fillOpacity={block.purpose === "弹性区" ? 0.62 : 0.88}
              stroke={selected ? "#06b6d4" : "#ef4444"}
              strokeWidth={selected ? 4 : 3}
            />
            <text
              x={x((rect.x0 + rect.x1) / 2)}
              y={y((rect.y0 + rect.y1) / 2) - 3}
              textAnchor="middle"
              fontSize={Math.max(12, Math.min(18, rect.w * scale * 0.12))}
              fontWeight={700}
              fill="#0f172a"
            >
              {block.purpose}
            </text>
            <text
              x={x((rect.x0 + rect.x1) / 2)}
              y={y((rect.y0 + rect.y1) / 2) + 14}
              textAnchor="middle"
              fontSize={11}
              fill="#334155"
            >
              {block.areaSqm.toFixed(1)}㎡
            </text>
          </g>
        );
      })}
      {showFurniture
        ? furniture.map((item) => (
            <g key={item.id} opacity={0.9}>
              <rect
                x={x(item.x0)}
                y={y(item.y0 + item.h)}
                width={item.w * scale}
                height={item.h * scale}
                rx={3}
                fill={item.color}
                stroke="#0f172a"
                strokeWidth={1}
              />
              <text
                x={x(item.x0 + item.w / 2)}
                y={y(item.y0 + item.h / 2) + 3}
                textAnchor="middle"
                fontSize={9}
                fill="#0f172a"
                fontWeight={700}
              >
                {item.label}
              </text>
            </g>
          ))
        : null}
    </svg>
  );
}

function PlanModel3D({
  plan,
  furniture,
  showFurniture,
  constructionColumn,
}: {
  plan: GeneratedPlan;
  furniture: FurnitureItem[];
  showFurniture: boolean;
  constructionColumn: boolean;
}) {
  return (
    <Canvas
      camera={{ position: [20, 13, 20], fov: 38, near: 0.1, far: 1000 }}
      gl={{ antialias: true, alpha: true }}
      shadows
      className="h-full w-full"
    >
      <color attach="background" args={["#111827"]} />
      <ambientLight intensity={0.68} />
      <directionalLight position={[8, 12, 8]} intensity={1.1} castShadow />
      <CameraLookAt />
      <PlanFrame
        plan={plan}
        furniture={furniture}
        showFurniture={showFurniture}
        constructionColumn={constructionColumn}
      />
      <OrbitControls target={[0, 3, 0]} enableDamping makeDefault />
    </Canvas>
  );
}

function CameraLookAt() {
  const { camera } = useThree();
  useEffect(() => {
    camera.lookAt(0, 3, 0);
    camera.updateProjectionMatrix();
  }, [camera]);
  return null;
}

function PlanFrame({
  plan,
  furniture,
  showFurniture,
  constructionColumn,
}: {
  plan: GeneratedPlan;
  furniture: FurnitureItem[];
  showFurniture: boolean;
  constructionColumn: boolean;
}) {
  const [envW, envH] = plan.summary.envelope;
  const w = envW / 1000;
  const d = envH / 1000;
  const levelH = 3.2;
  const gridX = buildAxisPositions(w, 3);
  const gridZ = buildAxisPositions(d, 3);
  const floors = Array.from({ length: plan.floors }, (_, index) => index + 1);

  return (
    <group position={[-w / 2, 0, -d / 2]}>
      {floors.map((floor) => {
        const yBase = (floor - 1) * levelH;
        const yTop = yBase + levelH;
        return (
          <group key={`floor-${floor}`}>
            <mesh position={[w / 2, yBase, d / 2]} receiveShadow>
              <boxGeometry args={[w, 0.06, d]} />
              <meshStandardMaterial
                color="#f8fafc"
                transparent
                opacity={0.88}
              />
            </mesh>
            <mesh position={[w / 2, yTop, d / 2]}>
              <boxGeometry args={[w, 0.08, d]} />
              <meshStandardMaterial
                color="#f8fafc"
                transparent
                opacity={0.58}
              />
            </mesh>
            {plan.blocks
              .filter((block) => block.floor === floor)
              .map((block) => {
                const rect = rectFromBlock(block);
                const bw = rect.w / 1000;
                const bd = rect.h / 1000;
                const bx = rect.x0 / 1000 + bw / 2;
                const bz = rect.y0 / 1000 + bd / 2;
                return (
                  <mesh key={block.id} position={[bx, yBase + 0.07, bz]}>
                    <boxGeometry args={[bw, 0.08, bd]} />
                    <meshStandardMaterial
                      color={roomColors[block.purpose] ?? "#cbd5e1"}
                      transparent
                      opacity={0.42}
                    />
                  </mesh>
                );
              })}
            {gridX.map((x) =>
              gridZ.map((z) => (
                <mesh
                  key={`c-${floor}-${x}-${z}`}
                  position={[x, yBase + levelH / 2, z]}
                  castShadow
                >
                  <boxGeometry args={[0.09, levelH, 0.09]} />
                  <meshStandardMaterial
                    color={constructionColumn ? "#e5e7eb" : "#64748b"}
                  />
                </mesh>
              )),
            )}
            {gridX.map((x) => (
              <mesh key={`bx-${floor}-${x}`} position={[x, yTop, d / 2]}>
                <boxGeometry args={[0.08, 0.12, d]} />
                <meshStandardMaterial color="#2dd4bf" />
              </mesh>
            ))}
            {gridZ.map((z) => (
              <mesh key={`bz-${floor}-${z}`} position={[w / 2, yTop, z]}>
                <boxGeometry args={[w, 0.12, 0.08]} />
                <meshStandardMaterial color="#2dd4bf" />
              </mesh>
            ))}
            {showFurniture
              ? furniture
                  .filter((item) => item.floor === floor)
                  .map((item) => (
                    <mesh
                      key={`furniture-${item.id}`}
                      position={[
                        item.x0 / 1000 + item.w / 2000,
                        yBase + 0.22,
                        item.y0 / 1000 + item.h / 2000,
                      ]}
                      castShadow
                    >
                      <boxGeometry
                        args={[item.w / 1000, 0.28, item.h / 1000]}
                      />
                      <meshStandardMaterial color={item.color} />
                    </mesh>
                  ))
              : null}
          </group>
        );
      })}
      <mesh position={[w / 2, -0.05, d / 2]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[w + 2, d + 2]} />
        <meshStandardMaterial color="#111827" />
      </mesh>
    </group>
  );
}

function modeDescription(mode: PlanFinderMode) {
  if (mode === "fit") return "Fit: 从方案库选择相近户型并适配当前边界。";
  if (mode === "furnish") return "Furnish: 自动放置家具并同步 2D / 3D 家具层。";
  if (mode === "manage") return "Manage: 管理候选方案和可复用模板库。";
  return "Generate: 依据外轮廓和房间需求生成多个候选。";
}

function nextModeLabel(mode: PlanFinderMode) {
  return planFinderModes.find((item) => item.id === mode)?.label ?? mode;
}

function candidateCommandForMode(
  mode: PlanFinderMode,
): PlanCandidate["command"] | null {
  if (mode === "generate") return "Generate";
  if (mode === "fit") return "Fit";
  if (mode === "furnish") return "Furnish";
  return null;
}
