// lib/skp-bom-extract.ts - SKP model component name extraction to BOM manifest
// License: Apache-2.0

export type SkpBomQuantityBasis = "sdk_instance_count" | "definition_copies";

export type SkpBomAdapter =
  | "skp_sdk_instance_scan"
  | "skp_component_name_scan";

export type SkpBomWeightBasis =
  | "computed_from_section"
  | "missing_in_source";

export interface SkpBomLine {
  lineNo: number;
  categoryName: string;
  categoryCode: string;
  componentName: string;
  namePrefix: string;
  sectionSize: string;
  lengthMm: number | null;
  unit: string;
  quantity: number;
  quantityBasis: SkpBomQuantityBasis;
  unitWeightKg: number | null;
  totalWeightKg: number | null;
  weightBasis: SkpBomWeightBasis;
  copyNames: string[];
  reviewState: "professional_review_required";
}

export interface SkpBomIssue {
  id: string;
  severity: "error" | "warning" | "info";
  code: string;
  message: string;
  lineNo: number;
  componentName: string;
}

export interface SkpBomSummary {
  lineCount: number;
  namedLineCount: number;
  unnamedLineCount: number;
  totalQuantity: number;
  totalWeightKg: number;
  weightedLineCount: number;
  skipped2dSymbolCount: number;
  unplacedDefinitionCount: number;
}

export interface SkpBomExtractManifest {
  schema: "architoken.skp_bom_extract_manifest.v1";
  adapter: SkpBomAdapter;
  quantityBasis: SkpBomQuantityBasis;
  sourceFormat: "skp";
  source: {
    fileId: string;
    originalName: string;
    checksum: string;
    size: number;
    version: string;
  };
  modelUnit: "mm";
  reviewState: "professional_review_required";
  summary: SkpBomSummary;
  lines: SkpBomLine[];
  issues: SkpBomIssue[];
  notes: string[];
}

// 与 component-bom.ts 命名规则表保持一致的主前缀，外加结构模型中常见的紧固/连接辅件前缀。
const rulebookNamingPrefixes = new Set([
  "Beam",
  "Column",
  "Purlin",
  "Gutter",
  "FixPart",
  "Mech",
  "Bath",
  "Fastener",
  "Connect",
  "StairBeam",
  "StairTread",
  "StairHandrail",
  "StairGlass",
  "StairPost",
  "StairPlatform",
]);

const auxiliaryNamingPrefixes = new Set([
  "Anchor",
  "Bolt",
  "Nut",
  "Washer",
  "Wsher",
  "Plate",
  "BasePlate",
  "EmbedPlate",
  "Brace",
  "Rafter",
  "Girt",
  "Truss",
]);

const prefixCategoryMap: Record<string, { name: string; code: string }> = {
  Column: { name: "焊接H型钢柱", code: "30-03.95.03.15" },
  Beam: { name: "焊接H型钢梁", code: "30-03.95.09.15" },
  Purlin: { name: "C型钢檩条", code: "30-03.95.33.20.15" },
  Fastener: { name: "螺栓", code: "30-03.95.42.20.10" },
  Anchor: { name: "钢结构锚栓", code: "30-03.95.42.20.20" },
  Bolt: { name: "螺栓", code: "30-03.95.42.20.10" },
  Plate: { name: "镀锌钢板", code: "30-03.40.10.20" },
};

const genericComponentPattern = /^组件#\d+$/u;
const library2dSymbolPattern = /^\$(?:DorLib2D|DORLIB2D|WinLib2D|WINLIB2D)\$/;
const copySuffixPattern = /\s*#(\d+)$/;
const lengthTokenPattern = /(?:^|_)L(\d+(?:\.\d+)?)(?:[_\s]|$)/i;
const hSectionPattern =
  /(?:^|_)H?(\d{2,4})[xX*](\d{2,4})[xX*](\d{1,3}(?:\.\d+)?)[xX*](\d{1,3}(?:\.\d+)?)(?:[_\s]|$)/;

const steelDensityKgM3 = 7850;

/**
 * 扫描二进制字节流中的可打印 UTF-8 字符串（含 CJK），用于从 SKP model.dat
 * 中提取构件定义名称。返回去重后的字符串集合。
 */
