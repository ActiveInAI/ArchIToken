// lib/single-flight-server.ts - share one in-flight Promise per key
// License: Apache-2.0
//
// 同一源文件的并发派生请求共享同一个进行中的转换 Promise,避免重复启动
// 数十分钟级的真实转换进程/容器(页面刷新、多端同时打开同一文件时)。
// 键约定:`${模块前缀}:${源 checksum}:${工件}:${通道}`。

const inflight = new Map<string, Promise<unknown>>();

export function singleFlight<T>(
  key: string,
  factory: () => Promise<T>,
): Promise<T> {
  const existing = inflight.get(key);
  if (existing) return existing as Promise<T>;
  const pending = factory().finally(() => {
    inflight.delete(key);
  });
  inflight.set(key, pending as Promise<unknown>);
  return pending;
}
