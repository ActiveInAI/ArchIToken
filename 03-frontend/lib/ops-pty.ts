// lib/ops-pty.ts
// License: Apache-2.0
// 运维中心交互式终端：用 node-pty 维护真实的伪终端会话（vim/top 等全屏程序可用）。
// 会话挂在 globalThis 上，确保 dev 模式 HMR 重载后不丢失。
import * as pty from "node-pty";
import os from "node:os";

interface PtySession {
  id: string;
  proc: pty.IPty;
  buffer: string[];
  subscribers: Set<(data: string) => void>;
  lastActive: number;
  exited: boolean;
}

interface PtyStore {
  sessions: Map<string, PtySession>;
  counter: number;
  reaper?: ReturnType<typeof setInterval>;
}

const store: PtyStore = ((globalThis as Record<string, unknown>).__opsPtyStore ??= {
  sessions: new Map<string, PtySession>(),
  counter: 0,
}) as PtyStore;

const MAX_BUFFER_CHUNKS = 4000;
const IDLE_TIMEOUT_MS = 30 * 60 * 1000;

if (!store.reaper) {
  store.reaper = setInterval(() => {
    const now = Date.now();
    for (const session of store.sessions.values()) {
      if (now - session.lastActive > IDLE_TIMEOUT_MS) killSession(session.id);
    }
  }, 60 * 1000);
  // 不阻止进程退出
  store.reaper.unref?.();
}

export function createSession(opts: { cwd?: string; cols?: number; rows?: number } = {}): string {
  store.counter += 1;
  const id = `pty-${store.counter}-${process.pid}`;
  const shell = process.env.SHELL || "bash";
  const proc = pty.spawn(shell, [], {
    name: "xterm-256color",
    cols: opts.cols ?? 80,
    rows: opts.rows ?? 24,
    cwd: opts.cwd || os.homedir(),
    env: process.env as Record<string, string>,
  });
  const session: PtySession = {
    id,
    proc,
    buffer: [],
    subscribers: new Set(),
    lastActive: Date.now(),
    exited: false,
  };
  proc.onData((data) => {
    session.buffer.push(data);
    if (session.buffer.length > MAX_BUFFER_CHUNKS) session.buffer.shift();
    for (const sub of session.subscribers) {
      try {
        sub(data);
      } catch {
        /* ignore subscriber error */
      }
    }
  });
  proc.onExit(() => {
    session.exited = true;
    const bye = "\r\n[33m[会话已结束][0m\r\n";
    for (const sub of session.subscribers) {
      try {
        sub(bye);
      } catch {
        /* ignore */
      }
    }
  });
  store.sessions.set(id, session);
  return id;
}

export function writeSession(id: string, data: string): boolean {
  const session = store.sessions.get(id);
  if (!session || session.exited) return false;
  session.proc.write(data);
  session.lastActive = Date.now();
  return true;
}

export function resizeSession(id: string, cols: number, rows: number): boolean {
  const session = store.sessions.get(id);
  if (!session || session.exited) return false;
  try {
    session.proc.resize(Math.max(2, cols), Math.max(2, rows));
  } catch {
    return false;
  }
  return true;
}

export function killSession(id: string): boolean {
  const session = store.sessions.get(id);
  if (!session) return false;
  try {
    session.proc.kill();
  } catch {
    /* already dead */
  }
  store.sessions.delete(id);
  return true;
}

export function subscribe(id: string, cb: (data: string) => void): (() => void) | null {
  const session = store.sessions.get(id);
  if (!session) return null;
  session.subscribers.add(cb);
  session.lastActive = Date.now();
  return () => {
    session.subscribers.delete(cb);
  };
}

export function replay(id: string): string {
  const session = store.sessions.get(id);
  return session ? session.buffer.join("") : "";
}

export function hasSession(id: string): boolean {
  return store.sessions.has(id);
}

export function listSessions() {
  return Array.from(store.sessions.values()).map((session) => ({
    id: session.id,
    exited: session.exited,
    lastActive: session.lastActive,
  }));
}
