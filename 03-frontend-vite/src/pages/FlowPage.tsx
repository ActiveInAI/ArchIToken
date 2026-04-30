import { PageHero } from "../components/PageHero";

export function FlowPage() {
  return (
    <>
      <PageHero
        eyebrow="Process Runtime"
        title="Flow"
        summary="Flow diagram shell for process graphs, approvals, asset lineage, and worker dependency visualization."
        tags={["flow_generate", "lineage", "approval"]}
      />
      <section className="panel">
        <h2>Flow workbench</h2>
        <p>
          Diagrams remain asset-backed runtime output and must preserve
          tenant/project isolation through every edit path.
        </p>
      </section>
    </>
  );
}
