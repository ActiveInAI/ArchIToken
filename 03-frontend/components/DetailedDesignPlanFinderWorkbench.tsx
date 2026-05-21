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
import { createModuleAuditEvent } from "@/lib/module-actions";
import type { ModuleAuditEvent } from "@/lib/module-file-system";
import { moduleFileApiClient } from "@/lib/module-file-api-client";

type RoomKey = "主卧" | "主卫" | "次卧" | "卫生间" | "厨房" | "阳台";
type PublicSplit = "auto" | "lk" | "lk_sep";
type RoofType = "双坡" | "单坡" | "平";
type RidgeAxis = "X" | "Y";
type PlanFinderMode = "generate" | "fit" | "furnish" | "manage";
type SidePanelTab = "requirements" | "rooms" | "furnish" | "checks";

interface RoomDefinition {
  key: RoomKey;
  count: number;
  min: number;
  max: number;
  short: number;
  locked: boolean;
  hint: string;
}

interface RoomRequirement {
  count: number;
  min: number;
  max: number;
}

interface TemplateConfig {
  title: string;
  total: number;
  floors: 1 | 2;
  split: PublicSplit;
  rooms: Partial<Record<RoomKey, RoomRequirement>>;
}

type TemplateRegistry = Record<string, TemplateConfig>;

interface StudioIntent {
  totalAreaSqm: number;
  south: "-Y" | "+Y";
  floors: 1 | 2;
  publicSplit: PublicSplit;
  roofType: RoofType;
  roofRidgeAxis: RidgeAxis;
  rooms: Record<RoomKey, RoomRequirement>;
}

interface Point2D {
  x: number;
  y: number;
}

interface PlanBlock {
  id: string;
  purpose: string;
  polygon: Point2D[];
  areaSqm: number;
  floor: 1 | 2;
  stairKind?: "单跑" | "双跑";
}

interface PlanWarning {
  room: string;
  msg: string;
  reason: string;
}

interface GeneratedPlan {
  projectId: string;
  projectName: string;
  intentLabel: string;
  floors: 1 | 2;
  blocks: PlanBlock[];
  designNotes: string[];
  warnings: PlanWarning[];
  summary: {
    envelope: [number, number];
    envelopeSqm: number;
    targetSqm: number;
    totalRoomSqm: number;
    usableRatioEst: number;
    blockCount: number;
    floor1Sqm?: number;
    floor2Sqm?: number;
  };
}

interface PlanCandidate {
  id: string;
  title: string;
  command: "Generate" | "Fit" | "Furnish";
  plan: GeneratedPlan;
  score: number;
  summary: string;
}

interface FurnitureItem {
  id: string;
  blockId: string;
  label: string;
  x0: number;
  y0: number;
  w: number;
  h: number;
  floor: 1 | 2;
  color: string;
}

interface BlockRect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  w: number;
  h: number;
}

const MODULUS = 300;
const MAX_SPAN = 4800;
const DEFAULT_USABLE_RATIO = 0.83;

const roomDefinitions: RoomDefinition[] = [
  {
    key: "主卧",
    count: 1,
    min: 12,
    max: 16,
    short: 3000,
    locked: true,
    hint: "南向",
  },
  {
    key: "主卫",
    count: 1,
    min: 3,
    max: 5,
    short: 1500,
    locked: false,
    hint: "套间",
  },
  {
    key: "次卧",
    count: 2,
    min: 10,
    max: 13,
    short: 2400,
    locked: false,
    hint: "南向",
  },
  {
    key: "卫生间",
    count: 1,
    min: 3,
    max: 6,
    short: 1500,
    locked: false,
    hint: "公卫",
  },
  {
    key: "厨房",
    count: 1,
    min: 6,
    max: 8,
    short: 1500,
    locked: true,
    hint: "",
  },
  {
    key: "阳台",
    count: 0,
    min: 3,
    max: 6,
    short: 1200,
    locked: false,
    hint: "可选",
  },
];

const roomColors: Record<string, string> = {
  主卧: "#3b82f6",
  次卧: "#60a5fa",
  主卫: "#a78bfa",
  卫生间: "#94a3b8",
  客厅: "#10b981",
  餐厅: "#22c55e",
  客餐厅一体: "#34d399",
  厨房: "#fbbf24",
  阳台: "#fcd34d",
  楼梯: "#a855f7",
  走廊: "#cbd5e1",
  储藏: "#64748b",
  弹性区: "#e2e8f0",
  公共区: "#38bdf8",
};

