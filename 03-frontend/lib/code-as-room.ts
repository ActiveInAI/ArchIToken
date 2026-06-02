// lib/code-as-room.ts - Code-as-Room module fixtures and manifest builders
// License: Apache-2.0

export type CodeAsRoomStageStatus =
  | "complete"
  | "running"
  | "queued"
  | "blocked";

export interface CodeAsRoomStage {
  id: string;
  index: number;
  phase: string;
  title: string;
  summary: string;
  output: string;
  status: CodeAsRoomStageStatus;
}

export interface CodeAsRoomObject {
  id: string;
  label: string;
  kind: "major" | "minor" | "wall" | "surface" | "light";
  x: number;
  y: number;
  w: number;
  d: number;
  h: number;
  rotationDeg: number;
  color: string;
}

export interface CodeAsRoomScene {
  id: string;
  name: string;
  roomType: string;
  style: string;
  inputImageUrl: string;
  videoUrl: string;
  objects: CodeAsRoomObject[];
  dimensions: {
    widthM: number;
    depthM: number;
    heightM: number;
  };
  sceneGraph: Array<{
    zone: string;
    objects: string[];
    relations: string[];
  }>;
}

export interface CodeAsRoomMemoryEntry {
  id: string;
  stage: string;
  type: "result" | "validation" | "artifact" | "repair";
  title: string;
  summary: string;
  tags: string[];
}

export interface CodeAsRoomArtifact {
  id: string;
  name: string;
  format: string;
  owner: string;
  status: CodeAsRoomStageStatus;
  sourceStage: string;
}

export interface CodeAsRoomRunManifest {
  schema: "architoken.code_as_room_run.v1";
  moduleId: "detailed_design";
  reviewState: "professional_review_required";
  upstream: {
    paper: string;
    repository: string;
    projectPage: string;
  };
  scene: CodeAsRoomScene;
  stages: CodeAsRoomStage[];
  memory: CodeAsRoomMemoryEntry[];
  artifacts: CodeAsRoomArtifact[];
  finalBlenderScript: string;
}

export interface CodeAsRoomDesignBrief {
  prompt: string;
  sceneId?: string;
  sourceImageUrl?: string;
  sourceImageName?: string;
  mode: "layout" | "detail" | "render";
}

export interface CodeAsRoomDesignCandidate {
  id: string;
  title: string;
  score: number;
  route: string;
  scene: CodeAsRoomScene;
  manifest: CodeAsRoomRunManifest;
  designNotes: string[];
}

export const codeAsRoomSources = {
  paper: "https://huggingface.co/papers/2605.18451",
  repository: "https://github.com/YxuanAr/Code-as-Room",
  projectPage: "https://code-as-room.github.io/",
};

