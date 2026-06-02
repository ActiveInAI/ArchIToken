"""HTTP launcher for the embedded FreeCAD/Blender noVNC workbench."""

from __future__ import annotations

import json
import os
import subprocess
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import urlencode


WORKSPACE_ROOT = Path(
    os.environ.get(
        "ARCHITOKEN_ENGINEERING_NATIVE_SESSION_DIR",
        "/home/insome/dev/insomeos/03-frontend/runtime/engineering-native-sessions",
    )
).resolve()
PUBLIC_URL = os.environ.get(
    "ARCHITOKEN_ENGINEERING_NATIVE_WORKBENCH_PUBLIC_URL",
    "http://192.168.1.100:6090",
).rstrip("/")
DISPLAY = os.environ.get("DISPLAY", ":99")
LAUNCH_MODE = os.environ.get(
    "ARCHITOKEN_ENGINEERING_NATIVE_WORKBENCH_LAUNCH_MODE",
    "container-app",
)


def main() -> None:
    host = os.environ.get("ARCHITOKEN_ENGINEERING_NATIVE_WORKBENCH_HOST", "0.0.0.0")
    port = int(os.environ.get("ARCHITOKEN_ENGINEERING_NATIVE_WORKBENCH_PORT", "6091"))
    WORKSPACE_ROOT.mkdir(parents=True, exist_ok=True)
    server = ThreadingHTTPServer((host, port), EngineeringNativeWorkbenchHandler)
    server.serve_forever()


class EngineeringNativeWorkbenchHandler(BaseHTTPRequestHandler):
    server_version = "ArchITokenEngineeringNativeWorkbench/1.0"

    def do_GET(self) -> None:
        if self.path == "/health":
            self.write_json(
                200,
                {
                    "status": "ok",
                    "workspaceRoot": str(WORKSPACE_ROOT),
                    "display": DISPLAY,
                    "launchMode": LAUNCH_MODE,
                },
            )
            return
        self.write_json(404, {"error": "not found"})

    def do_POST(self) -> None:
        if self.path != "/sessions":
            self.write_json(404, {"error": "not found"})
            return

        try:
            payload = self.read_json()
            app = str(payload.get("app") or "")
            session_id = safe_session_id(str(payload.get("sessionId") or ""))
            workspace_file = checked_workspace_path(
                str(payload.get("workspaceFilePath") or "")
            )
            if LAUNCH_MODE == "display-only":
                self.write_json(
                    200,
                    {
                        "schema": "architoken.engineering_native_workbench_session.v1",
                        "status": "ready",
                        "app": app,
                        "sessionId": session_id,
                        "workspaceFilePath": str(workspace_file),
                        "display": DISPLAY,
                        "hostAppLaunchRequired": True,
                        "launchUrl": launch_url(session_id),
                    },
                )
                return

            binary = app_binary(app)
            process = subprocess.Popen(
                [binary, str(workspace_file)],
                env={**os.environ, "DISPLAY": DISPLAY},
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                start_new_session=True,
            )
            self.write_json(
                200,
                {
                    "schema": "architoken.engineering_native_workbench_session.v1",
                    "status": "launched",
                    "app": app,
                    "sessionId": session_id,
                    "workspaceFilePath": str(workspace_file),
                    "processId": process.pid,
                    "display": DISPLAY,
                    "hostAppLaunchRequired": False,
                    "launchUrl": launch_url(session_id),
                },
            )
        except ValueError as error:
            self.write_json(400, {"error": str(error)})
        except FileNotFoundError as error:
            self.write_json(501, {"error": str(error)})
        except Exception as error:  # pragma: no cover - defensive server boundary
            self.write_json(500, {"error": str(error)})

    def read_json(self) -> dict[str, Any]:
        length = int(self.headers.get("content-length") or "0")
        if length <= 0:
            raise ValueError("JSON body is required")
        raw = self.rfile.read(length)
        parsed = json.loads(raw.decode("utf-8"))
        if not isinstance(parsed, dict):
            raise ValueError("JSON object body is required")
        return parsed

    def write_json(self, status: int, payload: dict[str, Any]) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("content-type", "application/json; charset=utf-8")
        self.send_header("content-length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format: str, *args: Any) -> None:
        if os.environ.get("ARCHITOKEN_ENGINEERING_NATIVE_WORKBENCH_DEBUG") == "1":
            super().log_message(format, *args)


def checked_workspace_path(value: str) -> Path:
    path = Path(value).resolve()
    if not value:
        raise ValueError("workspaceFilePath is required")
    try:
        path.relative_to(WORKSPACE_ROOT)
    except ValueError as error:
        raise ValueError("workspaceFilePath must stay inside the session root") from error
    if not path.is_file():
        raise ValueError("workspaceFilePath does not exist")
    return path


def safe_session_id(value: str) -> str:
    if not value or any(character not in "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_.-" for character in value):
        raise ValueError("sessionId is invalid")
    return value


def app_binary(app: str) -> str:
    if app == "freecad":
        return first_existing(
            os.environ.get("ARCHITOKEN_FREECAD_GUI_BINARY"),
            os.environ.get("FREECAD_BINARY"),
            "/usr/bin/freecad",
            "/usr/local/bin/freecad",
            "freecad",
            "FreeCAD",
        )
    if app == "blender":
        return first_existing(
            os.environ.get("ARCHITOKEN_BLENDER_GUI_BINARY"),
            os.environ.get("BLENDER_BINARY"),
            "/usr/bin/blender",
            "/usr/local/bin/blender",
            "blender",
        )
    raise ValueError("app must be freecad or blender")


def first_existing(*candidates: str | None) -> str:
    for candidate in candidates:
        if not candidate:
            continue
        if "/" not in candidate:
            return candidate
        path = Path(candidate)
        if path.exists() and os.access(path, os.X_OK):
            return str(path)
    raise FileNotFoundError("native application binary not found")


def launch_url(session_id: str) -> str:
    query = urlencode(
        {
            "autoconnect": "1",
            "resize": "remote",
            "quality": "9",
            "compression": "0",
            "path": "websockify",
            "architokenSession": session_id,
        }
    )
    return f"{PUBLIC_URL}/vnc.html?{query}"


if __name__ == "__main__":
    main()
