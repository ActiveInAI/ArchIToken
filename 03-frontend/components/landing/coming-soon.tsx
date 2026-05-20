import Link from "next/link";
import { useTranslations } from "next-intl";

export interface ComingSoonProps {
  readonly eyebrowKey: string;
  readonly headingKey: string;
  readonly descriptionKey: string;
}

export function ComingSoon({
  eyebrowKey,
  headingKey,
  descriptionKey,
}: ComingSoonProps) {
  const t = useTranslations("landing.placeholder");

  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-landing flex-col items-start justify-center gap-6 px-10 py-20">
      <div className="eyebrow">{t(eyebrowKey)}</div>
      <h1 className="font-display text-h1 font-extrabold tracking-tight">
        {t(headingKey)}
      </h1>
      <p className="max-w-[48ch] text-body text-fg-2">{t(descriptionKey)}</p>
      <Link
        href="/"
        className="mt-4 inline-flex items-center gap-2 border border-fg-0 bg-fg-0 px-3.5 py-2 font-semibold text-fg-9 text-small transition-colors hover:bg-fg-2"
      >
        ← {t("backToLanding")}
      </Link>
    </main>
  );
}