export const codeAsRoomStages: CodeAsRoomStage[] = [
  {
    id: "stage0_scene_classification",
    index: 0,
    phase: "routing",
    title: "Scene classification",
    summary: "识别房间类型、视角、复杂度和是否需要强制 scene-type route。",
    output: "scene_type.json",
    status: "complete",
  },
  {
    id: "stage1_spatial_semantics",
    index: 1,
    phase: "image structuring",
    title: "Spatial semantic analysis",
    summary: "从俯视图抽取墙体、门窗、区域、主要对象、尺度和摆放关系。",
    output: "stage1/scene_analysis.json",
    status: "complete",
  },
  {
    id: "stage2_scene_graph",
    index: 2,
    phase: "image structuring",
    title: "Scene graph construction",
    summary: "把对象、区域、支撑面和邻接关系转成可传递的 scene graph。",
    output: "stage2/scene_graph.json",
    status: "complete",
  },
  {
    id: "stage3_base_layout_code",
    index: 3,
    phase: "layout code generation",
    title: "Base Blender layout code",
    summary: "生成房间外壳、墙、地面、主要家具和初始 Blender layout code。",
    output: "stage3/base_layout.py",
    status: "complete",
  },
  {
    id: "stage4_wall_minor_placeholders",
    index: 4,
    phase: "layout code generation",
    title: "Wall objects and minor placeholders",
    summary: "补全墙面对象、门窗、壁挂物和可后续细化的小物件占位。",
    output: "stage4/room_with_wall_objects.py",
    status: "complete",
  },
  {
    id: "stage5_object_profiling",
    index: 5,
    phase: "layout-grounded profiling",
    title: "Major object descriptions",
    summary: "用 layout code + 输入图像抽取每个主要对象的细节属性。",
    output: "stage5_describe/object_profiles.json",
    status: "complete",
  },
  {
    id: "stage6_major_geometry",
    index: 6,
    phase: "object-level code generation",
    title: "Detailed geometry for major objects",
    summary: "按 object profile 生成沙发、柜体、桌椅、床等组合几何代码。",
    output: "stage6_geometry/object_geometry.py",
    status: "complete",
  },
  {
    id: "stage7_small_objects",
    index: 7,
    phase: "object-level code generation",
    title: "Surface-based small-object placement",
    summary: "解析支撑面,把杯子、书、瓶罐、灯具、装饰等小物体落到真实表面。",
    output: "stage7_small_objects/small_objects.json",
    status: "complete",
  },
  {
    id: "stage8_small_describe",
    index: 8,
    phase: "optional detail extension",
    title: "Small-object descriptions",
    summary: "可选: 为生成的小物件补充局部外观和结构描述。",
    output: "stage8_small_describe/small_profiles.json",
    status: "queued",
  },
  {
    id: "stage9_small_geometry",
    index: 9,
    phase: "optional detail extension",
    title: "Small-object geometry",
    summary: "可选: 用组合几何替换简单小物件 primitive。",
    output: "stage9_small_geometry/small_geometry.py",
    status: "queued",
  },
  {
    id: "stage10_pbr_material",
    index: 10,
    phase: "interior decoration code",
    title: "Per-part PBR materials",
    summary: "按对象部件分配 PBR 材质、颜色、粗糙度和金属度参数。",
    output: "stage10_material/material_config.json",
    status: "complete",
  },
  {
    id: "stage11_texture_injection",
    index: 11,
    phase: "interior decoration code",
    title: "Real texture generation and injection",
    summary: "可选: 生成或检索纹理图并注入 Blender material nodes。",
    output: "stage11_texture/texture_manifest.json",
    status: "running",
  },
  {
    id: "stage12_render_ready",
    index: 12,
    phase: "rendering",
    title: "Lighting and render script",
    summary: "生成最终灯光、相机、渲染设置和可执行 render_output.py。",
    output: "stage12_render/render_output.py",
    status: "complete",
  },
];

