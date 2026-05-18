# Phase 7 GIS / Reality Pipeline

The GIS and reality worker adapters cover:

- `geojson_ingest`
- `postgis_index`
- `pointcloud_metadata`
- `e57_metadata`
- `las_laz_metadata`
- `tileset_manifest`
- `panorama_graph`
- `osgb_adapter`

The contract is manifest-first. GDAL, PROJ, PDAL, Entwine/EPT, CesiumJS, MapLibre GL JS, 3D Tiles, E57, LAS, LAZ, PLY, OSGB, 360 panorama graphs, and WebXR run through explicit production adapters or workers with packaging, license, and security review.

The Rust API remains the owner of tenant/project isolation, RBAC, audit, asset records, conversion jobs, and object-store bindings.

## Digital Twin Frontend Baseline

The `digital_twin` module must stay inside the same Open CDE / Module Workflow OS shell as every other module. It does not get a separate top business entrance or standalone dashboard layout.

Frontend runtime decisions:

- Three.js / `@react-three/fiber` is the bundled fallback viewport for steel members, sensors, risk envelopes, 3DGS hints, and 4D process route playback.
- AntV / Ant Design Charts, D3, ECharts, and Highcharts are treated as visualization reference families for metrics, scales, filtering, responsiveness, and accessibility. Runtime bundling is limited to dependencies already approved in `03-frontend/package.json`.
- CesiumJS, Mapbox GL JS, Maptalks, Kepler.gl, and maptalks.three define the geospatial contract for 3D Tiles, CRS, city/factory context, spatial filters, heatmaps, OD flows, and future map+Three split rendering.
- The active code contract lives in `03-frontend/lib/digital-twin.ts` as `steelTwinVisualizationReferences` and `steelTwinViewportModes`, with Vitest coverage in `03-frontend/lib/digital-twin.test.ts`.

Production rule: every visual layer must be traceable to CDE assets, lifecycle transactions, approvals, and audit events before it can be used as handover evidence.
