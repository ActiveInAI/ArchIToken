import { validateBoqCode } from "./quantity-costing";

export interface QuotaImportContext {
  quotaLibraryId: string;
  quotaLibraryName: string;
  jurisdiction: string;
  specialty: string;
  version: string;
  standardId: string;
  sourceRef: string;
  sourceVerified: boolean;
}

export interface QuotaImportResource {
  resourceId: string;
  resourceType: "labor" | "material" | "machine";
  name: string;
  unit: string;
  consumption: number;
  unitPrice: number;
  sourceRef: string;
  sourceVerified: boolean;
}

export interface QuotaImportItem {
  quotaItemId: string;
  quotaLibraryId: string;
  boqCode: string;
  name: string;
  unit: string;
  sourceRef: string;
  sourceVerified: boolean;
  managementRate: number;
  profitRate: number;
  riskRate: number;
  resourceConsumptions: QuotaImportResource[];
}

export interface QuotaImportIssue {
  line: number;
  message: string;
}

export interface ParsedQuotaImport {
  quotaItems: QuotaImportItem[];
  errors: QuotaImportIssue[];
  warnings: QuotaImportIssue[];
  rowCount: number;
}

export interface PriceQuoteRow {
  resourceId: string;
  name: string;
  unitPrice: number;
  sourceRef: string;
}

export interface ParsedPriceImport {
  quotes: PriceQuoteRow[];
  errors: QuotaImportIssue[];
  rowCount: number;
}

const quotaHeaderAliases: Record<string, string> = {
  定额编号: "quotaItemId",
  quota_item_id: "quotaItemId",
  清单编码: "boqCode",
  boq_code: "boqCode",
  定额名称: "name",
  名称: "name",
  name: "name",
  单位: "unit",
  unit: "unit",
  管理费率: "managementRate",
  management_rate: "managementRate",
  利润率: "profitRate",
  profit_rate: "profitRate",
  风险费率: "riskRate",
  risk_rate: "riskRate",
  资源编号: "resourceId",
  resource_id: "resourceId",
  资源类型: "resourceType",
  resource_type: "resourceType",
  资源名称: "resourceName",
  resource_name: "resourceName",
  资源单位: "resourceUnit",
  resource_unit: "resourceUnit",
  消耗量: "consumption",
  consumption: "consumption",
  资源单价: "unitPrice",
  单价: "unitPrice",
  unit_price: "unitPrice",
  来源: "sourceRef",
  source_ref: "sourceRef",
};

const priceHeaderAliases: Record<string, string> = {
  资源编号: "resourceId",
  resource_id: "resourceId",
  资源名称: "name",
  名称: "name",
  name: "name",
  单价: "unitPrice",
  资源单价: "unitPrice",
  unit_price: "unitPrice",
  来源: "sourceRef",
  source_ref: "sourceRef",
};

const resourceTypeAliases: Record<string, "labor" | "material" | "machine"> = {
  人工: "labor",
  人: "labor",
  labor: "labor",
  材料: "material",
  材: "material",
  material: "material",
  机械: "machine",
  机: "machine",
  machine: "machine",
};

export function splitCsvLine(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;
  let index = 0;
  while (index < line.length) {
    const char = line.charAt(index);
    if (inQuotes) {
      if (char === '"') {
        if (line.charAt(index + 1) === '"') {
          current += '"';
          index += 2;
          continue;
        }
        inQuotes = false;
        index += 1;
        continue;
      }
      current += char;
      index += 1;
      continue;
    }
    if (char === '"') {
      inQuotes = true;
      index += 1;
      continue;
    }
    if (char === delimiter) {
      cells.push(current.trim());
      current = "";
      index += 1;
      continue;
    }
    current += char;
    index += 1;
  }
  cells.push(current.trim());
  return cells;
}

interface ParsedTable {
  columns: Record<string, number>;
  rows: Array<{ line: number; cells: string[] }>;
  unknownHeaders: string[];
}