export const codeAsRoomScenes: CodeAsRoomScene[] = [
  {
    id: "living-room",
    name: "Living Room · top-down reconstruction",
    roomType: "residential living room",
    style: "light wood / soft neutral",
    inputImageUrl:
      "https://raw.githubusercontent.com/YxuanAr/Code-as-Room/main/example/example1.png",
    videoUrl:
      "https://code-as-room.github.io/videos/walkthrough/mid_teaser_walk_cycles_hq.mp4",
    dimensions: { widthM: 7.2, depthM: 5.1, heightM: 2.8 },
    objects: [
      object("sofa", "Sofa", "major", 50, 70, 34, 12, 0.82, 0, "#f4f0e8"),
      object(
        "coffee",
        "Coffee table",
        "major",
        50,
        52,
        19,
        11,
        0.42,
        0,
        "#caa36b",
      ),
      object("tv", "TV console", "major", 50, 13, 42, 8, 0.48, 0, "#b58b61"),
      object(
        "chair-a",
        "Lounge chair",
        "major",
        25,
        45,
        13,
        13,
        0.72,
        -18,
        "#c8e1d3",
      ),
      object(
        "chair-b",
        "Lounge chair",
        "major",
        76,
        45,
        13,
        13,
        0.72,
        18,
        "#d8e7f3",
      ),
      object(
        "shelf",
        "Book shelf",
        "surface",
        82,
        18,
        12,
        28,
        1.9,
        0,
        "#d9bf91",
      ),
      object("plant-a", "Plant", "minor", 13, 78, 7, 7, 1.2, 0, "#49a56f"),
      object("lamp", "Floor lamp", "light", 86, 66, 5, 5, 1.55, 0, "#fde68a"),
    ],
    sceneGraph: [
      {
        zone: "media_wall",
        objects: ["TV console", "Book shelf", "wall art"],
        relations: ["TV faces sofa", "shelf attached to north wall"],
      },
      {
        zone: "conversation_core",
        objects: ["Sofa", "Coffee table", "two lounge chairs"],
        relations: [
          "coffee table centered in front of sofa",
          "chairs angled to table",
        ],
      },
      {
        zone: "decorative_surfaces",
        objects: ["Plant", "Floor lamp", "small table objects"],
        relations: ["small objects placed on support surfaces"],
      },
    ],
  },
  {
    id: "kitchen-dining",
    name: "Kitchen-Dining · cluttered room",
    roomType: "kitchen dining room",
    style: "farmhouse / grey stone floor",
    inputImageUrl:
      "https://raw.githubusercontent.com/YxuanAr/Code-as-Room/main/example/example2.jpeg",
    videoUrl:
      "https://code-as-room.github.io/videos/walkthrough/kitchen_farmhouse_walk_inner.mp4",
    dimensions: { widthM: 8.4, depthM: 4.6, heightM: 2.9 },
    objects: [
      object(
        "counter",
        "Kitchen counter",
        "major",
        20,
        38,
        23,
        54,
        0.9,
        0,
        "#d8c0a4",
      ),
      object(
        "island",
        "Kitchen island",
        "major",
        43,
        50,
        19,
        18,
        0.92,
        0,
        "#e7d5bc",
      ),
      object(
        "table",
        "Dining table",
        "major",
        68,
        52,
        28,
        18,
        0.76,
        0,
        "#dec494",
      ),
      object(
        "chair-1",
        "Dining chair",
        "major",
        61,
        38,
        7,
        8,
        0.64,
        0,
        "#f1eadc",
      ),
      object(
        "chair-2",
        "Dining chair",
        "major",
        75,
        38,
        7,
        8,
        0.64,
        0,
        "#f1eadc",
      ),
      object(
        "shelf-a",
        "Open shelf",
        "surface",
        19,
        14,
        26,
        8,
        1.65,
        0,
        "#bf8f63",
      ),
      object("sink", "Sink", "major", 15, 64, 9, 9, 0.32, 0, "#e5e7eb"),
      object("jars", "Shelf jars", "minor", 24, 16, 12, 5, 0.24, 0, "#f59e0b"),
    ],
    sceneGraph: [
      {
        zone: "kitchen_wall",
        objects: ["Kitchen counter", "Sink", "Open shelf", "Shelf jars"],
        relations: ["counter aligned to west wall", "jars rest on open shelf"],
      },
      {
        zone: "work_core",
        objects: ["Kitchen island", "small bowls", "utensils"],
        relations: ["island centered between counter and dining table"],
      },
      {
        zone: "dining_zone",
        objects: ["Dining table", "Dining chairs"],
        relations: ["chairs distributed around table with clearance"],
      },
    ],
  },
  {
    id: "dining-room",
    name: "Dining Room · re-render ready",
    roomType: "formal dining room",
    style: "traditional / warm wood",
    inputImageUrl:
      "https://raw.githubusercontent.com/YxuanAr/Code-as-Room/main/example/example3.png",
    videoUrl:
      "https://code-as-room.github.io/videos/walkthrough/dining_new_walk_cycles_hq.mp4",
    dimensions: { widthM: 7.6, depthM: 5.7, heightM: 3.0 },
    objects: [
      object(
        "dining-table",
        "Long dining table",
        "major",
        50,
        52,
        34,
        17,
        0.78,
        0,
        "#b98252",
      ),
      object(
        "rug",
        "Patterned rug",
        "surface",
        50,
        52,
        50,
        34,
        0.04,
        0,
        "#d7b98a",
      ),
      object(
        "cabinet-a",
        "Display cabinet",
        "major",
        20,
        16,
        15,
        11,
        1.95,
        0,
        "#986f45",
      ),
      object(
        "cabinet-b",
        "Sideboard",
        "major",
        80,
        17,
        24,
        10,
        0.88,
        0,
        "#a16f43",
      ),
      object(
        "chair-left",
        "Dining chairs",
        "major",
        34,
        52,
        6,
        28,
        0.58,
        0,
        "#dfc29b",
      ),
      object(
        "chair-right",
        "Dining chairs",
        "major",
        66,
        52,
        6,
        28,
        0.58,
        0,
        "#dfc29b",
      ),
      object(
        "chandelier",
        "Chandelier",
        "light",
        50,
        52,
        10,
        10,
        2.2,
        0,
        "#f8d278",
      ),
    ],
    sceneGraph: [
      {
        zone: "dining_core",
        objects: ["Long dining table", "Dining chairs", "Patterned rug"],
        relations: [
          "rug centered under table",
          "chairs mirror along long sides",
        ],
      },
      {
        zone: "storage_wall",
        objects: ["Display cabinet", "Sideboard"],
        relations: ["storage objects aligned to opposite walls"],
      },
      {
        zone: "ceiling_lighting",
        objects: ["Chandelier"],
        relations: ["light centered above table"],
      },
    ],
  },
];

