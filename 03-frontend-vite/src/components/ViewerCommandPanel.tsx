import * as Tabs from "@radix-ui/react-tabs";
import { viewerCommandKinds } from "../lib/runtimeIntegrations";
import { useWorkbenchStore } from "../state/workbenchStore";

export function ViewerCommandPanel() {
  const draftCommand = useWorkbenchStore((state) => state.draftCommand);
  const setDraftCommand = useWorkbenchStore((state) => state.setDraftCommand);

  return (
    <section className="panel">
      <h2>ViewerCommandPanel</h2>
      <Tabs.Root className="command-tabs" defaultValue="draft">
        <Tabs.List className="tab-list" aria-label="Viewer command workflow">
          <Tabs.Trigger className="tab-trigger" value="draft">
            Draft
          </Tabs.Trigger>
          <Tabs.Trigger className="tab-trigger" value="confirm">
            Confirm
          </Tabs.Trigger>
          <Tabs.Trigger className="tab-trigger" value="execute">
            Execute
          </Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="draft">
          <strong>
            {draftCommand.id} / {draftCommand.kind} / {draftCommand.status}
          </strong>
          <div className="badge-row">
            {viewerCommandKinds.map((kind) => (
              <button
                className="tab-trigger"
                key={kind}
                type="button"
                onClick={() =>
                  setDraftCommand({
                    id: `cmd-draft-${kind}`,
                    kind,
                    status: "draft",
                  })
                }
              >
                {kind}
              </button>
            ))}
          </div>
        </Tabs.Content>
        <Tabs.Content value="confirm">
          <p>
            Confirmation is explicit. Production execution remains backend
            audited and permission guarded.
          </p>
        </Tabs.Content>
        <Tabs.Content value="execute">
          <p>
            Commands enter queued state before terminal executed or skipped
            acknowledgement.
          </p>
        </Tabs.Content>
      </Tabs.Root>
    </section>
  );
}
