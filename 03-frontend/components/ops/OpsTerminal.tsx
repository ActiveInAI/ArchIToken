// components/ops/OpsTerminal.tsx
// License: Apache-2.0
// 基于 xterm + node-pty 的真·交互式终端：vim / top / htop 等全屏程序均可正常使用。
"use client";

import { useEffect, useRef, useState } from "react";
import "@xterm/xterm/css/xterm.css";

export function OpsTerminal() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = useState("正在连接终端…");

  useEffect(() => {
    let disposed = false;
    let sessionId: string | null = null;
    let es: EventSource | null = null;
    let cleanupFns: Array<() => void> = [];

    (async () => {
      const { Terminal } = await import("@xterm/xterm");
      const { FitAddon } = await import("@xterm/addon-fit");
      if (disposed || !containerRef.current) return;

      const term = new Terminal({
        fontSize: 13,
        fontFamily: 'ui-monospace, "JetBrains Mono", Menlo, monospace',
        cursorBlink: true,
        theme: { background: "#0f172a", foreground: "#e2e8f0" },
        scrollback: 5000,
      });
      const fit = new FitAddon();
      term.loadAddon(fit);
      term.open(containerRef.current);
      try {
        fit.fit();
      } catch {
        /* ignore */
      }

      const createRes = await fetch("/api/ops-center/pty", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ op: "create", cols: term.cols, rows: term.rows }),
      });
      const created = (await createRes.json()) as { id?: string; error?: string };
      if (disposed) {
        term.dispose();
        if (created.id) {
          void fetch("/api/ops-center/pty", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ op: "kill", id: created.id }),
          });
        }
        return;
      }
      if (!created.id) {
        setStatus(`终端创建失败：${created.error ?? "未知错误"}`);
        term.dispose();
        return;
      }
      sessionId = created.id;
      setStatus("");

      es = new EventSource(`/api/ops-center/pty/stream?id=${sessionId}`);
      es.onmessage = (event) => term.write(decodeURIComponent(event.data));

      const sendInput = (data: string) => {
        void fetch("/api/ops-center/pty", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ op: "input", id: sessionId, data }),
        });
      };
      const onData = term.onData(sendInput);
      const onResize = term.onResize(({ cols, rows }) => {
        void fetch("/api/ops-center/pty", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ op: "resize", id: sessionId, cols, rows }),
        });
      });

      const handleWindowResize = () => {
        try {
          fit.fit();
        } catch {
          /* ignore */
        }
      };
      window.addEventListener("resize", handleWindowResize);
      term.focus();

      cleanupFns = [
        () => window.removeEventListener("resize", handleWindowResize),
        () => onData.dispose(),
        () => onResize.dispose(),
        () => term.dispose(),
      ];
    })();

    return () => {
      disposed = true;
      es?.close();
      for (const fn of cleanupFns) {
        try {
          fn();
        } catch {
          /* ignore */
        }
      }
      if (sessionId) {
        void fetch("/api/ops-center/pty", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ op: "kill", id: sessionId }),
        });
      }
    };
  }, []);

  return (
    <div className="relative min-h-[440px] flex-1 overflow-hidden rounded-md bg-[#0f172a] p-2">
      {status ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center text-sm text-slate-400">
          {status}
        </div>
      ) : null}
      <div ref={containerRef} className="h-full w-full" />
    </div>
  );
}
