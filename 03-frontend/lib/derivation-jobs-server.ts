// lib/derivation-jobs-server.ts - 后台派生作业队列
// License: Apache-2.0
//
// 大文件派生(SKP→GLB 可达十余分钟、3DM→IFC 几何实测更久)若在 HTTP 请求内
// 同步等待,会让查看器无限期转圈甚至超时。本模块把派生包成进程内后台作业:
// - 同一 key 的并发请求复用同一作业(去重,不重复转换)
// - raceDerivationJob 用短窗口竞速:缓存命中/快速完成则内联返回结果(行为不变);
//   超时未完成则作业在后台继续,请求侧返回"处理中"快照供前端轮询
// - 作业成功/失败后保留一段 TTL 供轮询读取,之后清理(真实产物已落盘缓存,
//   再次请求会命中磁盘缓存秒回)
//
// 注意:这是进程内队列(非跨实例持久化)。重启后未完成作业丢失,但磁盘缓存
// 仍在,重新请求会重新发起转换。多实例部署需要外部队列,这里不做过度设计。

type DerivationJobStatus = "running" | "succeeded" | "failed";

interface DerivationJobRecord {
  key: string;
  status: DerivationJobStatus;
  startedAt: number;
  finishedAt?: number;
  error?: string;
  errorObject?: unknown;
  phase?: string;
  promise: Promise<unknown>;
  result?: unknown;
}

export interface DerivationJobSnapshot {
  status: DerivationJobStatus;
  startedAt: number;
  finishedAt?: number;
  elapsedMs: number;
  error?: string;
  phase?: string;
}

const jobs = new Map<string, DerivationJobRecord>();
const JOB_RETAIN_MS = 60_000;

export function setDerivationJobPhase(key: string, phase: string): void {
  const record = jobs.get(key);
  if (record && record.status === "running") record.phase = phase;
}

function snapshot(record: DerivationJobRecord): DerivationJobSnapshot {
  return {
    status: record.status,
    startedAt: record.startedAt,
    ...(record.finishedAt !== undefined ? { finishedAt: record.finishedAt } : {}),
    elapsedMs: (record.finishedAt ?? Date.now()) - record.startedAt,
    ...(record.error !== undefined ? { error: record.error } : {}),
    ...(record.phase !== undefined ? { phase: record.phase } : {}),
  };
}

function ensureJob<T>(
  key: string,
  runner: () => Promise<T>,
  phase?: string,
): DerivationJobRecord {
  const existing = jobs.get(key);
  // 复用进行中或刚成功的作业;失败的作业允许下次请求重新发起
  if (existing && existing.status !== "failed") return existing;

  const record: DerivationJobRecord = {
    key,
    status: "running",
    startedAt: Date.now(),
    promise: Promise.resolve(),
    ...(phase !== undefined ? { phase } : {}),
  };
  record.promise = runner()
    .then((result) => {
      record.status = "succeeded";
      record.finishedAt = Date.now();
      record.result = result;
      return result;
    })
    .catch((error: unknown) => {
      record.status = "failed";
      record.finishedAt = Date.now();
      record.error = error instanceof Error ? error.message : String(error);
      record.errorObject = error;
      throw error;
    })
    .finally(() => {
      const timer = setTimeout(() => {
        const current = jobs.get(key);
        if (current === record && current.status !== "running") {
          jobs.delete(key);
        }
      }, JOB_RETAIN_MS);
      // 不阻止进程退出
      (timer as { unref?: () => void }).unref?.();
    });
  jobs.set(key, record);
  return record;
}

export type RaceDerivationResult<T> =
  | { done: true; result: T }
  | { done: false; snapshot: DerivationJobSnapshot };

/**
 * 启动(或复用)后台派生作业,并用 timeoutMs 短窗口竞速。
 * - 窗口内完成(缓存命中/快速转换)→ { done:true, result }
 * - 仍在进行 → { done:false, snapshot }(供前端轮询显示进度)
 * - 作业失败 → 抛出原始错误(由路由转成对应错误响应)
 */
export async function raceDerivationJob<T>(
  key: string,
  runner: () => Promise<T>,
  timeoutMs: number,
  phase?: string,
): Promise<RaceDerivationResult<T>> {
  const record = ensureJob(key, runner, phase);
  if (record.status === "succeeded") {
    return { done: true, result: record.result as T };
  }
  if (record.status === "failed") {
    throw record.errorObject ?? new Error(record.error ?? "派生作业失败");
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<"timeout">((resolve) => {
    timer = setTimeout(() => resolve("timeout"), timeoutMs);
  });
  try {
    const settled = await Promise.race([
      record.promise.then(
        () => "settled" as const,
        () => "settled" as const,
      ),
      timeout,
    ]);
    if (settled === "timeout") {
      return { done: false, snapshot: snapshot(record) };
    }
    // record.status 在 await 期间被异步回调改写;读 snapshot 取最新值绕过收窄
    if (snapshot(record).status === "succeeded") {
      return { done: true, result: record.result as T };
    }
    throw record.errorObject ?? new Error(record.error ?? "派生作业失败");
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function getDerivationJob(key: string): DerivationJobSnapshot | null {
  const record = jobs.get(key);
  return record ? snapshot(record) : null;
}

/** 路由内联竞速窗口:窗口内完成则直接返回结果,否则转后台 + 202。 */
export function manifestInlineWaitMs(): number {
  const parsed = Number.parseInt(
    process.env.PANAEC_DERIVATION_INLINE_WAIT_MS ?? "",
    10,
  );
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 4000;
}

/** 统一的"处理中"202 响应(前端据此显示进度并轮询同一 URL)。 */
export function derivationProcessingResponse(
  fileId: string,
  kind: string,
  snap: DerivationJobSnapshot,
  extraHeaders: Record<string, string> = {},
): Response {
  const body = {
    schema: "architoken.derivation_processing.v1",
    status: "processing" as const,
    fileId,
    kind,
    elapsedMs: snap.elapsedMs,
    phase: snap.phase ?? "正在生成真实派生(首次转换大模型可能需要数分钟)",
    startedAt: snap.startedAt,
  };
  return new Response(JSON.stringify(body), {
    status: 202,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-architoken-derivation-status": "processing",
      "x-architoken-file-id": fileId,
      "retry-after": "3",
      ...extraHeaders,
    },
  });
}

// 测试钩子:清空注册表
export function __resetDerivationJobs(): void {
  jobs.clear();
}
