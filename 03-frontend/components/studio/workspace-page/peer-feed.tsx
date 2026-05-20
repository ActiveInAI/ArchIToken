"use client";

import { useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import { mockWorks, type Work } from "@/content/works.mock";
import { WorkCard } from "@/components/shared/work-card";
import { WorkDetailDialog } from "@/components/shared/work-detail-dialog";

export function PeerFeed() {
  const tPeer = useTranslations("workspace.studio.peer");
  const [openId, setOpenId] = useState<string | null>(null);

  const weeklyHot = useMemo(
    () => [...mockWorks].sort((a, b) => b.likes - a.likes).slice(0, 8),
    [],
  );
  const newDesigners = useMemo(
    () =>
      mockWorks
        .filter((w) => !w.creator.isHomeowner && w.creator.level <= 2)
        .slice(0, 6),
    [],
  );

  const work = mockWorks.find((w) => w.id === openId) ?? null;

  return (
    <div className="flex flex-col gap-10">
      <Row title={tPeer("weeklyHot")} works={weeklyHot} onOpen={setOpenId} />
      <Row title={tPeer("newDesigners")} works={newDesigners} onOpen={setOpenId} />
      <WorkDetailDialog
        work={work}
        open={openId !== null}
        theme="dark"
        onOpenChange={(o) => !o && setOpenId(null)}
      />
    </div>
  );
}

function Row({
  title,
  works,
  onOpen,
}: {
  title: string;
  works: ReadonlyArray<Work>;
  onOpen: (id: string) => void;
}) {
  return (
    <section>
      <h2 className="mb-3 font-mono text-micro tracking-eyebrow uppercase text-fg-4">{title}</h2>
      <div className="flex gap-4 overflow-x-auto pb-3 [scrollbar-width:thin]">
        {works.map((w) => (
          <div key={w.id} className="w-64 shrink-0">
            <WorkCard work={w} theme="dark" onOpen={onOpen} />
          </div>
        ))}
      </div>
    </section>
  );
}
