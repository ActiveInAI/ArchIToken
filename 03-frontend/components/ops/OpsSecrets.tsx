// components/ops/OpsSecrets.tsx
// License: Apache-2.0
// 密钥/配置中心：集中发现散落的 .env 文件，脱敏查看，显示明文后编辑/新增/删除并补丁式写回。
"use client";

import { useEffect, useState } from "react";
import { Button, Empty, Input, Segmented, Spin, Tag } from "@/components/pan-ui";
import { Eye, EyeOff, KeyRound, Plus, RefreshCcw, Save, Trash2, X } from "lucide-react";

type SecretCategory = "key" | "api" | "port" | "other";

// 按键名把 .env 条目归类：密钥/凭据、API 端点、端口/连接、其他
function classify(key: string): SecretCategory {
  const k = key.toUpperCase();
  if (k === "PORT" || /_PORT$/.test(k)) return "port";
  if (/(SECRET|TOKEN|PASSWORD|_API_KEY$|_KEY$|_ACCESS_KEY$|CREDENTIAL|_PWD$)/.test(k))
    return "key";
  if (/(_URL$|_BASE_URL$|_ENDPOINT$|_URI$|_HOST$|^HOST$|_DOMAIN$|URL|ENDPOINT|URI)/.test(k))
    return "api";
  return "other";
}

const CATEGORIES: Array<{ value: SecretCategory; label: string; color: string }> = [
  { value: "key", label: "🔑 密钥/凭据", color: "text-rose-600 bg-rose-50" },
  { value: "api", label: "🌐 API 端点", color: "text-sky-600 bg-sky-50" },
  { value: "port", label: "🔌 端口/连接", color: "text-emerald-600 bg-emerald-50" },
  { value: "other", label: "其他", color: "text-slate-500 bg-slate-100" },
];

interface SecretFile {
  path: string;
  size: number;
  keyCount: number;
  mtime: number;
}
interface Row {
  key: string;
  value: string;
  deleted?: boolean;
  isNew?: boolean;
  dirty?: boolean;
}

