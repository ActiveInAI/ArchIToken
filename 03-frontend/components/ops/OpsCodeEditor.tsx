// components/ops/OpsCodeEditor.tsx
// License: Apache-2.0
// 在线代码编辑：文件树浏览 + Monaco 编辑器 + 保存写回（限主目录内）。
"use client";

import { useEffect, useState } from "react";
import Editor, { loader } from "@monaco-editor/react";
import { Button, Empty, Spin } from "@/components/pan-ui";

// 自托管 Monaco，完全离线（静态资源在 public/monaco/vs，断网/无 CDN 也可用）
loader.config({ paths: { vs: "/monaco/vs" } });
import { ChevronRight, CornerLeftUp, File as FileIcon, Folder, RefreshCcw, Save } from "lucide-react";

interface Entry {
  name: string;
  type: "dir" | "file";
  size: number;
  path: string;
  ignored: boolean;
}
interface Listing {
  dir: string;
  parent: string | null;
  entries: Entry[];
}

function langOf(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    ts: "typescript",
    tsx: "typescript",
    js: "javascript",
    jsx: "javascript",
    mjs: "javascript",
    cjs: "javascript",
    json: "json",
    md: "markdown",
    css: "css",
    scss: "scss",
    html: "html",
    py: "python",
    go: "go",
    rs: "rust",
    sh: "shell",
    bash: "shell",
    yml: "yaml",
    yaml: "yaml",
    toml: "ini",
    env: "ini",
    sql: "sql",
    dockerfile: "dockerfile",
  };
  return map[ext] ?? "plaintext";
}

export function OpsCodeEditor() {
  const [listing, setListing] = useState<Listing | null>(null);
  const [file, setFile] = useState<{ path: string } | null>(null);
  const [content, setContent] = useState("");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const loadDir = async (dirPath: string) => {
    setErr(null);
    try {
      const response = await fetch(
        `/api/ops-center/fs?op=list&path=${encodeURIComponent(dirPath)}`,
        { cache: "no-store" },
      );
      const data = (await response.json()) as Listing & { error?: string };
      if (data.error) throw new Error(data.error);
      setListing(data);
    } catch (error) {
      setErr(error instanceof Error ? error.message : "目录加载失败");
    }
  };

  useEffect(() => {
    let active = true;
    fetch(`/api/ops-center/fs?op=list&path=`, { cache: "no-store" })
      .then((response) => response.json())
      .then((data: Listing & { error?: string }) => {
        if (!active) return;
        if (data.error) throw new Error(data.error);
        setListing(data);
      })
      .catch((error: unknown) => {
        if (active) setErr(error instanceof Error ? error.message : "目录加载失败");
      });
    return () => {
      active = false;
    };
  }, []);

  const openFile = async (entry: Entry) => {
    if (dirty && !window.confirm("当前文件有未保存改动，确认放弃？")) return;
    setErr(null);
    setMsg(null);
    try {
      const response = await fetch(
        `/api/ops-center/fs?op=read&path=${encodeURIComponent(entry.path)}`,
        { cache: "no-store" },
      );
      const data = (await response.json()) as { path: string; content: string; error?: string };
      if (data.error) throw new Error(data.error);
      setFile({ path: data.path });
      setContent(data.content);
      setDirty(false);
    } catch (error) {
      setErr(error instanceof Error ? error.message : "文件读取失败");
    }
  };

  const save = async () => {
    if (!file) return;
    setSaving(true);
    setErr(null);
    try {
      const response = await fetch("/api/ops-center/fs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ op: "write", path: file.path, content }),
      });
      const data = (await response.json()) as { ok?: boolean; path?: string; error?: string };
      if (data.error) throw new Error(data.error);
      setDirty(false);
      setMsg(`已保存 ${data.path}`);
    } catch (error) {
      setErr(error instanceof Error ? error.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 gap-3">
      {/* 文件树 */}
      <div className="flex w-72 shrink-0 flex-col gap-1 overflow-auto rounded-md border border-slate-100 p-2">
        <div className="flex items-center gap-1 px-1">
          <span className="arch-muted min-w-0 flex-1 truncate font-mono text-[11px]" title={listing?.dir}>
            {listing?.dir ?? "…"}
          </span>
          <Button size="small" type="text" icon={<RefreshCcw className="h-3.5 w-3.5" />} onClick={() => void loadDir(listing?.dir ?? "")} />
        </div>
        {listing?.parent !== null && listing?.parent !== undefined ? (
          <button
            type="button"
            onClick={() => void loadDir(listing.parent ?? "")}
            className="flex items-center gap-1.5 rounded px-2 py-1 text-left text-xs text-slate-500 hover:bg-slate-50"
          >
            <CornerLeftUp className="h-3.5 w-3.5" /> 上级目录
          </button>
        ) : null}
        {!listing ? (
          <Spin size="small" tip="加载中…" />
        ) : (
          listing.entries.map((entry) => (
            <button
              key={entry.path}
              type="button"
              onClick={() => (entry.type === "dir" ? void loadDir(entry.path) : void openFile(entry))}
              className={
                "flex items-center gap-1.5 rounded px-2 py-1 text-left text-xs transition hover:bg-emerald-50/60 " +
                (file?.path === entry.path ? "bg-emerald-50 text-emerald-700" : "text-slate-700") +
                (entry.ignored ? " opacity-50" : "")
              }
            >
              {entry.type === "dir" ? (
                <Folder className="h-3.5 w-3.5 shrink-0 text-amber-500" />
              ) : (
                <FileIcon className="h-3.5 w-3.5 shrink-0 text-slate-400" />
              )}
              <span className="min-w-0 flex-1 truncate" title={entry.name}>
                {entry.name}
              </span>
              {entry.type === "dir" ? <ChevronRight className="h-3 w-3 shrink-0 text-slate-300" /> : null}
            </button>
          ))
        )}
      </div>

      {/* 编辑器 */}
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        {!file ? (
          <Empty description="从左侧选择文件开始编辑" />
        ) : (
          <>
            <div className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate font-mono text-xs text-slate-600" title={file.path}>
                {file.path}
                {dirty ? <span className="ml-1 text-amber-500">●</span> : null}
              </span>
              {msg ? <span className="text-[11px] text-emerald-600">{msg}</span> : null}
              {err ? <span className="text-[11px] text-rose-600">{err}</span> : null}
              <Button
                type="primary"
                size="small"
                icon={<Save className="h-4 w-4" />}
                loading={saving}
                disabled={!dirty}
                onClick={() => void save()}
              >
                保存
              </Button>
            </div>
            <div className="min-h-0 flex-1 overflow-hidden rounded-md border border-slate-200">
              <Editor
                height="100%"
                theme="vs-dark"
                language={langOf(file.path)}
                value={content}
                onChange={(value) => {
                  setContent(value ?? "");
                  setDirty(true);
                  setMsg(null);
                }}
                options={{
                  fontSize: 13,
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                  tabSize: 2,
                }}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
