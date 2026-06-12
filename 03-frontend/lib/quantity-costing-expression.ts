import { roundQuantity } from "./quantity-costing";

export interface CostExpressionVariable {
  code: string;
  name: string;
  unit: string;
  value: number;
}

export type CostExpressionParseStatus =
  | "parsed"
  | "manual_review_required"
  | "failed";

export interface CostExpressionResult {
  expression: string;
  status: CostExpressionParseStatus;
  value: number | null;
  usedVariables: string[];
  missingVariables: string[];
  error: string | null;
}

export interface CostExpressionPairResult {
  submitted: CostExpressionResult;
  approved: CostExpressionResult;
  resultDelta: number | null;
  status: CostExpressionParseStatus;
}

type ExpressionToken =
  | { kind: "number"; value: number; raw: string }
  | { kind: "identifier"; raw: string }
  | { kind: "operator"; raw: "+" | "-" | "*" | "/" | "^" }
  | { kind: "paren"; raw: "(" | ")" };

const fullWidthReplacements: Record<string, string> = {
  "（": "(",
  "）": ")",
  "＋": "+",
  "－": "-",
  "×": "*",
  "＊": "*",
  "÷": "/",
  "／": "/",
  "．": ".",
  "，": "",
  "　": " ",
};

function normalizeExpression(expression: string): string {
  let normalized = "";
  for (const char of expression) {
    if (char in fullWidthReplacements) {
      normalized += fullWidthReplacements[char];
      continue;
    }
    const codePoint = char.codePointAt(0) ?? 0;
    if (codePoint >= 0xff10 && codePoint <= 0xff19) {
      normalized += String.fromCodePoint(codePoint - 0xff10 + 0x30);
      continue;
    }
    normalized += char;
  }
  return normalized.trim();
}

function isIdentifierChar(char: string): boolean {
  return /[A-Za-z0-9_一-鿿]/.test(char);
}

function isIdentifierStart(char: string): boolean {
  return /[A-Za-z_一-鿿]/.test(char);
}

function tokenizeExpression(expression: string): ExpressionToken[] {
  const tokens: ExpressionToken[] = [];
  let index = 0;
  while (index < expression.length) {
    const char = expression.charAt(index);
    if (char === " " || char === "\t") {
      index += 1;
      continue;
    }
    if (
      char === "+" ||
      char === "-" ||
      char === "*" ||
      char === "/" ||
      char === "^"
    ) {
      tokens.push({ kind: "operator", raw: char });
      index += 1;
      continue;
    }
    if (char === "(" || char === ")") {
      tokens.push({ kind: "paren", raw: char });
      index += 1;
      continue;
    }
    if (/[0-9.]/.test(char)) {
      let raw = "";
      while (
        index < expression.length &&
        /[0-9.]/.test(expression.charAt(index))
      ) {
        raw += expression.charAt(index);
        index += 1;
      }
      const value = Number(raw);
      if (!Number.isFinite(value) || raw === "." || raw.split(".").length > 2) {
        throw new Error(`无法识别的数字 "${raw}"`);
      }
      tokens.push({ kind: "number", value, raw });
      continue;
    }
    if (isIdentifierStart(char)) {
      let raw = "";
      while (
        index < expression.length &&
        isIdentifierChar(expression.charAt(index))
      ) {
        raw += expression.charAt(index);
        index += 1;
      }
      tokens.push({ kind: "identifier", raw });
      continue;
    }
    throw new Error(`无法识别的字符 "${char}"`);
  }
  return tokens;
}

interface ExpressionEvaluation {
  value: number;
  usedVariables: string[];
  missingVariables: string[];
}