const templates: TemplateRegistry = {
  t2: {
    title: "两居 75㎡",
    total: 75,
    floors: 1,
    split: "lk",
    rooms: {
      主卧: { count: 1, min: 12, max: 14 },
      主卫: { count: 0, min: 3, max: 5 },
      次卧: { count: 1, min: 9, max: 11 },
      卫生间: { count: 1, min: 3, max: 5 },
      厨房: { count: 1, min: 5, max: 7 },
      阳台: { count: 0, min: 3, max: 5 },
    },
  },
  t3: {
    title: "三居两厅 95㎡",
    total: 95,
    floors: 1,
    split: "lk_sep",
    rooms: {
      主卧: { count: 1, min: 13, max: 15 },
      主卫: { count: 0, min: 3, max: 5 },
      次卧: { count: 2, min: 10, max: 12 },
      卫生间: { count: 1, min: 4, max: 6 },
      厨房: { count: 1, min: 6, max: 8 },
      阳台: { count: 0, min: 3, max: 5 },
    },
  },
  t3b: {
    title: "三居两厅 + 主卫 110㎡",
    total: 110,
    floors: 2,
    split: "lk_sep",
    rooms: {
      主卧: { count: 1, min: 14, max: 17 },
      主卫: { count: 1, min: 3, max: 5 },
      次卧: { count: 2, min: 10, max: 13 },
      卫生间: { count: 1, min: 4, max: 6 },
      厨房: { count: 1, min: 6, max: 8 },
      阳台: { count: 0, min: 3, max: 5 },
    },
  },
  t4: {
    title: "四居两厅双卫 135㎡",
    total: 135,
    floors: 2,
    split: "lk_sep",
    rooms: {
      主卧: { count: 1, min: 15, max: 18 },
      主卫: { count: 1, min: 4, max: 6 },
      次卧: { count: 3, min: 10, max: 13 },
      卫生间: { count: 1, min: 4, max: 6 },
      厨房: { count: 1, min: 7, max: 9 },
      阳台: { count: 0, min: 3, max: 5 },
    },
  },
};

const paletteDefaults: Record<
  string,
  { w: number; h: number; stairKind?: "单跑" | "双跑" }
> = {
  主卧: { w: 3600, h: 4500 },
  次卧: { w: 3000, h: 4200 },
  主卫: { w: 1500, h: 2400 },
  卫生间: { w: 1800, h: 2400 },
  客厅: { w: 3600, h: 4500 },
  餐厅: { w: 3000, h: 3600 },
  客餐厅一体: { w: 4800, h: 3600 },
  厨房: { w: 3000, h: 3000 },
  阳台: { w: 3000, h: 1500 },
  楼梯: { w: 2400, h: 3900, stairKind: "双跑" },
  储藏: { w: 1500, h: 1500 },
  弹性区: { w: 3000, h: 3000 },
};

