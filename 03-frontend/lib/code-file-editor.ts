// lib/code-file-editor.ts - Text/code editing policy helpers
// License: Apache-2.0

import { extensionOf, fileTypeForFileName } from "./file-type-registry";

export type CodeEditorDiagnosticStatus =
  | "passed"
  | "warning"
  | "failed"
  | "not_applicable";

export interface CodeEditorDiagnostic {
  status: CodeEditorDiagnosticStatus;
  label: string;
  message: string;
}

export interface CodeEditorProfile {
  languageId: string;
  label: string;
  commentPrefix?: string;
  supportsFormatting: boolean;
}

export interface CodeEditorCursorPosition {
  line: number;
  column: number;
}

export const codeEditingRuntimeVersions = {
  monacoEditor: "0.55.1",
  codeServer: "4.121.0",
  treeSitter: "0.26.9",
} as const;

export const codeEditingRuntimeReferences = [
  {
    id: "monaco-editor",
    version: codeEditingRuntimeVersions.monacoEditor,
    sourceUrl:
      "https://github.com/microsoft/monaco-editor/releases/tag/v0.55.1",
    boundary: "frontend_runtime_dependency",
  },
  {
    id: "code-server",
    version: codeEditingRuntimeVersions.codeServer,
    sourceUrl: "https://github.com/coder/code-server/releases/tag/v4.121.0",
    boundary: "isolated_sidecar_service",
  },
  {
    id: "tree-sitter",
    version: codeEditingRuntimeVersions.treeSitter,
    sourceUrl:
      "https://github.com/tree-sitter/tree-sitter/releases/tag/v0.26.9",
    boundary: "source_build_worker_or_wasm_parser",
  },
] as const;

const nonTextStructuredExtensions = new Set([
  ".avro",
  ".bson",
  ".mpack",
  ".msgpack",
]);

const inlineEditableTextExtensions = new Set([
  ".adoc",
  ".bash",
  ".bat",
  ".c",
  ".cc",
  ".cfg",
  ".cmd",
  ".conf",
  ".cpp",
  ".cs",
  ".css",
  ".csv",
  ".cxx",
  ".env",
  ".fish",
  ".go",
  ".graphql",
  ".h",
  ".hh",
  ".hpp",
  ".htm",
  ".html",
  ".ini",
  ".java",
  ".js",
  ".json",
  ".jsonc",
  ".jsonl",
  ".jsx",
  ".kt",
  ".less",
  ".lock",
  ".log",
  ".markdown",
  ".md",
  ".php",
  ".pl",
  ".proto",
  ".protobuf",
  ".ps1",
  ".py",
  ".rb",
  ".rego",
  ".rs",
  ".rst",
  ".rtf",
  ".sass",
  ".scss",
  ".sh",
  ".sql",
  ".toml",
  ".ts",
  ".tsv",
  ".tsx",
  ".txt",
  ".xml",
  ".yaml",
  ".yml",
  ".zsh",
]);

const inlineEditableExactNames = new Set([
  ".dockerignore",
  ".env",
  ".env.local",
  ".gitignore",
  "cargo.lock",
  "cargo.toml",
  "docker-compose.yml",
  "dockerfile",
  "go.mod",
  "go.sum",
  "makefile",
  "package-lock.json",
  "package.json",
  "pnpm-lock.yaml",
  "pyproject.toml",
  "tileset.json",
  "yarn.lock",
]);

