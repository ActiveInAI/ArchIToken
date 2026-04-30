import { ConversionJobPanel } from "../components/ConversionJobPanel";
import { PageHero } from "../components/PageHero";
import { RuntimeExecutionTrace } from "../components/RuntimeExecutionTrace";
import { ViewerCommandPanel } from "../components/ViewerCommandPanel";

export function RuntimePage() {
  return (
    <>
      <PageHero
        eyebrow="Universal Runtime"
        title="Runtime"
        summary="Shared execution view for conversion jobs, viewer commands, AI plans, provider registry, and audit traces."
        tags={["RuntimeContext", "RBAC", "audit", "OpenAPI"]}
      />
      <div className="grid">
        <ConversionJobPanel />
        <RuntimeExecutionTrace />
      </div>
      <ViewerCommandPanel />
    </>
  );
}
