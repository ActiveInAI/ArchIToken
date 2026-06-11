// lib/ops-jobs.ts
// License: Apache-2.0
// 运维中心后台任务（模型启动/拉取等）：spawn 长进程，环形缓冲日志，可订阅(SSE)、可停止。
// 任务挂在 globalThis 上，dev 模式 HMR 重载后不丢失。
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import os from "node:os";

export interface JobInfo {
  id: string;
  kind: string;
  label: string;
  status: "running" | "exited";
  exitCode: number | null;
  startedAt: number;
  port: number | null;
}

interface Job extends JobInfo {
  proc: ChildProcessWithoutNullStreams;
  buffer: string[];
  subscribers: Set<(data: string) => void>;
}

interface JobStore {
  jobs: Map<string, Job>;
  counter: number;
  reaper?: ReturnType<typeof setInterval>;
}

const store: JobStore = ((globalThis as Record<string, unknown>).__opsJobStore ??= {
  jobs: new Map<string, Job>(),
  counter: 0,
}) as JobStore;

const MAX_BUFFER = 5000;
const KEEP_EXITED_MS = 60 * 60 * 1000;

if (!store.reaper) {
  store.reaper = setInterval(() => {
    const now = Date.now();
    for (const job of store.jobs.values()) {
      if (job.status === "exited" && now - job.startedAt > KEEP_EXITED_MS) {
        store.jobs.delete(job.id);
      }
    }
  }, 5 * 60 * 1000);
  store.reaper.unref?.();
}

function broadcast(job: Job, data: string) {
  job.buffer.push(data);
  if (job.buffer.length > MAX_BUFFER) job.buffer.shift();
  for (const sub of job.subscribers) {
    try {
      sub(data);
    } catch {
      /* ignore */
    }
  }
}

export function startJob(options: {
  kind: string;
  label: string;
  command: string;
  args: string[];
  port?: number;
}): string {
  store.counter += 1;
  const id = `job-${store.counter}-${process.pid}`;
  const proc = spawn(options.command, options.args, {
    cwd: os.homedir(),
    env: process.env,
  }) as ChildProcessWithoutNullStreams;
  const job: Job = {
    id,
    kind: options.kind,
    label: options.label,
    status: "running",
    exitCode: null,
    startedAt: Date.now(),
    port: options.port ?? null,
    proc,
    buffer: [],
    subscribers: new Set(),
  };
  broadcast(job, `$ ${options.command} ${options.args.join(" ")}\n`);
  proc.stdout.on("data", (chunk: Buffer) => broadcast(job, chunk.toString()));
  proc.stderr.on("data", (chunk: Buffer) => broadcast(job, chunk.toString()));
  proc.on("error", (error) => broadcast(job, `\n[启动失败] ${error.message}\n`));
  proc.on("exit", (code) => {
    job.status = "exited";
    job.exitCode = code;
    broadcast(job, `\n[进程已退出 · 退出码 ${code}]\n`);
  });
  store.jobs.set(id, job);
  return id;
}

export function killJob(id: string): boolean {
  const job = store.jobs.get(id);
  if (!job) return false;
  try {
    job.proc.kill("SIGTERM");
  } catch {
    /* already dead */
  }
  return true;
}

export function removeJob(id: string): boolean {
  const job = store.jobs.get(id);
  if (!job) return false;
  if (job.status === "running") {
    try {
      job.proc.kill("SIGTERM");
    } catch {
      /* ignore */
    }
  }
  return store.jobs.delete(id);
}

export function listJobs(): JobInfo[] {
  return Array.from(store.jobs.values())
    .map(({ id, kind, label, status, exitCode, startedAt, port }) => ({
      id,
      kind,
      label,
      status,
      exitCode,
      startedAt,
      port,
    }))
    .sort((a, b) => b.startedAt - a.startedAt);
}

export function hasJob(id: string): boolean {
  return store.jobs.has(id);
}

export function subscribeJob(id: string, cb: (data: string) => void): (() => void) | null {
  const job = store.jobs.get(id);
  if (!job) return null;
  job.subscribers.add(cb);
  return () => {
    job.subscribers.delete(cb);
  };
}

export function replayJob(id: string): string {
  const job = store.jobs.get(id);
  return job ? job.buffer.join("") : "";
}
