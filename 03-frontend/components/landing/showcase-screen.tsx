import Image from "next/image";
import { useTranslations } from "next-intl";
import type { ShowcaseScreen as ShowcaseScreenData } from "@/lib/insome/types";
import { cn } from "@/lib/insome/ui";

export interface ShowcaseScreenProps {
  readonly screen: ShowcaseScreenData;
  readonly dark?: boolean;
}

const aspectClass: Record<ShowcaseScreenData["aspect"], string> = {
  "16/10": "aspect-[16/10]",
  "4/3": "aspect-[4/3]",
  "3/2": "aspect-[3/2]",
};

export function ShowcaseScreen({ screen, dark = false }: ShowcaseScreenProps) {
  const t = useTranslations("showcase");

  return (
    <article
      className={cn(
        "relative flex flex-col overflow-hidden border snap-start w-105 shrink-0",
        dark ? "border-fg-1 bg-fg-0 text-fg-8" : "border-fg-6 bg-fg-9 text-fg-0",
      )}
    >
      <div className={cn("relative w-full", aspectClass[screen.aspect])}>
        <Image
          src={screen.svgPath}
          alt={t(screen.titleKey)}
          fill
          sizes="420px"
          className="object-cover"
        />
      </div>
      <div
        className={cn(
          "flex items-center justify-between border-t px-3.5 py-2.5 font-mono text-micro tracking-mono uppercase",
          dark ? "border-fg-1 text-fg-3" : "border-fg-6 text-fg-3",
        )}
      >
        <span>{t(screen.titleKey)}</span>
        <span aria-hidden>→</span>
      </div>
    </article>
  );
}
