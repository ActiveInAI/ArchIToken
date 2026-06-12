// components/ops/OpsLogsDrawer.tsx
// License: Apache-2.0
"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Segmented } from "@/components/pan-ui";
import { Pause, Play, X } from "lucide-react";

export function OpsLogsDrawer({
  id,
  name,
  onClose,
}: {
  id: string;
  name: string;
  onClose: () => void;
}) {
  const [lines, setLines] = useState<string[]>([]);
  const [paused, setPaused] = useState(false);
  const [connected, setConnected] = useState(false);
  const [tail, setTail] = useState(200);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const pausedRef = useRef(false);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    const es = new EventSource(
      `/api/ops-center/logs-stream?id=${encodeURIComponent(id)}&tail=${tail}`,
    );
    es.onopen = () => {
      setLines([]);
      setConnected(true);
    };
    es.onmessage = (event) => {
      if (pausedRef.current) return;
      const text = decodeURIComponent(event.data);
      setLines((prev) => {
        const next = [...prev, ...text.split("\n").filter((line) => line.length > 0)];
        return next.length > 3000 ? next.slice(-3000) : next;
      });
    };
    es.addEventListener("end", () => {
      setConnected(false);
      es.close();
    });
    es.onerror = () => setConnected(false);
    return () => es.close();
  }, [id, tail]);

  useEffect(() => {
    if (!paused) boxRef.current?.scrollTo({ top: boxRef.current.scrollHeight });
  }, [lines, paused]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/30" onClick={onClose}>
      <div
        className="flex h-full w-full max-w-3xl flex-col bg-white shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <div className="min-w-0">
            <p className="arch-primary-text font-mono text-[10px]">
              Container Logs · {connected ? "实时" : "已断开"}
            </p>
            <h4 className="truncate text-sm font-medium text-slate-800">{name}</h4>
          </div>
          <div className="flex items-center gap-2">
            <Segmented
              options={[
                { label: "100", value: 100 },
                { label: "200", value: 200 },
                { label: "500", value: 500 },
                { label: "1000", value: 1000 },
              ]}
              value={tail}
              onChange={setTail}
            />
            <Button
              size="small"
              icon={paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
              onClick={() => setPaused((value) => !value)}
            >
              {paused ? "继续" : "暂停"}
            </Button>
            <Button size="small" type="text" icon={<X className="h-4 w-4" />} onClick={onClose} />
          </div>
        </div>
        <div ref={boxRef} className="min-h-0 flex-1 overflow-auto bg-slate-950 p-3">
          <pre className="whitespace-pre-wrap break-all font-mono text-[11px] leading-5 text-slate-200">
            {lines.length ? lines.join("\n") : connected ? "等待日志输出…" : "正在连接…"}
          </pre>
        </div>
      </div>
    </div>
  );
}
