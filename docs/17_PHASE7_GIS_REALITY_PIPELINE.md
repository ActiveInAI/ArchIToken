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
