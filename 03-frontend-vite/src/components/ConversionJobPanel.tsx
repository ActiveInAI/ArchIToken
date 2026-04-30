import { conversionOperations } from "../lib/runtimeIntegrations";

export function ConversionJobPanel() {
  return (
    <section className="panel">
      <h2>ConversionJobPanel</h2>
      <p>
        Conversion jobs stay approval and tenant guarded. Workers receive
        explicit source asset/file identifiers and return manifest-only output.
      </p>
      <div className="badge-row">
        {conversionOperations.map((operation) => (
          <span className="badge" key={operation}>
            {operation}
          </span>
        ))}
      </div>
    </section>
  );
}