const profileByExtension = new Map<string, CodeEditorProfile>([
  [".adoc", profile("asciidoc", "AsciiDoc", "//")],
  [".bash", profile("shell", "Shell", "#")],
  [".bat", profile("batch", "Batch", "REM")],
  [".c", profile("c", "C", "//")],
  [".cc", profile("cpp", "C++", "//")],
  [".cfg", profile("config", "Config", "#")],
  [".cmd", profile("batch", "Batch", "REM")],
  [".conf", profile("config", "Config", "#")],
  [".cpp", profile("cpp", "C++", "//")],
  [".cs", profile("csharp", "C#", "//")],
  [".css", profile("css", "CSS", "/*")],
  [".csv", profile("csv", "CSV", undefined)],
  [".cxx", profile("cpp", "C++", "//")],
  [".env", profile("env", "ENV", "#")],
  [".fish", profile("shell", "Fish", "#")],
  [".go", profile("go", "Go", "//")],
  [".graphql", profile("graphql", "GraphQL", "#")],
  [".h", profile("c", "C Header", "//")],
  [".hh", profile("cpp", "C++ Header", "//")],
  [".hpp", profile("cpp", "C++ Header", "//")],
  [".htm", profile("html", "HTML", "<!--")],
  [".html", profile("html", "HTML", "<!--")],
  [".ini", profile("ini", "INI", ";")],
  [".java", profile("java", "Java", "//")],
  [".js", profile("javascript", "JavaScript", "//")],
  [".json", profile("json", "JSON", undefined, true)],
  [".jsonc", profile("jsonc", "JSONC", "//")],
  [".jsonl", profile("jsonl", "JSONL", undefined, true)],
  [".jsx", profile("javascript", "JSX", "//")],
  [".kt", profile("kotlin", "Kotlin", "//")],
  [".less", profile("less", "Less", "//")],
  [".lock", profile("lockfile", "Lockfile", undefined)],
  [".log", profile("log", "Log", undefined)],
  [".markdown", profile("markdown", "Markdown", "<!--")],
  [".md", profile("markdown", "Markdown", "<!--")],
  [".php", profile("php", "PHP", "//")],
  [".pl", profile("perl", "Perl", "#")],
  [".proto", profile("protobuf", "Protocol Buffers", "//")],
  [".protobuf", profile("protobuf", "Protocol Buffers", "//")],
  [".ps1", profile("powershell", "PowerShell", "#")],
  [".py", profile("python", "Python", "#")],
  [".rb", profile("ruby", "Ruby", "#")],
  [".rego", profile("rego", "Rego", "#")],
  [".rs", profile("rust", "Rust", "//")],
  [".rst", profile("rst", "reStructuredText", "..")],
  [".rtf", profile("rtf", "RTF", undefined)],
  [".sass", profile("sass", "Sass", "//")],
  [".scss", profile("scss", "SCSS", "//")],
  [".sh", profile("shell", "Shell", "#")],
  [".sql", profile("sql", "SQL", "--")],
  [".toml", profile("toml", "TOML", "#")],
  [".ts", profile("typescript", "TypeScript", "//")],
  [".tsv", profile("tsv", "TSV", undefined)],
  [".tsx", profile("typescript", "TSX", "//")],
  [".txt", profile("text", "Text", undefined)],
  [".xml", profile("xml", "XML", "<!--")],
  [".yaml", profile("yaml", "YAML", "#")],
  [".yml", profile("yaml", "YAML", "#")],
  [".zsh", profile("shell", "Zsh", "#")],
]);

const exactNameProfile = new Map<string, CodeEditorProfile>([
  ["dockerfile", profile("dockerfile", "Dockerfile", "#")],
  ["makefile", profile("makefile", "Makefile", "#")],
]);

const monacoLanguageByProfile = new Map<string, string>([
  ["batch", "bat"],
  ["config", "plaintext"],
  ["csv", "plaintext"],
  ["env", "plaintext"],
  ["jsonc", "json"],
  ["jsonl", "json"],
  ["lockfile", "plaintext"],
  ["log", "plaintext"],
  ["makefile", "makefile"],
  ["protobuf", "proto"],
  ["rst", "restructuredtext"],
  ["shell", "shell"],
  ["tsv", "plaintext"],
  ["text", "plaintext"],
]);

export function isInlineEditableCodeFile(input: {
  name?: string;
  originalName?: string;
  ext?: string;
  mimeType?: string;
}): boolean {
  const name = (input.name ?? input.originalName ?? "").toLowerCase();
  const ext = (input.ext || extensionOf(name)).toLowerCase();
  const mimeType = (input.mimeType ?? "").toLowerCase();
  const registryEntry = fileTypeForFileName(name);

  if (nonTextStructuredExtensions.has(ext)) return false;
  if (inlineEditableExactNames.has(name)) return true;
  if (inlineEditableTextExtensions.has(ext)) return true;
  if (registryEntry?.logicalType.startsWith("code.")) return true;

  return (
    mimeType.startsWith("text/") ||
    mimeType.includes("json") ||
    mimeType.includes("xml") ||
    mimeType.includes("yaml") ||
    mimeType.includes("toml") ||
    mimeType.includes("javascript") ||
    mimeType.includes("typescript")
  );
}

