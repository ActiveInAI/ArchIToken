import type { ReactNode } from "react";
import { AuthContextBootstrap } from "./AuthContextBootstrap";
import { AiCommandSurface } from "@/components/AiCommandSurface";

// /app/* 嵌套布局：恢复登录身份上下文 + 全局 AI 命令界面（AI-NATIVE 主入口）。
export default function AppSectionLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <AuthContextBootstrap>
      {children}
      <AiCommandSurface />
    </AuthContextBootstrap>
  );
}
