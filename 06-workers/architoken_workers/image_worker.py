"""Image analysis and derivative worker adapters."""

from __future__ import annotations

import shutil
import subprocess

from .adapter_requirements import blocked, missing_python_dependency
from .contract import ConversionJob, WorkerResult, validate_job
from .io import artifact_for_path, output_dir, require_source_file, write_json_artifact


def opencv_analyze(job: ConversionJob) -> WorkerResult:
    """Extract real image metadata/statistics with OpenCV."""

    validate_job(job)
    if unavailable := missing_python_dependency(
        job,
        adapter="opencv",
        import_name="cv2",
        install_hint="Install opencv-python-headless in the worker image for real image analysis.",
    ):
        return unavailable
    source, blocked_result = require_source_file(
        job,
        adapter="opencv",
        install_hint="Mount an image source file into the worker and pass sourcePath or sourceObjectKey.",
    )
    if blocked_result:
        return blocked_result

    import cv2

    image = cv2.imread(str(source), cv2.IMREAD_UNCHANGED)
    if image is None:
        return WorkerResult(
            job_id=job.job_id,
            status="failed",
            output={"adapter": "opencv", "sourcePath": str(source)},
            error={"code": "opencv_read_failed", "message": f"OpenCV could not decode image: {source}"},
        )
    height, width = image.shape[:2]
    channel_count = 1 if len(image.shape) == 2 else int(image.shape[2])
    means, stddevs = cv2.meanStdDev(image)
    payload = {
        "engine": "opencv",
        "sourcePath": str(source),
        "width": int(width),
        "height": int(height),
        "channels": channel_count,
        "dtype": str(image.dtype),
        "mean": [float(value[0]) for value in means.tolist()],
        "stddev": [float(value[0]) for value in stddevs.tolist()],
    }
    artifact = write_json_artifact(
        job,
        f"{source.stem}.opencv.json",
        payload,
        role="image_analysis",
        metadata={"engine": "opencv", "sourcePath": str(source)},
    )
    return WorkerResult(job_id=job.job_id, status="completed", artifacts=(artifact,), output=payload)


def imagemagick_convert(job: ConversionJob) -> WorkerResult:
    """Create image derivatives through ImageMagick with an external-process boundary."""

    validate_job(job)
    binary = shutil.which(str(job.input.get("imageMagickBinary", "")).strip()) if job.input.get("imageMagickBinary") else None
    if binary is None:
        binary = shutil.which("magick") or shutil.which("convert")
    if binary is None:
        return blocked(
            job,
            adapter="imagemagick",
            reason="missing executable: magick or convert",
            install_hint="Install ImageMagick in the worker image for real image derivative generation.",
        )
    source, blocked_result = require_source_file(
        job,
        adapter="imagemagick",
        install_hint="Mount an image source file into the worker and pass sourcePath or sourceObjectKey.",
    )
    if blocked_result:
        return blocked_result
    output_format = str(job.input.get("outputFormat", "webp")).lower().lstrip(".")
    target = output_dir(job) / f"{source.stem}.{output_format}"
    args = job.input.get("imageMagickArgs", [])
    if not isinstance(args, list) or not all(isinstance(value, str) for value in args):
        raise ValueError("job.input.imageMagickArgs must be a list of strings")
    command = [binary, str(source), *args, str(target)]
    if binary.endswith("magick"):
        command = [binary, str(source), *args, str(target)]
    completed = subprocess.run(
        command,
        check=False,
        capture_output=True,
        text=True,
        timeout=int(job.input.get("timeoutSeconds", 300)),
    )
    if completed.returncode != 0:
        return WorkerResult(
            job_id=job.job_id,
            status="failed",
            output={"adapter": "imagemagick", "sourcePath": str(source), "outputFormat": output_format},
            error={
                "code": "imagemagick_convert_failed",
                "message": completed.stderr[-4000:] or completed.stdout[-4000:],
            },
        )
    artifact = artifact_for_path(
        target,
        job=job,
        media_type=_media_type(output_format),
        role="image_derivative",
        metadata={"adapter": "imagemagick", "sourcePath": str(source), "format": output_format},
    )
    return WorkerResult(
        job_id=job.job_id,
        status="completed",
        artifacts=(artifact,),
        output={"adapter": "imagemagick", "sourcePath": str(source), "format": output_format},
    )


def _media_type(output_format: str) -> str:
    return {
        "png": "image/png",
        "jpg": "image/jpeg",
        "jpeg": "image/jpeg",
        "webp": "image/webp",
        "gif": "image/gif",
        "tif": "image/tiff",
        "tiff": "image/tiff",
        "avif": "image/avif",
    }.get(output_format, "application/octet-stream")