export function codeEditorProfileForFileName(
  name: string,
  mimeType?: string,
): CodeEditorProfile {
  const normalized = name.trim().toLowerCase();
  const exactProfile = exactNameProfile.get(normalized);
  if (exactProfile) return exactProfile;

  const ext = extensionOf(normalized);
  const extensionProfile = profileByExtension.get(ext);
  if (extensionProfile) return extensionProfile;

  const mime = mimeType?.toLowerCase() ?? "";
  if (mime.includes("json")) return profileByExtension.get(".json")!;
  if (mime.includes("xml")) return profileByExtension.get(".xml")!;
  if (mime.includes("yaml")) return profileByExtension.get(".yaml")!;
  if (mime.includes("toml")) return profileByExtension.get(".toml")!;
  if (mime.includes("html")) return profileByExtension.get(".html")!;
  if (mime.includes("javascript")) return profileByExtension.get(".js")!;
  if (mime.startsWith("text/")) return profileByExtension.get(".txt")!;

  return profile("text", "Text", undefined);
}

export function monacoLanguageIdForCodeEditorProfile(
  profile: CodeEditorProfile,
): string {
  return monacoLanguageByProfile.get(profile.languageId) ?? profile.languageId;
}

export function mimeTypeForCodeEditorContent(input: {
  name: string;
  mimeType?: string;
  localMimeType?: string;
}): string {
  if (input.mimeType && input.mimeType !== "application/octet-stream") {
    return withCharset(input.mimeType);
  }
  if (
    input.localMimeType &&
    input.localMimeType !== "application/octet-stream"
  ) {
    return withCharset(input.localMimeType);
  }

  const profile = codeEditorProfileForFileName(input.name);
  switch (profile.languageId) {
    case "csv":
      return "text/csv; charset=utf-8";
    case "html":
      return "text/html; charset=utf-8";
    case "javascript":
      return "text/javascript; charset=utf-8";
    case "json":
    case "jsonc":
      return "application/json; charset=utf-8";
    case "jsonl":
      return "application/x-ndjson; charset=utf-8";
    case "markdown":
      return "text/markdown; charset=utf-8";
    case "toml":
      return "application/toml; charset=utf-8";
    case "tsv":
      return "text/tab-separated-values; charset=utf-8";
    case "xml":
      return "application/xml; charset=utf-8";
    case "yaml":
      return "application/yaml; charset=utf-8";
    default:
      return "text/plain; charset=utf-8";
  }
}

export function validateCodeEditorContent(
  fileName: string,
  content: string,
): CodeEditorDiagnostic {
  const profile = codeEditorProfileForFileName(fileName);

  if (!content.trim()) {
    return {
      status: "warning",
      label: "空文件",
      message: "当前内容为空，可以保存为受控版本。",
    };
  }

  try {
    if (profile.languageId === "json") {
      JSON.parse(content);
      return passed("JSON 结构有效。");
    }
    if (profile.languageId === "jsonl") {
      validateJsonLines(content);
      return passed("JSONL 每行结构有效。");
    }
    if (profile.languageId === "jsonc") {
      JSON.parse(stripJsonComments(content));
      return passed("JSONC 去注释后结构有效。");
    }
  } catch (error) {
    return {
      status: "failed",
      label: "结构错误",
      message: error instanceof Error ? error.message : String(error),
    };
  }

  if (profile.languageId === "yaml" && /^\t+/m.test(content)) {
    return {
      status: "warning",
      label: "YAML 缩进",
      message: "YAML 缩进中出现 Tab，建议改为空格后再提交规则校验。",
    };
  }

  if (profile.languageId === "toml") {
    return validateTomlShape(content);
  }

  if (profile.languageId === "xml" || profile.languageId === "html") {
    return validateMarkupShape(profile.languageId, content);
  }

  return {
    status: "not_applicable",
    label: "文本编辑",
    message: "语法/LSP/Schema 校验应由后端 worker 或专业规则执行。",
  };
}

