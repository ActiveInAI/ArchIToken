"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  fetchAuthMe,
  getBackendRequestContext,
  setBackendRequestContext,
} from "@/lib/backend-api";
import { api } from "@/lib/api";

/// 整页加载后，前端内存里的运行时上下文会重置为默认租户/项目（11111111 /
/// 22222222），而真实身份在 HttpOnly 的 architoken_access cookie 里（JS 读不
/// 到）。这里在渲染 /app/* 子页面之前，先用 /v1/auth/me（凭 cookie 解析真实
/// 身份）恢复租户/操作者/角色，并选取该租户下的真实项目作为项目上下文。
///
/// 子页面在上下文就绪后才渲染，避免项目级接口用错租户/项目导致 403/500 与
/// 面板空白；带 4s 超时兜底，服务异常时也不会卡住整页。
export function AuthContextBootstrap({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const finish = () => {
      if (!cancelled) {
        setReady(true);
      }
    };
    const fallback = setTimeout(finish, 4000);

    void (async () => {
      try {
        const me = await fetchAuthMe();
        if (cancelled) return;
        const current = getBackendRequestContext();
        setBackendRequestContext({
          ...current,
          tenantId: me.tenantId,
          actor: me.accountId,
          roles: me.runtimeRoles.length > 0 ? me.runtimeRoles : current.roles,
        });
        try {
          const projects = await api.projects.list({ pageSize: 1 });
          if (cancelled) return;
          const firstProject = projects.items[0];
          if (firstProject) {
            const ctx = getBackendRequestContext();
            setBackendRequestContext({ ...ctx, projectId: firstProject.id });
          }
        } catch {
          // 无项目或服务不可达时维持默认项目，由各页面自行处理空态
        }
      } catch {
        // 未登录或服务不可达：维持默认上下文，由中间件/接口各自处理
      } finally {
        clearTimeout(fallback);
        finish();
      }
    })();

    return () => {
      cancelled = true;
      clearTimeout(fallback);
    };
  }, []);

  if (!ready) {
    return (
      <div className="flex h-screen w-screen items-center justify-center text-sm opacity-70">
        正在载入工作区…
      </div>
    );
  }
  return <>{children}</>;
}
