// components/DetailedDesignBusinessHome.tsx - Detailed-design module home tabs
// License: Apache-2.0
"use client";

import { useState } from "react";
import { ComponentBomWorkbench } from "@/components/ComponentBomWorkbench";
import { DetailedDesignSteelPlatformWorkbench } from "@/components/DetailedDesignSteelPlatformWorkbench";
import { Segmented } from "@/components/pan-ui";
import type { ModuleAuditEvent } from "@/lib/module-file-system";

type DetailedDesignView = "component_bom" | "steel_platform";

export function DetailedDesignBusinessHome({
  onAudit,
}: {
  onAudit?: (event: ModuleAuditEvent) => void;
}) {
  const [view, setView] = useState<DetailedDesignView>("component_bom");

  return (
    <div className="detailed-design-business-home">
      <div className="detailed-design-business-home__switch">
        <Segmented
          options={[
            { label: "构件BOM", value: "component_bom" },
            { label: "2D/3D深化", value: "steel_platform" },
          ]}
          value={view}
          onChange={setView}
        />
      </div>
      {view === "component_bom" ? (
        <ComponentBomWorkbench {...(onAudit ? { onAudit } : {})} />
      ) : (
        <DetailedDesignSteelPlatformWorkbench
          {...(onAudit ? { onAudit } : {})}
        />
      )}
    </div>
  );
}