export function formatCodeEditorContent(
  fileName: string,
  content: string,
): string | null {
  const profile = codeEditorProfileForFileName(fileName);
  if (profile.languageId === "json") {
    return `${JSON.stringify(JSON.parse(content), null, 2)}\n`;
  }
  if (profile.languageId === "jsonl") {
    return content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.stringify(JSON.parse(line)))
      .join("\n")
      .concat("\n");
  }
  return null;
}

export function codeEditorLineCount(content: string): number {
  return content.length === 0 ? 1 : content.split(/\r?\n/).length;
}

export function cursorPositionForText(
  content: string,
  selectionStart: number,
): CodeEditorCursorPosition {
  const beforeCursor = content.slice(0, Math.max(0, selectionStart));
  const lines = beforeCursor.split(/\r?\n/);
  return {
    line: lines.length,
    column: (lines.at(-1)?.length ?? 0) + 1,
  };
}

function profile(
  languageId: string,
  label: string,
  commentPrefix?: string,
  supportsFormatting = false,
): CodeEditorProfile {
  return {
    languageId,
    label,
    ...(commentPrefix ? { commentPrefix } : {}),
    supportsFormatting,
  };
}

function withCharset(mimeType: string): string {
  return mimeType.includes("charset=")
    ? mimeType
    : `${mimeType}; charset=utf-8`;
}

function passed(message: string): CodeEditorDiagnostic {
  return {
    status: "passed",
    label: "基础校验通过",
    message,
  };
}

function validateJsonLines(content: string): void {
  content.split(/\r?\n/).forEach((line, index) => {
    if (!line.trim()) return;
    try {
      JSON.parse(line);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`第 ${index + 1} 行 JSON 无效: ${message}`);
    }
  });
}

function stripJsonComments(content: string): string {
  let output = "";
  let inString = false;
  let escaped = false;
  for (let index = 0; index < content.length; index += 1) {
    const current = content[index] ?? "";
    const next = content[index + 1] ?? "";

    if (inString) {
      output += current;
      if (escaped) {
        escaped = false;
      } else if (current === "\\") {
        escaped = true;
      } else if (current === '"') {
        inString = false;
      }
      continue;
    }

    if (current === '"') {
      inString = true;
      output += current;
      continue;
    }

    if (current === "/" && next === "/") {
      while (index < content.length && content[index] !== "\n") index += 1;
      output += "\n";
      continue;
    }

    if (current === "/" && next === "*") {
      index += 2;
      while (
        index < content.length &&
        !(content[index] === "*" && content[index + 1] === "/")
      ) {
        if (content[index] === "\n") output += "\n";
        index += 1;
      }
      index += 1;
      continue;
    }

    output += current;
  }
  return output;
}

function validateTomlShape(content: string): CodeEditorDiagnostic {
  const invalidLine = content.split(/\r?\n/).find((line) => {
    const trimmed = line.trim();
    return (
      trimmed &&
      !trimmed.startsWith("#") &&
      !trimmed.startsWith("[") &&
      !trimmed.includes("=")
    );
  });

  if (invalidLine) {
    return {
      status: "warning",
      label: "TOML 结构",
      message: `可疑行: ${invalidLine.slice(0, 80)}`,
    };
  }

  return passed("TOML 基础行结构未发现明显问题。");
}

function validateMarkupShape(
  languageId: "html" | "xml",
  content: string,
): CodeEditorDiagnostic {
  if (typeof DOMParser === "undefined") {
    return {
      status: "not_applicable",
      label: "浏览器校验",
      message: "需要浏览器 DOMParser 执行 XML/HTML 基础结构检查。",
    };
  }

  const parser = new DOMParser();
  const parsed = parser.parseFromString(
    content,
    languageId === "xml" ? "application/xml" : "text/html",
  );
  const parserError = parsed.querySelector("parsererror");
  if (parserError) {
    return {
      status: "failed",
      label: "标记结构错误",
      message: parserError.textContent?.trim().slice(0, 240) || "解析失败",
    };
  }
  return passed(`${languageId.toUpperCase()} 基础结构有效。`);
}
