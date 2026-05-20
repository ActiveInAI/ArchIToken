"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { motion } from "motion/react";
import { BadgeCheck, Heart, Eye } from "lucide-react";
import { cn } from "@/lib/insome/ui";
import type { Work } from "@/content/works.mock";
import { proposalCardHover } from "@/lib/motion-presets";

interface WorkCardProps {
  readonly work: Work;
  readonly theme: "dark" | "light";
  readonly onOpen: (id: string) => void;
}

const ASPECT_CLASS: Record<Work["aspectRatio"], string> = {
  portrait: "aspect-[3/4]",
  landscape: "aspect-[4/3]",
  square: "aspect-square",
  tall: "aspect-[2/3]",
};

const ACCENT_CLASS: Record<Work["coverAccent"], string> = {
  warm: "from-[#F5E6D8] to-[#D7D4CE]",
  cool: "from-[#E1ECEE] to-[#CAD3D6]",
  neutral: "from-[#EDECE6] to-[#D5D4CE]",
};

const ACCENT_CLASS_DARK: Record<Work["coverAccent"], string> = {
  warm: "from-[#3A3530] to-[#1A1815]",
  cool: "from-[#2A3438] to-[#15191B]",
  neutral: "from-[#2C2C28] to-[#161614]",
};

export function WorkCard({ work, theme, onOpen }: WorkCardProps) {
  const tBadge = useTranslations("home.work.badge");
  const onDark = theme === "dark";
  const accentBg = onDark ? ACCENT_CLASS_DARK[work.coverAccent] : ACCENT_CLASS[work.coverAccent];
  const priceText = `${work.estimatedPriceMinWan}–${work.estimatedPriceMaxWan} 万`;

  return (
    <motion.button
      type="button"
      data-testid="work-card"
      onClick={() => onOpen(work.id)}
      className={cn(
        "group flex w-full break-inside-avoid flex-col text-left transition-colors",
        "border",
        onDark
          ? "border-fg-2 bg-fg-1 text-fg-8 hover:border-accent-lime"
          : "border-fg-6 bg-fg-9 text-fg-0 hover:border-accent-signal",
      )}
      whileHover={proposalCardHover.whileHover}
      transition={proposalCardHover.transition}
    >
      <div className={cn("relative w-full overflow-hidden bg-gradient-to-br", ASPECT_CLASS[work.aspectRatio], accentBg)}>
        {work.thumbnail ? (
          <Image
            src={work.thumbnail}
            alt={work.name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <WorkCoverSketch work={work} onDark={onDark} />
        )}
        {work.creator.isVerified ? (
          <div
            className={cn(
              "absolute right-3 top-3 flex items-center gap-1 px-2 py-1",
              "border font-mono text-micro tracking-eyebrow uppercase",
              onDark
                ? "border-accent-lime/60 bg-fg-0/60 text-accent-lime backdrop-blur-sm"
                : "border-fg-2 bg-fg-9/80 text-fg-0 backdrop-blur-sm",
            )}
          >
            <BadgeCheck size={12} aria-hidden />
            <span>V</span>
          </div>
        ) : null}
        {work.creator.isHomeowner ? (
          <div
            className={cn(
              "absolute left-3 top-3 px-2 py-1 font-mono text-micro tracking-eyebrow uppercase",
              onDark
                ? "border border-fg-2 bg-fg-0/60 text-fg-4 backdrop-blur-sm"
                : "border border-fg-6 bg-fg-9/80 text-fg-3 backdrop-blur-sm",
            )}
          >
            {tBadge("homeowner")}
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-2 p-4">
        <div className="flex items-baseline justify-between gap-3">
          <h3
            className={cn(
              "line-clamp-1 font-display text-h4 font-bold tracking-tight",
              onDark ? "text-fg-9" : "text-fg-0",
            )}
          >
            {work.name}
          </h3>
          <span
            className={cn(
              "shrink-0 font-mono text-micro tracking-eyebrow uppercase",
              onDark ? "text-fg-4" : "text-fg-3",
            )}
          >
            {work.totalAreaSqm}㎡
          </span>
        </div>

        <div className={cn("flex items-center gap-2 font-mono text-micro tracking-eyebrow uppercase", onDark ? "text-fg-4" : "text-fg-3")}>
          <span className="truncate">{work.creator.name}</span>
          {!work.creator.isHomeowner ? (
            <span className={cn("px-1.5 py-0.5 border", onDark ? "border-fg-3 text-fg-5" : "border-fg-5 text-fg-2")}>
              {tBadge(`lv${work.creator.level}` as never)}
            </span>
          ) : null}
        </div>

        <div className={cn("flex items-baseline justify-between border-t pt-2", onDark ? "border-fg-2" : "border-fg-6")}>
          <span
            className={cn(
              "font-display text-h4 font-bold tracking-tight",
              onDark ? "text-accent-lime" : "text-accent-signal",
            )}
          >
            {priceText}
          </span>
          <div className={cn("flex items-center gap-3 font-mono text-micro tracking-eyebrow", onDark ? "text-fg-4" : "text-fg-3")}>
            <span className="flex items-center gap-1">
              <Heart size={11} aria-hidden />
              {formatCount(work.likes)}
            </span>
            <span className="flex items-center gap-1">
              <Eye size={11} aria-hidden />
              {formatCount(work.views)}
            </span>
          </div>
        </div>
      </div>
    </motion.button>
  );
}

function formatCount(n: number): string {
  if (n >= 10_000) return `${(n / 10_000).toFixed(1)}w`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function WorkCoverSketch({ work, onDark }: { work: Work; onDark: boolean }) {
  const stroke = onDark ? "#E5E5E5" : "#0A0A0A";
  const accentStroke = onDark ? "#D4FF3A" : "#FF4B1F";
  const rooms = Math.min(work.bedrooms + 2, 7);
  const cols = work.stories >= 3 ? 4 : 3;
  return (
    <svg viewBox="0 0 200 150" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <rect x="18" y="22" width="164" height="106" fill="none" stroke={stroke} strokeWidth="1.5" />
      {Array.from({ length: rooms }).map((_, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        return (
          <rect
            key={i}
            x={26 + col * (140 / cols)}
            y={30 + row * 45}
            width={140 / cols - 8}
            height={38}
            fill="none"
            stroke={stroke}
            strokeWidth="1"
            opacity={0.35 + i * 0.08}
          />
        );
      })}
      <line x1="18" y1="75" x2="70" y2="75" stroke={accentStroke} strokeWidth="3" />
    </svg>
  );
}