export function scanUtf8Strings(
  bytes: Uint8Array,
  minLength = 4,
): Set<string> {
  const found = new Set<string>();
  const decoder = new TextDecoder("utf-8", { fatal: false });
  let runStart = -1;
  let charCount = 0;
  let index = 0;

  const flush = (end: number) => {
    if (runStart >= 0 && charCount >= minLength) {
      const text = decoder.decode(bytes.subarray(runStart, end)).trim();
      if (text.length >= minLength) {
        found.add(text);
      }
    }
    runStart = -1;
    charCount = 0;
  };

  while (index < bytes.length) {
    const byte = bytes[index]!;
    let sequenceLength = 0;

    if (byte >= 0x20 && byte <= 0x7e) {
      sequenceLength = 1;
    } else if (byte >= 0xc2 && byte <= 0xdf) {
      sequenceLength = 2;
    } else if (byte >= 0xe0 && byte <= 0xef) {
      sequenceLength = 3;
    } else if (byte >= 0xf0 && byte <= 0xf4) {
      sequenceLength = 4;
    }

    if (sequenceLength > 1) {
      if (index + sequenceLength > bytes.length) {
        sequenceLength = 0;
      } else {
        for (let offset = 1; offset < sequenceLength; offset += 1) {
          const continuation = bytes[index + offset]!;
          if (continuation < 0x80 || continuation > 0xbf) {
            sequenceLength = 0;
            break;
          }
        }
      }
    }

    if (sequenceLength === 0) {
      flush(index);
      index += 1;
      continue;
    }

    if (runStart < 0) {
      runStart = index;
    }
    charCount += 1;
    index += sequenceLength;
  }
  flush(index);

  return found;
}

export interface SkpComponentNameCollection {
  componentNames: string[];
  skipped2dSymbols: string[];
}

/**
 * 从扫描出的字符串集合中筛选构件定义名称：命名规则表前缀、
 * 含截面+长度令牌的结构名、辅件前缀，以及 SketchUp 自动命名的 组件#N。
 * 2D 图库符号（$DorLib2D$ 等）单独返回，不进入 BOM。
 */
export function collectSkpComponentNames(
  strings: Iterable<string>,
): SkpComponentNameCollection {
  const componentNames = new Set<string>();
  const skipped2dSymbols = new Set<string>();

  for (const raw of strings) {
    const name = raw.trim();
    if (!name || name.length > 200) continue;
    if (name.includes("/") || name.includes("\\")) continue;

    if (library2dSymbolPattern.test(name)) {
      skipped2dSymbols.add(name);
      continue;
    }

    if (genericComponentPattern.test(name)) {
      componentNames.add(name);
      continue;
    }

    const prefix = name.split(/[_\s]/, 1)[0] ?? "";
    const hasRulebookPrefix = rulebookNamingPrefixes.has(prefix);
    const hasAuxiliaryPrefix = auxiliaryNamingPrefixes.has(prefix);
    const hasSectionAndLength =
      hSectionPattern.test(name) && lengthTokenPattern.test(name);

    if (hasRulebookPrefix || hasAuxiliaryPrefix || hasSectionAndLength) {
      componentNames.add(name);
    }
  }

  return {
    componentNames: [...componentNames].sort(),
    skipped2dSymbols: [...skipped2dSymbols].sort(),
  };
}

export interface ParsedSkpComponentName {
  baseName: string;
  copyIndex: number | null;
  prefix: string;
  sectionSize: string;
  lengthMm: number | null;
}

export function parseSkpComponentName(name: string): ParsedSkpComponentName {
  const trimmed = name.trim();
  const copyMatch = copySuffixPattern.exec(trimmed);
  // 组件#N 的 #N 是定义名本身，不是 make-unique 拷贝后缀。
  const isGeneric = genericComponentPattern.test(trimmed);
  const copyIndex = !isGeneric && copyMatch ? Number(copyMatch[1]) : null;
  const baseName =
    copyIndex !== null
      ? trimmed.slice(0, copyMatch!.index).trim()
      : trimmed;

  const sectionMatch = hSectionPattern.exec(baseName);
  const lengthMatch = lengthTokenPattern.exec(baseName);

  return {
    baseName,
    copyIndex,
    prefix: baseName.split(/[_\s]/, 1)[0] ?? "",
    sectionSize: sectionMatch
      ? `H${sectionMatch[1]}X${sectionMatch[2]}X${sectionMatch[3]}X${sectionMatch[4]}`
      : "",
    lengthMm: lengthMatch ? Number(lengthMatch[1]) : null,
  };
}

/**
 * 焊接 H 型钢理论单重（kg/m）：A = 2·B·t2 + (H − 2·t2)·t1，密度 7850kg/m³。
 */
export function hSectionUnitWeightKgPerM(sectionSize: string): number | null {
  const match = /^H(\d+(?:\.\d+)?)X(\d+(?:\.\d+)?)X(\d+(?:\.\d+)?)X(\d+(?:\.\d+)?)$/.exec(
    sectionSize,
  );
  if (!match) return null;
  const [h, b, t1, t2] = [
    Number(match[1]),
    Number(match[2]),
    Number(match[3]),
    Number(match[4]),
  ];
  if (!(h > 0 && b > 0 && t1 > 0 && t2 > 0) || h <= 2 * t2) return null;
  const areaMm2 = 2 * b * t2 + (h - 2 * t2) * t1;
  return (areaMm2 * steelDensityKgM3) / 1_000_000;
}

