// lib/panai-bim-collab.ts - PanAI BIM协同助手: real IFC model analysis + persistent collab issues
// License: Apache-2.0

import { randomUUID } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import {
  getLocalUploadsDir,
  readLocalFileIndex,
  resolveLocalUploadStoragePath,
} from "./local-file-runtime-server";
import type { LocalFileMetadata } from "./local-file-runtime";

export type BimCollabAction = "model_summary" | "create_issue" | "list_issues";

export interface BimModelSummary {
  fileId: string;
  fileName: string;
  sizeBytes: number;
  schema: string | null;
  projectName: string | null;
  totalEntities: number;
  productEntities: number;
  topTypes: Array<{ type: string; count: number }>;
  storeys: Array<{ name: string; elevation: number | null }>;
}

export interface BimCollabIssue {
  id: string;
  title: string;
  description: string;
  status: "open" | "closed";
  moduleId: string;
  fileId: string | null;
  fileName: string | null;
  createdAt: string;
  createdBy: string;
}

const MAX_IFC_BYTES = 512 * 1024 * 1024;
const IFC_PRODUCT_TYPES = new Set([
  "IFCWALL",
  "IFCWALLSTANDARDCASE",
  "IFCSLAB",
  "IFCBEAM",
  "IFCCOLUMN",
  "IFCDOOR",
  "IFCWINDOW",
  "IFCSTAIR",
  "IFCSTAIRFLIGHT",
  "IFCROOF",
  "IFCRAILING",
  "IFCMEMBER",
  "IFCPLATE",
  "IFCCOVERING",
  "IFCCURTAINWALL",
  "IFCFOOTING",
  "IFCPILE",
  "IFCBUILDINGELEMENTPROXY",
  "IFCFLOWSEGMENT",
  "IFCFLOWFITTING",
  "IFCFLOWTERMINAL",
  "IFCFURNISHINGELEMENT",
]);

export function resolveBimCollabAction(input: string): BimCollabAction {
  if (/(创建|新建|提交?|登记|记录)[^，。\n]{0,10}(议题|问题|issue)/i.test(input)) {
    return "create_issue";
  }
  if (
    /(列出|查看|显示|有哪些|查询)[^，。\n]{0,10}(议题|问题清单|issue)/i.test(
      input,
    ) ||
    /议题(列表|清单)/.test(input)
  ) {
    return "list_issues";
  }
  return "model_summary";
}

export async function findBimModelFiles(): Promise<LocalFileMetadata[]> {
  const index = await readLocalFileIndex();
  return index.files
    .filter((file) => file.ext.toLowerCase() === ".ifc")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function pickBimModelFile(
  files: LocalFileMetadata[],
  input: string,
): LocalFileMetadata | null {
  if (files.length === 0) return null;
  const mentioned = files.find((file) => {
    const stem = file.originalName.replace(/\.[^.]+$/, "");
    return stem.length >= 2 && input.includes(stem);
  });
  return mentioned ?? files[0] ?? null;
}

export async function analyzeBimModel(
  metadata: LocalFileMetadata,
): Promise<BimModelSummary> {
  const storagePath = resolveLocalUploadStoragePath(metadata);
  const fileStat = await stat(storagePath);
  if (fileStat.size > MAX_IFC_BYTES) {
    throw new Error(
      `IFC 文件过大 (${fileStat.size} 字节 > ${MAX_IFC_BYTES})，暂不做全文解析。`,
    );
  }

  const content = await readFile(storagePath, "utf8");
  const counts = new Map<string, number>();
  const typePattern = /=\s*IFC([A-Z0-9_]+)\s*\(/g;
  let match: RegExpExecArray | null;
  let totalEntities = 0;
  while ((match = typePattern.exec(content)) !== null) {
    const type = `IFC${match[1]}`;
    counts.set(type, (counts.get(type) ?? 0) + 1);
    totalEntities += 1;
  }

  const productEntities = Array.from(counts.entries())
    .filter(([type]) => IFC_PRODUCT_TYPES.has(type))
    .reduce((sum, [, count]) => sum + count, 0);

  const topTypes = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([type, count]) => ({ type, count }));

  return {
    fileId: metadata.fileId,
    fileName: metadata.originalName,
    sizeBytes: fileStat.size,
    schema: extractIfcSchema(content),
    projectName: extractFirstStringArg(content, "IFCPROJECT", 1),
    totalEntities,
    productEntities,
    topTypes,
    storeys: extractStoreys(content),
  };
}

export async function createBimCollabIssue(input: {
  title: string;
  description: string;
  moduleId: string;
  fileId?: string | null;
  fileName?: string | null;
  createdBy?: string;
}): Promise<BimCollabIssue> {
  const issue: BimCollabIssue = {
    id: `bim-issue-${Date.now()}-${randomUUID().slice(0, 8)}`,
    title: input.title.slice(0, 120),
    description: input.description.slice(0, 2000),
    status: "open",
    moduleId: input.moduleId,
    fileId: input.fileId ?? null,
    fileName: input.fileName ?? null,
    createdAt: new Date().toISOString(),
    createdBy: input.createdBy ?? "panai",
  };
  const issues = await listBimCollabIssues();
  await writeIssueStore([issue, ...issues]);
  return issue;
}

export async function listBimCollabIssues(): Promise<BimCollabIssue[]> {
  try {
    const raw = await readFile(getBimCollabIssueStorePath(), "utf8");
    const parsed = JSON.parse(raw) as { issues?: BimCollabIssue[] };
    return Array.isArray(parsed.issues) ? parsed.issues : [];
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code === "ENOENT") return [];
    throw error;
  }
}

