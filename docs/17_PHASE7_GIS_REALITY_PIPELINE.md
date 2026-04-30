# Phase 7 GIS / Reality Pipeline

The GIS and reality worker skeleton covers:

- `geojson_ingest`
- `postgis_index`
- `pointcloud_metadata`
- `e57_metadata`
- `las_laz_metadata`
- `tileset_manifest`
- `panorama_graph`
- `osgb_adapter_boundary`

The contract is manifest-first. GDAL, PROJ, PDAL, Entwine/EPT, CesiumJS, MapLibre GL JS, 3D Tiles, E57, LAS, LAZ, PLY, OSGB, 360 panorama graphs, and WebXR remain explicit adapter or worker boundaries until production packaging, license, and security reviews are complete.

The Rust API remains the owner of tenant/project isolation, RBAC, audit, asset records, conversion jobs, and object-store bindings.