export const codeAsRoomArtifacts: CodeAsRoomArtifact[] = [
  artifact(
    "scene-analysis",
    "scene_analysis.json",
    "JSON",
    "Stage 1",
    "complete",
  ),
  artifact("scene-graph", "scene_graph.json", "JSON", "Stage 2", "complete"),
  artifact(
    "layout-code",
    "base_layout.py",
    "Python / Blender",
    "Stage 3",
    "complete",
  ),
  artifact(
    "object-profiles",
    "object_profiles.json",
    "JSON",
    "Stage 5",
    "complete",
  ),
  artifact(
    "object-geometry",
    "object_geometry.py",
    "Python / Blender",
    "Stage 6",
    "complete",
  ),
  artifact(
    "small-objects",
    "small_objects.json",
    "JSON",
    "Stage 7",
    "complete",
  ),
  artifact("materials", "material_config.json", "JSON", "Stage 10", "complete"),
  artifact(
    "textures",
    "texture_manifest.json",
    "JSON + PNG",
    "Stage 11",
    "running",
  ),
  artifact(
    "render-script",
    "render_output.py",
    "Python / Blender",
    "Stage 12",
    "complete",
  ),
];

export const codeAsRoomResultMedia = [
  {
    id: "demo",
    title: "Official demo",
    type: "video",
    url: "https://code-as-room.github.io/videos/CodeasRoom_demo.mp4",
  },
  {
    id: "walk-kitchen",
    title: "Kitchen walkthrough",
    type: "video",
    url: "https://code-as-room.github.io/videos/walkthrough/kitchen_farmhouse_walk_inner.mp4",
  },
  {
    id: "walk-dining",
    title: "Dining walkthrough",
    type: "video",
    url: "https://code-as-room.github.io/videos/walkthrough/dining_new_walk_cycles_hq.mp4",
  },
  {
    id: "result-grid",
    title: "Model comparison with CaR",
    type: "image",
    url: "https://code-as-room.github.io/figs/new_result_cropped.png",
  },
  {
    id: "rerender",
    title: "Re-rendering quality",
    type: "image",
    url: "https://code-as-room.github.io/figs/rerender.png",
  },
];

export function buildCodeAsRoomRunManifest(
  sceneId: string,
): CodeAsRoomRunManifest {
  const scene =
    codeAsRoomScenes.find((item) => item.id === sceneId) ??
    codeAsRoomScenes[0]!;

  return buildCodeAsRoomRunManifestForScene(scene);
}