function parseDelimitedTable(
  text: string,
  aliases: Record<string, string>,
): ParsedTable | null {
  const lines = text
    .split(/\r\n|\r|\n/)
    .map((line, index) => ({ line: index + 1, raw: line }))
    .filter((entry) => entry.raw.trim() !== "");
  const headerEntry = lines[0];
  if (!headerEntry) {
    return null;
  }
  const delimiter = headerEntry.raw.includes("\t") ? "\t" : ",";
  const headers = splitCsvLine(headerEntry.raw, delimiter);
  const columns: Record<string, number> = {};
  const unknownHeaders: string[] = [];
  headers.forEach((header, index) => {
    const normalized = header.trim().toLowerCase();
    const mapped =
      aliases[header.trim()] ?? aliases[normalized] ?? null;
    if (mapped) {
      if (!(mapped in columns)) {
        columns[mapped] = index;
      }
    } else if (header.trim() !== "") {
      unknownHeaders.push(header.trim());
    }
  });
  return {
    columns,
    rows: lines.slice(1).map((entry) => ({
      line: entry.line,
      cells: splitCsvLine(entry.raw, delimiter),
    })),
    unknownHeaders,
  };
}

function cellValue(
  columns: Record<string, number>,
  cells: string[],
  key: string,
): string {
  const index = columns[key];
  if (index === undefined) {
    return "";
  }
  return (cells[index] ?? "").trim();
}

function parseRate(raw: string): { value: number; percentAssumed: boolean } {
  const cleaned = raw.replace("%", "").trim();
  const value = Number(cleaned);
  if (!Number.isFinite(value)) {
    return { value: Number.NaN, percentAssumed: false };
  }
  if (raw.includes("%") || value > 1) {
    return { value: value / 100, percentAssumed: !raw.includes("%") };
  }
  return { value, percentAssumed: false };
}