const initialIntent: StudioIntent = {
  totalAreaSqm: 100,
  south: "-Y",
  floors: 2,
  publicSplit: "auto",
  roofType: "平",
  roofRidgeAxis: "X",
  rooms: Object.fromEntries(
    roomDefinitions.map((item) => [
      item.key,
      { count: item.count, min: item.min, max: item.max },
    ]),
  ) as Record<RoomKey, RoomRequirement>,
};

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
    const nextPlan = normalizePlanFromBlocks(plan, nextBlocks);
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
    commitPlan(normalizePlanFromBlocks(plan, nextBlocks));
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
    commitPlan(normalizePlanFromBlocks(plan, [...plan.blocks, block]));
    selectBlock(block);
    emit("detailed-design-ai-plan-add-room", `已加入 ${purpose} 色块。`);
  }

  async function savePlan() {
    setSaving(true);
    try {
      const payload = {
        schema: "architoken.detailed_design.ai_floor_plan_studio.v1",
        moduleId: "detailed_design",
        source:
          "Imported from local AI floor-plan studio reference: frontend/studio.html and intent_to_blocks.py logic",
        reviewState: "professional_review_required",
        mode,
        intent,
        plan,
        activeCandidate,
        candidates,
        furniture: furnitureVisible ? furniture : [],
        constructionColumn,
        createdAt: new Date().toISOString(),
      };
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

function createPlanCandidates(intent: StudioIntent): PlanCandidate[] {
  const base = generatePlan(intent);
  const mirrored = mirrorPlan(base, intent, "x", "Generate B · 镜像采光");
  const compact = scalePlan(base, intent, 0.94, 1.04, "Fit · 紧凑核心");
  const furnishReady = mirrorPlan(
    scalePlan(base, intent, 1.03, 0.96, "Furnish · 家具友好").plan,
    intent,
    "y",
    "Furnish · 家具友好",
  );
  const candidates: Array<Omit<PlanCandidate, "score" | "summary">> = [
    {
      id: "generate-a",
      title: "Generate A · 平衡方案",
      command: "Generate",
      plan: base,
    },
    {
      id: "generate-b",
      title: "Generate B · 镜像采光",
      command: "Generate",
      plan: mirrored.plan,
    },
    {
      id: "fit-c",
      title: "Fit C · 模板适配",
      command: "Fit",
      plan: compact.plan,
    },
    {
      id: "furnish-d",
      title: "Furnish D · 家具友好",
      command: "Furnish",
      plan: furnishReady.plan,
    },
  ];
  return candidates.map((candidate) => ({
    ...candidate,
    score: scorePlan(candidate.plan),
    summary: candidateSummary(candidate.plan),
  }));
}

function mirrorPlan(
  plan: GeneratedPlan,
  intent: StudioIntent,
  axis: "x" | "y",
  projectName: string,
) {
  const [envW, envH] = plan.summary.envelope;
  const blocks = plan.blocks.map((block) => ({
    ...block,
    id: `${block.id}_${axis === "x" ? "mx" : "my"}`,
    polygon: block.polygon.map((point) => ({
      x: axis === "x" ? snap(envW - point.x) : point.x,
      y: axis === "y" ? snap(envH - point.y) : point.y,
    })),
  }));
  return {
    plan: finalizePlan({
      projectId: `${plan.projectId}-${axis}-mirror`,
      projectName,
      intentLabel: plan.intentLabel,
      floors: plan.floors,
      blocks: blocks.map((block) => ({
        ...block,
        areaSqm: roundArea(
          (rectFromBlock(block).w * rectFromBlock(block).h) / 1e6,
        ),
      })),
      targetSqm: plan.summary.targetSqm,
      designNotes: [
        ...plan.designNotes.slice(0, 2),
        axis === "x"
          ? "候选变体：按 X 方向镜像，用于快速比较入口和采光侧。"
          : "候选变体：按 Y 方向镜像，用于比较南北动线和家具摆放。",
      ],
      rooms: intent.rooms,
    }),
  };
}

function scalePlan(
  plan: GeneratedPlan,
  intent: StudioIntent,
  scaleX: number,
  scaleY: number,
  projectName: string,
) {
  const blocks = plan.blocks.map((block) => ({
    ...block,
    id: `${block.id}_s${Math.round(scaleX * 100)}${Math.round(scaleY * 100)}`,
    polygon: block.polygon.map((point) => ({
      x: Math.max(0, snap(point.x * scaleX)),
      y: Math.max(0, snap(point.y * scaleY)),
    })),
  }));
  return {
    plan: finalizePlan({
      projectId: `${plan.projectId}-scaled-${Math.round(scaleX * 100)}-${Math.round(scaleY * 100)}`,
      projectName,
      intentLabel: plan.intentLabel,
      floors: plan.floors,
      blocks: blocks.map((block) => ({
        ...block,
        areaSqm: roundArea(
          (rectFromBlock(block).w * rectFromBlock(block).h) / 1e6,
        ),
      })),
      targetSqm: plan.summary.targetSqm,
      designNotes: [
        ...plan.designNotes.slice(0, 2),
        "候选变体：按外轮廓比例重新适配，模拟 PlanFinder Fit 的库方案贴合。",
      ],
      rooms: intent.rooms,
    }),
  };
}

function candidateSummary(plan: GeneratedPlan) {
  return `${plan.summary.envelope[0]}×${plan.summary.envelope[1]}mm · ${plan.summary.blockCount} 房间 · ${plan.warnings.length} 警告`;
}

function scorePlan(plan: GeneratedPlan) {
  const ratioPenalty = Math.abs(plan.summary.usableRatioEst - 0.83) * 28;
  const warningPenalty = plan.warnings.length * 4;
  return Math.max(
    68,
    Math.min(98, Math.round(95 - ratioPenalty - warningPenalty)),
  );
}

function buildFurniture(plan: GeneratedPlan): FurnitureItem[] {
  return plan.blocks.flatMap((block) => furnitureForBlock(block));
}

function furnitureForBlock(block: PlanBlock): FurnitureItem[] {
  const rect = rectFromBlock(block);
  const base = {
    blockId: block.id,
    floor: block.floor,
  };
  const centerX = rect.x0 + rect.w / 2;
  const centerY = rect.y0 + rect.h / 2;
  if (["主卧", "次卧"].includes(block.purpose)) {
    return [
      {
        ...base,
        id: `${block.id}-bed`,
        label: "床",
        x0: snap(rect.x0 + 300),
        y0: snap(rect.y0 + 300),
        w: Math.min(2100, Math.max(1500, rect.w - 900)),
        h: 1800,
        color: "#bfdbfe",
      },
      {
        ...base,
        id: `${block.id}-wardrobe`,
        label: "柜",
        x0: snap(rect.x1 - 900),
        y0: snap(rect.y0 + 300),
        w: 600,
        h: Math.min(2400, Math.max(1200, rect.h - 600)),
        color: "#dbeafe",
      },
    ];
  }
  if (["客厅", "公共区", "客餐厅一体"].includes(block.purpose)) {
    return [
      {
        ...base,
        id: `${block.id}-sofa`,
        label: "沙发",
        x0: snap(centerX - 1200),
        y0: snap(centerY - 600),
        w: 2400,
        h: 900,
        color: "#bbf7d0",
      },
      {
        ...base,
        id: `${block.id}-table`,
        label: "几",
        x0: snap(centerX - 450),
        y0: snap(centerY + 600),
        w: 900,
        h: 600,
        color: "#86efac",
      },
    ];
  }
  if (block.purpose === "餐厅") {
    return [
      {
        ...base,
        id: `${block.id}-dining`,
        label: "餐桌",
        x0: snap(centerX - 900),
        y0: snap(centerY - 600),
        w: 1800,
        h: 1200,
        color: "#bbf7d0",
      },
    ];
  }
  if (block.purpose === "厨房") {
    return [
      {
        ...base,
        id: `${block.id}-cabinet`,
        label: "橱柜",
        x0: rect.x0 + 150,
        y0: rect.y0 + 150,
        w: Math.max(900, rect.w - 300),
        h: 600,
        color: "#fde68a",
      },
    ];
  }
  if (["卫生间", "主卫"].includes(block.purpose)) {
    return [
      {
        ...base,
        id: `${block.id}-bath`,
        label: "洁具",
        x0: snap(centerX - 450),
        y0: snap(centerY - 450),
        w: 900,
        h: 900,
        color: "#e0e7ff",
      },
    ];
  }
  return [];
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

function generatePlan(intent: StudioIntent): GeneratedPlan {
  return intent.floors === 2
    ? generateTwoFloorPlan(intent)
    : generateSingleFloorPlan(intent);
}

function generateSingleFloorPlan(intent: StudioIntent): GeneratedPlan {
  const rooms = intent.rooms;
  const master = rooms.主卧;
  const masterBath = rooms.主卫;
  const secondary = rooms.次卧;
  const wc = rooms.卫生间;
  const kitchen = rooms.厨房;
  const balcony = rooms.阳台;
  const bedCount = Math.max(1, master.count) + secondary.count;
  const bathCount = masterBath.count + wc.count;
  const publicSplit =
    intent.publicSplit === "auto"
      ? bedCount <= 2
        ? "lk"
        : "lk_sep"
      : intent.publicSplit;
  const [masterW, privateDepth] = pickMasterDims(master.max || 16);

  const southRooms: Array<{ purpose: string; w: number; idx?: number }> = [
    { purpose: "主卧", w: masterW },
  ];
  if (masterBath.count > 0) {
    southRooms.push({
      purpose: "主卫",
      w: Math.max(1500, snap((masterBath.max * 1e6) / privateDepth)),
    });
  }
  for (let index = 0; index < secondary.count; index += 1) {
    southRooms.push({
      purpose: "次卧",
      w: Math.min(
        MAX_SPAN,
        Math.max(2400, snap((secondary.max * 1e6) / privateDepth)),
      ),
      idx: index + 1,
    });
  }

  let envelopeW = southRooms.reduce((sum, room) => sum + room.w, 0);
  envelopeW = Math.max(envelopeW, bedCount <= 1 ? 6000 : 9000);
  const targetInnerArea = intent.totalAreaSqm * DEFAULT_USABLE_RATIO * 1e6;
  const northDepth = Math.min(
    MAX_SPAN,
    snap(Math.max(targetInnerArea / envelopeW - privateDepth, 3000)),
  );
  const envelopeH = privateDepth + northDepth;
  const kitchenWetArea = kitchen.max + (wc.count > 0 ? wc.max : 0);
  const wetW = Math.max(
    1500,
    Math.min(envelopeW - 3600, snap((kitchenWetArea * 1e6) / northDepth)),
  );
  const publicW = envelopeW - wetW;
  const blocks: PlanBlock[] = [];

  let cursor = 0;
  for (const room of southRooms) {
    const id = room.idx ? `R_${room.purpose}_${room.idx}` : `R_${room.purpose}`;
    blocks.push(
      rectBlock(id, room.purpose, cursor, 0, cursor + room.w, privateDepth, 1),
    );
    cursor += room.w;
  }

  if (publicSplit === "lk") {
    blocks.push(
      rectBlock(
        "R_客餐厅一体",
        "客餐厅一体",
        0,
        privateDepth,
        publicW,
        envelopeH,
        1,
      ),
    );
  } else {
    const livingW = snap(publicW * 0.6);
    blocks.push(
      rectBlock("R_客厅", "客厅", 0, privateDepth, livingW, envelopeH, 1),
    );
    blocks.push(
      rectBlock("R_餐厅", "餐厅", livingW, privateDepth, publicW, envelopeH, 1),
    );
  }

  if (wc.count > 0) {
    const wcH = Math.max(
      1500,
      Math.min(northDepth - 1500, snap((wc.max * 1e6) / wetW)),
    );
    blocks.push(
      rectBlock(
        "R_卫生间",
        "卫生间",
        publicW,
        privateDepth,
        envelopeW,
        privateDepth + wcH,
        1,
      ),
    );
    blocks.push(
      rectBlock(
        "R_厨房",
        "厨房",
        publicW,
        privateDepth + wcH,
        envelopeW,
        envelopeH,
        1,
      ),
    );
  } else {
    blocks.push(
      rectBlock(
        "R_厨房",
        "厨房",
        publicW,
        privateDepth,
        envelopeW,
        envelopeH,
        1,
      ),
    );
  }

  if (balcony.count > 0) {
    blocks.push(
      rectBlock(
        "R_阳台",
        "阳台",
        0,
        envelopeH,
        Math.min(3600, envelopeW),
        envelopeH + 1500,
        1,
      ),
    );
  }

  return finalizePlan({
    projectId: `ai-plan-${bedCount}bed-${bathCount}bath-${Math.round(intent.totalAreaSqm)}sqm`,
    projectName: `AI 模板生成：${Math.round(intent.totalAreaSqm)}㎡ ${bedCount}卧${bathCount}卫`,
    intentLabel: `${bedCount}居${publicSplit === "lk" ? "一厅" : "两厅"} ${bathCount}卫`,
    floors: 1,
    blocks,
    targetSqm: intent.totalAreaSqm,
    designNotes: [
      `南向（Y 小）：主卧${masterBath.count ? "+主卫" : ""} + 次卧×${secondary.count}`,
      `北向（Y 大）：${publicSplit === "lk" ? "客餐厅一体" : "客厅+餐厅"} + 厨房${wc.count ? "+公卫" : ""}`,
      "模板化布局：南卧 + 北公共 + 厨卫角，生成后进入专业复核。",
    ],
    rooms,
  });
}

function generateTwoFloorPlan(intent: StudioIntent): GeneratedPlan {
  const rooms = intent.rooms;
  const bedCount = Math.max(1, rooms.主卧.count) + rooms.次卧.count;
  const bathCount = rooms.主卫.count + rooms.卫生间.count;
  const footprintTarget = Math.max(100, intent.totalAreaSqm * 1.08);
  const envelopeW = snap(
    Math.max(12000, Math.sqrt(footprintTarget * 1e6 * 1.33)),
  );
  const envelopeH = snap(Math.max(9000, (footprintTarget * 1e6) / envelopeW));
  const c1 = snap(envelopeW * 0.31);
  const c2 = snap(envelopeW * 0.55);
  const c3 = snap(envelopeW * 0.75);
  const r1 = snap(envelopeH * 0.33);
  const r2 = snap(envelopeH * 0.62);
  const blocks: PlanBlock[] = [
    rectBlock("R_1F_公共区", "公共区", 0, 0, c1, r1, 1),
    rectBlock("R_1F_厨房", "厨房", c1, 0, c2, r1, 1),
    rectBlock("R_1F_卫生间", "卫生间", c2, 0, c3, r1, 1),
    rectBlock("R_1F_楼梯", "楼梯", c3, 0, envelopeW, r1, 1, "双跑"),
    rectBlock("R_1F_客厅", "客厅", 0, r1, c2, r2, 1),
    rectBlock("R_1F_餐厅", "餐厅", c2, r1, c3, r2, 1),
    rectBlock("R_1F_弹性区_A", "弹性区", c3, r1, envelopeW, r2, 1),
    rectBlock("R_1F_弹性区_B", "弹性区", 0, r2, c1, envelopeH, 1),
    rectBlock("R_1F_弹性区_C", "弹性区", c1, r2, c2, envelopeH, 1),
    rectBlock("R_1F_弹性区_D", "弹性区", c2, r2, c3, envelopeH, 1),
    rectBlock("R_1F_弹性区_E", "弹性区", c3, r2, envelopeW, envelopeH, 1),
    rectBlock("R_2F_主卧", "主卧", 0, 0, c2, r1, 2),
    rectBlock("R_2F_主卫", "主卫", c2, 0, c3, r1, 2),
    rectBlock("R_2F_楼梯", "楼梯", c3, 0, envelopeW, r1, 2, "双跑"),
    rectBlock("R_2F_次卧_1", "次卧", 0, r1, c1, r2, 2),
    rectBlock("R_2F_卫生间", "卫生间", c1, r1, c2, r2, 2),
    rectBlock("R_2F_次卧_2", "次卧", c2, r1, c3, r2, 2),
    rectBlock("R_2F_储藏", "储藏", c3, r1, envelopeW, r2, 2),
    rectBlock("R_2F_弹性区_A", "弹性区", 0, r2, c1, envelopeH, 2),
    rectBlock("R_2F_弹性区_B", "弹性区", c1, r2, c2, envelopeH, 2),
    rectBlock("R_2F_弹性区_C", "弹性区", c2, r2, c3, envelopeH, 2),
    rectBlock("R_2F_弹性区_D", "弹性区", c3, r2, envelopeW, envelopeH, 2),
  ];

  for (let index = 2; index < rooms.次卧.count; index += 1) {
    const x0 = snap(((index - 2) % 2) * (envelopeW / 2));
    const y0 = snap(envelopeH - 3000 - Math.floor((index - 2) / 2) * 3000);
    blocks.push(
      rectBlock(
        `R_2F_次卧_${index + 1}`,
        "次卧",
        x0,
        y0,
        x0 + 3000,
        y0 + 3000,
        2,
      ),
    );
  }

  return finalizePlan({
    projectId: `ai-plan-two-floor-${bedCount}bed-${bathCount}bath-${Math.round(intent.totalAreaSqm)}sqm`,
    projectName: `AI 两层户型：${Math.round(intent.totalAreaSqm)}㎡ ${bedCount}卧${bathCount}卫`,
    intentLabel: `${bedCount}居两厅 ${bathCount}卫 · 2 层`,
    floors: 2,
    blocks:
      rooms.主卫.count > 0
        ? blocks
        : blocks.filter((block) => block.purpose !== "主卫"),
    targetSqm: intent.totalAreaSqm,
    designNotes: [
      "1F：公共区 + 厨房 + 卫生间 + 楼梯，弹性区等待深化分配。",
      "2F：主卧 + 次卧 + 公卫 + 楼梯，上下层楼梯位置完全对齐。",
      "3D：按外轮廓生成层板、柱网、梁网和房间底色，后续可进入构件深化。",
    ],
    rooms,
  });
}

function finalizePlan({
  projectId,
  projectName,
  intentLabel,
  floors,
  blocks,
  targetSqm,
  designNotes,
  rooms,
}: {
  projectId: string;
  projectName: string;
  intentLabel: string;
  floors: 1 | 2;
  blocks: PlanBlock[];
  targetSqm: number;
  designNotes: string[];
  rooms: Record<RoomKey, RoomRequirement>;
}): GeneratedPlan {
  const envelope = computeEnvelope(blocks);
  const totalRoomSqm = roundArea(
    blocks.reduce((sum, block) => sum + block.areaSqm, 0),
  );
  const warnings = collectWarnings(blocks, rooms);
  const floor1Sqm = roundArea(
    blocks
      .filter((block) => block.floor === 1)
      .reduce((sum, block) => sum + block.areaSqm, 0),
  );
  const floor2Sqm = roundArea(
    blocks
      .filter((block) => block.floor === 2)
      .reduce((sum, block) => sum + block.areaSqm, 0),
  );
  return {
    projectId,
    projectName,
    intentLabel,
    floors,
    blocks,
    designNotes,
    warnings,
    summary: {
      envelope,
      envelopeSqm: roundArea((envelope[0] * envelope[1]) / 1e6),
      targetSqm,
      totalRoomSqm,
      usableRatioEst: targetSqm ? roundArea(totalRoomSqm / targetSqm) : 0,
      blockCount: blocks.length,
      ...(floors === 2 ? { floor1Sqm, floor2Sqm } : {}),
    },
  };
}

function normalizePlanFromBlocks(
  plan: GeneratedPlan,
  blocks: PlanBlock[],
): GeneratedPlan {
  return finalizePlan({
    projectId: plan.projectId,
    projectName: plan.projectName,
    intentLabel: plan.intentLabel,
    floors: plan.floors,
    blocks,
    targetSqm: plan.summary.targetSqm,
    designNotes: plan.designNotes,
    rooms: initialIntent.rooms,
  });
}

function collectWarnings(
  blocks: PlanBlock[],
  rooms: Record<RoomKey, RoomRequirement>,
): PlanWarning[] {
  const warnings: PlanWarning[] = [];
  for (const block of blocks) {
    if (!isRoomKey(block.purpose)) continue;
    const cfg = rooms[block.purpose];
    if (!cfg || cfg.count === 0) continue;
    if (block.areaSqm > cfg.max * 1.1) {
      warnings.push({
        room: block.id,
        msg: `${block.id} 实际 ${block.areaSqm.toFixed(1)}㎡ 超过目标 max ${cfg.max}㎡`,
        reason: "模数 snap 和短边约束导致，需人工复核。",
      });
    } else if (block.areaSqm < cfg.min * 0.9) {
      warnings.push({
        room: block.id,
        msg: `${block.id} 实际 ${block.areaSqm.toFixed(1)}㎡ 低于目标 min ${cfg.min}㎡`,
        reason: "目标面积偏紧或房间被压缩，需人工复核。",
      });
    }
  }
  return warnings;
}

function computeLiveSummary(intent: StudioIntent) {
  const privateKeys: RoomKey[] = [
    "主卧",
    "主卫",
    "次卧",
    "卫生间",
    "厨房",
    "阳台",
  ];
  let privateMin = 0;
  let privateMax = 0;
  let privateCount = 0;
  for (const key of privateKeys) {
    const item = intent.rooms[key];
    privateCount += item.count;
    privateMin += item.count * item.min;
    privateMax += item.count * item.max;
  }
  const usable = intent.totalAreaSqm * DEFAULT_USABLE_RATIO;
  const publicMin = Math.max(0, usable - privateMax);
  const publicMax = Math.max(0, usable - privateMin);
  let check = "参数合理";
  let tone: "ok" | "warn" | "err" = "ok";
  if (privateMax > usable) {
    check = "私密区超总面积";
    tone = "err";
  } else if (publicMax < 14) {
    check = "公共区不足";
    tone = "warn";
  }
  return {
    privateRange: `${privateMin.toFixed(1)} ~ ${privateMax.toFixed(1)} ㎡`,
    privateCount,
    publicRange: `${publicMin.toFixed(1)} ~ ${publicMax.toFixed(1)} ㎡`,
    check,
    tone,
  };
}

function parsePromptToIntent(prompt: string, base: StudioIntent): StudioIntent {
  const text = prompt.trim();
  const areaMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:平|㎡|m2|m²)/i);
  const bedMatch = text.match(/([一二两三四五六七八九]|\d+)\s*(?:室|居|房)/);
  const bathCount = /双卫|两卫|2卫/.test(text)
    ? 2
    : /主卧带卫生间|主卫|套卫/.test(text)
      ? 2
      : 1;
  const hasMasterBath = /主卧带卫生间|主卫|套卫/.test(text);
  const split: PublicSplit = /一体|一厅/.test(text)
    ? "lk"
    : /两厅|大餐厅|餐厅/.test(text)
      ? "lk_sep"
      : base.publicSplit;
  const bedCount = bedMatch
    ? parseChineseNumber(bedMatch[1] ?? "3")
    : base.rooms.主卧.count + base.rooms.次卧.count;
  const totalAreaSqm = areaMatch ? Number(areaMatch[1]) : base.totalAreaSqm;
  const floors: 1 | 2 =
    /两层|2层|二层|楼梯|复式/.test(text) || totalAreaSqm >= 105 ? 2 : 1;
  return {
    ...base,
    totalAreaSqm,
    floors,
    publicSplit: split,
    rooms: {
      ...base.rooms,
      主卧: {
        ...base.rooms.主卧,
        count: 1,
        max: totalAreaSqm >= 120 ? 18 : 16,
      },
      主卫: {
        ...base.rooms.主卫,
        count: hasMasterBath ? 1 : Math.max(0, bathCount - 1),
      },
      次卧: { ...base.rooms.次卧, count: Math.max(0, bedCount - 1) },
      卫生间: { ...base.rooms.卫生间, count: 1 },
      厨房: { ...base.rooms.厨房, count: 1 },
    },
  };
}

function parseChineseNumber(value: string) {
  const map: Record<string, number> = {
    一: 1,
    二: 2,
    两: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    七: 7,
    八: 8,
    九: 9,
  };
  return Number(value) || map[value] || 3;
}

function pickMasterDims(
  areaTarget: number,
  minShort = 3000,
  ratio = 1.2,
): [number, number] {
  const targetSide = Math.sqrt((areaTarget * 1e6) / ratio);
  const w = Math.max(minShort, Math.min(snap(targetSide), MAX_SPAN));
  const h = Math.max(
    minShort,
    Math.min(snap((areaTarget * 1e6) / w), MAX_SPAN),
  );
  return [w, h];
}

function rectBlock(
  id: string,
  purpose: string,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  floor: 1 | 2,
  stairKind?: "单跑" | "双跑",
): PlanBlock {
  const w = Math.max(MODULUS, x1 - x0);
  const h = Math.max(MODULUS, y1 - y0);
  return {
    id,
    purpose,
    polygon: rectToPolygon({ x0, y0, x1: x0 + w, y1: y0 + h, w, h }),
    areaSqm: roundArea((w * h) / 1e6),
    floor,
    ...(stairKind ? { stairKind } : {}),
  };
}

function rectFromBlock(block: PlanBlock): BlockRect {
  const xs = block.polygon.map((point) => point.x);
  const ys = block.polygon.map((point) => point.y);
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs);
  const y0 = Math.min(...ys);
  const y1 = Math.max(...ys);
  return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 };
}

