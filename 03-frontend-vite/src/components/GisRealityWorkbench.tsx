export function GisRealityWorkbench() {
  return (
    <section className="panel">
      <h2>GisRealityWorkbench</h2>
      <p>
        GIS and reality capture shell for PostGIS, GDAL, PROJ, PDAL, EPT, 3D
        Tiles, MapLibre, Cesium, OSGB adapter boundaries, panorama graphs, and
        WebXR.
      </p>
      <div className="badge-row">
        {["PostGIS", "3D Tiles", "EPT", "MapLibre", "Cesium", "WebXR"].map((tag) => (
          <span className="badge" key={tag}>
            {tag}
          </span>
        ))}
      </div>
    </section>
  );
}
