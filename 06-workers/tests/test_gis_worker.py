from architoken_workers import ConversionJob, ConversionOperation
from architoken_workers.gis_worker import geojson_ingest, postgis_index
from architoken_workers.panorama_worker import osgb_adapter, panorama_graph
from architoken_workers.pointcloud_worker import pointcloud_metadata, tileset_manifest


def _job(operation: ConversionOperation = ConversionOperation.GIS_TILE, input_payload: dict | None = None) -> ConversionJob:
    return ConversionJob(
        job_id="job-gis-1",
        tenant_id="tenant-a",
        project_id="project-a",
        actor="gis-worker-test",
        operation=operation,
        source_asset_id="asset-gis-1",
        source_file_id="file-gis-1",
        input=input_payload or {},
    )


def test_geojson_and_postgis_contracts(tmp_path) -> None:
    source = tmp_path / "layer.geojson"
    source.write_text(
        '{"type":"FeatureCollection","features":[{"type":"Feature","geometry":{"type":"Point","coordinates":[115.86,-31.95]},"properties":{}}]}',
        encoding="utf-8",
    )
    geojson = geojson_ingest(_job(input_payload={"sourcePath": str(source)}))
    postgis = postgis_index(_job())
    assert geojson.output["featureCount"] == 1
    assert postgis.status == "blocked"
    assert postgis.output["adapter"] == "postgis"


def test_pointcloud_metadata_and_tileset_manifest() -> None:
    metadata = pointcloud_metadata(_job(ConversionOperation.POINTCLOUD_TILE), "e57")
    tileset = tileset_manifest(_job(ConversionOperation.POINTCLOUD_TILE))
    assert metadata.status in {"blocked", "completed"}
    assert tileset.status in {"blocked", "completed"}
    if metadata.status == "completed":
        assert metadata.output["format"] == "e57"
    if tileset.status == "blocked":
        assert tileset.output["adapter"] in {"cesium_ion", "pdal"}


def test_panorama_and_osgb_boundaries() -> None:
    graph = panorama_graph(_job(ConversionOperation.PANORAMA_INGEST))
    osgb = osgb_adapter(_job())
    assert graph.status in {"blocked", "completed"}
    if graph.status == "completed":
        assert graph.output["cameraSync"] is True
    assert osgb.status == "blocked"
    assert osgb.output["adapter"] == "osgb"
