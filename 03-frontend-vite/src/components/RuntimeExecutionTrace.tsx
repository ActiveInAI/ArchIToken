const traceSteps = [
  "draft_command_created",
  "query_plan_created",
  "action_plan_created",
  "direct_asset_mutation_blocked",
  "permission_decision_recorded",
  "approval_required",
  "viewer_command_queued",
  "audit_event_appended",
];

export function RuntimeExecutionTrace() {
  return (
    <section className="panel">
      <h2>RuntimeExecutionTrace</h2>
      <p>
        Trace view models Phase 7 AI runtime execution: query plans and action
        plans remain draft-only until a reviewer approves queued execution.
      </p>
      <ol className="trace">
        {traceSteps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
    </section>
  );
}
