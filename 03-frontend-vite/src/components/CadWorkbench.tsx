export function CadWorkbench() {
  return (
    <section className="panel">
      <h2>CadWorkbench</h2>
      <p>
        CAD shell for OCCT, FreeCAD headless, CadQuery, STEP, IGES, STL, OBJ,
        3MF, glTF, DXF, and DWG legal adapter boundaries.
      </p>
      <div className="badge-row">
        {["OCCT", "FreeCAD", "CadQuery", "DXF", "STEP", "DWG legal boundary"].map((tag) => (
          <span className="badge" key={tag}>
            {tag}
          </span>
        ))}
      </div>
    </section>
  );
}
