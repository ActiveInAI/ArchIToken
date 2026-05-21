"use client";

import { useEffect, useMemo, use } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { getWorkById } from "@/content/works.mock";
import { PageThemeMount } from "@/components/shared/page-theme-mount";
import { ShowcaseShell } from "@/components/home/showcase-page/showcase-shell";
import { StudioShowcaseNav } from "@/components/studio/showcase-page/studio-showcase-nav";
import { StudioInfoCard } from "@/components/studio/showcase-page/studio-info-card";
import { StudioChatPanel } from "@/components/studio/editor/studio-chat-panel";
import { CanvasPanel } from "@/components/home/workspace/canvas-panel";
import { useFloorplanStore } from "@/stores/floorplan.store";

interface PageProps {
  readonly params: Promise<{ workId: string }>;
}

export default function StudioWorkPage({ params }: PageProps) {
  const { workId } = use(params);
  const tNotFound = useTranslations("showcase.studio.notFound");
  const setVariant = useFloorplanStore((s) => s.setVariant);

  const work = useMemo(() => getWorkById(workId), [workId]);

  useEffect(() => {
    if (work?.floorplan) setVariant(work.floorplan.id);
  }, [work, setVariant]);

  if (!work) {
    return (
      <>
        <PageThemeMount theme="dark" />
        <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-fg-0 px-6 text-fg-8">
          <h1 className="font-display text-h1 font-extrabold tracking-tight text-fg-9">
            {tNotFound("title")}
          </h1>
          <p className="text-body text-fg-4">{tNotFound("description")}</p>
          <Link
            href="/app/modules/concept_design"
            className="border border-accent-lime bg-accent-lime px-5 py-2.5 font-mono text-small tracking-eyebrow uppercase text-fg-0 transition-opacity hover:opacity-90"
          >
            ← {tNotFound("back")}
          </Link>
        </main>
      </>
    );
  }

  const title = work.name;

  return (
    <>
      <PageThemeMount theme="dark" />
      <ShowcaseShell
        theme="dark"
        nav={<StudioShowcaseNav title={title} />}
        chat={<StudioChatPanel />}
        canvas={<CanvasPanel />}
        info={
          <StudioInfoCard
            workId={work.id}
            {...(work.floorplan ? { floorplan: work.floorplan } : {})}
            priceMinWan={work.estimatedPriceMinWan}
            priceMaxWan={work.estimatedPriceMaxWan}
            constructionDays={work.constructionDays}
            savingsPercent={work.savingsPercent}
          />
        }
      />
    </>
  );
}