export function OpsSecrets() {
  const [files, setFiles] = useState<SecretFile[] | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [revealed, setRevealed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<SecretCategory | "all">("all");

  const loadFiles = async () => {
    try {
      const response = await fetch("/api/ops-center/secrets", { cache: "no-store" });
      const data = (await response.json()) as { files?: SecretFile[]; error?: string };
      if (data.error) throw new Error(data.error);
      setFiles(data.files ?? []);
    } catch (error) {
      setErr(error instanceof Error ? error.message : "加载失败");
      setFiles([]);
    }
  };

  useEffect(() => {
    let active = true;
    fetch("/api/ops-center/secrets", { cache: "no-store" })
      .then((response) => response.json())
      .then((data: { files?: SecretFile[]; error?: string }) => {
        if (!active) return;
        if (data.error) throw new Error(data.error);
        setFiles(data.files ?? []);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setErr(error instanceof Error ? error.message : "加载失败");
        setFiles([]);
      });
    return () => {
      active = false;
    };
  }, []);

  const openFile = async (filePath: string, reveal = false) => {
    setLoading(true);
    setErr(null);
    setMsg(null);
    try {
      const response = await fetch(
        `/api/ops-center/secrets?file=${encodeURIComponent(filePath)}${reveal ? "&reveal=1" : ""}`,
        { cache: "no-store" },
      );
      const data = (await response.json()) as {
        entries?: Array<{ key: string; value: string }>;
        error?: string;
      };
      if (data.error) throw new Error(data.error);
      setActive(filePath);
      setRevealed(reveal);
      setRows((data.entries ?? []).map((entry) => ({ key: entry.key, value: entry.value })));
    } catch (error) {
      setErr(error instanceof Error ? error.message : "读取失败");
    } finally {
      setLoading(false);
    }
  };

  const updateRow = (index: number, patch: Partial<Row>) => {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch, dirty: true } : row)));
  };

  const save = async () => {
    if (!active) return;
    const changes = rows
      .filter((row) => row.dirty || row.deleted || row.isNew)
      .filter((row) => row.key.trim().length > 0)
      .map((row) => ({ key: row.key.trim(), value: row.value, deleted: row.deleted }));
    if (changes.length === 0) {
      setMsg("没有改动");
      return;
    }
    if (!revealed && changes.some((change) => !change.deleted)) {
      setErr("请先点「显示明文」再编辑，否则会把脱敏串写回文件。");
      return;
    }
    setLoading(true);
    setErr(null);
    try {
      const response = await fetch("/api/ops-center/secrets", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ file: active, changes }),
      });
      const data = (await response.json()) as { ok?: boolean; error?: string };
      if (data.error) throw new Error(data.error);
      setMsg(`已保存 ${changes.length} 项改动到 ${active}`);
      await openFile(active, revealed);
      await loadFiles();
    } catch (error) {
      setErr(error instanceof Error ? error.message : "保存失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 gap-3">
      {/* 文件列表 */}
      <div className="flex w-64 shrink-0 flex-col gap-2 overflow-auto rounded-md border border-slate-100 p-2">
        <div className="flex items-center justify-between px-1">
          <span className="arch-muted text-[11px]">{files?.length ?? 0} 个配置文件</span>
          <Button size="small" type="text" icon={<RefreshCcw className="h-3.5 w-3.5" />} onClick={() => void loadFiles()} />
        </div>
        {files === null ? (
          <Spin size="small" tip="扫描中…" />
        ) : files.length === 0 ? (
          <Empty description="未发现 .env 文件" />
        ) : (
          files.map((file) => (
            <button
              key={file.path}
              type="button"
              onClick={() => void openFile(file.path)}
              className={
                "flex flex-col rounded-md border px-2 py-1.5 text-left text-xs transition " +
                (active === file.path
                  ? "border-emerald-200 bg-emerald-50"
                  : "border-slate-100 hover:border-emerald-200 hover:bg-emerald-50/40")
              }
            >
              <span className="truncate font-medium text-slate-700" title={file.path}>
                {file.path}
              </span>
              <span className="arch-muted text-[10px]">{file.keyCount} 个键</span>
            </button>
          ))
        )}
      </div>

      {/* 编辑区 */}
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        {!active ? (
          <Empty description="选择左侧文件查看与编辑密钥" />
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Tag color="green" icon={<KeyRound className="h-3.5 w-3.5" />}>
                {active}
              </Tag>
              <Button
                size="small"
                icon={revealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                onClick={() => void openFile(active, !revealed)}
              >
                {revealed ? "脱敏" : "显示明文"}
              </Button>
              <span className="ml-auto flex items-center gap-1">
                <Button
                  size="small"
                  icon={<Plus className="h-4 w-4" />}
                  onClick={() => setRows((prev) => [...prev, { key: "", value: "", isNew: true, dirty: true }])}
                >
                  新增键
                </Button>
                <Button type="primary" size="small" icon={<Save className="h-4 w-4" />} loading={loading} onClick={() => void save()}>
                  保存
                </Button>
              </span>
            </div>

            {err ? (
              <div className="flex items-center gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs text-rose-700">
                {err}
                <button type="button" className="ml-auto" onClick={() => setErr(null)}>
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : msg ? (
              <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs text-emerald-700">
                {msg}
              </div>
            ) : null}

            <Segmented
              options={[
                { label: `全部 ${rows.length}`, value: "all" as SecretCategory | "all" },
                ...CATEGORIES.map((cat) => ({
                  label: `${cat.label} ${rows.filter((row) => classify(row.key) === cat.value).length}`,
                  value: cat.value as SecretCategory | "all",
                })),
              ]}
              value={categoryFilter}
              onChange={setCategoryFilter}
            />

            <div className="min-h-0 flex-1 space-y-3 overflow-auto">
              {CATEGORIES.filter(
                (cat) => categoryFilter === "all" || categoryFilter === cat.value,
              ).map((cat) => {
                const items = rows
                  .map((row, index) => ({ row, index }))
                  .filter(({ row }) => classify(row.key) === cat.value);
                if (items.length === 0) return null;
                return (
                  <div key={cat.value} className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span
                        className={
                          "inline-flex items-center rounded px-2 py-0.5 text-[11px] font-medium " + cat.color
                        }
                      >
                        {cat.label}
                      </span>
                      <span className="arch-muted text-[10px]">{items.length} 项</span>
                    </div>
                    {items.map(({ row, index }) => (
                      <div
                        key={`${row.key}-${index}`}
                        className={"flex items-center gap-2 " + (row.deleted ? "opacity-40" : "")}
                      >
                        <div className="w-1/3 shrink-0">
                          <Input
                            size="small"
                            value={row.key}
                            placeholder="KEY"
                            disabled={!row.isNew}
                            onChange={(event) => updateRow(index, { key: event.target.value })}
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <Input
                            size="small"
                            value={row.value}
                            placeholder={revealed ? "value" : "（脱敏，点显示明文后可编辑）"}
                            disabled={!revealed && !row.isNew}
                            onChange={(event) => updateRow(index, { value: event.target.value })}
                          />
                        </div>
                        <button
                          type="button"
                          title={row.deleted ? "撤销删除" : "删除"}
                          onClick={() => updateRow(index, { deleted: !row.deleted })}
                          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-slate-100 text-slate-400 hover:border-rose-200 hover:text-rose-500"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
