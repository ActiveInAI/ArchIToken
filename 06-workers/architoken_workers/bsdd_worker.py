"""buildingSMART bSDD worker adapter."""

from __future__ import annotations

import json
import os
import urllib.parse
import urllib.request

from .contract import ConversionJob, WorkerResult, validate_job
from .io import write_json_artifact


def enrich_with_bsdd(job: ConversionJob) -> WorkerResult:
    """Enrich classifications through the buildingSMART Data Dictionary API."""

    validate_job(job)
    query = str(job.input.get("classificationQuery", "")).strip()
    if not query:
        output = {
            "dictionary": "bSDD",
            "networkPolicy": "scheduled_explicit_only",
            "classifications": [],
            "reason": "classificationQuery was not provided",
        }
        artifact = write_json_artifact(
            job,
            "bsdd_classification_report.json",
            output,
            role="bsdd_classification_report",
            metadata={"standard": "bSDD"},
        )
        return WorkerResult(
            job_id=job.job_id,
            status="completed",
            artifacts=(artifact,),
            output=output,
        )

    base_url = os.getenv("BSDD_API_URL", "https://api.bsdd.buildingsmart.org").rstrip("/")
    url = f"{base_url}/api/Classification/v4/Search?{urllib.parse.urlencode({'SearchText': query})}"
    request = urllib.request.Request(url, headers={"Accept": "application/json"})
    with urllib.request.urlopen(request, timeout=int(job.input.get("timeoutSeconds", 30))) as response:
        payload = json.loads(response.read().decode("utf-8"))
    output = {
        "dictionary": "bSDD",
        "networkPolicy": "scheduled_explicit_only",
        "query": query,
        "sourceUrl": url,
        "classifications": payload.get("classifications", payload.get("items", [])),
    }
    artifact = write_json_artifact(
        job,
        "bsdd_classification_report.json",
        output,
        role="bsdd_classification_report",
        metadata={"standard": "bSDD", "sourceUrl": url},
    )
    return WorkerResult(
        job_id=job.job_id,
        status="completed",
        artifacts=(artifact,),
        output=output,
    )
