"use client";

import Image from "next/image";
import { motion } from "motion/react";
import { useTranslations } from "next-intl";
import type { Proposal } from "@/lib/insome/types";
import { cn } from "@/lib/insome/ui";
import { proposalCardHover } from "@/lib/motion-presets";
import { useStudioCreateStore } from "@/stores/studio-create.store";
import { useStudioViewStore } from "@/stores/studio-view.store";

export function ProposalsView() {
  const t = useTranslations("studio.create.proposals");
  const proposals = useStudioCreateStore((s) => s.proposals);
  const openProposal = useStudioViewStore((s) => s.openProposal);

  return (
    <div className="mx-auto flex w-full max-w-landing flex-col gap-6 px-10 py-12">
      <header>
        <div className="eyebrow text-fg-4">{t("eyebrow")}</div>
        <h1 className="mt-2 font-display text-[42px] font-extrabold tracking-tight text-fg-8">
          {t("title")}
        </h1>
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {proposals.map((p) => (
          <ProposalCard key={p.id} proposal={p} onPick={() => openProposal(p.id)} />
        ))}
      </div>
    </div>
  );
}

function ProposalCard({
  proposal,
  onPick,
}: {
  readonly proposal: Proposal;
  readonly onPick: () => void;
}) {
  const t = useTranslations("studio.create.proposals");
  return (
    <motion.button
      type="button"
      {...proposalCardHover}
      onClick={onPick}
      className={cn(
        "flex flex-col overflow-hidden border border-fg-2 bg-fg-1 text-left transition-colors hover:border-accent-lime",
      )}
    >
      <div className="flex items-center justify-between bg-accent-lime px-3 py-1.5 font-mono text-micro tracking-eyebrow uppercase text-fg-0">
        <span>Proposal {proposal.label}</span>
        <span className="font-bold">{proposal.areaSqft} ft²</span>
      </div>
      <div className="aspect-[3/2] w-full overflow-hidden bg-fg-0">
        <Image
          src={proposal.thumbnail}
          alt=""
          width={240}
          height={160}
          className="h-full w-full object-cover"
        />
      </div>
      <div className="flex flex-col gap-1.5 p-3">
        <div className="text-small text-fg-8">{t(proposal.diffKey)}</div>
        <div className="font-mono text-micro text-fg-4">
          {proposal.roomCount} {t("roomsLabel")}
        </div>
        <div className="mt-2 text-right font-mono text-micro tracking-eyebrow uppercase text-accent-lime">
          {t("select")} →
        </div>
      </div>
    </motion.button>
  );
}
