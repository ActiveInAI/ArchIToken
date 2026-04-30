import { PageHero } from "../components/PageHero";

export function GanttPage() {
  return (
    <>
      <PageHero
        eyebrow="Schedule Runtime"
        title="Gantt"
        summary="Planning asset shell for schedule imports, AI-generated task drafts, and model-linked progress overlays."
        tags={["gantt_generate", "dependencies", "progress"]}
      />
      <section className="panel">
        <h2>Gantt workbench</h2>
        <p>
          Phase 7 keeps schedule generation as a conversion job contract before
          adding specialized planner editing behavior.
        </p>
      </section>
    </>
  );
}