function evaluateTokens(
  tokens: ExpressionToken[],
  variables: Map<string, number>,
): ExpressionEvaluation {
  let position = 0;
  const usedVariables = new Set<string>();
  const missingVariables = new Set<string>();

  function peek(): ExpressionToken | null {
    return tokens[position] ?? null;
  }

  function consume(): ExpressionToken {
    const token = tokens[position];
    if (!token) {
      throw new Error("计算式不完整");
    }
    position += 1;
    return token;
  }

  function parsePrimary(): number {
    const token = consume();
    if (token.kind === "number") {
      return token.value;
    }
    if (token.kind === "identifier") {
      usedVariables.add(token.raw);
      const value = variables.get(token.raw);
      if (value === undefined) {
        missingVariables.add(token.raw);
        return 0;
      }
      return value;
    }
    if (token.kind === "paren" && token.raw === "(") {
      const value = parseAdditive();
      const closing = consume();
      if (closing.kind !== "paren" || closing.raw !== ")") {
        throw new Error("括号未闭合");
      }
      return value;
    }
    throw new Error(`计算式中位置不正确的符号 "${token.raw}"`);
  }

  function parseUnary(): number {
    const token = peek();
    if (token && token.kind === "operator" && token.raw === "-") {
      consume();
      return -parseUnary();
    }
    if (token && token.kind === "operator" && token.raw === "+") {
      consume();
      return parseUnary();
    }
    return parsePower();
  }

  function parsePower(): number {
    const base = parsePrimary();
    const token = peek();
    if (token && token.kind === "operator" && token.raw === "^") {
      consume();
      return base ** parseUnary();
    }
    return base;
  }

  function parseMultiplicative(): number {
    let value = parseUnary();
    let token = peek();
    while (
      token &&
      token.kind === "operator" &&
      (token.raw === "*" || token.raw === "/")
    ) {
      consume();
      const right = parseUnary();
      if (token.raw === "/") {
        if (right === 0) {
          throw new Error("计算式存在除以 0");
        }
        value /= right;
      } else {
        value *= right;
      }
      token = peek();
    }
    return value;
  }

  function parseAdditive(): number {
    let value = parseMultiplicative();
    let token = peek();
    while (
      token &&
      token.kind === "operator" &&
      (token.raw === "+" || token.raw === "-")
    ) {
      consume();
      const right = parseMultiplicative();
      value = token.raw === "+" ? value + right : value - right;
      token = peek();
    }
    return value;
  }

  const value = parseAdditive();
  const trailing = tokens[position];
  if (trailing) {
    throw new Error(`计算式存在多余内容 "${trailing.raw}"`);
  }
  return {
    value,
    usedVariables: [...usedVariables],
    missingVariables: [...missingVariables],
  };
}

export function evaluateCostExpression(
  expression: string,
  variables: CostExpressionVariable[] = [],
): CostExpressionResult {
  const normalized = normalizeExpression(expression);
  if (normalized === "") {
    return {
      expression,
      status: "failed",
      value: null,
      usedVariables: [],
      missingVariables: [],
      error: "计算式为空",
    };
  }

  const variableMap = new Map(
    variables.map((variable) => [variable.code, variable.value]),
  );

  let tokens: ExpressionToken[];
  try {
    tokens = tokenizeExpression(normalized);
  } catch (error) {
    return {
      expression,
      status: "failed",
      value: null,
      usedVariables: [],
      missingVariables: [],
      error: error instanceof Error ? error.message : "计算式解析失败",
    };
  }

  try {
    const evaluation = evaluateTokens(tokens, variableMap);
    if (evaluation.missingVariables.length > 0) {
      return {
        expression,
        status: "manual_review_required",
        value: null,
        usedVariables: evaluation.usedVariables,
        missingVariables: evaluation.missingVariables,
        error: `引用了未定义变量: ${evaluation.missingVariables.join("、")}`,
      };
    }
    if (!Number.isFinite(evaluation.value)) {
      return {
        expression,
        status: "failed",
        value: null,
        usedVariables: evaluation.usedVariables,
        missingVariables: [],
        error: "计算结果无效",
      };
    }
    return {
      expression,
      status: "parsed",
      value: roundQuantity(evaluation.value),
      usedVariables: evaluation.usedVariables,
      missingVariables: [],
      error: null,
    };
  } catch (error) {
    return {
      expression,
      status: "failed",
      value: null,
      usedVariables: [],
      missingVariables: [],
      error: error instanceof Error ? error.message : "计算式求值失败",
    };
  }
}

export function evaluateCostExpressionPair(
  submittedExpression: string,
  approvedExpression: string,
  variables: CostExpressionVariable[] = [],
): CostExpressionPairResult {
  const submitted = evaluateCostExpression(submittedExpression, variables);
  const approved = evaluateCostExpression(approvedExpression, variables);
  const status: CostExpressionParseStatus =
    submitted.status === "failed" || approved.status === "failed"
      ? "failed"
      : submitted.status === "manual_review_required" ||
          approved.status === "manual_review_required"
        ? "manual_review_required"
        : "parsed";
  const resultDelta =
    submitted.value !== null && approved.value !== null
      ? roundQuantity(approved.value - submitted.value)
      : null;
  return { submitted, approved, resultDelta, status };
}
