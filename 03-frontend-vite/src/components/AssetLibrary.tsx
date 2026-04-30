import { assetKinds } from "../lib/runtimeIntegrations";

const previewAssets = [
  { id: "asset-ifc-campus", kind: "ifc", status: "ready", format: "IFC4x3" },
  { id: "asset-tiles-district", kind: "gis_layer", status: "indexed", format: "3D Tiles" },
  { id: "asset-scan-hall", kind: "point_cloud", status: "processing", format: "E57" },
];

export function AssetLibrary() {
  return (
    <section className="panel">
      <h2>AssetLibrary</h2>
      <p>
        Tenant-scoped registry preview for openBIM, CAD, GIS, documents, media,
        reality capture, gantt, and flow assets.
      </p>
      <div className="grid">
        {previewAssets.map((asset) => (
          <article className="panel" key={asset.id}>
            <strong>{asset.id}</strong>
            <span className="meta">
              {asset.kind} / {asset.status} / {asset.format}
            </span>
          </article>
        ))}
      </div>
      <div className="badge-row">
        {assetKinds.map((kind) => (
          <span className="badge" key={kind}>
            {kind}
          </span>
        ))}
      </div>
    </section>
  );
}
