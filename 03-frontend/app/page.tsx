import { LandingFooter } from "@/components/landing/landing-footer";
import { LandingHero } from "@/components/landing/landing-hero";
import { PageThemeMount } from "@/components/shared/page-theme-mount";
import { SponsorMarquee } from "@/components/shared/sponsor-marquee";
import { UnifiedNav } from "@/components/shared/unified-nav";
import { WorksExplorer } from "@/components/shared/works-explorer";

export default function LandingPage() {
  return (
    <>
      <PageThemeMount theme="dark" />
      <UnifiedNav variant="landing" />
      <main className="flex flex-col bg-fg-0">
        <LandingHero />
        <SponsorMarquee theme="dark" />
        <WorksExplorer theme="dark" compactFilters />
      </main>
      <LandingFooter />
    </>
  );
}
