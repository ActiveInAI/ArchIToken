const traceSteps = [
  "draft_command_created",
  "permission_decision_recorded",
  "approval_required",
  "viewer_command_queued",
  "audit_event_appended",
];

export function RuntimeExecutionTrace() {
  return (
    <section className="panel">
      <h2>RuntimeExecutionTrace</h2>
      <ol className="trace">
        {traceSteps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
    </section>
  );
}
