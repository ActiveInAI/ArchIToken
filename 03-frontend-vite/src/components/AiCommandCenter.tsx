import { previewRuntimeRequest } from "../lib/backendClient";

export function AiCommandCenter() {
  const requestPreview = previewRuntimeRequest();

  return (
    <section className="panel">
      <h2>AiCommandCenter</h2>
      <p>
        AI can draft query plans, action plans, and viewer commands. It must not
        directly mutate tenant assets.
      </p>
      <div className="grid">
        <div>
          <strong>Backend target</strong>
          <span className="meta">{requestPreview.baseUrl}</span>
        </div>
        <div>
          <strong>Context headers</strong>
          <span className="meta">
            {Object.entries(requestPreview.headers)
              .map(([key, value]) => `${key}: ${value}`)
              .join(" / ")}
          </span>
        </div>
      </div>
    </section>
  );
}
