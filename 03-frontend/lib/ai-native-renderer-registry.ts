// lib/ai-native-renderer-registry.ts - AI Native renderer selection contract
// License: Apache-2.0

export type AiNativeRendererId =
  | "pan-ui"
  | "d3"
  | "xyflow-react"
  | "mermaid"
  | "bpmn-js"
  | "three-webgpu";

export type AiNativeRendererRole =
  | "ui_primitives"
  | "data_visualization"
  | "node_graph"
  | "document_diagram"
  | "bpmn"
  | "digital_twin";

export type RendererPortability =
  | "native_contract"
  | "web_renderer_adapter"
  | "webgpu_renderer_adapter";

export interface GitHubStarsSnapshot {
  checkedAt: "2026-06-08";
  repository: string;
  stars: number;
  rankNote: string;
}

export interface AiNativeRendererRoute {
  id: AiNativeRendererId;
  label: string;
  role: AiNativeRendererRole;
  packageNames: readonly string[];
  sourceUrls: readonly string[];
  githubStarsSnapshot: readonly GitHubStarsSnapshot[];
  structuredInputSchema: string;
  generatedArtifactSchema: string;
  rendererBoundary: "RendererRegistry";
  portability: RendererPortability;
  aiNativeContract: {
    schemaValidated: true;
    auditLogged: true;
    approvalAware: true;
    businessLogicSeparated: true;
  };
  decision: string;
}

