// lib/quantity-costing-registry-import.test.ts - Quota/price CSV import tests
// License: Apache-2.0

import { describe, expect, it } from "vitest";
import {
  parsePriceQuoteCsv,
  parseQuotaRegistryCsv,
  splitCsvLine,
  type QuotaImportContext,
} from "./quantity-costing-registry-import";
import { quantityCostingPhase2Registry } from "./quantity-costing";
import {
  applyPriceLoadPlan,
  buildPriceUpdatePayload,
  createPriceLoadPlan,
} from "./quantity-costing-price-load";

const context: QuotaImportContext = {
  quotaLibraryId: "SC-2020-steel",
  quotaLibraryName: "四川2020定额·钢结构册",
  jurisdiction: "CN-SC",
  specialty: "钢结构",
  version: "2020",
  standardId: "SC-2020-quota",
  sourceRef: "川建造价发〔2020〕",
  sourceVerified: true,
};

const quotaCsv = [
  "定额编号,清单编码,定额名称,单位,管理费率,利润率,资源编号,资源类型,资源名称,资源单位,消耗量,资源单价,来源",
  "A7-001,010515001,钢梁制作安装,t,8.77%,5%,L-001,人工,综合人工,工日,10.5,285,SC2020",
  "A7-001,010515001,钢梁制作安装,t,,,M-001,材料,Q355B钢材,t,1.06,5350,川价信息",
  "A7-001,010515001,钢梁制作安装,t,,,J-001,机械,汽车吊25t,台班,0.42,1180,SC2020",
  "A7-002,010606001,高强螺栓安装,套,8%,5%,L-001,人工,综合人工,工日,0.02,285,SC2020",
].join("\n");

describe("splitCsvLine", () => {
  it("处理引号包裹与转义引号", () => {
    expect(splitCsvLine('a,"b,c","d""e"', ",")).toEqual(["a", "b,c", 'd"e']);
  });
});

describe("parseQuotaRegistryCsv", () => {
  it("长表格式分组为定额子目并换算百分比费率", () => {
    const result = parseQuotaRegistryCsv(quotaCsv, context);
    expect(result.errors).toEqual([]);
    expect(result.quotaItems).toHaveLength(2);

    const beam = result.quotaItems.find((i) => i.quotaItemId === "A7-001");
    expect(beam?.boqCode).toBe("010515001");
    expect(beam?.managementRate).toBeCloseTo(0.0877);
    expect(beam?.profitRate).toBeCloseTo(0.05);
    expect(beam?.resourceConsumptions).toHaveLength(3);
    expect(beam?.resourceConsumptions[1]).toMatchObject({
      resourceId: "M-001",
      resourceType: "material",
      consumption: 1.06,
      unitPrice: 5350,
    });
    expect(beam?.quotaLibraryId).toBe("SC-2020-steel");
    expect(beam?.sourceVerified).toBe(true);
  });

  it("非 9 位编码与未知资源类型逐行报错", () => {
    const bad = [
      "定额编号,清单编码,定额名称,单位,资源编号,资源类型,消耗量",
      "X-1,12345,坏编码,t,L-1,人工,1",
      "X-2,010515001,好编码,t,L-1,火星,1",
    ].join("\n");
    const result = parseQuotaRegistryCsv(bad, context);
    expect(result.quotaItems.map((i) => i.quotaItemId)).toEqual(["X-2"]);
    expect(result.errors).toHaveLength(2);
    expect(result.errors[0]?.message).toContain("9 位数字");
    expect(result.errors[1]?.message).toContain("火星");
  });

  it("缺必需列时给出明确表头错误", () => {
    const result = parseQuotaRegistryCsv("名称,单位\n钢梁,t", context);
    expect(result.quotaItems).toEqual([]);
    expect(result.errors[0]?.message).toContain("定额编号");
  });

  it("支持制表符分隔与英文表头", () => {
    const tsv = [
      "quota_item_id\tboq_code\tname\tunit",
      "T-1\t010515001\t钢柱\tt",
    ].join("\n");
    const result = parseQuotaRegistryCsv(tsv, context);
    expect(result.errors).toEqual([]);
    expect(result.quotaItems[0]?.name).toBe("钢柱");
  });
});

describe("price load plan", () => {
  it("按编号与名称两级匹配并计算价差", () => {
    const priceCsv = [
      "资源编号,资源名称,单价,来源",
      "labor-steel-install,,300,川价信息2026-06",
      ",Q355B 钢材,5300,川价信息2026-06",
      "no-such-id,不存在资源,1,x",
    ].join("\n");
    const parsed = parsePriceQuoteCsv(priceCsv);
    expect(parsed.errors).toEqual([]);

    const plan = createPriceLoadPlan(quantityCostingPhase2Registry, parsed.quotes);
    expect(plan.idMatchedCount).toBe(1);
    expect(plan.nameMatchedCount).toBe(1);
    expect(plan.unmatchedCount).toBe(1);

    const labor = plan.rows[0];
    expect(labor?.currentPrice).toBe(280);
    expect(labor?.priceDelta).toBe(20);
    expect(labor?.deltaRatio).toBeCloseTo(0.0714, 3);
    expect(plan.rows[2]?.selected).toBe(false);
  });

  it("应用计划更新注册表价格并生成后端载荷", () => {
    const plan = createPriceLoadPlan(quantityCostingPhase2Registry, [
      {
        resourceId: "labor-steel-install",
        name: "",
        unitPrice: 300,
        sourceRef: "川价信息2026-06",
      },
    ]);
    const applied = applyPriceLoadPlan(quantityCostingPhase2Registry, plan);
    expect(applied.appliedCount).toBe(1);
    expect(
      applied.registry.priceResources.find(
        (r) => r.resourceId === "labor-steel-install",
      ),
    ).toMatchObject({ unitPrice: 300, sourceVerified: true });
    // 原注册表不可变
    expect(
      quantityCostingPhase2Registry.priceResources.find(
        (r) => r.resourceId === "labor-steel-install",
      )?.unitPrice,
    ).toBe(280);

    const payload = buildPriceUpdatePayload(plan);
    expect(payload).toEqual([
      {
        resourceId: "labor-steel-install",
        unitPrice: 300,
        sourceRef: "川价信息2026-06",
        sourceVerified: true,
      },
    ]);
  });

  it("价格表缺匹配列时报错", () => {
    const parsed = parsePriceQuoteCsv("单价\n100");
    expect(parsed.errors[0]?.message).toContain("匹配");
  });
});
