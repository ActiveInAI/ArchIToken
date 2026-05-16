import json

from architoken_workers import ConversionJob, ConversionOperation
import architoken_workers.ifcdb_agent_worker as ifcdb_agent_worker
from architoken_workers.ifcdb_agent_worker import IFCDB_AGENT_REQUIRED_VERSION, run_ifcdb_agent
from architoken_workers.worker_cli import DISPATCH, production_self_check


def _job(operation: ConversionOperation, input_payload: dict | None = None) -> ConversionJob:
    return ConversionJob(
        job_id="job-ifcdb-1",
        tenant_id="tenant-a",
        project_id="project-a",
        actor="ifcdb-test",
        operation=operation,
        source_asset_id="asset-ifcdb-1",
        source_file_id="file-ifcdb-1",
        input=input_payload or {},
    )


def test_ifcdb_agent_adapter_is_dispatchable() -> None:
    assert DISPATCH["ifcdb_agent"] is run_ifcdb_agent


def test_ifcdb_agent_blocks_when_sidecar_missing(monkeypatch) -> None:
    monkeypatch.delenv("IFCDB_AGENT_URL", raising=False)
    result = run_ifcdb_agent(_job(ConversionOperation.IFCDB_QUERY, {"query": "select * from IfcWall"}))
    assert result.status == "blocked"
    assert result.output["adapter"] == "ifcdb_agent"
    assert "IFCDB_AGENT_URL" in result.error["message"]


def test_ifcdb_agent_self_check_requires_v109(monkeypatch) -> None:
    monkeypatch.setenv("IFCDB_AGENT_URL", "http://127.0.0.1:65535")
    monkeypatch.setenv("IFCDB_AGENT_VERSION", IFCDB_AGENT_REQUIRED_VERSION)
    check = production_self_check()["ifcdb_agent"]
    assert check["available"] is True
    assert check["requiredVersion"] == "v1.0.9"


def test_ifcdb_agent_query_calls_real_sidecar(monkeypatch, tmp_path) -> None:
    requests = []
    monkeypatch.setenv("IFCDB_AGENT_URL", "http://ifcdb-agent.test")
    monkeypatch.setenv("IFCDB_AGENT_VERSION", IFCDB_AGENT_REQUIRED_VERSION)
    monkeypatch.setenv("IFCDB_AGENT_QUERY_PATH", "/query")

    def fake_request(job, path, *, method="POST", body=None, content_type=None):
        requests.append((path, method, body, content_type))
        if path == "/health":
            return {
                "url": "http://ifcdb-agent.test/health",
                "statusCode": 200,
                "contentType": "application/json",
                "body": json.dumps({"status": "ok", "service": "ifcdb-agent"}).encode("utf-8"),
            }
        assert path == "/query"
        payload = json.loads(body.decode("utf-8"))
        assert payload["operation"] == "ifcdb_query"
        assert payload["query"] == "select GlobalId from IfcWall"
        return {
            "url": "http://ifcdb-agent.test/query",
            "statusCode": 200,
            "contentType": "application/json",
            "body": json.dumps({"rows": [{"GlobalId": "wall-guid-1"}], "sql": payload["query"]}).encode("utf-8"),
        }

    monkeypatch.setattr(ifcdb_agent_worker, "_request", fake_request)
    result = run_ifcdb_agent(
        _job(
            ConversionOperation.IFCDB_QUERY,
            {
                "query": "select GlobalId from IfcWall",
                "outputDir": str(tmp_path),
            },
        )
    )

    assert result.status == "completed"
    assert result.output["operation"] == "ifcdb_query"
    assert [request[0] for request in requests] == ["/health", "/query"]
    assert result.artifacts[0].name == "ifcdb_query_result.json"
    payload = json.loads((tmp_path / "ifcdb_query_result.json").read_text(encoding="utf-8"))
    assert payload["response"]["rows"][0]["GlobalId"] == "wall-guid-1"


def test_ifcdb_agent_sql_query_uses_documented_prefix(monkeypatch, tmp_path) -> None:
    captured = {}
    monkeypatch.setenv("IFCDB_AGENT_URL", "http://ifcdb-agent.test")
    monkeypatch.setenv("IFCDB_AGENT_VERSION", IFCDB_AGENT_REQUIRED_VERSION)

    def fake_request(job, path, *, method="POST", body=None, content_type=None):
        if path == "/health":
            return {
                "url": "http://ifcdb-agent.test/health",
                "statusCode": 200,
                "contentType": "application/json",
                "body": json.dumps({"status": "ok"}).encode("utf-8"),
            }
        captured.update(json.loads(body.decode("utf-8")))
        return {
            "url": "http://ifcdb-agent.test/query",
            "statusCode": 200,
            "contentType": "application/json",
            "body": json.dumps({"rows": []}).encode("utf-8"),
        }

    monkeypatch.setattr(ifcdb_agent_worker, "_request", fake_request)
    result = run_ifcdb_agent(
        _job(
            ConversionOperation.IFCDB_QUERY,
            {"sql": "select id, name from IfcWall", "outputDir": str(tmp_path)},
        )
    )

    assert result.status == "completed"
    assert captured["query"] == "%%sql_ifc\nselect id, name from IfcWall"
    assert captured["queryMode"] == "sql_ifc"


def test_ifcdb_agent_export_defaults_to_csv_from_manual(monkeypatch, tmp_path) -> None:
    captured = {}
    monkeypatch.setenv("IFCDB_AGENT_URL", "http://ifcdb-agent.test")
    monkeypatch.setenv("IFCDB_AGENT_VERSION", IFCDB_AGENT_REQUIRED_VERSION)

    def fake_request(job, path, *, method="POST", body=None, content_type=None):
        if path == "/health":
            return {
                "url": "http://ifcdb-agent.test/health",
                "statusCode": 200,
                "contentType": "application/json",
                "body": json.dumps({"status": "ok"}).encode("utf-8"),
            }
        captured.update(json.loads(body.decode("utf-8")))
        return {
            "url": "http://ifcdb-agent.test/export",
            "statusCode": 200,
            "contentType": "application/json",
            "body": json.dumps({"exported": True}).encode("utf-8"),
        }

    monkeypatch.setattr(ifcdb_agent_worker, "_request", fake_request)
    result = run_ifcdb_agent(_job(ConversionOperation.IFCDB_EXPORT, {"modelId": "m1", "outputDir": str(tmp_path)}))

    assert result.status == "completed"
    assert captured["exportFormat"] == "csv"
    assert captured["queryMode"] == "export_csv"