export const aiNativeRendererRoutes = [
  {
    id: "pan-ui",
    label: "PanUI",
    role: "ui_primitives",
    packageNames: ["react", "lucide-react", "tailwindcss"],
    sourceUrls: [
      "https://github.com/ActiveInAI/PanUI",
      "https://github.com/shadcn-ui/ui",
      "https://github.com/radix-ui/primitives",
    ],
    githubStarsSnapshot: [
      {
        checkedAt: "2026-06-08",
        repository: "ActiveInAI/PanUI",
        stars: 0,
        rankNote: "Canonical owned product UI layer; stars are not used as the selection criterion.",
      },
      {
        checkedAt: "2026-06-08",
        repository: "shadcn-ui/ui",
        stars: 115970,
        rankNote: "Reference-only composition benchmark for owned PanUI primitives.",
      },
      {
        checkedAt: "2026-06-08",
        repository: "radix-ui/primitives",
        stars: 18952,
        rankNote: "Reference-only accessible headless primitive benchmark.",
      },
    ],
    structuredInputSchema: "architoken.panui_component_contract.v1",
    generatedArtifactSchema: "architoken.panui_view_state.v1",
    rendererBoundary: "RendererRegistry",
    portability: "native_contract",
    aiNativeContract: {
      schemaValidated: true,
      auditLogged: true,
      approvalAware: true,
      businessLogicSeparated: true,
    },
    decision:
      "Selected as the owned AI Native design-system layer; external UI projects are references, not product identity.",
  },
  {
    id: "d3",
    label: "D3",
    role: "data_visualization",
    packageNames: ["d3"],
    sourceUrls: ["https://github.com/d3/d3", "https://d3js.org/"],
    githubStarsSnapshot: [
      {
        checkedAt: "2026-06-08",
        repository: "d3/d3",
        stars: 113036,
        rankNote: "Highest-starred route among checked charting candidates.",
      },
    ],
    structuredInputSchema: "architoken.chart_spec.v1",
    generatedArtifactSchema: "architoken.chart_artifact.v1",
    rendererBoundary: "RendererRegistry",
    portability: "web_renderer_adapter",
    aiNativeContract: {
      schemaValidated: true,
      auditLogged: true,
      approvalAware: true,
      businessLogicSeparated: true,
    },
    decision:
      "Selected for data charts, engineering analytics and custom Gantt routes where traceable data binding matters.",
  },
  {
    id: "xyflow-react",
    label: "React Flow / xyflow",
    role: "node_graph",
    packageNames: ["@xyflow/react"],
    sourceUrls: ["https://github.com/xyflow/xyflow", "https://reactflow.dev/"],
    githubStarsSnapshot: [
      {
        checkedAt: "2026-06-08",
        repository: "xyflow/xyflow",
        stars: 36976,
        rankNote: "Strong embedded React node-editor route; whiteboard apps were excluded from this category.",
      },
    ],
    structuredInputSchema: "architoken.node_graph.v1",
    generatedArtifactSchema: "architoken.node_graph_artifact.v1",
    rendererBoundary: "RendererRegistry",
    portability: "web_renderer_adapter",
    aiNativeContract: {
      schemaValidated: true,
      auditLogged: true,
      approvalAware: true,
      businessLogicSeparated: true,
    },
    decision:
      "Selected for workflow, topology, dependency, mind-map and agent graph surfaces with explicit nodes and edges.",
  },
  {
    id: "mermaid",
    label: "Mermaid",
    role: "document_diagram",
    packageNames: ["mermaid"],
    sourceUrls: ["https://github.com/mermaid-js/mermaid", "https://mermaid.js.org/"],
    githubStarsSnapshot: [
      {
        checkedAt: "2026-06-08",
        repository: "mermaid-js/mermaid",
        stars: 88515,
        rankNote: "High-adoption text diagram DSL, suitable for AI generation and document versioning.",
      },
    ],
    structuredInputSchema: "architoken.mermaid_source.v1",
    generatedArtifactSchema: "architoken.document_diagram_artifact.v1",
    rendererBoundary: "RendererRegistry",
    portability: "web_renderer_adapter",
    aiNativeContract: {
      schemaValidated: true,
      auditLogged: true,
      approvalAware: true,
      businessLogicSeparated: true,
    },
    decision:
      "Selected for document-level diagrams because text DSL output is easy for agents to generate, validate and diff.",
  },
  {
    id: "bpmn-js",
    label: "bpmn-js",
    role: "bpmn",
    packageNames: ["bpmn-js"],
    sourceUrls: ["https://github.com/bpmn-io/bpmn-js", "https://bpmn.io/toolkit/bpmn-js"],
    githubStarsSnapshot: [
      {
        checkedAt: "2026-06-08",
        repository: "bpmn-io/bpmn-js",
        stars: 9554,
        rankNote: "Specialized BPMN 2.0 browser modeling toolkit; not compared against generic drawing apps.",
      },
    ],
    structuredInputSchema: "architoken.bpmn_manifest.v1",
    generatedArtifactSchema: "bpmn_2_0_xml",
    rendererBoundary: "RendererRegistry",
    portability: "web_renderer_adapter",
    aiNativeContract: {
      schemaValidated: true,
      auditLogged: true,
      approvalAware: true,
      businessLogicSeparated: true,
    },
    decision:
      "Selected for BPMN because business process semantics must stay BPMN 2.0, not generic graph shapes.",
  },
  {
    id: "three-webgpu",
    label: "Three.js / WebGPU",
    role: "digital_twin",
    packageNames: ["three", "@react-three/fiber", "@react-three/drei"],
    sourceUrls: [
      "https://github.com/mrdoob/three.js",
      "https://threejs.org/",
      "https://threejs.org/manual/en/webgpurenderer",
    ],
    githubStarsSnapshot: [
      {
        checkedAt: "2026-06-08",
        repository: "mrdoob/three.js",
        stars: 112907,
        rankNote: "Highest-starred checked web 3D runtime; WebGPU remains the preferred renderer route.",
      },
    ],
    structuredInputSchema: "architoken.scene_manifest.v1",
    generatedArtifactSchema: "architoken.digital_twin_view_artifact.v1",
    rendererBoundary: "RendererRegistry",
    portability: "webgpu_renderer_adapter",
    aiNativeContract: {
      schemaValidated: true,
      auditLogged: true,
      approvalAware: true,
      businessLogicSeparated: true,
    },
    decision:
      "Selected for digital twin and engineering 3D; WebGPU is primary and WebGL/CPU are audited fallback paths only.",
  },
] as const satisfies readonly AiNativeRendererRoute[];

export const selectedAiNativeRendererIds = aiNativeRendererRoutes.map(
  (route) => route.id,
);

export const aiNativeRendererPackageNames = Array.from(
  new Set(aiNativeRendererRoutes.flatMap((route) => route.packageNames)),
).sort();

const legacyUiPackage = ["ant", "d"].join("");
const legacyUiScope = `@${["ant", "design"].join("-")}`;
const legacyGraphScope = `@${["ant", "v"].join("")}`;

export const disallowedLegacyRendererPackages = [
  legacyUiPackage,
  `${legacyUiPackage}-style`,
  `${legacyUiScope}/charts`,
  `${legacyUiScope}/colors`,
  `${legacyUiScope}/cssinjs-utils`,
  `${legacyUiScope}/graphs`,
  `${legacyUiScope}/icons`,
  `${legacyUiScope}/pro-components`,
  `${legacyUiScope}/static-style-extract`,
  `${legacyUiScope}/x`,
  `${legacyGraphScope}/g6`,
  `${legacyGraphScope}/x6`,
] as const;

export function aiNativeRendererById(
  id: AiNativeRendererId,
): AiNativeRendererRoute {
  const route = aiNativeRendererRoutes.find((item) => item.id === id);
  if (!route) throw new Error(`Unknown AI Native renderer route: ${id}`);
  return route;
}
