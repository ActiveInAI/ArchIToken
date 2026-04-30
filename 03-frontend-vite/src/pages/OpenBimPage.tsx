import { OpenBimWorkbench } from "../components/OpenBimWorkbench";
import { PageHero } from "../components/PageHero";

export function OpenBimPage() {
  return (
    <>
      <PageHero
        eyebrow="openBIM"
        title="IFC Workbench"
        summary="IFC4x3 model inspection, IDS validation, bSDD enrichment, BCF issue flows, and COBie handoff contracts."
        tags={["IFC4x3", "IDS", "bSDD", "BCF", "COBie"]}
      />
      <OpenBimWorkbench />
    </>
  );
}