export function buildCodeAsRoomRunManifestForScene(
  scene: CodeAsRoomScene,
): CodeAsRoomRunManifest {
  return {
    schema: "architoken.code_as_room_run.v1",
    moduleId: "detailed_design",
    reviewState: "professional_review_required",
    upstream: codeAsRoomSources,
    scene,
    stages: codeAsRoomStages,
    memory: buildMemory(scene),
    artifacts: codeAsRoomArtifacts,
    finalBlenderScript: buildBlenderScriptPreview(scene),
  };
}

export function generateCodeAsRoomDesignCandidates(
  brief: CodeAsRoomDesignBrief,
): CodeAsRoomDesignCandidate[] {
  const source = resolveBriefScene(brief);
  const normalizedPrompt = brief.prompt.trim() || "室内俯视图生成 3D room";
  const variants = [
    {
      id: "layout-faithful",
      title: "布局忠实版",
      score: 92,
      offset: 0,
      styleSuffix: "layout-faithful",
      notes: [
        "优先保持输入俯视图的墙体、开间、家具位置和主要动线。",
        "Stage3/4 输出适合作为 Blender layout code 的第一轮草案。",
      ],
    },
    {
      id: "detail-rich",
      title: "细节增强版",
      score: 88,
      offset: 4,
      styleSuffix: "detail-rich",
      notes: [
        "强化柜体、开放架、桌面小物和墙面装饰的对象画像。",
        "Stage5/6/7 更适合展示 Code-as-Room 的对象级几何细化效果。",
      ],
    },
    {
      id: "render-ready",
      title: "重渲染版",
      score: 90,
      offset: -3,
      styleSuffix: "render-ready",
      notes: [
        "优先生成 PBR 材质、纹理 manifest、灯光和 walkthrough 镜头。",
        "Stage10/11/12 输出面向 render_output.py 与复核视频。",
      ],
    },
  ];

  return variants.map((variant) => {
    const scene = transformSceneForVariant(
      source,
      normalizedPrompt,
      brief,
      variant.offset,
      variant.styleSuffix,
    );
    const manifest = buildCodeAsRoomRunManifestForScene(scene);
    return {
      id: `${scene.id}-${variant.id}`,
      title: variant.title,
      score: variant.score,
      route:
        "OpenCDE -> WorkflowRouter -> ModelRouter -> InferenceRouter -> Code-as-Room Worker -> Blender Worker",
      scene,
      manifest,
      designNotes: [
        `设计意图: ${normalizedPrompt}`,
        `输入图: ${brief.sourceImageName ?? "Code-as-Room 官方示例"}`,
        ...variant.notes,
      ],
    };
  });
}

function object(
  id: string,
  label: string,
  kind: CodeAsRoomObject["kind"],
  x: number,
  y: number,
  w: number,
  d: number,
  h: number,
  rotationDeg: number,
  color: string,
): CodeAsRoomObject {
  return { id, label, kind, x, y, w, d, h, rotationDeg, color };
}

function artifact(
  id: string,
  name: string,
  format: string,
  sourceStage: string,
  status: CodeAsRoomStageStatus,
): CodeAsRoomArtifact {
  return {
    id,
    name,
    format,
    sourceStage,
    status,
    owner: "Code-as-Room Worker",
  };
}