export function parseQuotaRegistryCsv(
  text: string,
  context: QuotaImportContext,
): ParsedQuotaImport {
  const errors: QuotaImportIssue[] = [];
  const warnings: QuotaImportIssue[] = [];
  const table = parseDelimitedTable(text, quotaHeaderAliases);
  if (!table) {
    return {
      quotaItems: [],
      errors: [{ line: 0, message: "文件为空" }],
      warnings: [],
      rowCount: 0,
    };
  }
  const required: Array<[string, string]> = [
    ["quotaItemId", "定额编号"],
    ["boqCode", "清单编码"],
    ["name", "定额名称"],
    ["unit", "单位"],
  ];
  const missing = required.filter(([key]) => !(key in table.columns));
  if (missing.length > 0) {
    return {
      quotaItems: [],
      errors: [
        {
          line: 1,
          message: `表头缺少必需列: ${missing
            .map(([, label]) => label)
            .join("、")}（支持中文/英文列名）`,
        },
      ],
      warnings: [],
      rowCount: table.rows.length,
    };
  }
  if (table.unknownHeaders.length > 0) {
    warnings.push({
      line: 1,
      message: `忽略未识别列: ${table.unknownHeaders.join("、")}`,
    });
  }

  const itemMap = new Map<string, QuotaImportItem>();
  for (const row of table.rows) {
    const quotaItemId = cellValue(table.columns, row.cells, "quotaItemId");
    const boqCode = cellValue(table.columns, row.cells, "boqCode");
    const name = cellValue(table.columns, row.cells, "name");
    const unit = cellValue(table.columns, row.cells, "unit");
    if (quotaItemId === "") {
      errors.push({ line: row.line, message: "定额编号为空" });
      continue;
    }
    if (!validateBoqCode(boqCode)) {
      errors.push({
        line: row.line,
        message: `清单编码 "${boqCode}" 不符合 9 位数字规则`,
      });
      continue;
    }

    let item = itemMap.get(quotaItemId);
    if (!item) {
      const rates: Array<
        ["managementRate" | "profitRate" | "riskRate", string]
      > = [
        ["managementRate", cellValue(table.columns, row.cells, "managementRate")],
        ["profitRate", cellValue(table.columns, row.cells, "profitRate")],
        ["riskRate", cellValue(table.columns, row.cells, "riskRate")],
      ];
      const rateValues = { managementRate: 0, profitRate: 0, riskRate: 0 };
      for (const [key, raw] of rates) {
        if (raw === "") {
          continue;
        }
        const parsed = parseRate(raw);
        if (Number.isNaN(parsed.value)) {
          errors.push({
            line: row.line,
            message: `费率 "${raw}" 无法解析`,
          });
          continue;
        }
        if (parsed.percentAssumed) {
          warnings.push({
            line: row.line,
            message: `费率 ${raw} 大于 1，按百分比换算为 ${parsed.value}`,
          });
        }
        rateValues[key] = parsed.value;
      }
      item = {
        quotaItemId,
        quotaLibraryId: context.quotaLibraryId,
        boqCode,
        name: name || quotaItemId,
        unit,
        sourceRef: context.sourceRef,
        sourceVerified: context.sourceVerified,
        managementRate: rateValues.managementRate,
        profitRate: rateValues.profitRate,
        riskRate: rateValues.riskRate,
        resourceConsumptions: [],
      };
      itemMap.set(quotaItemId, item);
    }

    const resourceId = cellValue(table.columns, row.cells, "resourceId");
    if (resourceId === "") {
      continue;
    }
    const typeRaw = cellValue(table.columns, row.cells, "resourceType");
    const resourceType =
      resourceTypeAliases[typeRaw] ?? resourceTypeAliases[typeRaw.toLowerCase()];
    if (!resourceType) {
      errors.push({
        line: row.line,
        message: `资源类型 "${typeRaw}" 无法识别（支持 人工/材料/机械）`,
      });
      continue;
    }
    const consumption = Number(
      cellValue(table.columns, row.cells, "consumption") || "0",
    );
    if (!Number.isFinite(consumption) || consumption < 0) {
      errors.push({ line: row.line, message: "消耗量无效" });
      continue;
    }
    const unitPriceRaw = cellValue(table.columns, row.cells, "unitPrice");
    const unitPrice = unitPriceRaw === "" ? 0 : Number(unitPriceRaw);
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      errors.push({ line: row.line, message: "资源单价无效" });
      continue;
    }
    if (
      item.resourceConsumptions.some(
        (resource) => resource.resourceId === resourceId,
      )
    ) {
      warnings.push({
        line: row.line,
        message: `定额 ${quotaItemId} 重复资源 ${resourceId}，已忽略后者`,
      });
      continue;
    }
    item.resourceConsumptions.push({
      resourceId,
      resourceType,
      name:
        cellValue(table.columns, row.cells, "resourceName") || resourceId,
      unit: cellValue(table.columns, row.cells, "resourceUnit"),
      consumption,
      unitPrice,
      sourceRef:
        cellValue(table.columns, row.cells, "sourceRef") || context.sourceRef,
      sourceVerified: context.sourceVerified,
    });
  }

  return {
    quotaItems: [...itemMap.values()],
    errors,
    warnings,
    rowCount: table.rows.length,
  };
}

export function parsePriceQuoteCsv(text: string): ParsedPriceImport {
  const errors: QuotaImportIssue[] = [];
  const table = parseDelimitedTable(text, priceHeaderAliases);
  if (!table) {
    return { quotes: [], errors: [{ line: 0, message: "文件为空" }], rowCount: 0 };
  }
  if (!("unitPrice" in table.columns)) {
    return {
      quotes: [],
      errors: [{ line: 1, message: "表头缺少单价列（单价/unit_price）" }],
      rowCount: table.rows.length,
    };
  }
  if (!("resourceId" in table.columns) && !("name" in table.columns)) {
    return {
      quotes: [],
      errors: [
        { line: 1, message: "表头需要资源编号或资源名称列用于匹配" },
      ],
      rowCount: table.rows.length,
    };
  }

  const quotes: PriceQuoteRow[] = [];
  for (const row of table.rows) {
    const resourceId = cellValue(table.columns, row.cells, "resourceId");
    const name = cellValue(table.columns, row.cells, "name");
    if (resourceId === "" && name === "") {
      errors.push({ line: row.line, message: "资源编号与名称均为空" });
      continue;
    }
    const unitPrice = Number(cellValue(table.columns, row.cells, "unitPrice"));
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      errors.push({ line: row.line, message: "单价无效" });
      continue;
    }
    quotes.push({
      resourceId,
      name,
      unitPrice,
      sourceRef: cellValue(table.columns, row.cells, "sourceRef"),
    });
  }
  return { quotes, errors, rowCount: table.rows.length };
}
