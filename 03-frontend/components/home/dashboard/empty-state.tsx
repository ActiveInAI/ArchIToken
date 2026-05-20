import { useTranslations } from "next-intl";
import { EmptyIllustration } from "@/components/shared/empty-illustration";

export function DashboardEmptyState() {
  const t = useTranslations("home.dashboard");
  const tEmpty = useTranslations("empty.dashboard");

  return (
    <div className="flex flex-col items-start gap-4 border border-dashed border-fg-6 bg-fg-9 p-10">
      <EmptyIllustration variant="no-projects" accent="signal" size={72} />
      <div className="eyebrow">{t("eyebrow")}</div>
      <div className="font-display text-h3 font-bold tracking-tight text-fg-0">
        {tEmpty("title")}
      </div>
      <p className="max-w-[48ch] text-body text-fg-2">{tEmpty("description")}</p>
    </div>
  );
}
