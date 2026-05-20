"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useTranslations } from "next-intl";
import { Upload, X, Check } from "lucide-react";
import type { Floorplan } from "@/lib/insome/floorplan";
import { cn } from "@/lib/insome/ui";
import { usePublishWork } from "@/lib/publish-work";

interface PublishButtonProps {
  readonly workId: string;
  readonly floorplan?: Floorplan | undefined;
  readonly theme?: "light" | "dark";
}

export function PublishButton({ workId, floorplan, theme = "light" }: PublishButtonProps) {
  const tDialog = useTranslations("publish.dialog");
  const tAction = useTranslations("showcase.home.action");
  const { publish } = usePublishWork();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const onDark = theme === "dark";

  const handleSubmit = async () => {
    if (!title.trim()) return;
    setSubmitting(true);
    try {
      await publish({
        title: title.trim(),
        description: description.trim(),
        ...(floorplan ? { floorplan } : {}),
      });
      setDone(true);
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setTitle("");
      setDescription("");
      setDone(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={handleClose}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          className={cn(
            "flex items-center justify-center gap-2 px-4 py-2.5 font-mono text-small tracking-eyebrow uppercase transition-colors",
            onDark
              ? "border border-fg-2 bg-fg-1 text-fg-8 hover:border-accent-lime hover:text-accent-lime"
              : "border border-fg-2 bg-fg-9 text-fg-0 hover:border-accent-signal hover:text-accent-signal",
          )}
        >
          <Upload size={14} aria-hidden /> {tAction("publish")}
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className={cn("fixed inset-0 z-40 backdrop-blur-sm", onDark ? "bg-fg-0/80" : "bg-fg-0/70")} />
        <Dialog.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-50 flex w-[min(560px,92vw)] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 border p-6 shadow-xl",
            onDark ? "border-fg-2 bg-fg-1 text-fg-9" : "border-fg-6 bg-fg-9 text-fg-0",
          )}
        >
          <Dialog.Close
            className={cn(
              "absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center transition-opacity hover:opacity-70",
              onDark ? "border border-fg-2 bg-fg-0 text-fg-8" : "border border-fg-6 bg-fg-8 text-fg-0",
            )}
            aria-label="Close"
          >
            <X size={14} />
          </Dialog.Close>
          <Dialog.Title className={cn("font-display text-h3 font-bold tracking-tight", onDark ? "text-fg-9" : "text-fg-0")}>
            {tDialog("title")}
          </Dialog.Title>
          {done ? (
            <div className="flex flex-col items-center justify-center gap-2 py-6 text-center">
              <Check size={28} className={onDark ? "text-accent-lime" : "text-accent-signal"} />
              <span className={cn("font-display text-h4 font-bold tracking-tight", onDark ? "text-fg-9" : "text-fg-0")}>
                {tDialog("success")}
              </span>
              <span className={cn("font-mono text-micro tracking-eyebrow uppercase", onDark ? "text-fg-4" : "text-fg-3")}>
                {workId}
              </span>
            </div>
          ) : (
            <>
              <Dialog.Description className={cn("text-small", onDark ? "text-fg-4" : "text-fg-3")}>
                {tDialog("description")}
              </Dialog.Description>
              <Field label={tDialog("titleField")} onDark={onDark}>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className={cn(
                    "w-full border p-2.5 font-sans text-small focus:outline-none",
                    onDark ? "border-fg-2 bg-fg-0 text-fg-9 focus:border-accent-lime" : "border-fg-6 bg-fg-8 text-fg-0 focus:border-fg-0",
                  )}
                  placeholder={tDialog("titlePlaceholder")}
                />
              </Field>
              <Field label={tDialog("descriptionField")} onDark={onDark}>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className={cn(
                    "w-full resize-none border p-2.5 font-sans text-small focus:outline-none",
                    onDark ? "border-fg-2 bg-fg-0 text-fg-9 focus:border-accent-lime" : "border-fg-6 bg-fg-8 text-fg-0 focus:border-fg-0",
                  )}
                  placeholder={tDialog("descriptionPlaceholder")}
                />
              </Field>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!title.trim() || submitting}
                className={cn(
                  "px-4 py-2.5 font-mono text-small tracking-eyebrow uppercase transition-opacity hover:opacity-90 disabled:opacity-50",
                  onDark ? "border border-accent-lime bg-accent-lime text-fg-0" : "border border-accent-signal bg-accent-signal text-fg-9",
                )}
              >
                {submitting ? tDialog("submitting") : tDialog("submit")}
              </button>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Field({ label, onDark, children }: { label: string; onDark: boolean; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className={cn("font-mono text-micro tracking-eyebrow uppercase", onDark ? "text-fg-4" : "text-fg-3")}>{label}</span>
      {children}
    </label>
  );
}
