#!/usr/bin/env bash
set -euo pipefail

# Run the standalone proxy admin helper using codex-lb's uv environment.
# Example:
#   ./scripts/codex-lb-proxy-admin.sh --proxies-file ~/.codex-lb/proxies.txt --reset-proxies --bind-active --prune-reauth --restart

CODEX_LB_DIR="${CODEX_LB_DIR:-$HOME/Dev/code-forge/codex-lb}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ ! -d "$CODEX_LB_DIR" ]]; then
  echo "ERROR: codex-lb dir not found: $CODEX_LB_DIR" >&2
  echo "Set CODEX_LB_DIR=/path/to/codex-lb" >&2
  exit 1
fi

cd "$CODEX_LB_DIR"
exec uv run python "$SCRIPT_DIR/codex-lb-proxy-admin.py" --codex-lb-dir "$CODEX_LB_DIR" "$@"
