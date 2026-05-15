import zipfile

from architoken_workers import ConversionJob, ConversionOperation
from architoken_workers.bsdd_worker import enrich_with_bsdd
from architoken_workers.openbim_standards_worker import bcf_ingest, buildingsmart_validate, idm_ingest


def _job(operation: ConversionOperation, input_payload: dict | None = None) -> ConversionJob:
    return ConversionJob(
        job_id="job-openbim-standards-1",
        tenant_id="tenant-a",
        project_id="project-a",
        actor="openbim-standards-test",
        operation=operation,
        source_asset_id="asset-openbim-1",
        source_file_id="file-openbim-1",
        input=input_payload or {},
    )


def test_bcf_ingest_extracts_topics(tmp_path) -> None:
    source = tmp_path / "issues.bcfzip"
    with zipfile.ZipFile(source, "w") as archive:
        archive.writestr("bcf.version", "<Version VersionId='2.1' />")
        archive.writestr("project.bcfp", "<ProjectExtension><Project ProjectId='p1'><Name>Test</Name></Project></ProjectExtension>")
        archive.writestr(
            "topic-1/markup.bcf",
            """
            <Markup>
              <Topic Guid="topic-guid-1">
                <TopicType>Clash</TopicType>
                <TopicStatus>Open</TopicStatus>
                <Title>Beam clash</Title>
                <CreationAuthor>bim@example.com</CreationAuthor>
              </Topic>
              <Comment Guid="comment-1"><Date>2026-05-16</Date><Author>a</Author><Comment>Fix it</Comment></Comment>
            </Markup>
            """,
        )

    result = bcf_ingest(_job(ConversionOperation.BCF_INGEST, {"sourcePath": str(source)}))

    assert result.status == "completed"
    assert result.output["standard"] == "BCF"
    assert result.output["topicCount"] == 1
    assert any(artifact.name == "bcf_topics.jsonl" for artifact in result.artifacts)


def test_idm_ingest_validates_structured_exchange_requirements() -> None:
    result = idm_ingest(
        _job(
            ConversionOperation.IDM_INGEST,
            {
                "idmSpec": {
                    "processName": "Model handover",
                    "exchanges": [
                        {
                            "name": "Design model release",
                            "sender": "Designer",
                            "receiver": "Contractor",
                            "milestone": "IFC model issue",
                            "deliverables": ["IFC4.3 model", "IDS report"],
                            "informationRequirements": ["Every IfcBeam has material and fire rating"],
                            "idsRefs": ["handover.ids"],
                            "bsddRefs": ["identifier.buildingsmart.org"],
                            "bcfTopics": ["open-clashes"],
                        }
                    ],
                }
            },
        )
    )

    assert result.status == "completed"
    assert result.output["standard"] == "IDM"
    assert result.output["machineReadable"] is True


def test_buildingsmart_validate_and_bsdd_boundaries(tmp_path) -> None:
    source = tmp_path / "model.ifc"
    source.write_text("ISO-10303-21;\nEND-ISO-10303-21;\n", encoding="utf-8")

    validation = buildingsmart_validate(_job(ConversionOperation.OPENBIM_VALIDATE, {"sourcePath": str(source)}))
    bsdd = enrich_with_bsdd(_job(ConversionOperation.BSDD_ENRICH))

    assert validation.status in {"blocked", "completed"}
    if validation.status == "completed":
        assert validation.output["standard"] == "buildingSMART Validate"
    assert bsdd.status == "completed"
    assert bsdd.output["dictionary"] == "bSDD"
