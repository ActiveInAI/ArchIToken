import { PageThemeMount } from "@/components/shared/page-theme-mount";
import { UnifiedNav } from "@/components/shared/unified-nav";
import { InspirationHero } from "@/components/home/inspiration-page/inspiration-hero";
import { InspirationGrid } from "@/components/home/inspiration-page/inspiration-grid";
import { LandingFooter } from "@/components/landing/landing-footer";

export default function HomePage() {
  return (
    <>
      <PageThemeMount theme="light" />
      <UnifiedNav variant="home" />
      <main className="flex flex-col bg-fg-8">
        <InspirationHero />
        <InspirationGrid />
      </main>
      <LandingFooter theme="light" />
    </>
  );
}