export interface SkpComponentObservation {
  name: string;
  /** SDK 实例计数模式下该定义的真实放置数；名称扫描模式为 undefined。 */
  instances?: number;
}

export interface BuildSkpBomManifestInput {
  components: SkpComponentObservation[];
  quantityBasis: SkpBomQuantityBasis;
  skipped2dSymbols?: string[];
  source: SkpBomExtractManifest["source"];
}

export function buildSkpBomManifest(
  input: BuildSkpBomManifestInput,
): SkpBomExtractManifest {
  interface Group {
    baseName: string;
    copyNames: string[];
    instanceTotal: number;
  }
  const groups = new Map<string, Group>();
  const observations = new Map<string, SkpComponentObservation>();
  for (const component of input.components) {
    const name = component.name.trim();
    if (name) observations.set(name, component);
  }
  const allNames = new Set(observations.keys());

  for (const [name, observation] of observations) {
    const parsed = parseSkpComponentName(name);
    // 仅当去掉 #N 后的基础名也存在于定义集合时才按拷贝归并，
    // 否则 #N 视为定义名的一部分（如 组件#32）。
    const groupKey =
      parsed.copyIndex !== null && hasBaseDefinition(allNames, parsed.baseName)
        ? parsed.baseName
        : name;
    const group =
      groups.get(groupKey) ??
      ({ baseName: groupKey, copyNames: [], instanceTotal: 0 } as Group);
    group.copyNames.push(name);
    group.instanceTotal += observation.instances ?? 0;
    groups.set(groupKey, group);
  }

  const useSdkCounts = input.quantityBasis === "sdk_instance_count";
  let unplacedDefinitionCount = 0;
  if (useSdkCounts) {
    for (const [key, group] of [...groups]) {
      if (group.instanceTotal <= 0) {
        groups.delete(key);
        unplacedDefinitionCount += group.copyNames.length;
      }
    }
  }

  const sortedGroups = [...groups.values()].sort((a, b) => {
    const aGeneric = genericComponentPattern.test(a.baseName) ? 1 : 0;
    const bGeneric = genericComponentPattern.test(b.baseName) ? 1 : 0;
    if (aGeneric !== bGeneric) return aGeneric - bGeneric;
    return a.baseName.localeCompare(b.baseName, "zh-Hans-CN");
  });

  const lines: SkpBomLine[] = [];
  const issues: SkpBomIssue[] = [];

  for (const group of sortedGroups) {
    const lineNo = lines.length + 1;
    const parsed = parseSkpComponentName(group.baseName);
    const isGeneric = genericComponentPattern.test(group.baseName);
    const category = prefixCategoryMap[parsed.prefix] ?? {
      name: isGeneric ? "未分类组件" : "未映射类目",
      code: "",
    };

    const unitWeightPerM = parsed.sectionSize
      ? hSectionUnitWeightKgPerM(parsed.sectionSize)
      : null;
    const unitWeightKg =
      unitWeightPerM !== null && parsed.lengthMm !== null
        ? roundTo(unitWeightPerM * (parsed.lengthMm / 1000), 2)
        : null;
    const quantity = useSdkCounts ? group.instanceTotal : group.copyNames.length;

    lines.push({
      lineNo,
      categoryName: category.name,
      categoryCode: category.code,
      componentName: group.baseName,
      namePrefix: parsed.prefix,
      sectionSize: parsed.sectionSize,
      lengthMm: parsed.lengthMm,
      unit: "PCS",
      quantity,
      quantityBasis: input.quantityBasis,
      unitWeightKg,
      totalWeightKg:
        unitWeightKg !== null ? roundTo(unitWeightKg * quantity, 2) : null,
      weightBasis:
        unitWeightKg !== null ? "computed_from_section" : "missing_in_source",
      copyNames: [...group.copyNames].sort(),
      reviewState: "professional_review_required",
    });

    if (isGeneric) {
      issues.push({
        id: `line-${lineNo}-naming-prefix-not-in-rulebook`,
        severity: "warning",
        code: "naming_prefix_not_in_rulebook",
        message: `组件 ${group.baseName} 未按标准化命名规则命名，无法解析截面/长度`,
        lineNo,
        componentName: group.baseName,
      });
    } else if (!rulebookNamingPrefixes.has(parsed.prefix)) {
      issues.push({
        id: `line-${lineNo}-naming-prefix-not-in-rulebook`,
        severity: "warning",
        code: "naming_prefix_not_in_rulebook",
        message: `命名前缀 ${parsed.prefix} 未在命名规则表中声明`,
        lineNo,
        componentName: group.baseName,
      });
    }

    if (!isGeneric && unitWeightKg === null) {
      issues.push({
        id: `line-${lineNo}-weight-missing-in-source`,
        severity: "warning",
        code: "weight_missing_in_source",
        message: "名称中缺少可解析的 H 截面或长度令牌，系统不自动伪造重量",
        lineNo,
        componentName: group.baseName,
      });
    }
  }

  if (lines.length === 0) {
    issues.push({
      id: "manifest-no-component-names-found",
      severity: "error",
      code: "no_component_names_found",
      message: "未在 SKP 模型流中发现可识别的构件定义名称",
      lineNo: 0,
      componentName: "",
    });
  }

  const namedLines = lines.filter(
    (line) => !genericComponentPattern.test(line.componentName),
  );
  const weightedLines = lines.filter((line) => line.totalWeightKg !== null);

  return {
    schema: "architoken.skp_bom_extract_manifest.v1",
    adapter: useSdkCounts
      ? "skp_sdk_instance_scan"
      : "skp_component_name_scan",
    quantityBasis: input.quantityBasis,
    sourceFormat: "skp",
    source: input.source,
    modelUnit: "mm",
    reviewState: "professional_review_required",
    summary: {
      lineCount: lines.length,
      namedLineCount: namedLines.length,
      unnamedLineCount: lines.length - namedLines.length,
      totalQuantity: lines.reduce((sum, line) => sum + line.quantity, 0),
      totalWeightKg: roundTo(
        weightedLines.reduce((sum, line) => sum + (line.totalWeightKg ?? 0), 0),
        2,
      ),
      weightedLineCount: weightedLines.length,
      skipped2dSymbolCount: input.skipped2dSymbols?.length ?? 0,
      unplacedDefinitionCount,
    },
    lines,
    issues,
    notes: [
      useSdkCounts
        ? "数量为官方 SketchUp SDK 递归展开后的真实放置实例数（含嵌套定义乘积）。"
        : "数量按构件定义拷贝（make-unique #N 副本）统计；同一定义被多次放置的真实实例数需 SketchUp SDK 适配器核对。",
      "理论重量仅对名称中含 H 截面与 L 长度令牌的构件按密度 7850kg/m³ 计算；其余行不自动伪造重量。",
      "清单为专业评审输入（professional_review_required），不可直接作为采购依据。",
    ],
  };
}

