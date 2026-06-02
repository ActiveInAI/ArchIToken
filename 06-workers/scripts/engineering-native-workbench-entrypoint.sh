#!/usr/bin/env bash
set -euo pipefail

export DISPLAY="${DISPLAY:-:99}"
export ARCHITOKEN_ENGINEERING_NATIVE_SESSION_DIR="${ARCHITOKEN_ENGINEERING_NATIVE_SESSION_DIR:-/tmp/architoken-engineering-native-sessions}"

mkdir -p "${ARCHITOKEN_ENGINEERING_NATIVE_SESSION_DIR}"
mkdir -p /tmp/.X11-unix
chmod 1777 /tmp/.X11-unix

if [[ "${ARCHITOKEN_ENGINEERING_NATIVE_EXTERNAL_DISPLAY:-0}" != "1" ]]; then
  Xvfb "${DISPLAY}" -screen 0 "${ARCHITOKEN_ENGINEERING_NATIVE_SCREEN:-1920x1080x24}" -ac -nolisten tcp &
fi
openbox >/tmp/architoken-openbox.log 2>&1 &
x11vnc -display "${DISPLAY}" -forever -shared -nopw -noshm -rfbport 5900 >/tmp/architoken-x11vnc.log 2>&1 &
websockify --web=/usr/share/novnc/ 0.0.0.0:6080 localhost:5900 >/tmp/architoken-websockify.log 2>&1 &

exec python3 -m architoken_workers.engineering_native_workbench_server
