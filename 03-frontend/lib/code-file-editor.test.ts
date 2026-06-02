// lib/code-file-editor.test.ts - Code editor policy contract tests
// License: Apache-2.0

import { describe, expect, it } from "vitest";
import {
  codeEditorProfileForFileName,
  codeEditingRuntimeReferences,
  codeEditingRuntimeVersions,
  formatCodeEditorContent,
  isInlineEditableCodeFile,
  mimeTypeForCodeEditorContent,
  monacoLanguageIdForCodeEditorProfile,
  validateCodeEditorContent,
} from "./code-file-editor";

describe("code file editor policy", () => {
  it("marks common source, markup, config, and exact-name files editable", () => {
    for (const name of [
      "index.html",
      "schema.xml",
      "README.md",
      "package.json",
      "config.yaml",
      "Cargo.toml",
      "main.rs",
      "component.tsx",
      "script.js",
      ".gitignore",
      "Dockerfile",
    ]) {
      expect(
        isInlineEditableCodeFile({
          originalName: name,
          ext: name.includes(".") ? name.slice(name.lastIndexOf(".")) : "",
          mimeType: "text/plain",
        }),
        name,
      ).toBe(true);
    }
  });

  it("does not treat binary structured containers as inline text", () => {
    expect(
      isInlineEditableCodeFile({
        originalName: "payload.avro",
        ext: ".avro",
        mimeType: "application/octet-stream",
      }),
    ).toBe(false);
  });

  it("detects editor profiles and MIME types for registered formats", () => {
    expect(codeEditorProfileForFileName("main.rs").label).toBe("Rust");
    expect(codeEditorProfileForFileName("view.tsx").languageId).toBe(
      "typescript",
    );
    expect(codeEditorProfileForFileName("Cargo.toml").label).toBe("TOML");
    expect(mimeTypeForCodeEditorContent({ name: "config.yaml" })).toContain(
      "application/yaml",
    );
  });

  it("pins the selected code editing runtimes", () => {
    expect(codeEditingRuntimeVersions).toEqual({
      monacoEditor: "0.55.1",
      codeServer: "4.121.0",
      treeSitter: "0.26.9",
    });
    expect(codeEditingRuntimeReferences.map((item) => item.id)).toEqual([
      "monaco-editor",
      "code-server",
      "tree-sitter",
    ]);
  });

  it("maps internal profiles to Monaco language ids", () => {
    expect(
      monacoLanguageIdForCodeEditorProfile(
        codeEditorProfileForFileName("events.jsonl"),
      ),
    ).toBe("json");
    expect(
      monacoLanguageIdForCodeEditorProfile(
        codeEditorProfileForFileName("build.rs"),
      ),
    ).toBe("rust");
    expect(
      monacoLanguageIdForCodeEditorProfile(
        codeEditorProfileForFileName("Dockerfile"),
      ),
    ).toBe("dockerfile");
  });

  it("validates and formats JSON-like source safely", () => {
    expect(
      validateCodeEditorContent("package.json", '{"name":"demo"}'),
    ).toMatchObject({ status: "passed" });
    expect(validateCodeEditorContent("broken.json", '{"name":')).toMatchObject({
      status: "failed",
    });
    expect(formatCodeEditorContent("package.json", '{"name":"demo"}')).toBe(
      '{\n  "name": "demo"\n}\n',
    );
  });

  it("validates JSONL line by line", () => {
    expect(
      validateCodeEditorContent("events.jsonl", '{"a":1}\n{"b":2}'),
    ).toMatchObject({ status: "passed" });
    expect(
      validateCodeEditorContent("events.jsonl", '{"a":1}\nnope'),
    ).toMatchObject({ status: "failed" });
  });
});
