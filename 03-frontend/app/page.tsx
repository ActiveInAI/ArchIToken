import { LandingFooter } from "@/components/landing/landing-footer";
import { LandingHero } from "@/components/landing/landing-hero";
import { PageThemeMount } from "@/components/shared/page-theme-mount";
import { SponsorMarquee } from "@/components/shared/sponsor-marquee";
import { UnifiedNav } from "@/components/shared/unified-nav";
import { WorksExplorer } from "@/components/shared/works-explorer";

const landingBusinessModules = [
  "个人中心",
  "市场客服",
  "计划管理",
  "方案设计",
  "标准族库",
  "深化设计",
  "计量造价",
  "材料物流",
  "生产制造",
  "施工管理",
  "数字孪生",
  "数字档案",
  "财务管理",
  "人力资源",
  "AI中心",
  "设置中心",
];

export default function LandingPage() {
  return (
    <>
      <PageThemeMount theme="dark" />
      <UnifiedNav variant="landing" />
      <main className="flex flex-col bg-fg-0">
        <LandingHero />
        <section className="border-y border-fg-2 bg-fg-0 px-6 py-8">
          <div className="mx-auto max-w-landing">
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {landingBusinessModules.map((moduleName) => (
                <div
                  key={moduleName}
                  className="border border-fg-2 bg-fg-1 px-4 py-3 text-center text-small font-semibold text-fg-8"
                >
                  {moduleName}
                </div>
              ))}
            </div>
          </div>
        </section>
        <SponsorMarquee theme="dark" />
        <WorksExplorer theme="dark" compactFilters />
      </main>
      <LandingFooter />
    </>
  );
}
