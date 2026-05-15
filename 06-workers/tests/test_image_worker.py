import base64

from architoken_workers import ConversionJob, ConversionOperation
from architoken_workers.image_worker import imagemagick_convert, opencv_analyze


PNG_1X1 = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII="
)


def _job(source_path: str) -> ConversionJob:
    return ConversionJob(
        job_id="job-image-1",
        tenant_id="tenant-a",
        project_id="project-a",
        actor="image-worker-test",
        operation=ConversionOperation.MEDIA_TRANSCODE,
        source_asset_id="asset-image-1",
        source_file_id="file-image-1",
        input={"sourcePath": source_path, "outputFormat": "webp"},
    )


def test_image_adapter_boundaries(tmp_path) -> None:
    source = tmp_path / "pixel.png"
    source.write_bytes(PNG_1X1)

    opencv = opencv_analyze(_job(str(source)))
    imagemagick = imagemagick_convert(_job(str(source)))

    assert opencv.status in {"blocked", "completed", "failed"}
    assert imagemagick.status in {"blocked", "completed", "failed"}
    if opencv.status == "completed":
        assert opencv.output["width"] == 1
        assert opencv.output["height"] == 1
    if imagemagick.status == "completed":
        assert imagemagick.output["format"] == "webp"