function buildMemory(scene: CodeAsRoomScene): CodeAsRoomMemoryEntry[] {
  return [
    {
      id: "memory-stage1",
      stage: "stage1",
      type: "result",
      title: "Spatial semantics",
      summary: `${scene.roomType}, ${scene.dimensions.widthM}m x ${scene.dimensions.depthM}m, ${scene.objects.length} detected objects.`,
      tags: ["image", "room-scale", "major-objects"],
    },
    {
      id: "memory-stage2",
      stage: "stage2",
      type: "result",
      title: "Scene graph",
      summary: `${scene.sceneGraph.length} zones with object adjacency and support relations.`,
      tags: ["graph", "relations", "layout"],
    },
    {
      id: "memory-stage3",
      stage: "stage3",
      type: "artifact",
      title: "Layout code",
      summary:
        "Room shell, wall openings, main furniture placement and collision-aware layout engine hooks generated.",
      tags: ["blender-code", "layout"],
    },
    {
      id: "memory-stage6",
      stage: "stage6",
      type: "validation",
      title: "Object geometry",
      summary:
        "Major furniture converted to composite Blender primitives; output remains professional_review_required.",
      tags: ["geometry", "professional_review_required"],
    },
    {
      id: "memory-stage12",
      stage: "stage12",
      type: "artifact",
      title: "Render-ready script",
      summary:
        "Final render_output.py includes lighting, camera, PBR material bindings and re-render settings.",
      tags: ["render", "lighting", "pbr"],
    },
  ];
}

function resolveBriefScene(brief: CodeAsRoomDesignBrief): CodeAsRoomScene {
  const prompt = brief.prompt.toLowerCase();
  const explicitScene = brief.sceneId
    ? codeAsRoomScenes.find((item) => item.id === brief.sceneId)
    : null;

  if (prompt.includes("厨房") || prompt.includes("kitchen")) {
    return codeAsRoomScenes.find((item) => item.id === "kitchen-dining")!;
  }
  if (prompt.includes("餐厅") || prompt.includes("dining")) {
    return codeAsRoomScenes.find((item) => item.id === "dining-room")!;
  }
  if (prompt.includes("卧室") || prompt.includes("bedroom")) {
    return createBedroomScene(brief);
  }
  return explicitScene ?? codeAsRoomScenes[0]!;
}

function createBedroomScene(brief: CodeAsRoomDesignBrief): CodeAsRoomScene {
  return {
    id: "generated-bedroom",
    name: "AI Bedroom · Code-as-Room generated",
    roomType: "residential bedroom",
    style: "soft neutral / timber / daylight",
    inputImageUrl:
      brief.sourceImageUrl ??
      "https://code-as-room.github.io/figs/teaser_cropped.png",
    videoUrl:
      "https://code-as-room.github.io/videos/walkthrough/mid_teaser_walk_cycles_hq.mp4",
    dimensions: { widthM: 5.4, depthM: 4.2, heightM: 2.8 },
    objects: [
      object("bed", "Queen bed", "major", 48, 52, 32, 38, 0.68, 0, "#f4efe6"),
      object(
        "nightstand-a",
        "Nightstand",
        "major",
        27,
        53,
        8,
        10,
        0.52,
        0,
        "#cba875",
      ),
      object(
        "nightstand-b",
        "Nightstand",
        "major",
        69,
        53,
        8,
        10,
        0.52,
        0,
        "#cba875",
      ),
      object(
        "wardrobe",
        "Wardrobe",
        "major",
        84,
        36,
        12,
        42,
        2.1,
        0,
        "#d7b98f",
      ),
      object(
        "desk",
        "Writing desk",
        "surface",
        22,
        22,
        24,
        9,
        0.76,
        0,
        "#d6b280",
      ),
      object("chair", "Desk chair", "major", 24, 35, 9, 9, 0.72, 0, "#e7edf4"),
      object("lamp", "Bedside lamp", "light", 28, 45, 4, 4, 0.42, 0, "#fde68a"),
      object("plant", "Plant", "minor", 78, 78, 7, 7, 1.1, 0, "#4ca66f"),
    ],
    sceneGraph: [
      {
        zone: "sleeping_core",
        objects: ["Queen bed", "Nightstands", "Bedside lamp"],
        relations: [
          "bed centered on wall",
          "nightstands mirror along bed sides",
        ],
      },
      {
        zone: "storage_wall",
        objects: ["Wardrobe"],
        relations: ["wardrobe aligned to circulation edge"],
      },
      {
        zone: "work_corner",
        objects: ["Writing desk", "Desk chair", "Plant"],
        relations: ["desk uses daylight side", "chair faces desk"],
      },
    ],
  };
}

