// lib/quantity-costing-expression.test.ts - Quantity expression engine tests
// License: Apache-2.0

import { describe, expect, it } from "vitest";
import {
  evaluateCostExpression,
  evaluateCostExpressionPair,
  type CostExpressionVariable,
} from "./quantity-costing-expression";

const variables: CostExpressionVariable[] = [
  { code: "JZMJ", name: "建筑面积", unit: "m2", value: 4000 },
  { code: "GCL", name: "工程量差", unit: "t", value: 1.4 },
];

describe("evaluateCostExpression", () => {
  it("计算基础四则与括号", () => {
    const result = evaluateCostExpression("25.8+1.4*(2+1)");
    expect(result.status).toBe("parsed");
    expect(result.value).toBe(30);
  });

  it("支持一元负号与幂运算", () => {
    expect(evaluateCostExpression("-2^2").value).toBe(-4);
    expect(evaluateCostExpression("(1980+120)*1").value).toBe(2100);
  });

  it("解析变量引用并记录使用情况", () => {
    const result = evaluateCostExpression("JZMJ*0.5+GCL", variables);
    expect(result.status).toBe("parsed");
    expect(result.value).toBe(2001.4);
    expect(result.usedVariables).toEqual(["JZMJ", "GCL"]);
  });

  it("未定义变量标记为待人工复核", () => {
    const result = evaluateCostExpression("JZMJ*XSJS", variables);
    expect(result.status).toBe("manual_review_required");
    expect(result.value).toBeNull();
    expect(result.missingVariables).toEqual(["XSJS"]);
  });

  it("归一化全角符号与中文乘除号", () => {
    const result = evaluateCostExpression("（２５.８＋１.４）×２");
    expect(result.status).toBe("parsed");
    expect(result.value).toBe(54.4);
  });

  it("语法错误与除零返回失败", () => {
    expect(evaluateCostExpression("25.8+*2").status).toBe("failed");
    expect(evaluateCostExpression("10/0").status).toBe("failed");
    expect(evaluateCostExpression("(1+2").status).toBe("failed");
    expect(evaluateCostExpression("").status).toBe("failed");
    expect(evaluateCostExpression("1 2").status).toBe("failed");
  });

  it("结果按工程量精度保留四位小数", () => {
    const result = evaluateCostExpression("1/3");
    expect(result.value).toBe(0.3333);
  });
});

describe("evaluateCostExpressionPair", () => {
  it("送审审定双侧求值并计算结果差", () => {
    const pair = evaluateCostExpressionPair("25.8", "25.8+1.4", variables);
    expect(pair.status).toBe("parsed");
    expect(pair.submitted.value).toBe(25.8);
    expect(pair.approved.value).toBe(27.2);
    expect(pair.resultDelta).toBe(1.4);
  });

  it("任一侧失败则整体失败且无结果差", () => {
    const pair = evaluateCostExpressionPair("25.8", "25.8+", variables);
    expect(pair.status).toBe("failed");
    expect(pair.resultDelta).toBeNull();
  });

  it("缺变量优先级低于解析失败", () => {
    const pair = evaluateCostExpressionPair("WZL*2", "25.8", variables);
    expect(pair.status).toBe("manual_review_required");
  });
});
