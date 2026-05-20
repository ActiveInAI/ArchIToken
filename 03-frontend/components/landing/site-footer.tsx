import { useTranslations } from "next-intl";

export function SiteFooter() {
  const t = useTranslations("landing.footer");

  return (
    <footer className="mx-auto mt-10 grid w-full max-w-landing grid-cols-1 gap-10 border-t border-fg-6 px-10 pt-20 pb-10 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr]">
      <div>
        <div className="font-display text-[64px] font-extrabold leading-[.95] tracking-tight">
          {t("taglineLine1")}
          <br />
          <mark>{t("taglineLine2")}</mark>
        </div>
        <p className="mt-6 max-w-[42ch] text-small text-fg-3">
          {t("description")}
        </p>
      </div>
      <FooterColumn title={t("product")}>
        <li>{t("productInsomeHome")}</li>
        <li>{t("productInsomeStudio")}</li>
        <li>{t("productApi")}</li>
        <li>{t("productChangelog")}</li>
      </FooterColumn>
      <FooterColumn title={t("company")}>
        <li>{t("companyAbout")}</li>
        <li>{t("companyCareers")}</li>
        <li>{t("companyPress")}</li>
        <li>{t("companyContact")}</li>
      </FooterColumn>
      <FooterColumn title={t("legal")}>
        <li>{t("legalTerms")}</li>
        <li>{t("legalPrivacy")}</li>
        <li>{t("legalSecurity")}</li>
      </FooterColumn>
    </footer>
  );
}

function FooterColumn({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h4 className="mb-4 font-mono text-micro font-semibold uppercase tracking-eyebrow text-fg-3">
        {title}
      </h4>
      <ul className="flex flex-col gap-2 text-small text-fg-2">{children}</ul>
    </div>
  );
}
