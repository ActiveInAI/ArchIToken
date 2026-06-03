// app/app/database-manager/page.tsx
// License: Apache-2.0

import type { Metadata } from "next";
import { DatabaseManagerWorkbench } from "@/components/DatabaseManagerWorkbench";

export const metadata: Metadata = {
  title: "数据库管理器 · ArchIToken",
  description:
    "ArchIToken Database Manager unified runtime inventory and read-only database operations.",
};

export default function DatabaseManagerPage() {
  return <DatabaseManagerWorkbench />;
}
