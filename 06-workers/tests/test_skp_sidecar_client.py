import base64
import json
import os
import subprocess
import sys
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from threading import Thread
from typing import Any


IFC_BYTES = (
    b"ISO-10303-21;\n"
    b"HEADER;\n"
    b"FILE_SCHEMA(('IFC4'));\n"
    b"ENDSEC;\n"
    b"DATA;\n"
    b"ENDSEC;\n"
    b"END-ISO-10303-21;\n"
)
GLB_BYTES = b"glTF" + b"\x02\x00\x00\x00" + b"\x10\x00\x00\x00" + b"\x00" * 8


def test_skp_sidecar_client_writes_ifc_artifact(tmp_path) -> None:
    requests: list[dict[str, Any]] = []
    server, url = _start_sidecar(
        target_format="ifc",
        media_type="application/p21",
        role="openbim_ifc",
        content=IFC_BYTES,
        requests=requests,
    )
    try:
        source = tmp_path / "model.skp"
        output = tmp_path / "model.ifc"
        source.write_bytes(b"skp bytes are consumed only by the licensed sidecar")

        result = subprocess.run(
            [
                sys.executable,
                str(_client_script()),
                "--adapter-url",
                url,
                "--target-format",
                "ifc",
                str(source),
                str(output),
            ],
            check=False,
            capture_output=True,
            text=True,
        )

        assert result.returncode == 0, result.stderr
        assert output.read_bytes() == IFC_BYTES
        assert requests[0]["sourceFormat"] == "skp"
        assert requests[0]["targetFormat"] == "ifc"
        assert requests[0]["outputFormats"] == ["ifc", "properties-index"]
    finally:
        server.shutdown()


def test_skp_sidecar_client_writes_glb_artifact(tmp_path) -> None:
    requests: list[dict[str, Any]] = []
    server, url = _start_sidecar(
        target_format="glb",
        media_type="model/gltf-binary",
        role="skp_glb",
        content=GLB_BYTES,
        requests=requests,
    )
    try:
        source = tmp_path / "model.skp"
        output = tmp_path / "model.glb"
        source.write_bytes(b"skp bytes are consumed only by the licensed sidecar")

        result = subprocess.run(
            [
                sys.executable,
                str(_client_script()),
                "--adapter-url",
                url,
                "--target-format",
                "glb",
                str(source),
                str(output),
            ],
            check=False,
            capture_output=True,
            text=True,
        )

        assert result.returncode == 0, result.stderr
        assert output.read_bytes() == GLB_BYTES
        assert requests[0]["targetFormat"] == "glb"
    finally:
        server.shutdown()


def test_skp_sidecar_client_requires_adapter_url(tmp_path) -> None:
    source = tmp_path / "model.skp"
    output = tmp_path / "model.ifc"
    source.write_bytes(b"skp bytes")
    env = os.environ.copy()
    for key in (
        "SKETCHUP_ADAPTER_URL",
        "ARCHITOKEN_SKP_ADAPTER_URL",
        "LICENSED_BIM_ADAPTER_URL",
    ):
        env.pop(key, None)

    result = subprocess.run(
        [
            sys.executable,
            str(_client_script()),
            "--target-format",
            "ifc",
            str(source),
            str(output),
        ],
        check=False,
        capture_output=True,
        text=True,
        env=env,
    )

    assert result.returncode != 0
    assert "No licensed SketchUp adapter URL configured" in result.stderr
    assert not output.exists()


def _client_script() -> Path:
    return Path(__file__).parents[1] / "scripts" / "architoken_skp_sidecar_client.py"


def _start_sidecar(
    *,
    target_format: str,
    media_type: str,
    role: str,
    content: bytes,
    requests: list[dict[str, Any]],
) -> tuple[HTTPServer, str]:
    class Handler(BaseHTTPRequestHandler):
        def do_POST(self) -> None:  # noqa: N802 - stdlib handler API.
            raw_length = self.headers.get("Content-Length", "0")
            body = self.rfile.read(int(raw_length))
            requests.append(json.loads(body.decode("utf-8")))
            payload = {
                "artifacts": [
                    {
                        "name": f"model.{target_format}",
                        "role": role,
                        "mediaType": media_type,
                        "contentBase64": base64.b64encode(content).decode("ascii"),
                    }
                ]
            }
            encoded = json.dumps(payload).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(encoded)))
            self.end_headers()
            self.wfile.write(encoded)

        def log_message(self, *_args: object) -> None:
            return

    server = HTTPServer(("127.0.0.1", 0), Handler)
    thread = Thread(target=server.serve_forever, daemon=True)
    thread.start()
    host, port = server.server_address
    return server, f"http://{host}:{port}/v1/convert"
