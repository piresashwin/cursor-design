#!/usr/bin/env bash
# Launch Cursor (not VS Code) as an Extension Development Host for apps/extension, opened on examples/.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CURSOR_BIN="${CURSOR_BIN:-/Applications/Cursor.app/Contents/Resources/app/bin/cursor}"
if [ ! -x "$CURSOR_BIN" ]; then
  echo "Cursor CLI not found at $CURSOR_BIN (set CURSOR_BIN)" >&2
  exit 1
fi
exec "$CURSOR_BIN" --new-window \
  --extensionDevelopmentPath="$ROOT/apps/extension" \
  "$ROOT/examples"
