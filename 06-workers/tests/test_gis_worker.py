from architoken_workers import ConversionJob, ConversionOperation
from architoken_workers.gis_worker import geojson_ingest, postgis_index
from architoken_workers.panorama_worker import osgb_adapter_boundary, panorama_graph
from architoken_workers.pointcloud_worker import pointcloud_metadata, tileset_manifest


def _job(operation: ConversionOperation = ConversionOperation.GIS_TILE) -> ConversionJob:
    return ConversionJob(
        job_id="job-gis-1",
        tenant_id="tenant-a",
        project_id="project-a",
        actor="gis-worker-test",
        operation=operation,
        source_asset_id="asset-gis-1",
        source_file_id="file-gis-1",
    )


def test_geojson_and_postgis_contracts() -> None:
    geojson = geojson_ingest(_job())
    postgis = postgis_index(_job())
    assert geojson.output["postgisReady"] is True
    assert postgis.output["tables"] == ["asset_geometries"]


def test_pointcloud_metadata_and_tileset_manifest() -> None:
    metadata = pointcloud_metadata(_job(ConversionOperation.POINTCLOUD_TILE), "e57")
    tileset = tileset_manifest(_job(ConversionOperation.POINTCLOUD_TILE))
    assert metadata.output["format"] == "e57"
    assert tileset.artifacts[0].name == "tileset.json"


def test_panorama_and_osgb_boundaries() -> None:
    graph = panorama_graph(_job(ConversionOperation.PANORAMA_INGEST))
    osgb = osgb_adapter_boundary(_job())
    assert graph.output["cameraSync"] is True
    assert osgb.output["productionEnabled"] is False
    assert osgb.output["mode"] == "boundary_only"
