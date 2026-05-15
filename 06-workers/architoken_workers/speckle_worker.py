"""Speckle Server worker adapter."""

from __future__ import annotations

import os

from .adapter_requirements import missing_env, missing_python_dependency
from .contract import ConversionJob, WorkerResult, validate_job
from .io import require_source_file, write_json_artifact


def speckle_send_metadata(job: ConversionJob) -> WorkerResult:
    """Send a source-file metadata object to a configured Speckle Server stream."""

    validate_job(job)
    if unavailable := missing_python_dependency(
        job,
        adapter="speckle",
        import_name="specklepy",
        install_hint="Install specklepy in the worker image for Speckle Server integration.",
    ):
        return unavailable
    if unavailable := missing_env(
        job,
        adapter="speckle",
        name="SPECKLE_SERVER_URL",
        install_hint="Configure SPECKLE_SERVER_URL for the target Speckle Server.",
    ):
        return unavailable
    if unavailable := missing_env(
        job,
        adapter="speckle",
        name="SPECKLE_TOKEN",
        install_hint="Configure SPECKLE_TOKEN with stream write permission.",
    ):
        return unavailable
    source, blocked = require_source_file(
        job,
        adapter="speckle",
        install_hint="Mount a source file into the worker and pass sourcePath in the job input.",
    )
    if blocked:
        return blocked
    stream_id = str(job.input.get("streamId", "")).strip()
    if not stream_id:
        return WorkerResult(
            job_id=job.job_id,
            status="blocked",
            error={"code": "speckle_stream_missing", "message": "job.input.streamId is required"},
            output={"adapter": "speckle", "available": False},
        )

    from specklepy.api import operations
    from specklepy.api.client import SpeckleClient
    from specklepy.objects import Base
    from specklepy.transports.server import ServerTransport

    client = SpeckleClient(host=os.environ["SPECKLE_SERVER_URL"])
    client.authenticate_with_token(os.environ["SPECKLE_TOKEN"])
    transport = ServerTransport(client=client, stream_id=stream_id)
    speckle_object = Base(
        applicationId="architoken-worker",
        jobId=job.job_id,
        tenantId=job.tenant_id,
        projectId=job.project_id,
        sourceFileName=source.name,
        sourcePath=str(source),
        sourceSizeBytes=source.stat().st_size,
    )
    object_id = operations.send(base=speckle_object, transports=[transport])
    artifact = write_json_artifact(
        job,
        "speckle_send_manifest.json",
        {"serverUrl": os.environ["SPECKLE_SERVER_URL"], "streamId": stream_id, "objectId": object_id},
        role="speckle_manifest",
        metadata={"adapter": "speckle"},
    )
    return WorkerResult(
        job_id=job.job_id,
        status="completed",
        artifacts=(artifact,),
        output={"adapter": "speckle", "streamId": stream_id, "objectId": object_id},
    )
