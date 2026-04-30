export function OpenBimWorkbench() {
  return (
    <section className="panel">
      <h2>OpenBimWorkbench</h2>
      <p>
        IFC4x3, IDS, bSDD, BCF, and COBie workbench entry. IfcOpenShell remains
        a worker-side optional integration, not a bundled browser dependency.
      </p>
      <div className="badge-row">
        {["IFC4x3", "IDS", "bSDD", "BCF", "COBie"].map((tag) => (
          <span className="badge" key={tag}>
            {tag}
          </span>
        ))}
      </div>
    </section>
  );
}
