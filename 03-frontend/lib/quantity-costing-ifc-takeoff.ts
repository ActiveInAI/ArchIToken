import { roundMoney, roundQuantity } from "./quantity-costing";
import type { QuantityCostingBoqItem } from "./quantity-costing";

// IFC 几何实测 BOM 清单行（panaec-ifc-to-bom manifest.lines 的结构子集）
export interface IfcTakeoffLine {
  lineNo: number;
  category: string;
  ifcClass: string;
  sectionLabel: string;
  lengthMm: number;
  quantity: number;
  unitWeightKg: number | null;
  totalWeightKg: number | null;
  storeys?: Record<string, number>;
  globalIds?: string[];
}

export interface IfcTakeoffManifest {
  summary: {
    lineCount: number;
    elementCount: number;
    totalWeightKg: number;
    geometryFailures: number;
    byClass: Record<string, number>;
  };
  lines: IfcTakeoffLine[];
}

// SJG 157-2024 语义字典分类（来自标准导入数据，由后端接口返回）
export interface Sjg157Category {
  code: string;
  nameZh: string;
  ifcEntity: string | null;
  levelName: string;
}

export interface IfcTakeoffMapOptions {
  projectId: string;
  nodeId: string;
  sourceFileName: string;
  // SJG157 钢结构小类，用于按构件类别精确匹配字典编码；缺省则编码留空
  semanticCategories?: Sjg157Category[];
}

export interface IfcTakeoffResult {
  boqItems: QuantityCostingBoqItem[];
  totalWeightTon: number;
  mappedClassCount: number;
  reviewRequiredCount: number;
  unweightedElementCount: number;
  sjg157MatchedCount: number;
}

interface ClassAggregate {
  ifcClass: string;
  category: string;
  sections: Map<string, number>;
  totalWeightKg: number;
  totalQuantity: number;
  unweightedQuantity: number;
  storeys: Set<string>;
  globalIds: string[];
}

/// 把 IFC 几何实测 BOM 按构件类别汇总为清单项的工程量来源。
/// 只输出几何实测的真实数据：构件类别名称、截面规格、楼层、理论重量(t)、
/// 构件 GlobalId 追溯。清单编码不臆造，一律留空——由人工套清单或从已接入
/// 的标准/定额库匹配后填入。无截面/无重量的构件单独计数，决不伪造重量。
export function mapIfcManifestToBoqItems(
  manifest: IfcTakeoffManifest,
  options: IfcTakeoffMapOptions,
): IfcTakeoffResult {
  const sourceRef = `IFC几何实测:${options.sourceFileName}`;
  const aggregates = new Map<string, ClassAggregate>();

  for (const line of manifest.lines) {
    const agg = aggregates.get(line.ifcClass) ?? {
      ifcClass: line.ifcClass,
      category: line.category || line.ifcClass,
      sections: new Map<string, number>(),
      totalWeightKg: 0,
      totalQuantity: 0,
      unweightedQuantity: 0,
      storeys: new Set<string>(),
      globalIds: [],
    };
    agg.totalQuantity += line.quantity;
    if (line.totalWeightKg && line.totalWeightKg > 0) {
      agg.totalWeightKg += line.totalWeightKg;
    } else {
      agg.unweightedQuantity += line.quantity;
    }
    if (line.sectionLabel) {
      agg.sections.set(
        line.sectionLabel,
        (agg.sections.get(line.sectionLabel) ?? 0) + line.quantity,
      );
    }
    for (const storey of Object.keys(line.storeys ?? {})) {
      if (storey) agg.storeys.add(storey);
    }
    if (line.globalIds) {
      agg.globalIds.push(...line.globalIds);
    }
    aggregates.set(line.ifcClass, agg);
  }

  // SJG157 字典按 name_zh 精确匹配（严格按标准，只在唯一确定时填码）
  const sjg157ByName = new Map<string, Sjg157Category>();
  for (const cat of options.semanticCategories ?? []) {
    if (!sjg157ByName.has(cat.nameZh)) {
      sjg157ByName.set(cat.nameZh, cat);
    }
  }

  let reviewRequiredCount = 0;
  let unweightedElementCount = 0;
  let totalWeightTon = 0;
  let sjg157MatchedCount = 0;

  const boqItems: QuantityCostingBoqItem[] = [...aggregates.values()]
    .filter((agg) => agg.totalQuantity > 0)
    .map((agg, index): QuantityCostingBoqItem => {
      const weightTon = roundQuantity(agg.totalWeightKg / 1000);
      totalWeightTon = roundMoney(totalWeightTon + weightTon);
      const sectionList = [...agg.sections.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([label, count]) => `${label}×${count}`)
        .join("，");
      const storeyList = [...agg.storeys].sort().join("、");
      const featureParts = [
        sectionList ? `截面 ${sectionList}` : "",
        storeyList ? `楼层 ${storeyList}` : "",
        `构件 ${agg.totalQuantity} 件`,
      ].filter(Boolean);
      const isUnclassified =
        agg.ifcClass === "IfcBuildingElementProxy" || agg.totalWeightKg <= 0;

      // 名称用 panaec 几何实测的真实构件类别（钢柱/钢梁/钢斜柱/板/未分类构件）
      const panaecName = agg.category;
      // SJG157 精确匹配 → 用字典编码与字典名称；否则编码留空、保留 panaec 名称
      const matched = sjg157ByName.get(panaecName);
      const code = matched ? matched.code : "";
      const name = matched ? matched.nameZh : panaecName;
      if (matched) sjg157MatchedCount += 1;

      // 编码为空（未匹配 SJG157）或有未计重构件或未分类 → 待复核
      const reviewNeeded = !matched || agg.unweightedQuantity > 0 || isUnclassified;
      if (reviewNeeded) reviewRequiredCount += 1;
      unweightedElementCount += agg.unweightedQuantity;

      const feature = featureParts.join("；");
      return {
        itemId: `ifc-${agg.ifcClass}-${index + 1}-${Date.now()}`,
        projectId: options.projectId,
        nodeId: options.nodeId,
        submittedCode: code,
        approvedCode: code,
        submittedName: name,
        approvedName: name,
        submittedFeature: feature,
        approvedFeature: feature,
        unit: "t",
        submittedQty: weightTon,
        approvedQty: weightTon,
        submittedUnitPrice: 0,
        approvedUnitPrice: 0,
        sourceRef,
        ruleId: `ifc-takeoff-${agg.ifcClass}`,
        ...(agg.globalIds[0] ? { elementId: agg.globalIds[0] } : {}),
        manualReviewRequired: reviewNeeded,
        ...(isUnclassified ? { temporary: true } : {}),
      };
    });

  return {
    boqItems,
    totalWeightTon,
    mappedClassCount: boqItems.length,
    reviewRequiredCount,
    unweightedElementCount,
    sjg157MatchedCount,
  };
}
