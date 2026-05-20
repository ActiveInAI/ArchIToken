"use client";

import { useState, type ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useTranslations } from "next-intl";
import type { Floorplan } from "@/lib/insome/floorplan";
import type { LeadSource, PriceEstimate } from "@/lib/insome/core";
import { useLeadProvider } from "@/lib/lead/context";

export interface ClaimDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly source: LeadSource;
  readonly floorplan?: Floorplan | null;
  readonly priceEstimate?: PriceEstimate;
  readonly projectId?: string;
  readonly trigger?: ReactNode;
}

const PHONE_REGEX = /^1[3-9]\d{9}$/;

export function ClaimDialog(props: ClaimDialogProps) {
  const { open, onOpenChange, source, floorplan, priceEstimate, projectId, trigger } = props;
  const t = useTranslations("claim");
  const provider = useLeadProvider();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setName("");
    setPhone("");
    setEmail("");
    setMessage("");
    setSubmittedId(null);
    setError(null);
  };

  const onSubmit = async () => {
    if (!name.trim()) { setError(t("errors.nameRequired")); return; }
    if (!PHONE_REGEX.test(phone.trim())) { setError(t("errors.phoneInvalid")); return; }
    setSubmitting(true);
    try {
      const result = await provider.submit({
        name: name.trim(),
        phone: phone.trim(),
        ...(email.trim() ? { email: email.trim() } : {}),
        ...(message.trim() ? { message: message.trim() } : {}),
        ...(floorplan ? { floorplanSnapshot: floorplan } : {}),
        ...(priceEstimate ? { priceEstimate } : {}),
        ...(projectId ? { projectId } : {}),
        source,
      });
      setSubmittedId(result.id);
    } catch (e) {
      setError(String(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      {trigger ? <Dialog.Trigger asChild>{trigger}</Dialog.Trigger> : null}
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-fg-9/60 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(480px,92vw)] -translate-x-1/2 -translate-y-1/2 border border-fg-2 bg-fg-0 p-6 shadow-xl">
          {submittedId ? (
            <>
              <Dialog.Title className="mb-3 font-display text-h3 font-bold tracking-tight text-fg-8">
                {t("success.title")}
              </Dialog.Title>
              <Dialog.Description className="mb-5 text-small text-fg-4">
                {t("success.description")}
              </Dialog.Description>
              <div className="flex justify-end">
                <Dialog.Close asChild>
                  <button
                    type="button"
                    className="border border-fg-2 bg-fg-0 px-4 py-2 font-mono text-micro tracking-eyebrow uppercase text-fg-4 transition-colors hover:border-accent-signal hover:text-fg-8"
                  >
                    {t("success.close")}
                  </button>
                </Dialog.Close>
              </div>
            </>
          ) : (
            <>
              <Dialog.Title className="mb-2 font-display text-h3 font-bold tracking-tight text-fg-8">
                {t("title")}
              </Dialog.Title>
              <Dialog.Description className="mb-5 text-small text-fg-4">
                {t("description")}
              </Dialog.Description>
              <div className="flex flex-col gap-3">
                <Field label={t("fields.name")} required>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="border border-fg-2 bg-fg-0 px-3 py-2 text-small text-fg-8 focus:border-accent-signal focus:outline-none"
                  />
                </Field>
                <Field label={t("fields.phone")} required>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="border border-fg-2 bg-fg-0 px-3 py-2 text-small text-fg-8 focus:border-accent-signal focus:outline-none"
                  />
                </Field>
                <Field label={t("fields.email")}>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="border border-fg-2 bg-fg-0 px-3 py-2 text-small text-fg-8 focus:border-accent-signal focus:outline-none"
                  />
                </Field>
                <Field label={t("fields.message")}>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={3}
                    className="border border-fg-2 bg-fg-0 px-3 py-2 text-small text-fg-8 focus:border-accent-signal focus:outline-none"
                  />
                </Field>
                {error ? <div className="text-micro text-accent-signal">{error}</div> : null}
                <div className="mt-3 flex justify-end gap-2">
                  <Dialog.Close asChild>
                    <button type="button" className="border border-fg-2 bg-fg-0 px-3 py-2 font-mono text-micro tracking-eyebrow uppercase text-fg-4 hover:text-fg-8">
                      {t("cancel")}
                    </button>
                  </Dialog.Close>
                  <button
                    type="button"
                    onClick={onSubmit}
                    disabled={submitting}
                    className="border border-accent-signal bg-accent-signal px-4 py-2 font-mono text-micro tracking-eyebrow uppercase text-fg-9 transition-opacity hover:opacity-90 disabled:opacity-50"
                  >
                    {submitting ? t("submitting") : t("submit")}
                  </button>
                </div>
              </div>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="font-mono text-micro tracking-eyebrow uppercase text-fg-4">
        {label}
        {required ? <span className="ml-1 text-accent-signal">*</span> : null}
      </span>
      {children}
    </label>
  );
}
