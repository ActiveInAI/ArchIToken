// components/ops/OpsAgents.tsx
// License: Apache-2.0
// 智能体观测：发现 agent 项目、关联运行容器、最近活跃度，并可一键查看其容器实时日志。
"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, Empty, Spin, Tag } from "@/components/pan-ui";
import { Bot, FolderOpen, RefreshCcw, ScrollText } from "lucide-react";
import { OpsLogsDrawer } from "./OpsLogsDrawer";

interface Agent {
  name: string;
  path: string;
  exists: boolean;
  mtime: number;
  containers: string[];
  running: boolean;
}

export function OpsAgents() {
  const [agents, setAgents] = useState<Agent[] | null>(null);
  const [logsFor, setLogsFor] = useState<{ id: string; name: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/ops-center/agents", { cache: "no-store" });
      const data = (await response.json()) as { agents?: Agent[] };
      setAgents(data.agents ?? []);
    } catch {
      setAgents([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (agents === null) {
    return (
      <div className="flex flex-1 items-center justify-center py-16">
        <Spin tip="发现智能体项目…" />
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="arch-muted text-[11px]">
          {agents.filter((agent) => agent.running).length}/{agents.length} 个智能体有运行容器
        </span>
        <Button size="small" icon={<RefreshCcw className="h-4 w-4" />} onClick={() => void load()}>
          刷新
        </Button>
      </div>
      {agents.length === 0 ? (
        <Empty description="未发现智能体项目" />
      ) : (
        <div className="grid min-h-0 flex-1 content-start gap-3 overflow-auto sm:grid-cols-2 xl:grid-cols-3">
          {agents.map((agent) => (
            <div
              key={agent.path}
              className="flex flex-col gap-2 rounded-md border border-slate-100 bg-white p-3 shadow-sm"
            >
              <div className="flex items-center gap-2">
                <span
                  className={
                    "inline-flex h-8 w-8 items-center justify-center rounded-md " +
                    (agent.running ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-400")
                  }
                >
                  <Bot className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-800">{agent.name}</p>
                  <p className="arch-muted truncate font-mono text-[10px]" title={agent.path}>
                    ~/{agent.path}
                  </p>
                </div>
                <Tag color={agent.running ? "green" : "slate"} className="ml-auto">
                  {agent.running ? "运行中" : agent.exists ? "在线" : "缺失"}
                </Tag>
              </div>
              <div className="flex flex-wrap gap-1">
                {agent.containers.length === 0 ? (
                  <span className="arch-muted text-[11px]">无关联容器</span>
                ) : (
                  agent.containers.slice(0, 6).map((container) => (
                    <span
                      key={container}
                      className="max-w-full truncate rounded-full border border-slate-100 bg-slate-50 px-2 py-0.5 text-[10px] text-slate-600"
                      title={container}
                    >
                      {container}
                    </span>
                  ))
                )}
              </div>
              <div className="mt-auto flex items-center gap-1.5 pt-1">
                {agent.containers[0] ? (
                  <Button
                    size="small"
                    type="text"
                    icon={<ScrollText className="h-3.5 w-3.5" />}
                    onClick={() =>
                      setLogsFor({ id: agent.containers[0] as string, name: agent.containers[0] as string })
                    }
                  >
                    日志
                  </Button>
                ) : null}
                {agent.mtime > 0 ? (
                  <span className="arch-muted ml-auto inline-flex items-center gap-1 text-[10px]">
                    <FolderOpen className="h-3 w-3" />
                    {new Date(agent.mtime).toLocaleDateString()}
                  </span>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}

      {logsFor ? (
        <OpsLogsDrawer id={logsFor.id} name={logsFor.name} onClose={() => setLogsFor(null)} />
      ) : null}
    </div>
  );
}