function transformSceneForVariant(
  scene: CodeAsRoomScene,
  prompt: string,
  brief: CodeAsRoomDesignBrief,
  offset: number,
  styleSuffix: string,
): CodeAsRoomScene {
  const modeLabel = brief.mode === "render" ? "render" : brief.mode;
  const objects = scene.objects.map((item, index) => ({
    ...item,
    id: `${item.id}-${styleSuffix}`,
    x: clampPercent(item.x + (index % 2 === 0 ? offset : -offset / 2)),
    y: clampPercent(item.y + (index % 3 === 0 ? -offset / 2 : offset)),
    color: recolor(item.color, brief.mode, index),
  }));

  if (brief.mode !== "layout") {
    objects.push(
      object(
        `generated-books-${styleSuffix}`,
        "Generated decor objects",
        "minor",
        52 + offset,
        48,
        10,
        4,
        0.18,
        0,
        "#f4a261",
      ),
    );
  }
  if (brief.mode === "render") {
    objects.push(
      object(
        `generated-key-light-${styleSuffix}`,
        "Generated area light",
        "light",
        50,
        28,
        10,
        10,
        2.45,
        0,
        "#fff3b0",
      ),
    );
  }

  return {
    ...scene,
    id: `generated-${scene.id}-${styleSuffix}`,
    name: `AI Generated · ${scene.roomType} · ${styleSuffix}`,
    style: `${scene.style} / ${modeLabel} / ${prompt.slice(0, 28)}`,
    inputImageUrl: brief.sourceImageUrl ?? scene.inputImageUrl,
    objects,
    sceneGraph: scene.sceneGraph.map((zone) => ({
      ...zone,
      relations: [
        ...zone.relations,
        `generated from design prompt through ${modeLabel} route`,
      ],
    })),
  };
}

function clampPercent(value: number): number {
  return Math.min(92, Math.max(8, Math.round(value)));
}

function recolor(
  color: string,
  mode: CodeAsRoomDesignBrief["mode"],
  index: number,
): string {
  if (mode === "layout") return color;
  const detailPalette = ["#d8b48a", "#9fb7aa", "#e6cfb3", "#bfd7ea"];
  const renderPalette = ["#c49a6c", "#f2e8dc", "#88a0a8", "#f6d365"];
  const palette = mode === "render" ? renderPalette : detailPalette;
  return palette[index % palette.length] ?? color;
}

function buildBlenderScriptPreview(scene: CodeAsRoomScene): string {
  const majorObjects = scene.objects
    .filter((item) => item.kind === "major")
    .slice(0, 5)
    .map(
      (item) =>
        `engine.add_furniture("${item.label}", loc=(${toMeters(item.x, scene.dimensions.widthM)}, ${toMeters(item.y, scene.dimensions.depthM)}, ${item.h / 2}), size=(${toMeters(item.w, scene.dimensions.widthM)}, ${toMeters(item.d, scene.dimensions.depthM)}, ${item.h}))`,
    )
    .join("\n    ");

  return `from IncrementalLayoutEngine import IncrementalLayoutEngine, clear_scene, create_material

def run_layout_engine():
    clear_scene()
    engine = IncrementalLayoutEngine(
        scene_w=${scene.dimensions.widthM},
        scene_d=${scene.dimensions.depthM},
        wall_thickness=0.18,
    )
    floor_mat = create_material("warm_floor", (0.78, 0.66, 0.50, 1.0))
    wall_mat = create_material("soft_wall", (0.92, 0.90, 0.84, 1.0))
    engine.add_room_shell("${scene.name}", floor_mat=floor_mat, wall_mat=wall_mat)
    ${majorObjects}
    engine.add_surface_small_objects()
    engine.apply_pbr_materials()
    engine.setup_camera_and_lighting()
    return engine

if __name__ == "__main__":
    run_layout_engine()`;
}

function toMeters(percent: number, scale: number): string {
  return ((percent / 100) * scale).toFixed(2);
}
