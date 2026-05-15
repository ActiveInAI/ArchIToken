"""Audio, video, and image transcode worker backed by FFmpeg."""

from __future__ import annotations

import subprocess

from .adapter_requirements import missing_binary
from .contract import ConversionJob, WorkerResult, validate_job
from .io import artifact_for_path, output_dir, require_source_file


def ffmpeg_transcode(job: ConversionJob) -> WorkerResult:
    """Transcode a media source with FFmpeg and persist the derivative."""

    validate_job(job)
    if unavailable := missing_binary(
        job,
        adapter="ffmpeg",
        binary="ffmpeg",
        install_hint="Install FFmpeg in the worker image for real audio/video/image transcoding.",
    ):
        return unavailable
    source, blocked = require_source_file(
        job,
        adapter="ffmpeg",
        install_hint="Mount a media source file into the worker and pass sourcePath or sourceObjectKey.",
    )
    if blocked:
        return blocked
    output_format = str(job.input.get("outputFormat", "mp4")).lower().lstrip(".")
    target = output_dir(job) / f"{source.stem}.{output_format}"
    extra_args = job.input.get("ffmpegArgs", [])
    if not isinstance(extra_args, list) or not all(isinstance(arg, str) for arg in extra_args):
        raise ValueError("job.input.ffmpegArgs must be a list of strings")
    completed = subprocess.run(
        ["ffmpeg", "-y", "-i", str(source), *extra_args, str(target)],
        check=False,
        capture_output=True,
        text=True,
        timeout=int(job.input.get("timeoutSeconds", 900)),
    )
    if completed.returncode != 0:
        return WorkerResult(
            job_id=job.job_id,
            status="failed",
            error={"code": "ffmpeg_transcode_failed", "message": completed.stderr[-4000:] or completed.stdout[-4000:]},
            output={"adapter": "ffmpeg", "sourcePath": str(source), "outputFormat": output_format},
        )
    artifact = artifact_for_path(
        target,
        job=job,
        media_type=_media_type(output_format),
        role="media_derivative",
        metadata={"adapter": "ffmpeg", "sourcePath": str(source), "format": output_format},
    )
    return WorkerResult(
        job_id=job.job_id,
        status="completed",
        artifacts=(artifact,),
        output={"adapter": "ffmpeg", "sourcePath": str(source), "format": output_format},
    )


def _media_type(output_format: str) -> str:
    return {
        "mp4": "video/mp4",
        "webm": "video/webm",
        "mov": "video/quicktime",
        "mp3": "audio/mpeg",
        "wav": "audio/wav",
        "ogg": "audio/ogg",
        "m4a": "audio/mp4",
        "png": "image/png",
        "jpg": "image/jpeg",
        "jpeg": "image/jpeg",
        "webp": "image/webp",
        "gif": "image/gif",
    }.get(output_format, "application/octet-stream")
