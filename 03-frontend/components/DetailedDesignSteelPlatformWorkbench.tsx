// components/DetailedDesignSteelPlatformWorkbench.tsx - Steel platform detailed-design workbench
// License: Apache-2.0
"use client";

import { OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import {
  Button,
  Checkbox,
  Input,
  InputNumber,
  Progress,
  Segmented,
  Select,
  Table,
  Tag,
  Tooltip,
  type ColumnsType,
} from "@/components/pan-ui";
import {
  DoorOpen,
  FileJson,
  Home,
  Layers,
  ListChecks,
  MousePointer2,
  Play,
  RotateCw,
  Save,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import type { MouseEvent, ReactNode } from "react";
import { useMemo, useState } from "react";
import {
  MODULUS,
  computeLiveSummary,
  generatePlan,
  initialIntent,
  normalizePlanFromBlocks,
  paletteDefaults,
  parsePromptToIntent,
  rectBlock,
  rectFromBlock,
  roomColors,
  roomDefinitions,
  templates,
  type GeneratedPlan,
  type PlanBlock,
  type PublicSplit,
  type RoomKey,
  type RoomRequirement,
  type StudioIntent,
} from "@/lib/architoken/floorplan-layout";
import { createModuleAuditEvent } from "@/lib/module-actions";
import type { ModuleAuditEvent } from "@/lib/module-file-system";
import { moduleFileApiClient } from "@/lib/module-file-api-client";
import {
  createSteelPlatformPackage,
  steelPlatformDefaultSettings,
  type SteelPlatformBeam,
  type SteelPlatformBomRow,
  type SteelPlatformColumn,
  type SteelPlatformConstructionColumn,
  type SteelPlatformInteriorDoor,
  type SteelPlatformInteriorWall,
  type SteelPlatformOpening,
  type SteelPlatformPackage,
  type SteelPlatformPlanBlock,
  type SteelPlatformPoint,
  type SteelPlatformSettings,
  type SteelPlatformWallBay,
  type SteelPlatformWallSide,
} from "@/lib/steel-platform";

type InteractionMode =
  | "select"
  | "outline"
  | "opening"
  | "interior-door"
  | "remove-wall";
type OpeningPresetName = "入户门" | "普通窗" | "落地窗";

const openingPresets: Record<
  OpeningPresetName,
  Pick<
    SteelPlatformOpening,
    "openingType" | "frameType" | "widthMm" | "heightMm" | "sillMm"
  >
> = {
  入户门: {
    openingType: "door",
    frameType: "3-edge",
    widthMm: 1200,
    heightMm: 2100,
    sillMm: 0,
  },
  普通窗: {
    openingType: "window",
    frameType: "4-edge",
    widthMm: 1200,
    heightMm: 1500,
    sillMm: 900,
  },
  落地窗: {
    openingType: "window",
    frameType: "3-edge",
    widthMm: 1200,
    heightMm: 2400,
    sillMm: 0,
  },
};

const wallSideLabels: Record<SteelPlatformWallSide, string> = {
  south: "南",
  north: "北",
  east: "东",
  west: "西",
};

const splitOptions: Array<{ label: string; value: PublicSplit }> = [
  { label: "自动", value: "auto" },
  { label: "客餐一体", value: "lk" },
  { label: "两厅分离", value: "lk_sep" },
];

const bomColumns: ColumnsType<SteelPlatformBomRow> = [
  { title: "分类", dataIndex: "category", key: "category", width: 96 },
  { title: "项目", dataIndex: "item", key: "item" },
  {
    title: "数量",
    dataIndex: "count",
    key: "count",
    width: 72,
    render: (value: SteelPlatformBomRow["count"]) => value ?? "-",
  },
  {
    title: "长度(m)",
    dataIndex: "lengthM",
    key: "lengthM",
    width: 92,
    render: (value: SteelPlatformBomRow["lengthM"]) => value ?? "-",
  },
  {
    title: "面积(m2)",
    dataIndex: "areaM2",
    key: "areaM2",
    width: 92,
    render: (value: SteelPlatformBomRow["areaM2"]) => value ?? "-",
  },
  {
    title: "重量(t)",
    dataIndex: "weightT",
    key: "weightT",
    width: 86,
    render: (value: SteelPlatformBomRow["weightT"]) => value ?? "-",
  },
];

export function DetailedDesignSteelPlatformWorkbench({
  onAudit,
}: {
  onAudit?: (event: ModuleAuditEvent) => void;
}) {
  const [prompt, setPrompt] = useState(
    "135 平两层四室两厅双卫，主卧带卫生间，客厅朝南，大餐厅",
  );
  const [intent, setIntent] = useState<StudioIntent>(() =>
    parsePromptToIntent(
      "135 平两层四室两厅双卫，主卧带卫生间，客厅朝南，大餐厅",
      initialIntent,
    ),
  );
  const [plan, setPlan] = useState<GeneratedPlan>(() => generatePlan(intent));
  const [settings, setSettings] = useState<SteelPlatformSettings>({
    ...steelPlatformDefaultSettings,
    roofType: intent.roofType,
    roofRidgeAxis: intent.roofRidgeAxis,
  });
  const [currentFloor, setCurrentFloor] = useState<1 | 2>(1);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [customOutline, setCustomOutline] = useState<SteelPlatformPoint[]>();
  const [draftOutline, setDraftOutline] = useState<SteelPlatformPoint[]>([]);
  const [interactionMode, setInteractionMode] =
    useState<InteractionMode>("select");
  const [openings, setOpenings] = useState<SteelPlatformOpening[]>([]);
  const [interiorDoors, setInteriorDoors] = useState<
    SteelPlatformInteriorDoor[]
  >([]);
  const [lastDoorWallId, setLastDoorWallId] = useState<string | null>(null);
  const [removedInteriorWallIds, setRemovedInteriorWallIds] = useState<
    string[]
  >([]);
  const [enclosureVisible, setEnclosureVisible] = useState(true);
  const [saveState, setSaveState] = useState("未归档");
  const [status, setStatus] = useState("就绪 · 调整参数后生成 2D");
  const [log, setLog] = useState("等待操作。");

  const designPackage = useMemo(() => {
    const options = {
      ...(customOutline ? { outlinePolygon: customOutline } : {}),
      openings,
      interiorDoors,
      removedInteriorWallIds,
    };
    return createSteelPlatformPackage(plan, settings, options);
  }, [
    customOutline,
    interiorDoors,
    openings,
    plan,
    removedInteriorWallIds,
    settings,
  ]);
  const liveSummary = useMemo(() => computeLiveSummary(intent), [intent]);
  const selectedBlock = selectedBlockId
    ? plan.blocks.find((block) => block.id === selectedBlockId)
    : undefined;
  const reviewProgress = useMemo(() => {
    const passed = designPackage.ruleChecks.filter(
      (check) => check.status === "passed",
    ).length;
    return Math.round((passed / designPackage.ruleChecks.length) * 100);
  }, [designPackage.ruleChecks]);

  function emit(action: string, summary: string) {
    onAudit?.(
      createModuleAuditEvent(action, "SteelPlatformWorkbench", summary),
    );
  }

  function updateIntent(next: StudioIntent) {
    setIntent(next);
    setSettings((current) => ({
      ...current,
      roofType: next.roofType,
      roofRidgeAxis: next.roofRidgeAxis,
    }));
  }

  function updateRoomRequirement<K extends keyof RoomRequirement>(
    room: RoomKey,
    field: K,
    value: RoomRequirement[K],
  ) {
    updateIntent({
      ...intent,
      rooms: {
        ...intent.rooms,
        [room]: { ...intent.rooms[room], [field]: value },
      },
    });
  }

  function applyTemplate(templateKey: keyof typeof templates) {
    const template = templates[templateKey];
    if (!template) return;
    updateIntent({
      ...intent,
      totalAreaSqm: template.total,
      floors: template.floors,
      publicSplit: template.split,
      rooms: mergeTemplateRooms(intent.rooms, template.rooms),
    });
    setCurrentFloor(1);
    setStatus(`已应用模板 ${template.title} · 生成后进入 2D 编辑`);
  }

  function generateFromPrompt() {
    const nextIntent = parsePromptToIntent(prompt, intent);
    updateIntent(nextIntent);
    generateLayout(nextIntent, "AI 文本已解析为户型需求");
  }

  function generateLayout(nextIntent = intent, reason = "参数生成") {
    const nextPlan = generatePlan(nextIntent);
    setPlan(nextPlan);
    setSelectedBlockId(null);
    setOpenings([]);
    setInteriorDoors([]);
    setRemovedInteriorWallIds([]);
    setDraftOutline([]);
    setInteractionMode("select");
    setSaveState("已生成 · 待归档");
    const env = nextPlan.summary.envelope;
    const floorInfo =
      nextPlan.floors === 2
        ? ` · 2层 ${nextPlan.summary.floor1Sqm ?? "-"}㎡ + ${nextPlan.summary.floor2Sqm ?? "-"}㎡`
        : "";
    const nextStatus = `${reason}: ${env[0]}×${env[1]}mm · ${nextPlan.blocks.length} 空间块${floorInfo}`;
    setStatus(nextStatus);
    setLog(`plan:\n${JSON.stringify(nextPlan, null, 2)}`);
    emit("detailed-design-steel-platform-generate", nextStatus);
  }

  function updateSetting<K extends keyof SteelPlatformSettings>(
    key: K,
    value: SteelPlatformSettings[K],
  ) {
    setSettings((current) => ({ ...current, [key]: value }));
  }

  function applySelectedBlockRect(next: {
    x0?: number;
    y0?: number;
    w?: number;
    h?: number;
  }) {
    if (!selectedBlock) return;
    const rect = rectFromBlock(selectedBlock);
    const x0 = snap(next.x0 ?? rect.x0);
    const y0 = snap(next.y0 ?? rect.y0);
    const w = Math.max(MODULUS, snap(next.w ?? rect.w));
    const h = Math.max(MODULUS, snap(next.h ?? rect.h));
    const blocks = plan.blocks.map((block) =>
      block.id === selectedBlock.id
        ? rectBlock(
            block.id,
            block.purpose,
            x0,
            y0,
            x0 + w,
            y0 + h,
            block.floor,
            block.stairKind,
            "manual",
          )
        : block,
    );
    setPlan(normalizePlanFromBlocks(plan, blocks));
    setStatus(`${selectedBlock.purpose} 已按 300mm 模数更新`);
  }

  function addRoom(roomType: string, stairKind?: "单跑" | "双跑") {
    if (roomType === "楼梯" && plan.floors < 2) {
      setStatus("单层方案不添加楼梯；请先切换为两层。");
      return;
    }
    const defaults =
      roomType === "楼梯" && stairKind === "单跑"
        ? { w: 1200, h: 4800 }
        : roomType === "楼梯" && stairKind === "双跑"
          ? { w: 2400, h: 3900 }
          : (paletteDefaults[roomType] ?? { w: 3000, h: 3000 });
    const sameFloor = plan.blocks.filter(
      (block) => block.floor === currentFloor,
    );
    const index = sameFloor.length;
    const x0 = snap((index % 4) * 3300);
    const y0 = snap(Math.floor(index / 4) * 3600);
    const id = `R_${roomType}_${Date.now().toString(36)}`;
    const nextBlock = rectBlock(
      id,
      roomType,
      x0,
      y0,
      x0 + defaults.w,
      y0 + defaults.h,
      currentFloor,
      stairKind,
      "manual",
    );
    setPlan(normalizePlanFromBlocks(plan, [...plan.blocks, nextBlock]));
    setSelectedBlockId(id);
    setStatus(`已添加 ${roomType}${stairKind ? `-${stairKind}` : ""}`);
  }

  function deleteSelectedBlock() {
    if (!selectedBlock) return;
    const blocks = plan.blocks.filter((block) => block.id !== selectedBlock.id);
    setPlan(normalizePlanFromBlocks(plan, blocks));
    setSelectedBlockId(null);
    setStatus(`已删除 ${selectedBlock.purpose}`);
  }

  function toggleOpeningBay(bay: SteelPlatformWallBay) {
    const existing = openings.find((opening) => opening.bayId === bay.id);
    if (existing) {
      setOpenings((current) =>
        current.filter((opening) => opening.bayId !== bay.id),
      );
      setStatus(`${wallSideLabels[bay.wallSide]}墙 ${bay.id} 已恢复为实墙`);
      return;
    }
    setOpenings((current) => [
      ...current,
      openingFromBay(bay, "普通窗", current.length + 1),
    ]);
    setStatus(`${wallSideLabels[bay.wallSide]}墙 ${bay.id} 已布置普通窗`);
  }

  function addOpeningManual() {
    const bay =
      designPackage.structuralLayout.wallBays.find(
        (candidate) => candidate.floor === currentFloor,
      ) ?? designPackage.structuralLayout.wallBays[0];
    if (!bay) return;
    setOpenings((current) => [
      ...current,
      openingFromBay(bay, "普通窗", current.length + 1),
    ]);
    setStatus("已添加门窗，可在清单中切换门/窗类型与位置。");
  }

  function updateOpening(
    id: string,
    patch: Partial<SteelPlatformOpening> & { preset?: OpeningPresetName },
  ) {
    setOpenings((current) =>
      current.map((opening) =>
        opening.id === id ? mergeOpeningPatch(opening, patch) : opening,
      ),
    );
  }

  function removeOpening(id: string) {
    setOpenings((current) => current.filter((opening) => opening.id !== id));
  }

  function toggleInteriorDoor(wall: SteelPlatformInteriorWall) {
    const existing = interiorDoors.find((door) => door.wallId === wall.id);
    if (existing) {
      setInteriorDoors((current) =>
        current.filter((door) => door.wallId !== wall.id),
      );
      setStatus(`${wall.id} 内门已删除`);
      return;
    }
    const position =
      wall.axis === "X"
        ? (wall.start.x + wall.end.x) / 2
        : (wall.start.y + wall.end.y) / 2;
    setInteriorDoors((current) => [
      ...current,
      { wallId: wall.id, positionMm: snap(position), flip: 0 },
    ]);
    setLastDoorWallId(wall.id);
    setStatus(`${wall.id} 已放置内门`);
  }

  function flipLastDoor() {
    if (!lastDoorWallId) {
      setStatus("先在内墙模式中放置一道内门。");
      return;
    }
    setInteriorDoors((current) =>
      current.map((door) =>
        door.wallId === lastDoorWallId
          ? { ...door, flip: ((door.flip + 1) % 4) as 0 | 1 | 2 | 3 }
          : door,
      ),
    );
    setStatus(`${lastDoorWallId} 内门开向已翻转`);
  }

  function toggleRemovedWall(wall: SteelPlatformInteriorWall) {
    setRemovedInteriorWallIds((current) =>
      current.includes(wall.id)
        ? current.filter((id) => id !== wall.id)
        : [...current, wall.id],
    );
    setStatus(`${wall.id} ${wall.removed ? "已恢复" : "已标记删除"}`);
  }

  function handleCanvasPoint(point: SteelPlatformPoint) {
    if (interactionMode !== "outline") return;
    const snapped = {
      x: snap(point.x),
      y: snap(point.y),
    };
    setDraftOutline((current) => {
      if (!current.length) return [snapped];
      const first = current[0]!;
      if (current.length >= 3 && distance(first, snapped) < 600) {
        setCustomOutline(closeOrthogonalOutline(current));
        setInteractionMode("select");
        setStatus(`户型轮廓已闭合 · ${current.length} 顶点`);
        return [];
      }
      const last = current[current.length - 1]!;
      const dx = Math.abs(snapped.x - last.x);
      const dy = Math.abs(snapped.y - last.y);
      const orthogonal =
        dx >= dy ? { x: snapped.x, y: last.y } : { x: last.x, y: snapped.y };
      if (orthogonal.x === last.x && orthogonal.y === last.y) return current;
      return [...current, orthogonal];
    });
  }

  function finishOutline() {
    if (draftOutline.length < 3) {
      setStatus("轮廓至少需要 3 个转角。");
      return;
    }
    setCustomOutline(closeOrthogonalOutline(draftOutline));
    setDraftOutline([]);
    setInteractionMode("select");
    setStatus("轮廓已保存，重新生成或继续深化。");
  }

  function clearOutline() {
    setCustomOutline(undefined);
    setDraftOutline([]);
    setInteractionMode("select");
    setStatus("轮廓已清除，退回自动矩形外形。");
  }

  async function saveDesignPackage() {
    const content = JSON.stringify(designPackage, null, 2);
    const filename = `steel-platform-${Date.now()}.json`;
    try {
      await moduleFileApiClient.createModuleFile({
        moduleId: "detailed_design",
        name: filename,
        kind: "file",
        mimeType: "application/json",
        sizeBytes: new Blob([content]).size,
        owner: "深化设计师",
        tags: [
          "steel-platform",
          "professional_review_required",
          "BOM",
          "STEP-ready",
        ],
        content,
      });
      setSaveState(`已归档 · ${filename}`);
      emit(
        "detailed-design-steel-platform-save",
        "钢平台深化 JSON 包、BOM、门窗、内墙和门禁状态已写入 CDE 文件接口。",
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown error";
      setSaveState("归档失败 · 后端文件接口不可用");
      emit(
        "detailed-design-steel-platform-save-failed",
        `钢平台深化包归档失败: ${message}`,
      );
    }
  }

  function build3DModel() {
    setStatus("✓ 3D 模型已按当前 2D 方案、屋面、门窗和围护开关生成");
    setLog(
      JSON.stringify(
        {
          glb: "full_house.gltf",
          glbFrame: "full_house_frame.gltf",
          step: "full_house.step",
          source: "live steel-platform package",
          reviewState: designPackage.reviewState,
          outline: designPackage.plan.summary.envelope,
          columns: designPackage.structuralLayout.columns.length,
          beams: designPackage.structuralLayout.mainBeams.length,
          wallBays: designPackage.structuralLayout.wallBays.length,
          openings: designPackage.structuralLayout.exteriorOpenings.length,
        },
        null,
        2,
      ),
    );
    emit(
      "detailed-design-steel-platform-build-3d",
      "当前钢平台 2D 深化包已派生 3D 视口模型，真实 STEP/GLTF 仍需 worker build123d/OCP。",
    );
  }

  function calculateBom() {
    setStatus("✓ 工程量 BOM 已按当前设计包计算");
    setLog(JSON.stringify(designPackage.bom, null, 2));
    emit(
      "detailed-design-steel-platform-calculate-bom",
      "钢平台柱梁、围护、内墙、门窗和屋面工程量已计算。",
    );
  }

  return (
    <section
      className="open-cde-business-panel steel-platform-workbench min-h-[860px] min-w-0 overflow-x-auto bg-[var(--arch-huly-main-bg)] text-[var(--arch-text)]"
      data-business-context-root="steel-platform"
    >
      <div className="border-b border-[var(--module-accent-soft)] bg-[var(--module-accent)] px-4 py-3 text-[var(--module-accent-foreground)]">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="whitespace-nowrap text-xl font-semibold">
                装配式钢结构深化工作室
              </h2>
              <Tag color="green">professional_review_required</Tag>
              <Tag color="blue">参数 → 2D → 3D → BOM</Tag>
            </div>
            <p className="mt-1 text-sm opacity-80">
              AI 户型工作室 · 参数 → 2D → 3D ·
              柱网、梁、构造柱、内墙龙骨、门窗、屋面和 BOM。
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="max-w-[520px] rounded-md border border-white/35 bg-white/20 px-3 py-2 text-xs text-[var(--module-accent-foreground)]">
              <span>状态 </span>
              <span className="font-semibold">{status}</span>
            </div>
            <Button
              type="primary"
              icon={<Play className="h-4 w-4" />}
              onClick={build3DModel}
            >
              生成 3D 模型
            </Button>
            <Button
              icon={<ListChecks className="h-4 w-4" />}
              onClick={calculateBom}
            >
              算工程量
            </Button>
          </div>
        </div>
        <EngineeringTicker designPackage={designPackage} />
      </div>

      <div className="grid gap-4 p-4 xl:grid-cols-[260px_minmax(0,1fr)_270px] 2xl:grid-cols-[360px_minmax(0,1fr)_430px]">
        <aside className="space-y-4">
          <Panel title="AI 与参数">
            <div className="flex items-center gap-2">
              <Input
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                onPressEnter={generateFromPrompt}
              />
              <Tooltip title="解析为户型需求并生成 2D">
                <Button
                  type="primary"
                  icon={<Play className="h-4 w-4" />}
                  onClick={generateFromPrompt}
                />
              </Tooltip>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <NumberField
                label="建筑面积(㎡)"
                value={intent.totalAreaSqm}
                min={40}
                max={500}
                step={5}
                onChange={(value) =>
                  updateIntent({
                    ...intent,
                    totalAreaSqm: value ?? intent.totalAreaSqm,
                  })
                }
              />
              <SelectField
                label="楼层"
                value={intent.floors}
                options={[
                  { label: "1 层", value: 1 },
                  { label: "2 层", value: 2 },
                ]}
                onChange={(value) =>
                  updateIntent({ ...intent, floors: value as 1 | 2 })
                }
              />
              <SelectField
                label="公区"
                value={intent.publicSplit}
                options={splitOptions}
                onChange={(value) =>
                  updateIntent({
                    ...intent,
                    publicSplit: value as PublicSplit,
                  })
                }
              />
              <SelectField
                label="模板"
                value=""
                options={Object.entries(templates).map(([value, template]) => ({
                  label: template.title,
                  value,
                }))}
                onChange={(value) =>
                  applyTemplate(value as keyof typeof templates)
                }
              />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <MiniStat label="私密区" value={liveSummary.privateRange} />
              <MiniStat label="公共区" value={liveSummary.publicRange} />
              <MiniStat
                label="房间数"
                value={String(liveSummary.privateCount)}
              />
              <MiniStat label="校验" value={liveSummary.check} />
            </div>
            <Button
              className="mt-3 w-full"
              type="primary"
              icon={<Play className="h-4 w-4" />}
              onClick={() => generateLayout()}
            >
              生成布局 (2D)
            </Button>
          </Panel>

          <Panel title="房间需求">
            <div className="grid gap-2">
              {roomDefinitions.map((room) => (
                <div
                  key={room.key}
                  className="grid grid-cols-[48px_repeat(3,minmax(0,1fr))] items-center gap-2 text-xs"
                >
                  <span className="font-medium text-[var(--arch-text)]">
                    {room.key}
                  </span>
                  <InputNumber
                    className="min-w-0"
                    size="small"
                    value={intent.rooms[room.key].count}
                    min={0}
                    max={5}
                    disabled={room.locked}
                    onChange={(value) =>
                      updateRoomRequirement(
                        room.key,
                        "count",
                        value ?? intent.rooms[room.key].count,
                      )
                    }
                  />
                  <InputNumber
                    className="min-w-0"
                    size="small"
                    value={intent.rooms[room.key].min}
                    min={0}
                    step={0.5}
                    onChange={(value) =>
                      updateRoomRequirement(
                        room.key,
                        "min",
                        value ?? intent.rooms[room.key].min,
                      )
                    }
                  />
                  <InputNumber
                    className="min-w-0"
                    size="small"
                    value={intent.rooms[room.key].max}
                    min={0}
                    step={0.5}
                    onChange={(value) =>
                      updateRoomRequirement(
                        room.key,
                        "max",
                        value ?? intent.rooms[room.key].max,
                      )
                    }
                  />
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="钢构与屋面">
            <div className="grid gap-3">
              <NumberField
                label="柱跨硬上限(mm)"
                value={settings.maxSpanMm}
                min={3000}
                max={4800}
                step={300}
                onChange={(value) =>
                  updateSetting("maxSpanMm", value ?? settings.maxSpanMm)
                }
              />
              <NumberField
                label="层高(mm)"
                value={settings.floorHeightMm}
                min={2600}
                max={4200}
                step={100}
                onChange={(value) =>
                  updateSetting(
                    "floorHeightMm",
                    value ?? settings.floorHeightMm,
                  )
                }
              />
              <SelectField
                label="屋顶"
                value={settings.roofType}
                options={[
                  { label: "平屋面", value: "平" },
                  { label: "单坡", value: "单坡" },
                  { label: "双坡", value: "双坡" },
                ]}
                onChange={(value) =>
                  updateSetting(
                    "roofType",
                    value as SteelPlatformSettings["roofType"],
                  )
                }
              />
              <SelectField
                label="屋脊"
                value={settings.roofRidgeAxis}
                options={[
                  { label: "X 向", value: "X" },
                  { label: "Y 向", value: "Y" },
                ]}
                onChange={(value) =>
                  updateSetting(
                    "roofRidgeAxis",
                    value as SteelPlatformSettings["roofRidgeAxis"],
                  )
                }
              />
              <NumberField
                label="屋面坡度(°)"
                value={settings.roofSlopeDeg}
                min={0}
                max={45}
                step={1}
                onChange={(value) =>
                  updateSetting("roofSlopeDeg", value ?? settings.roofSlopeDeg)
                }
              />
              <NumberField
                label="构造柱间距(mm)"
                value={settings.constructionColumnSpacingMm}
                min={600}
                max={1800}
                step={300}
                onChange={(value) =>
                  updateSetting(
                    "constructionColumnSpacingMm",
                    value ?? settings.constructionColumnSpacingMm,
                  )
                }
              />
              <div className="grid grid-cols-2 gap-2">
                <Checkbox
                  checked={settings.constructionColumnEnabled}
                  onChange={(event) =>
                    updateSetting(
                      "constructionColumnEnabled",
                      event.target.checked,
                    )
                  }
                >
                  外墙构造柱
                </Checkbox>
                <Checkbox
                  checked={settings.interiorWallEnabled}
                  onChange={(event) =>
                    updateSetting("interiorWallEnabled", event.target.checked)
                  }
                >
                  内墙龙骨
                </Checkbox>
              </div>
            </div>
          </Panel>
        </aside>

        <main className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
            <Panel
              title={
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span>2D 平面图</span>
                  <div className="flex flex-wrap items-center gap-2">
                    {plan.floors === 2 ? (
                      <Segmented
                        size="small"
                        value={currentFloor}
                        onChange={(value) => setCurrentFloor(value as 1 | 2)}
                        options={[
                          { label: "1F", value: 1 },
                          { label: "2F", value: 2 },
                        ]}
                      />
                    ) : null}
                    <ModeButton
                      mode="select"
                      active={interactionMode === "select"}
                      icon={<MousePointer2 className="h-3.5 w-3.5" />}
                      label="选择"
                      onClick={() => setInteractionMode("select")}
                    />
                    <ModeButton
                      mode="outline"
                      active={interactionMode === "outline"}
                      icon={<Home className="h-3.5 w-3.5" />}
                      label="轮廓"
                      onClick={() => setInteractionMode("outline")}
                    />
                    <ModeButton
                      mode="opening"
                      active={interactionMode === "opening"}
                      icon={<Layers className="h-3.5 w-3.5" />}
                      label="门窗"
                      onClick={() => setInteractionMode("opening")}
                    />
                    <ModeButton
                      mode="interior-door"
                      active={interactionMode === "interior-door"}
                      icon={<DoorOpen className="h-3.5 w-3.5" />}
                      label="内门"
                      onClick={() => setInteractionMode("interior-door")}
                    />
                    <ModeButton
                      mode="remove-wall"
                      active={interactionMode === "remove-wall"}
                      icon={<ListChecks className="h-3.5 w-3.5" />}
                      label="删墙"
                      onClick={() => setInteractionMode("remove-wall")}
                    />
                  </div>
                </div>
              }
            >
              <div className="relative">
                <PlanPreview
                  designPackage={designPackage}
                  currentFloor={currentFloor}
                  interactionMode={interactionMode}
                  selectedBlockId={selectedBlockId}
                  draftOutline={draftOutline}
                  onSelectBlock={setSelectedBlockId}
                  onCanvasPoint={handleCanvasPoint}
                  onToggleOpening={toggleOpeningBay}
                  onToggleDoor={toggleInteriorDoor}
                  onToggleRemovedWall={toggleRemovedWall}
                />
                {selectedBlock ? (
                  <div className="absolute right-3 top-3 w-[210px] rounded-md border border-[var(--module-accent)] bg-[var(--arch-surface)] p-3 shadow-xl backdrop-blur">
                    <RoomEditor
                      block={selectedBlock}
                      onChange={applySelectedBlockRect}
                      onDelete={deleteSelectedBlock}
                    />
                  </div>
                ) : null}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {interactionMode === "outline" ? (
                  <>
                    <Button size="small" onClick={finishOutline}>
                      完成轮廓
                    </Button>
                    <Button size="small" onClick={clearOutline}>
                      清除轮廓
                    </Button>
                  </>
                ) : null}
                {["主卧", "次卧", "客厅", "餐厅", "厨房", "卫生间", "储藏"].map(
                  (room) => (
                    <Button
                      key={room}
                      size="small"
                      style={{
                        borderColor: roomColors[room] ?? "#cbd5e1",
                        color: "#0f172a",
                      }}
                      onClick={() => addRoom(room)}
                    >
                      + {room}
                    </Button>
                  ),
                )}
                {plan.floors === 2 ? (
                  <>
                    <Button
                      size="small"
                      onClick={() => addRoom("楼梯", "单跑")}
                    >
                      + 楼梯-单跑
                    </Button>
                    <Button
                      size="small"
                      onClick={() => addRoom("楼梯", "双跑")}
                    >
                      + 楼梯-双跑
                    </Button>
                  </>
                ) : null}
              </div>
            </Panel>

            <Panel
              title={
                <div className="flex items-center justify-between gap-2">
                  <span>3D 模型</span>
                  <Button
                    size="small"
                    icon={<Layers className="h-3.5 w-3.5" />}
                    onClick={() => setEnclosureVisible((value) => !value)}
                  >
                    外围护: {enclosureVisible ? "显示" : "隐藏"}
                  </Button>
                </div>
              }
            >
              <SteelFramePreview
                designPackage={designPackage}
                enclosureVisible={enclosureVisible}
              />
            </Panel>
          </div>

          <Panel title="工程量 BOM">
            <Table<SteelPlatformBomRow>
              size="small"
              rowKey={(row) => `${row.category}-${row.item}`}
              columns={bomColumns}
              dataSource={designPackage.bom.rows}
              pagination={false}
              scroll={{ x: 760 }}
            />
          </Panel>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.45fr)]">
            <Panel title="状态与日志">
              <div className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                {status}
              </div>
              <pre className="mt-3 max-h-44 overflow-auto rounded-md bg-[var(--arch-surface-muted)] p-3 text-xs text-[var(--arch-text)]">
                {log}
              </pre>
            </Panel>
            <Panel title="门禁">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <ShieldCheck className="h-4 w-4 text-emerald-600" />
                  专业复核链
                </div>
                <Progress
                  className="max-w-[130px]"
                  percent={reviewProgress}
                  size="small"
                />
              </div>
              <div className="mt-3 space-y-2">
                {designPackage.ruleChecks.map((check) => (
                  <div
                    key={check.id}
                    className="flex items-center justify-between gap-2 rounded-md bg-[var(--arch-surface-muted)] px-2 py-2 text-xs"
                  >
                    <span>{check.title}</span>
                    <Tag
                      color={
                        check.status === "passed" ? "success" : "processing"
                      }
                    >
                      {check.status === "passed" ? "passed" : "review"}
                    </Tag>
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        </main>

        <aside className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Metric
              label="空间块"
              value={designPackage.plan.summary.blockCount.toString()}
            />
            <Metric
              label="构件"
              value={designPackage.bom.summary.totalMemberCount.toString()}
            />
            <Metric
              label="钢量(t)"
              value={designPackage.bom.summary.totalSteelT.toFixed(3)}
            />
            <Metric
              label="面积(m2)"
              value={designPackage.bom.summary.floorAreaM2.toFixed(1)}
            />
          </div>

          <LayerSchedule
            designPackage={designPackage}
            currentFloor={currentFloor}
            onFloorChange={setCurrentFloor}
          />

          <Panel title="房间编辑">
            {selectedBlock ? (
              <RoomEditor
                block={selectedBlock}
                onChange={applySelectedBlockRect}
                onDelete={deleteSelectedBlock}
              />
            ) : (
              <div className="rounded-md bg-[var(--arch-surface-muted)] p-3 text-sm text-[var(--arch-muted)]">
                点击 2D 平面中的房间后编辑坐标和尺寸。
              </div>
            )}
            <div className="mt-3 max-h-48 space-y-2 overflow-auto">
              {plan.blocks
                .filter((block) => block.floor === currentFloor)
                .map((block) => (
                  <button
                    key={block.id}
                    className={`flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm ${
                      selectedBlockId === block.id
                        ? "border-[var(--module-accent)] bg-[var(--module-accent-soft)] text-[var(--arch-text)]"
                        : "border-[var(--arch-border)] bg-[var(--arch-surface-muted)] text-[var(--arch-text)]"
                    }`}
                    type="button"
                    onClick={() => setSelectedBlockId(block.id)}
                  >
                    <span>{block.purpose}</span>
                    <span className="text-xs text-[var(--arch-muted)]">
                      {block.areaSqm.toFixed(1)}㎡
                    </span>
                  </button>
                ))}
            </div>
          </Panel>

          <Panel
            title={
              <div className="flex items-center justify-between gap-2">
                <span>门窗</span>
                <Button size="small" onClick={addOpeningManual}>
                  + 加门窗
                </Button>
              </div>
            }
          >
            <div className="space-y-2">
              {openings.length ? (
                openings.map((opening) => (
                  <OpeningEditor
                    key={opening.id}
                    opening={opening}
                    onChange={updateOpening}
                    onRemove={removeOpening}
                  />
                ))
              ) : (
                <div className="rounded-md bg-[var(--arch-surface-muted)] p-3 text-sm text-[var(--arch-muted)]">
                  可点“门窗模式”后在外墙 bay 上布置，也可手动添加。
                </div>
              )}
            </div>
          </Panel>

          <Panel title="内墙与内门">
            <div className="flex gap-2">
              <Button
                icon={<RotateCw className="h-4 w-4" />}
                onClick={flipLastDoor}
              >
                翻转开向
              </Button>
              <Button
                icon={<ListChecks className="h-4 w-4" />}
                onClick={() => {
                  setLog(
                    JSON.stringify(
                      designPackage.structuralLayout.interiorWalls,
                      null,
                      2,
                    ),
                  );
                  setStatus("内墙龙骨清单已写入日志。");
                }}
              >
                查看内墙
              </Button>
            </div>
            <div className="mt-3 space-y-2 text-xs text-[var(--arch-muted)]">
              <div>内门: {interiorDoors.length} 道</div>
              <div>已删内墙: {removedInteriorWallIds.length} 段</div>
              <div>
                撞窗提示:{" "}
                {
                  designPackage.structuralLayout.interiorWalls.filter(
                    (wall) => wall.hitExteriorOpening,
                  ).length
                }{" "}
                段
              </div>
            </div>
          </Panel>

          <Panel title="交付物">
            <div className="space-y-2 text-sm">
              {[
                ["steel_platform_design_package.json", "ready"],
                ["steel_platform_bom.json", "ready"],
                ["full_house.step", "worker"],
                ["full_house.gltf", "worker"],
                ["full_house_frame.gltf", "worker"],
              ].map(([name, state]) => (
                <div
                  key={name}
                  className="flex items-center justify-between rounded-md border border-[var(--arch-border)] bg-[var(--arch-surface-muted)] px-3 py-2"
                >
                  <span className="truncate">{name}</span>
                  <Tag color={state === "ready" ? "green" : "blue"}>
                    {state}
                  </Tag>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="CDE 归档">
            <p className="text-sm text-[var(--arch-muted)]">{saveState}</p>
            <div className="mt-3 flex gap-2">
              <Tooltip title="写入模块文件接口">
                <Button
                  type="primary"
                  icon={<Save className="h-4 w-4" />}
                  onClick={() => void saveDesignPackage()}
                >
                  归档
                </Button>
              </Tooltip>
              <Button
                icon={<FileJson className="h-4 w-4" />}
                onClick={() => {
                  setSaveState("JSON 已刷新 · 待归档");
                  setLog(JSON.stringify(designPackage, null, 2));
                  emit(
                    "detailed-design-steel-platform-refresh-json",
                    "钢平台深化 JSON 包已刷新。",
                  );
                }}
              >
                刷新
              </Button>
            </div>
          </Panel>
        </aside>
      </div>

      <div className="sticky bottom-0 z-10 flex flex-wrap items-center gap-2 border-t border-[var(--arch-border)] bg-[var(--arch-surface)]/95 px-4 py-3 backdrop-blur">
        <Button
          type="primary"
          icon={<Play className="h-4 w-4" />}
          onClick={() => generateLayout()}
        >
          生成布局 (2D)
        </Button>
        <Button
          type="primary"
          icon={<Play className="h-4 w-4" />}
          onClick={build3DModel}
        >
          生成 3D 模型
        </Button>
        <Button icon={<ListChecks className="h-4 w-4" />} onClick={calculateBom}>
          算工程量
        </Button>
        <Button
          icon={<Save className="h-4 w-4" />}
          onClick={() => void saveDesignPackage()}
        >
          归档 CDE
        </Button>
        <span className="min-w-[220px] flex-1 truncate pl-2 text-xs text-[var(--module-accent)]">
          {status}
        </span>
      </div>
    </section>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number | null) => void;
}) {
  return (
    <label className="grid gap-1 text-xs text-[var(--arch-muted)]">
      <span>{label}</span>
      <InputNumber
        className="w-full"
        size="small"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={onChange}
      />
    </label>
  );
}

function EngineeringTicker({
  designPackage,
}: {
  designPackage: SteelPlatformPackage;
}) {
  const rows = [
    ["楼层", `${designPackage.plan.floors}`],
    ["外轮廓", designPackage.plan.summary.envelope.join("×")],
    ["空间块", `${designPackage.plan.summary.blockCount}`],
    ["柱", `${designPackage.structuralLayout.columns.length}`],
    ["梁", `${designPackage.structuralLayout.mainBeams.length}`],
    ["构造柱", `${designPackage.structuralLayout.constructionColumns.length}`],
    ["墙板 bay", `${designPackage.structuralLayout.wallBays.length}`],
    ["内墙", `${designPackage.structuralLayout.interiorWalls.length}`],
    ["门窗", `${designPackage.structuralLayout.exteriorOpenings.length}`],
    ["钢量(t)", designPackage.bom.summary.totalSteelT.toFixed(3)],
  ];
  return (
    <div className="mt-3 grid grid-cols-5 gap-px overflow-hidden rounded-md border border-white/20 bg-white/20 text-xs xl:grid-cols-10">
      {rows.map(([label, value]) => (
        <div key={label} className="bg-white/20 px-3 py-2">
          <div className="text-[11px] opacity-70">{label}</div>
          <div className="mt-1 truncate font-semibold text-[var(--module-accent-foreground)]">
            {value}
          </div>
        </div>
      ))}
    </div>
  );
}

function SelectField<T extends string | number>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: Array<{ label: string; value: T }>;
  onChange: (value: T) => void;
}) {
  return (
    <label className="grid gap-1 text-xs text-[var(--arch-muted)]">
      <span>{label}</span>
      <Select<T>
        size="small"
        value={value}
        options={options}
        onChange={onChange}
      />
    </label>
  );
}

function Panel({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <div className="rounded-md border border-[var(--arch-border)] bg-[var(--arch-surface)] p-3 shadow-sm">
      {typeof title === "string" ? (
        <h3 className="mb-3 text-sm font-semibold text-[var(--arch-text)]">
          {title}
        </h3>
      ) : (
        <div className="mb-3 text-sm font-semibold text-[var(--arch-text)]">
          {title}
        </div>
      )}
      {children}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-[var(--arch-border)] bg-[var(--arch-surface)] p-3">
      <p className="text-xs text-[var(--arch-muted)]">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-[var(--module-accent)]">
        {value}
      </p>
    </div>
  );
}

function LayerSchedule({
  designPackage,
  currentFloor,
  onFloorChange,
}: {
  designPackage: SteelPlatformPackage;
  currentFloor: 1 | 2;
  onFloorChange: (floor: 1 | 2) => void;
}) {
  const floors = Array.from(
    { length: designPackage.plan.floors },
    (_, index) => (index + 1) as 1 | 2,
  );
  const rows = floors.map((floor) => ({
    floor,
    rooms: designPackage.plan.blocks.filter((block) => block.floor === floor)
      .length,
    columns: designPackage.structuralLayout.columns.filter(
      (column) => column.floor === floor,
    ).length,
    beams: designPackage.structuralLayout.mainBeams.filter(
      (beam) => beam.floor === floor,
    ).length,
    walls: designPackage.structuralLayout.wallBays.filter(
      (bay) => bay.floor === floor,
    ).length,
  }));

  return (
    <Panel title="楼层与构件层">
      <div className="space-y-2 text-xs">
        {rows.map((row) => (
          <button
            key={row.floor}
            className={`grid w-full grid-cols-[38px_repeat(4,minmax(0,1fr))] items-center gap-2 rounded-md border px-2 py-2 text-left ${
              row.floor === currentFloor
                ? "border-[var(--module-accent)] bg-[var(--module-accent-soft)] text-[var(--arch-text)]"
                : "border-[var(--arch-border)] bg-[var(--arch-surface-muted)] text-[var(--arch-text)]"
            }`}
            type="button"
            onClick={() => onFloorChange(row.floor)}
          >
            <span className="font-semibold">{row.floor}F</span>
            <span>房 {row.rooms}</span>
            <span>柱 {row.columns}</span>
            <span>梁 {row.beams}</span>
            <span>墙 {row.walls}</span>
          </button>
        ))}
      </div>
    </Panel>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-[var(--module-accent-soft)] px-2 py-1">
      <div className="text-[11px] text-[var(--arch-muted)]">{label}</div>
      <div className="truncate text-xs font-medium text-[var(--arch-text)]">
        {value}
      </div>
    </div>
  );
}

function ModeButton({
  active,
  icon,
  label,
  onClick,
}: {
  mode: InteractionMode;
  active: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <Button
      size="small"
      type={active ? "primary" : "default"}
      icon={icon}
      onClick={onClick}
    >
      {label}
    </Button>
  );
}

function PlanPreview({
  designPackage,
  currentFloor,
  interactionMode,
  selectedBlockId,
  draftOutline,
  onSelectBlock,
  onCanvasPoint,
  onToggleOpening,
  onToggleDoor,
  onToggleRemovedWall,
}: {
  designPackage: SteelPlatformPackage;
  currentFloor: 1 | 2;
  interactionMode: InteractionMode;
  selectedBlockId: string | null;
  draftOutline: SteelPlatformPoint[];
  onSelectBlock: (id: string) => void;
  onCanvasPoint: (point: SteelPlatformPoint) => void;
  onToggleOpening: (bay: SteelPlatformWallBay) => void;
  onToggleDoor: (wall: SteelPlatformInteriorWall) => void;
  onToggleRemovedWall: (wall: SteelPlatformInteriorWall) => void;
}) {
  const box = designPackage.structuralLayout.envelope;
  const padding = Math.max(
    900,
    Math.round(Math.max(box.widthMm, box.depthMm) * 0.08),
  );
  const gridStep = Math.max(
    300,
    Math.ceil(Math.max(box.widthMm, box.depthMm) / 32 / 300) * 300,
  );

  function handleSvgClick(event: MouseEvent<SVGSVGElement>) {
    if (interactionMode !== "outline") return;
    const svg = event.currentTarget;
    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const matrix = svg.getScreenCTM();
    if (!matrix) return;
    const local = point.matrixTransform(matrix.inverse());
    onCanvasPoint({ x: local.x, y: local.y });
  }

  return (
    <svg
      className={`h-[420px] w-full rounded-md border border-[var(--arch-border)] bg-[var(--arch-surface-muted)] ${
        interactionMode === "outline" ? "cursor-crosshair" : ""
      }`}
      viewBox={`${box.minX - padding} ${box.minY - padding} ${box.widthMm + padding * 2} ${box.depthMm + padding * 2}`}
      role="img"
      aria-label="steel platform plan preview"
      onClick={handleSvgClick}
    >
      <GridLines box={box} step={gridStep} />
      <polygon
        points={pointsAttribute(designPackage.plan.outlinePolygon)}
        fill="#ecfdf5"
        stroke="#059669"
        strokeWidth={80}
      />
      {draftOutline.length ? (
        <polyline
          points={pointsAttribute(draftOutline)}
          fill="none"
          stroke="#7c3aed"
          strokeDasharray="180 120"
          strokeWidth={80}
        />
      ) : null}
      {designPackage.plan.blocks
        .filter((block) => block.floor === currentFloor)
        .map((block) => (
          <PlanBlockPolygon
            key={block.id}
            block={block}
            selected={selectedBlockId === block.id}
            onClick={() => onSelectBlock(block.id)}
          />
        ))}
      {designPackage.structuralLayout.grid.xAxes.map((x) => (
        <line
          key={`gx-${x}`}
          x1={x}
          x2={x}
          y1={box.minY}
          y2={box.maxY}
          stroke="#94a3b8"
          strokeDasharray="160 120"
          strokeWidth={34}
        />
      ))}
      {designPackage.structuralLayout.grid.yAxes.map((y) => (
        <line
          key={`gy-${y}`}
          x1={box.minX}
          x2={box.maxX}
          y1={y}
          y2={y}
          stroke="#94a3b8"
          strokeDasharray="160 120"
          strokeWidth={34}
        />
      ))}
      {designPackage.structuralLayout.columns
        .filter((column) => column.floor === currentFloor)
        .map((column) => (
          <circle
            key={column.id}
            cx={column.location[0]}
            cy={column.location[1]}
            r={130}
            fill="#0f766e"
            stroke="#ffffff"
            strokeWidth={40}
          />
        ))}
      {designPackage.structuralLayout.wallBays
        .filter((bay) => bay.floor === currentFloor)
        .map((bay) => (
          <WallBayLine
            key={bay.id}
            bay={bay}
            active={interactionMode === "opening"}
            hasOpening={designPackage.structuralLayout.exteriorOpenings.some(
              (opening) => opening.bayId === bay.id,
            )}
            onClick={() => onToggleOpening(bay)}
          />
        ))}
      {designPackage.structuralLayout.exteriorOpenings
        .filter((opening) => opening.floor === currentFloor)
        .map((opening) => {
          const bay = designPackage.structuralLayout.wallBays.find(
            (candidate) => candidate.id === opening.bayId,
          );
          return bay ? (
            <OpeningMark key={opening.id} opening={opening} bay={bay} />
          ) : null;
        })}
      {designPackage.structuralLayout.interiorWalls
        .filter((wall) => wall.floor === currentFloor)
        .map((wall) => (
          <InteriorWallLine
            key={wall.id}
            wall={wall}
            mode={interactionMode}
            onDoor={() => onToggleDoor(wall)}
            onRemove={() => onToggleRemovedWall(wall)}
          />
        ))}
    </svg>
  );
}

function GridLines({
  box,
  step,
}: {
  box: SteelPlatformPackage["structuralLayout"]["envelope"];
  step: number;
}) {
  const lines: ReactNode[] = [];
  for (let x = Math.floor(box.minX / step) * step; x <= box.maxX; x += step) {
    const major = x % 4800 === 0;
    lines.push(
      <line
        key={`x-${x}`}
        x1={x}
        x2={x}
        y1={box.minY}
        y2={box.maxY}
        stroke={major ? "#cbd5e1" : "#e2e8f0"}
        strokeWidth={major ? 24 : 10}
      />,
    );
  }
  for (let y = Math.floor(box.minY / step) * step; y <= box.maxY; y += step) {
    const major = y % 4800 === 0;
    lines.push(
      <line
        key={`y-${y}`}
        x1={box.minX}
        x2={box.maxX}
        y1={y}
        y2={y}
        stroke={major ? "#cbd5e1" : "#e2e8f0"}
        strokeWidth={major ? 24 : 10}
      />,
    );
  }
  return <g>{lines}</g>;
}

function PlanBlockPolygon({
  block,
  selected,
  onClick,
}: {
  block: SteelPlatformPlanBlock;
  selected: boolean;
  onClick: () => void;
}) {
  const centroid = block.polygon.reduce(
    (acc, point) => ({ x: acc.x + point.x, y: acc.y + point.y }),
    { x: 0, y: 0 },
  );
  const x = centroid.x / block.polygon.length;
  const y = centroid.y / block.polygon.length;
  return (
    <g
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
    >
      <polygon
        points={pointsAttribute(block.polygon)}
        fill={roomColors[block.purpose] ?? "#e2e8f0"}
        opacity={0.72}
        stroke={selected ? "#059669" : "#475569"}
        strokeWidth={selected ? 90 : 42}
      />
      <text
        x={x}
        y={y - 130}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={300}
        fill="#0f172a"
      >
        {block.purpose}
      </text>
      <text
        x={x}
        y={y + 210}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={230}
        fill="#334155"
      >
        {block.areaSqm.toFixed(1)}㎡
      </text>
    </g>
  );
}

function WallBayLine({
  bay,
  active,
  hasOpening,
  onClick,
}: {
  bay: SteelPlatformWallBay;
  active: boolean;
  hasOpening: boolean;
  onClick: () => void;
}) {
  return (
    <line
      x1={bay.start.x}
      y1={bay.start.y}
      x2={bay.end.x}
      y2={bay.end.y}
      stroke={hasOpening ? "#f59e0b" : active ? "#64748b" : "transparent"}
      strokeWidth={active || hasOpening ? 130 : 1}
      opacity={0.82}
      className={active ? "cursor-pointer" : ""}
      onClick={(event) => {
        if (!active) return;
        event.stopPropagation();
        onClick();
      }}
    />
  );
}

function OpeningMark({
  opening,
  bay,
}: {
  opening: SteelPlatformOpening;
  bay: SteelPlatformWallBay;
}) {
  const centerRatio =
    (opening.centerMm - axisMin(bay)) /
    Math.max(1, axisMax(bay) - axisMin(bay));
  const center = interpolate(bay.start, bay.end, centerRatio);
  const half = opening.widthMm / 2;
  const length = Math.max(400, half);
  const start =
    bay.axis === "X"
      ? { x: center.x - length, y: center.y }
      : { x: center.x, y: center.y - length };
  const end =
    bay.axis === "X"
      ? { x: center.x + length, y: center.y }
      : { x: center.x, y: center.y + length };
  return (
    <line
      x1={start.x}
      y1={start.y}
      x2={end.x}
      y2={end.y}
      stroke={opening.openingType === "door" ? "#dc2626" : "#d97706"}
      strokeWidth={210}
      strokeLinecap="round"
    />
  );
}

function InteriorWallLine({
  wall,
  mode,
  onDoor,
  onRemove,
}: {
  wall: SteelPlatformInteriorWall;
  mode: InteractionMode;
  onDoor: () => void;
  onRemove: () => void;
}) {
  const interactive = mode === "interior-door" || mode === "remove-wall";
  const color = wall.removed
    ? "#94a3b8"
    : mode === "remove-wall" && wall.hitExteriorOpening
      ? "#ef4444"
      : wall.door
        ? "#a16207"
        : "#2563eb";
  return (
    <g>
      <line
        x1={wall.start.x}
        y1={wall.start.y}
        x2={wall.end.x}
        y2={wall.end.y}
        stroke={color}
        strokeWidth={interactive ? 90 : 34}
        strokeDasharray={
          wall.removed ? "140 120" : wall.door ? undefined : "180 120"
        }
        opacity={interactive ? 0.85 : 0.48}
        className={interactive ? "cursor-pointer" : ""}
        onClick={(event) => {
          if (!interactive) return;
          event.stopPropagation();
          if (mode === "remove-wall") onRemove();
          if (mode === "interior-door") onDoor();
        }}
      />
      {wall.door ? <InteriorDoorMark wall={wall} /> : null}
    </g>
  );
}

function InteriorDoorMark({ wall }: { wall: SteelPlatformInteriorWall }) {
  const door = wall.door;
  if (!door) return null;
  const direction = door.flip === 0 || door.flip === 1 ? 1 : -1;
  const start =
    wall.axis === "X"
      ? { x: door.positionMm, y: wall.start.y }
      : { x: wall.start.x, y: door.positionMm };
  const end =
    wall.axis === "X"
      ? { x: door.positionMm, y: wall.start.y + direction * 600 }
      : { x: wall.start.x + direction * 600, y: door.positionMm };
  return (
    <line
      x1={start.x}
      y1={start.y}
      x2={end.x}
      y2={end.y}
      stroke="#a16207"
      strokeWidth={70}
      strokeLinecap="round"
    />
  );
}

function RoomEditor({
  block,
  onChange,
  onDelete,
}: {
  block: PlanBlock;
  onChange: (next: {
    x0?: number;
    y0?: number;
    w?: number;
    h?: number;
  }) => void;
  onDelete: () => void;
}) {
  const rect = rectFromBlock(block);
  return (
    <div className="grid gap-2 text-xs">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-semibold">{block.purpose}</div>
          <div className="text-[var(--arch-muted)]">{block.id}</div>
        </div>
        <Button
          size="small"
          danger
          icon={<Trash2 className="h-3.5 w-3.5" />}
          onClick={onDelete}
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <NumberField
          label="X"
          value={rect.x0}
          min={-60000}
          max={60000}
          step={300}
          onChange={(value) => onChange({ x0: value ?? rect.x0 })}
        />
        <NumberField
          label="Y"
          value={rect.y0}
          min={-60000}
          max={60000}
          step={300}
          onChange={(value) => onChange({ y0: value ?? rect.y0 })}
        />
        <NumberField
          label="宽"
          value={rect.w}
          min={300}
          max={4800}
          step={300}
          onChange={(value) => onChange({ w: value ?? rect.w })}
        />
        <NumberField
          label="高"
          value={rect.h}
          min={300}
          max={4800}
          step={300}
          onChange={(value) => onChange({ h: value ?? rect.h })}
        />
      </div>
    </div>
  );
}

function OpeningEditor({
  opening,
  onChange,
  onRemove,
}: {
  opening: SteelPlatformOpening;
  onChange: (
    id: string,
    patch: Partial<SteelPlatformOpening> & { preset?: OpeningPresetName },
  ) => void;
  onRemove: (id: string) => void;
}) {
  const presetName = openingPresetName(opening);
  return (
    <div className="grid grid-cols-[58px_62px_82px_1fr_28px] items-center gap-1 rounded-md border border-[var(--arch-border)] bg-[var(--arch-surface-muted)] p-2 text-xs">
      <Select
        size="small"
        value={opening.floor}
        options={[
          { label: "1F", value: 1 },
          { label: "2F", value: 2 },
        ]}
        onChange={(value) => onChange(opening.id, { floor: value })}
      />
      <Select
        size="small"
        value={opening.wallSide}
        options={Object.entries(wallSideLabels).map(([value, label]) => ({
          label,
          value,
        }))}
        onChange={(value) =>
          onChange(opening.id, { wallSide: value as SteelPlatformWallSide })
        }
      />
      <Select
        size="small"
        value={presetName}
        options={Object.keys(openingPresets).map((value) => ({
          label: value,
          value,
        }))}
        onChange={(value) =>
          onChange(opening.id, { preset: value as OpeningPresetName })
        }
      />
      <InputNumber
        size="small"
        value={opening.centerMm}
        step={300}
        min={0}
        onChange={(value) =>
          onChange(opening.id, { centerMm: value ?? opening.centerMm })
        }
      />
      <Button
        size="small"
        icon={<Trash2 className="h-3.5 w-3.5" />}
        onClick={() => onRemove(opening.id)}
      />
    </div>
  );
}

function SteelFramePreview({
  designPackage,
  enclosureVisible,
}: {
  designPackage: SteelPlatformPackage;
  enclosureVisible: boolean;
}) {
  const envelope = designPackage.structuralLayout.envelope;
  const origin = {
    x: (envelope.minX + envelope.maxX) / 2,
    y: (envelope.minY + envelope.maxY) / 2,
    z: designPackage.structuralLayout.roof.baseZ / 2,
  };
  return (
    <div className="h-[420px] overflow-hidden rounded-md bg-[var(--arch-canvas-bg)]">
      <Canvas camera={{ position: [13, 9, 16], fov: 50 }}>
        <ambientLight intensity={0.72} />
        <directionalLight position={[6, 10, 8]} intensity={1.15} />
        <gridHelper args={[18, 18, "#334155", "#1e293b"]} />
        {enclosureVisible ? (
          <>
            {designPackage.structuralLayout.floorSlabs.map((slab) => (
              <SlabMesh key={slab.id} slab={slab} origin={origin} />
            ))}
            {designPackage.structuralLayout.wallBays.map((bay) => (
              <WallMesh
                key={bay.id}
                bay={bay}
                origin={origin}
                heightMm={designPackage.settings.floorHeightMm - 194}
              />
            ))}
            {designPackage.structuralLayout.interiorWalls
              .filter((wall) => !wall.removed)
              .map((wall) => (
                <InteriorWallMesh
                  key={wall.id}
                  wall={wall}
                  origin={origin}
                  heightMm={designPackage.settings.floorHeightMm - 194}
                />
              ))}
            <RoofMesh designPackage={designPackage} origin={origin} />
          </>
        ) : null}
        {designPackage.structuralLayout.columns.map((column) => (
          <ColumnMesh key={column.id} column={column} origin={origin} />
        ))}
        {designPackage.structuralLayout.mainBeams.map((beam) => (
          <BeamMesh key={beam.id} beam={beam} origin={origin} />
        ))}
        {designPackage.structuralLayout.constructionColumns.map((column) => (
          <ConstructionColumnMesh
            key={column.id}
            column={column}
            origin={origin}
          />
        ))}
        {designPackage.structuralLayout.exteriorOpenings.map((opening) => {
          const bay = designPackage.structuralLayout.wallBays.find(
            (candidate) => candidate.id === opening.bayId,
          );
          return bay ? (
            <OpeningMesh
              key={opening.id}
              opening={opening}
              bay={bay}
              origin={origin}
            />
          ) : null;
        })}
        <OrbitControls enableDamping makeDefault target={[0, 0.6, 0]} />
      </Canvas>
    </div>
  );
}

function ColumnMesh({
  column,
  origin,
}: {
  column: SteelPlatformColumn;
  origin: Origin3D;
}) {
  return (
    <mesh
      position={[
        (column.location[0] - origin.x) / 1000,
        (column.location[2] - origin.z) / 1000,
        (column.location[1] - origin.y) / 1000,
      ]}
    >
      <boxGeometry args={[0.15, column.netLengthMm / 1000, 0.15]} />
      <meshStandardMaterial color="#38bdf8" metalness={0.45} roughness={0.35} />
    </mesh>
  );
}

function BeamMesh({
  beam,
  origin,
}: {
  beam: SteelPlatformBeam;
  origin: Origin3D;
}) {
  const args: [number, number, number] =
    beam.axis === "X"
      ? [beam.netLengthMm / 1000, 0.194, 0.15]
      : [0.15, 0.194, beam.netLengthMm / 1000];
  return (
    <mesh
      position={[
        (beam.midpoint[0] - origin.x) / 1000,
        (beam.midpoint[2] - origin.z) / 1000,
        (beam.midpoint[1] - origin.y) / 1000,
      ]}
    >
      <boxGeometry args={args} />
      <meshStandardMaterial color="#22c55e" metalness={0.35} roughness={0.4} />
    </mesh>
  );
}

function ConstructionColumnMesh({
  column,
  origin,
}: {
  column: SteelPlatformConstructionColumn;
  origin: Origin3D;
}) {
  return (
    <mesh
      position={[
        (column.location[0] - origin.x) / 1000,
        (column.location[2] - origin.z) / 1000,
        (column.location[1] - origin.y) / 1000,
      ]}
    >
      <boxGeometry args={[0.04, column.heightMm / 1000, 0.04]} />
      <meshStandardMaterial color="#f59e0b" metalness={0.2} roughness={0.5} />
    </mesh>
  );
}

function WallMesh({
  bay,
  origin,
  heightMm,
}: {
  bay: SteelPlatformWallBay;
  origin: Origin3D;
  heightMm: number;
}) {
  const mid = midpoint(bay.start, bay.end);
  const zBase = (bay.floor - 1) * heightMm;
  const args: [number, number, number] =
    bay.axis === "X"
      ? [bay.lengthMm / 1000, heightMm / 1000, 0.1]
      : [0.1, heightMm / 1000, bay.lengthMm / 1000];
  return (
    <mesh
      position={[
        (mid.x - origin.x) / 1000,
        (zBase + heightMm / 2 - origin.z) / 1000,
        (mid.y - origin.y) / 1000,
      ]}
    >
      <boxGeometry args={args} />
      <meshStandardMaterial color="#e5e7eb" metalness={0.05} roughness={0.85} />
    </mesh>
  );
}

function InteriorWallMesh({
  wall,
  origin,
  heightMm,
}: {
  wall: SteelPlatformInteriorWall;
  origin: Origin3D;
  heightMm: number;
}) {
  const mid = midpoint(wall.start, wall.end);
  const zBase = (wall.floor - 1) * heightMm;
  const args: [number, number, number] =
    wall.axis === "X"
      ? [wall.lengthMm / 1000, heightMm / 1000, 0.08]
      : [0.08, heightMm / 1000, wall.lengthMm / 1000];
  return (
    <mesh
      position={[
        (mid.x - origin.x) / 1000,
        (zBase + heightMm / 2 - origin.z) / 1000,
        (mid.y - origin.y) / 1000,
      ]}
    >
      <boxGeometry args={args} />
      <meshStandardMaterial
        color="#cbd5e1"
        roughness={0.78}
        transparent
        opacity={0.7}
      />
    </mesh>
  );
}

function SlabMesh({
  slab,
  origin,
}: {
  slab: SteelPlatformPackage["structuralLayout"]["floorSlabs"][number];
  origin: Origin3D;
}) {
  const [minX, minY, maxX, maxY] = bounds(slab.polygon);
  return (
    <mesh
      position={[
        (minX + (maxX - minX) / 2 - origin.x) / 1000,
        (slab.floor - 1) * 3 - origin.z / 1000 + 0.04,
        (minY + (maxY - minY) / 2 - origin.y) / 1000,
      ]}
    >
      <boxGeometry args={[(maxX - minX) / 1000, 0.08, (maxY - minY) / 1000]} />
      <meshStandardMaterial
        color="#94a3b8"
        roughness={0.9}
        transparent
        opacity={0.32}
      />
    </mesh>
  );
}

function RoofMesh({
  designPackage,
  origin,
}: {
  designPackage: SteelPlatformPackage;
  origin: Origin3D;
}) {
  const roof = designPackage.structuralLayout.roof;
  const env = designPackage.structuralLayout.envelope;
  const w = (env.widthMm + roof.eaveOverhangMm * 2) / 1000;
  const d = (env.depthMm + roof.eaveOverhangMm * 2) / 1000;
  const y = (roof.baseZ + 120 - origin.z) / 1000;
  if (roof.type === "平") {
    return (
      <mesh position={[0, y, 0]}>
        <boxGeometry args={[w, 0.1, d]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.82} />
      </mesh>
    );
  }
  const slope = (Math.PI / 180) * roof.slopeDeg;
  const ridgeAxisX = roof.ridgeAxis === "X";
  const panelArgs: [number, number, number] = ridgeAxisX
    ? [w, 0.1, d / 2]
    : [w / 2, 0.1, d];
  const offset = ridgeAxisX ? d / 4 : w / 4;
  return (
    <>
      <mesh
        position={ridgeAxisX ? [0, y, -offset] : [-offset, y, 0]}
        rotation={ridgeAxisX ? [slope, 0, 0] : [0, 0, -slope]}
      >
        <boxGeometry args={panelArgs} />
        <meshStandardMaterial color="#f8fafc" roughness={0.82} />
      </mesh>
      <mesh
        position={ridgeAxisX ? [0, y, offset] : [offset, y, 0]}
        rotation={ridgeAxisX ? [-slope, 0, 0] : [0, 0, slope]}
      >
        <boxGeometry args={panelArgs} />
        <meshStandardMaterial color="#f8fafc" roughness={0.82} />
      </mesh>
    </>
  );
}

function OpeningMesh({
  opening,
  bay,
  origin,
}: {
  opening: SteelPlatformOpening;
  bay: SteelPlatformWallBay;
  origin: Origin3D;
}) {
  const centerRatio =
    (opening.centerMm - axisMin(bay)) /
    Math.max(1, axisMax(bay) - axisMin(bay));
  const center = interpolate(bay.start, bay.end, centerRatio);
  const zBase = (opening.floor - 1) * 3000;
  const args: [number, number, number] =
    bay.axis === "X"
      ? [opening.widthMm / 1000, opening.heightMm / 1000, 0.12]
      : [0.12, opening.heightMm / 1000, opening.widthMm / 1000];
  return (
    <mesh
      position={[
        (center.x - origin.x) / 1000,
        (zBase + opening.sillMm + opening.heightMm / 2 - origin.z) / 1000,
        (center.y - origin.y) / 1000,
      ]}
    >
      <boxGeometry args={args} />
      <meshStandardMaterial
        color={opening.openingType === "door" ? "#111827" : "#0f766e"}
      />
    </mesh>
  );
}

type Origin3D = { x: number; y: number; z: number };

function mergeTemplateRooms(
  rooms: Record<RoomKey, RoomRequirement>,
  templateRooms: Partial<Record<RoomKey, RoomRequirement>>,
): Record<RoomKey, RoomRequirement> {
  return Object.fromEntries(
    roomDefinitions.map((room) => [
      room.key,
      templateRooms[room.key] ?? rooms[room.key],
    ]),
  ) as Record<RoomKey, RoomRequirement>;
}

function openingFromBay(
  bay: SteelPlatformWallBay,
  preset: OpeningPresetName,
  index: number,
): SteelPlatformOpening {
  return {
    id: `OP-${Date.now().toString(36)}-${index}`,
    bayId: bay.id,
    wallSide: bay.wallSide,
    centerMm: axisMin(bay) + (axisMax(bay) - axisMin(bay)) / 2,
    floor: bay.floor,
    ...openingPresets[preset],
  };
}

function openingPresetName(opening: SteelPlatformOpening): OpeningPresetName {
  const match = Object.entries(openingPresets).find(
    ([, preset]) =>
      preset.openingType === opening.openingType &&
      preset.frameType === opening.frameType &&
      preset.heightMm === opening.heightMm,
  );
  return (match?.[0] as OpeningPresetName | undefined) ?? "普通窗";
}

function mergeOpeningPatch(
  opening: SteelPlatformOpening,
  patch: Partial<SteelPlatformOpening> & { preset?: OpeningPresetName },
): SteelPlatformOpening {
  const { preset, ...rest } = patch;
  return {
    ...opening,
    ...(preset ? openingPresets[preset] : {}),
    ...rest,
  };
}

function closeOrthogonalOutline(points: SteelPlatformPoint[]) {
  const next = [...points];
  const first = next[0];
  const last = next.at(-1);
  if (first && last && first.x !== last.x && first.y !== last.y) {
    const prev = next.at(-2);
    const vertical = prev ? last.x === prev.x : false;
    next.push(vertical ? { x: first.x, y: last.y } : { x: last.x, y: first.y });
  }
  return next;
}

function snap(value: number) {
  return Math.round(value / MODULUS) * MODULUS;
}

function distance(a: SteelPlatformPoint, b: SteelPlatformPoint) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function interpolate(
  start: SteelPlatformPoint,
  end: SteelPlatformPoint,
  ratio: number,
): SteelPlatformPoint {
  return {
    x: start.x + (end.x - start.x) * ratio,
    y: start.y + (end.y - start.y) * ratio,
  };
}

function midpoint(a: SteelPlatformPoint, b: SteelPlatformPoint) {
  return interpolate(a, b, 0.5);
}

function axisMin(bay: SteelPlatformWallBay) {
  return bay.axis === "X"
    ? Math.min(bay.start.x, bay.end.x)
    : Math.min(bay.start.y, bay.end.y);
}

function axisMax(bay: SteelPlatformWallBay) {
  return bay.axis === "X"
    ? Math.max(bay.start.x, bay.end.x)
    : Math.max(bay.start.y, bay.end.y);
}

function pointsAttribute(points: ReadonlyArray<SteelPlatformPoint>) {
  return points.map((point) => `${point.x},${point.y}`).join(" ");
}

function bounds(
  points: ReadonlyArray<SteelPlatformPoint>,
): [number, number, number, number] {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}
