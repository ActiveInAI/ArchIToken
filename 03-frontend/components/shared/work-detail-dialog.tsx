"use client";

import { useState } from "react";
import Image from "next/image";
import * as Dialog from "@radix-ui/react-dialog";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { BadgeCheck, Heart, Eye, Share2, X } from "lucide-react";
import { cn } from "@/lib/insome/ui";
import type { Work } from "@/content/works.mock";
import { ClaimDialog } from "@/components/shared/claim-dialog";

interface WorkDetailDialogProps {
  readonly work: Work | null;
  readonly open: boolean;
  readonly theme: "dark" | "light";
  readonly onOpenChange: (open: boolean) => void;
}

export function WorkDetailDialog({ work, open, theme, onOpenChange }: WorkDetailDialogProps) {
  const tDetail = useTranslations("home.work.detail");
  const tBadge = useTranslations("home.work.badge");
  const router = useRouter();
  const [claimOpen, setClaimOpen] = useState(false);
  if (!work) return null;
  const onDark = theme === "dark";
  const priceText = `${work.estimatedPriceMinWan}–${work.estimatedPriceMaxWan} 万`;

  const handleIWantSame = () => {
    onOpenChange(false);
    router.push(`/home/design/${work.id}`);
  };

  return (
    <>
      <Dialog.Root open={open} onOpenChange={onOpenChange}>
        <Dialog.Portal>
          <Dialog.Overlay className={cn("fixed inset-0 z-40 backdrop-blur-sm", onDark ? "bg-fg-0/80" : "bg-fg-0/70")} />
          <Dialog.Content
            className={cn(
              "fixed left-1/2 top-1/2 z-50 flex max-h-[90vh] w-[min(1080px,94vw)] -translate-x-1/2 -translate-y-1/2 overflow-hidden border shadow-xl",
              onDark ? "border-fg-2 bg-fg-1 text-fg-8" : "border-fg-6 bg-fg-9 text-fg-0",
            )}
          >
            <div className="grid w-full grid-cols-1 lg:grid-cols-[1.2fr_1fr]">
              <div
                className={cn(
                  "relative flex aspect-[4/3] items-center justify-center overflow-hidden bg-gradient-to-br lg:aspect-auto",
                  onDark
                    ? work.coverAccent === "warm"
                      ? "from-[#3A3530] to-[#1A1815]"
                      : work.coverAccent === "cool"
                        ? "from-[#2A3438] to-[#15191B]"
                        : "from-[#2C2C28] to-[#161614]"
                    : work.coverAccent === "warm"
                      ? "from-[#F5E6D8] to-[#D7D4CE]"
                      : work.coverAccent === "cool"
                        ? "from-[#E1ECEE] to-[#CAD3D6]"
                        : "from-[#EDECE6] to-[#D5D4CE]",
                )}
              >
                {work.thumbnail ? (
                  <Image
                    src={work.thumbnail}
                    alt={work.name}
                    fill
                    sizes="(max-width: 1024px) 100vw, 60vw"
                    className="object-cover"
                  />
                ) : (
                  <div className="w-full max-w-md p-8">
                    <svg viewBox="0 0 200 150" className="h-full w-full" aria-hidden="true">
                      <rect x="15" y="18" width="170" height="114" fill="none" stroke={onDark ? "#E5E5E5" : "#0A0A0A"} strokeWidth="1.5" />
                      {Array.from({ length: Math.min(work.bedrooms + 3, 8) }).map((_, i) => (
                        <rect
                          key={i}
                          x={22 + (i % 3) * 56}
                          y={26 + Math.floor(i / 3) * 36}
                          width="48"
                          height="32"
                          fill="none"
                          stroke={onDark ? "#E5E5E5" : "#0A0A0A"}
                          strokeWidth="1"
                          opacity={0.3 + i * 0.08}
                        />
                      ))}
                      <line x1="15" y1="75" x2="80" y2="75" stroke={onDark ? "#D4FF3A" : "#FF4B1F"} strokeWidth="3" />
                    </svg>
                  </div>
                )}
                <div className={cn("absolute bottom-4 left-4 flex items-center gap-3 font-mono text-micro tracking-eyebrow", onDark ? "text-fg-4" : "text-fg-2")}>
                  <span className="flex items-center gap-1">
                    <Heart size={12} aria-hidden /> {formatCount(work.likes)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Eye size={12} aria-hidden /> {formatCount(work.views)}
                  </span>
                  <span className="flex items-center gap-1">
                    {work.adoptedCount} {tBadge("adopted")}
                  </span>
                </div>
              </div>

              <div className="flex flex-col overflow-y-auto p-8">
                <Dialog.Close
                  className={cn(
                    "absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center transition-opacity hover:opacity-80",
                    onDark ? "border border-fg-2 bg-fg-0 text-fg-8" : "border border-fg-6 bg-fg-9 text-fg-0",
                  )}
                  aria-label="Close"
                >
                  <X size={16} />
                </Dialog.Close>

                <Dialog.Title className={cn("font-display text-h2 font-extrabold tracking-tight", onDark ? "text-fg-9" : "text-fg-0")}>
                  {work.name}
                </Dialog.Title>
                <Dialog.Description className={cn("mt-2 text-body", onDark ? "text-fg-4" : "text-fg-3")}>
                  {work.description}
                </Dialog.Description>

                <div
                  className={cn(
                    "mt-5 flex items-center gap-3 border p-3",
                    onDark ? "border-fg-2 bg-fg-0/40" : "border-fg-6 bg-fg-7/40",
                  )}
                >
                  <div
                    className={cn(
                      "flex h-10 w-10 items-center justify-center font-mono text-small font-bold",
                      onDark ? "border border-fg-2 bg-fg-1 text-fg-9" : "border border-fg-5 bg-fg-9 text-fg-0",
                    )}
                  >
                    {work.creator.name.slice(0, 1)}
                  </div>
                  <div className="flex flex-1 flex-col">
                    <div className="flex items-center gap-2">
                      <span className={cn("font-display text-body font-bold tracking-tight", onDark ? "text-fg-9" : "text-fg-0")}>
                        {work.creator.name}
                      </span>
                      {work.creator.isVerified ? (
                        <BadgeCheck size={14} className={cn(onDark ? "text-accent-lime" : "text-accent-signal")} aria-hidden />
                      ) : null}
                    </div>
                    <span className={cn("font-mono text-micro tracking-eyebrow uppercase", onDark ? "text-fg-4" : "text-fg-3")}>
                      {work.creator.isHomeowner
                        ? tBadge("homeowner")
                        : `${tBadge(`lv${work.creator.level}` as never)} · ${tBadge("designer")}`}
                    </span>
                  </div>
                </div>

                <div className={cn("mt-5 grid grid-cols-3 gap-3 border-y py-4", onDark ? "border-fg-2" : "border-fg-6")}>
                  <Stat label={tDetail("stat.area")} value={`${work.totalAreaSqm}㎡`} onDark={onDark} />
                  <Stat label={tDetail("stat.stories")} value={String(work.stories)} onDark={onDark} />
                  <Stat label={tDetail("stat.bedrooms")} value={String(work.bedrooms)} onDark={onDark} />
                </div>

                <div className="mt-5 flex flex-col gap-1">
                  <span className={cn("font-mono text-micro tracking-eyebrow uppercase", onDark ? "text-fg-4" : "text-fg-3")}>
                    {tDetail("priceLabel")}
                  </span>
                  <span className={cn("font-display text-h1 font-extrabold tracking-tight", onDark ? "text-accent-lime" : "text-accent-signal")}>
                    {priceText}
                  </span>
                  <span className={cn("font-mono text-micro", onDark ? "text-fg-4" : "text-fg-3")}>
                    {tDetail("priceDisclaimer")}
                  </span>
                </div>

                <div className={cn("mt-4 grid grid-cols-2 gap-3 text-small", onDark ? "text-fg-5" : "text-fg-2")}>
                  <span>
                    {tDetail("constructionDays")}: <strong>{work.constructionDays}</strong>
                  </span>
                  <span>
                    {tDetail("savings")}: <strong>{work.savingsPercent}%</strong>
                  </span>
                </div>

                <div className="mt-auto flex flex-col gap-3 pt-8">
                  <button
                    type="button"
                    onClick={handleIWantSame}
                    className={cn(
                      "px-4 py-3 font-mono text-small tracking-eyebrow uppercase transition-opacity hover:opacity-90",
                      onDark
                        ? "border border-accent-lime bg-accent-lime text-fg-0"
                        : "border border-accent-signal bg-accent-signal text-fg-9",
                    )}
                  >
                    ★ {tDetail("cta.iWantSame")}
                  </button>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setClaimOpen(true)}
                      className={cn(
                        "px-4 py-3 font-mono text-small tracking-eyebrow uppercase transition-colors",
                        onDark
                          ? "border border-fg-2 bg-fg-0 text-fg-8 hover:border-accent-lime hover:text-accent-lime"
                          : "border border-fg-2 bg-fg-9 text-fg-0 hover:border-accent-signal hover:text-accent-signal",
                      )}
                    >
                      {tDetail("cta.contact")}
                    </button>
                    <button
                      type="button"
                      onClick={() => navigator.clipboard?.writeText(window.location.origin + `/home/design/${work.id}?ref=share`)}
                      className={cn(
                        "flex items-center justify-center gap-2 px-4 py-3 font-mono text-small tracking-eyebrow uppercase transition-colors",
                        onDark
                          ? "border border-fg-2 bg-fg-0 text-fg-8 hover:border-fg-4"
                          : "border border-fg-2 bg-fg-9 text-fg-0 hover:border-fg-3",
                      )}
                    >
                      <Share2 size={14} aria-hidden /> {tDetail("cta.share")}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      <ClaimDialog
        open={claimOpen}
        onOpenChange={setClaimOpen}
        source="home-template"
        {...(work.floorplan ? { floorplan: work.floorplan } : {})}
        projectId={work.id}
      />
    </>
  );
}

function Stat({ label, value, onDark }: { label: string; value: string; onDark: boolean }) {
  return (
    <div className="flex flex-col gap-1">
      <span className={cn("font-mono text-micro tracking-eyebrow uppercase", onDark ? "text-fg-4" : "text-fg-3")}>{label}</span>
      <span className={cn("font-display text-h3 font-bold tracking-tight", onDark ? "text-fg-9" : "text-fg-0")}>{value}</span>
    </div>
  );
}

function formatCount(n: number): string {
  if (n >= 10_000) return `${(n / 10_000).toFixed(1)}w`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}