function hasBaseDefinition(names: Set<string>, baseName: string): boolean {
  if (names.has(baseName)) return true;
  // 模型里基础定义名可能带尾随空格（如 "..._V0  "），扫描阶段已 trim，
  // 这里再按 trim 后等值兜底比对。
  for (const name of names) {
    if (name.trim() === baseName) return true;
  }
  return false;
}

const csvHeader = [
  "行号",
  "类目名称",
  "类目编码",
  "构件名称",
  "截面规格",
  "长度mm",
  "单位",
  "数量",
  "数量依据",
  "单重kg",
  "总重kg",
  "重量依据",
  "评审状态",
];

export function renderSkpBomCsv(manifest: SkpBomExtractManifest): string {
  const rows = manifest.lines.map((line) =>
    [
      String(line.lineNo),
      line.categoryName,
      line.categoryCode,
      line.componentName,
      line.sectionSize,
      line.lengthMm !== null ? String(line.lengthMm) : "",
      line.unit,
      String(line.quantity),
      line.quantityBasis === "sdk_instance_count" ? "SDK实例计数" : "定义拷贝数",
      line.unitWeightKg !== null ? String(line.unitWeightKg) : "",
      line.totalWeightKg !== null ? String(line.totalWeightKg) : "",
      line.weightBasis === "computed_from_section" ? "截面理论重量" : "源缺失",
      "待专业评审",
    ]
      .map(escapeCsvField)
      .join(","),
  );
  const summaryRow = [
    "合计",
    "",
    "",
    `共 ${manifest.summary.lineCount} 行（规范命名 ${manifest.summary.namedLineCount} 行）`,
    "",
    "",
    "",
    String(manifest.summary.totalQuantity),
    "",
    "",
    String(manifest.summary.totalWeightKg),
    `计重行 ${manifest.summary.weightedLineCount}`,
    "",
  ]
    .map(escapeCsvField)
    .join(",");
  // UTF-8 BOM 让 Excel 正确识别中文表头。
  return `${"\uFEFF"}${[csvHeader.join(","), ...rows, summaryRow].join("\r\n")}\r\n`;
}

function escapeCsvField(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function roundTo(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
