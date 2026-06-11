// components/ops/OpsJobLogsDrawer.tsx
// License: Apache-2.0
"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/pan-ui";
import { X } from "lucide-react";

export function OpsJobLogsDrawer({
  id,
  name,
  onClose,
}: {
  id: string;
  name: string;
  onClose: () => void;
}) {
  const [text, setText] = useState("");
  const boxRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setText("");
    const es = new EventSource(`/api/ops-center/jobs/stream?id=${encodeURIComponent(id)}`);
    es.onmessage = (event) => {
      const chunk = decodeURIComponent(event.data);
      setText((prev) => {
        const next = prev + chunk;
        return next.length > 200000 ? next.slice(-200000) : next;
      });
    };
    es.onerror = () => {
      /* 任务结束或断开 */
    };
    return () => es.close();
  }, [id]);

  useEffect(() => {
    boxRef.current?.scrollTo({ top: boxRef.current.scrollHeight });
  }, [text]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/30" onClick={onClose}>
      <div
        className="flex h-full w-full max-w-3xl flex-col bg-white shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <div className="min-w-0">
            <p className="arch-primary-text font-mono text-[10px]">Job Logs</p>
            <h4 className="truncate text-sm font-medium text-slate-800">{name}</h4>
          </div>
          <Button size="small" type="text" icon={<X className="h-4 w-4" />} onClick={onClose} />
        </div>
        <div ref={boxRef} className="min-h-0 flex-1 overflow-auto bg-slate-950 p-3">
          <pre className="whitespace-pre-wrap break-all font-mono text-[11px] leading-5 text-slate-200">
            {text || "等待任务输出…"}
          </pre>
        </div>
      </div>
    </div>
  );
}