function rectToPolygon(rect: BlockRect): Point2D[] {
  return [
    { x: rect.x0, y: rect.y0 },
    { x: rect.x1, y: rect.y0 },
    { x: rect.x1, y: rect.y1 },
    { x: rect.x0, y: rect.y1 },
  ];
}

function computeEnvelope(blocks: PlanBlock[]): [number, number] {
  const xs = blocks.flatMap((block) => block.polygon.map((point) => point.x));
  const ys = blocks.flatMap((block) => block.polygon.map((point) => point.y));
  return [snap(Math.max(...xs, 1)), snap(Math.max(...ys, 1))];
}

function buildGridLines(w: number, h: number, step: number) {
  const xs: number[] = [];
  const ys: number[] = [];
  for (let value = 0; value <= w; value += step) xs.push(value);
  for (let value = 0; value <= h; value += step) ys.push(value);
  return { x: xs, y: ys };
}

function buildAxisPositions(lengthM: number, stepM: number) {
  const values: number[] = [];
  for (let value = 0; value <= lengthM + 0.001; value += stepM)
    values.push(value);
  if (values[values.length - 1] !== lengthM) values.push(lengthM);
  return values;
}

function isRoomKey(value: string): value is RoomKey {
  return ["主卧", "主卫", "次卧", "卫生间", "厨房", "阳台"].includes(value);
}

function snap(value: number) {
  return Math.round(value / MODULUS) * MODULUS;
}

function roundArea(value: number) {
  return Math.round(value * 100) / 100;
}

function safeFileName(value: string) {
  return value.replace(/[^\p{L}\p{N}-]+/gu, "-").replace(/^-+|-+$/g, "");
}
