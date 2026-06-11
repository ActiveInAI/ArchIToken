// lib/ops-center-fs.ts
// License: Apache-2.0
// 运维中心文件访问的统一路径安全校验：仅允许操作主目录内的文件。
import path from "node:path";
import os from "node:os";

export const OPS_ROOT = os.homedir();

export function resolveSafe(input: string): string {
  let target = input && input.trim() ? input.trim() : ".";
  // 归一化 toRel() 产生的 "~" 与 "~/x" 形式
  if (target === "~") target = ".";
  else if (target.startsWith("~/")) target = target.slice(2);
  const resolved = path.isAbsolute(target)
    ? path.resolve(target)
    : path.resolve(OPS_ROOT, target);
  if (resolved !== OPS_ROOT && !resolved.startsWith(OPS_ROOT + path.sep)) {
    throw new Error("路径越界：仅允许访问主目录内的文件");
  }
  return resolved;
}

export function toRel(absolute: string): string {
  const rel = path.relative(OPS_ROOT, absolute);
  return rel === "" ? "~" : rel;
}
