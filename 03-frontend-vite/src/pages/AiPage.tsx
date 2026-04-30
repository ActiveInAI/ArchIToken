import { AiCommandCenter } from "../components/AiCommandCenter";
import { PageHero } from "../components/PageHero";
import { RuntimeExecutionTrace } from "../components/RuntimeExecutionTrace";
import { ViewerCommandPanel } from "../components/ViewerCommandPanel";

export function AiPage() {
  return (
    <>
      <PageHero
        eyebrow="Approval Gated AI"
        title="AI Command Center"
        summary="AI produces plans and draft runtime commands first; approvals and audit decide whether actions execute."
        tags={["draft only", "approval required", "audit"]}
      />
      <div className="grid">
        <AiCommandCenter />
        <RuntimeExecutionTrace />
      </div>
      <ViewerCommandPanel />
    </>
  );
}
