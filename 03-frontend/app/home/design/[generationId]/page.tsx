"use client";

import { useEffect, useMemo, use } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ChatProviderScope, ScriptedChatProvider } from "@/lib/chat";
import { HOME_OFF_SCRIPT_REPLY_KEY, homeChatScript } from "@/content/chat-script.home";
import { HOME_VARIANT_IDS } from "@/content/floorplan-variants.home";
import { getWorkById } from "@/content/works.mock";
import { PageThemeMount } from "@/components/shared/page-theme-mount";
import { ShowcaseShell } from "@/components/home/showcase-page/showcase-shell";
import { ShowcaseNav } from "@/components/home/showcase-page/showcase-nav";
import { InfoFloatCard } from "@/components/home/showcase-page/info-float-card";
import { ChatPanel } from "@/components/home/workspace/chat-panel";
import { CanvasPanel } from "@/components/home/workspace/canvas-panel";
import { useFloorplanStore } from "@/stores/floorplan.store";
import { useCanvasViewStore } from "@/stores/canvas-view.store";

interface PageProps {
  readonly params: Promise<{ generationId: string }>;
}

export default function HomeDesignPage({ params }: PageProps) {
  const { generationId } = use(params);
  const t = useTranslations();
  const tNotFound = useTranslations("showcase.home.notFound");

  const work = useMemo(() => getWorkById(generationId), [generationId]);

  const provider = useMemo(
    () =>
      new ScriptedChatProvider({
        script: homeChatScript,
        variantIds: HOME_VARIANT_IDS,
        translator: (key) => t(key),
        offScriptReplyKey: HOME_OFF_SCRIPT_REPLY_KEY,
      }),
    [t],
  );

  const setVariant = useFloorplanStore((s) => s.setVariant);
  const resetCanvasViews = useCanvasViewStore((s) => s.resetAll);

  useEffect(() => {
    resetCanvasViews();
  }, [generationId, resetCanvasViews]);

  useEffect(() => {
    if (work?.floorplan) setVariant(work.floorplan.id);
  }, [work, setVariant]);

  if (!work) {
    return (
      <>
        <PageThemeMount theme="light" />
        <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-fg-8 px-6 text-fg-0">
          <h1 className="font-display text-h1 font-extrabold tracking-tight">{tNotFound("title")}</h1>
          <p className="text-body text-fg-3">{tNotFound("description")}</p>
          <Link
            href="/home"
            className="border border-accent-signal bg-accent-signal px-5 py-2.5 font-mono text-small tracking-eyebrow uppercase text-fg-9 transition-opacity hover:opacity-90"
          >
            ← {tNotFound("back")}
          </Link>
        </main>
      </>
    );
  }

  const title = work.name;

  return (
    <ChatProviderScope value={provider}>
      <PageThemeMount theme="light" />
      <ShowcaseShell
        theme="light"
        nav={<ShowcaseNav title={title} />}
        chat={<ChatPanel />}
        canvas={<CanvasPanel />}
        info={
          <InfoFloatCard
            workId={work.id}
            {...(work.floorplan ? { floorplan: work.floorplan } : {})}
            priceMinWan={work.estimatedPriceMinWan}
            priceMaxWan={work.estimatedPriceMaxWan}
            constructionDays={work.constructionDays}
            savingsPercent={work.savingsPercent}
            theme="light"
          />
        }
      />
    </ChatProviderScope>
  );
}