export function extractIssueTitle(input: string): string {
  const quoted = input.match(/[「《“"']([^「《“"'」》”]{2,80})[」》”"']/);
  if (quoted?.[1]) return quoted[1].trim();
  const labelled = input.match(/(?:议题|问题|issue)\s*[:：]\s*([^，。\n]{2,80})/i);
  if (labelled?.[1]) return labelled[1].trim();
  const stripped = input
    .replace(/(创建|新建|提交?|登记|记录)[^，。\n]{0,10}(议题|问题|issue)\s*[，,:：]?/i, "")
    .trim();
  return (stripped || input).slice(0, 80);
}

export function getBimCollabIssueStorePath(): string {
  return join(dirname(getLocalUploadsDir()), "bim-collab", "issues.json");
}

async function writeIssueStore(issues: BimCollabIssue[]): Promise<void> {
  const path = getBimCollabIssueStorePath();
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify({ issues }, null, 2)}\n`, "utf8");
}

function extractIfcSchema(content: string): string | null {
  const match = content.match(/FILE_SCHEMA\s*\(\s*\(\s*'([^']+)'/);
  return match?.[1] ?? null;
}

function extractFirstStringArg(
  content: string,
  type: string,
  stringIndex: number,
): string | null {
  const pattern = new RegExp(`=\\s*${type}\\s*\\(([^;]*)\\)\\s*;`);
  const args = content.match(pattern)?.[1];
  if (!args) return null;
  const strings = args.match(/'((?:[^'']|'')*)'/g);
  const value = strings?.[stringIndex];
  if (!value) return null;
  const decoded = value.slice(1, -1).replace(/''/g, "'").trim();
  return decoded || null;
}

function extractStoreys(
  content: string,
): Array<{ name: string; elevation: number | null }> {
  const storeys: Array<{ name: string; elevation: number | null }> = [];
  const pattern = /=\s*IFCBUILDINGSTOREY\s*\(([^;]*)\)\s*;/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(content)) !== null && storeys.length < 200) {
    const args = match[1] ?? "";
    const strings = args.match(/'((?:[^'']|'')*)'/g);
    const name = strings?.[1]
      ? strings[1].slice(1, -1).replace(/''/g, "'")
      : `Storey ${storeys.length + 1}`;
    const elevation = args.match(
      /,\s*([-+]?\d+(?:\.\d+)?(?:E[-+]?\d+)?)\s*$/i,
    )?.[1];
    storeys.push({
      name,
      elevation: elevation !== undefined ? Number(elevation) : null,
    });
  }
  return storeys.sort((a, b) => (a.elevation ?? 0) - (b.elevation ?? 0));
}
