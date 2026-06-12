#!/bin/bash
# 包装 architoken-worker:统一 PATH(让 officecli/mineru/mmdc/blender/freecad 可被找到)
# 并自动加载同目录 .env 里的外部服务凭据。PanAI 的 MCP 指向本脚本。
HERE="/home/insome/dev/insomeos/06-workers"
set -a
[ -f "$HERE/.env" ] && . "$HERE/.env"
set +a
export PATH="$HERE/.venv/bin:/home/insome/.local/bin:/home/insome/.npm-global/bin:/usr/local/bin:/usr/bin:/bin"
exec "$HERE/.venv/bin/architoken-worker" "$@"
