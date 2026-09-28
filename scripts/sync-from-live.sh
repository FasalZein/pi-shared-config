#!/usr/bin/env bash
set -euo pipefail

SOURCE_DIR="${1:-${PI_AGENT_SOURCE_DIR:-$HOME/.pi/agent}}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
SOURCE_DIR="$(cd "$SOURCE_DIR" && pwd)"
SOURCE_HOME="$(cd "$SOURCE_DIR/../.." && pwd)"
SKILL_STORE_DIR="${SKILL_STORE_DIR:-$SOURCE_HOME/.agents}"

ROOT_FILES=(
  settings.json
  models.json
  keybindings.json
  fancy-footer.json
  pi-codex-conversion.json
  proxies.json
  trust.json
  REALTIME-SYSTEM-PROMPT.md
  oxlint.config.ts
)
SYNC_DIRS=(templates themes oxlint)
LIVE_AGENTS=(architect cleaner design-builder design forge github hardener researcher reviewer scout worker)
EXCLUDES=(
  '.DS_Store'
  'auth.json'
  'models-store.json'
  'mcp-cache.json'
  'mcp-onboarding.json'
  'cursor-sdk-context-windows.json'
  'cursor-sdk-model-list.json'
  'claude-account-source.txt'
  'claude-code-version.json'
  'howaboua-pi-stuff-changelog.json'
  'run-history.jsonl'
  'sessions'
  'git'
  '.git'
  'tests'
  'tmp'
  'backup'
  'cache'
  'state'
  'node_modules'
  'npm/node_modules'
  'llm-verifier-venv'
  'web-run-sessions'
  'agents.bak-*'
  '*.bak-*'
  '*.bak'
  'credentials.json'
)

require_path() {
  if [[ ! -e "$1" ]]; then
    echo "Missing required source: $1" >&2
    exit 1
  fi
}

sync_dir() {
  local source="$1"
  local target="$2"
  local args=(-a --delete)
  local pattern
  for pattern in "${EXCLUDES[@]}"; do
    args+=(--exclude "$pattern")
  done
  mkdir -p "$target"
  rsync "${args[@]}" "$source/" "$target/"
}

require_path "$SOURCE_DIR"
require_path "$SKILL_STORE_DIR/.skill-lock.json"
command -v rsync >/dev/null || { echo "rsync is required" >&2; exit 1; }
command -v python3 >/dev/null || { echo "python3 is required" >&2; exit 1; }

for file in "${ROOT_FILES[@]}"; do
  if [[ "$file" == "REALTIME-SYSTEM-PROMPT.md" && ! -e "$SOURCE_DIR/$file" ]]; then
    echo "Live source has no REALTIME-SYSTEM-PROMPT.md; keeping the repository copy." >&2
    continue
  fi
  require_path "$SOURCE_DIR/$file"
done
for directory in "${SYNC_DIRS[@]}"; do
  require_path "$SOURCE_DIR/$directory"
done
for agent in "${LIVE_AGENTS[@]}"; do
  require_path "$SOURCE_DIR/agents/$agent.md"
done
for skill in bro msw cmux; do
  require_path "$SOURCE_DIR/skills/$skill"
done

echo "Syncing Pi configuration from $SOURCE_DIR"

for file in "${ROOT_FILES[@]}"; do
  if [[ "$file" == "models.json" || ! -e "$SOURCE_DIR/$file" ]]; then
    continue
  fi
  cp "$SOURCE_DIR/$file" "$REPO_DIR/$file"
done

cp "$SOURCE_DIR/models.json" "$REPO_DIR/models.json"
for directory in "${SYNC_DIRS[@]}"; do
  sync_dir "$SOURCE_DIR/$directory" "$REPO_DIR/$directory"
done
for agent in "${LIVE_AGENTS[@]}"; do
  cp "$SOURCE_DIR/agents/$agent.md" "$REPO_DIR/agents/$agent.md"
done
sync_dir "$SOURCE_DIR/scripts" "$REPO_DIR/agent-scripts"

skill_stage="$(mktemp -d)"
trap 'rm -rf "$skill_stage"' EXIT
for skill in bro msw cmux; do
  sync_dir "$SOURCE_DIR/skills/$skill" "$skill_stage/$skill"
done
cp "$SKILL_STORE_DIR/.skill-lock.json" "$skill_stage/.skill-lock.json"
copy_metadata="$REPO_DIR/skills/managed-metadata.json"
require_path "$copy_metadata"
cp "$copy_metadata" "$skill_stage/managed-metadata.json"
python3 - "$SOURCE_DIR/skills" "$skill_stage/symlinks.json" <<'PY'
import json
import os
import sys
from pathlib import Path

source = Path(sys.argv[1])
target = Path(sys.argv[2])
links = {
    entry.name: os.readlink(entry)
    for entry in sorted(source.iterdir(), key=lambda path: path.name)
    if entry.is_symlink() and entry.name not in {"to-prd", "to-slices"}
}
target.write_text(json.dumps({"version": 1, "links": links}, indent=2) + "\n")
PY
rsync -a --delete "$skill_stage/" "$REPO_DIR/skills/"

require_path "$SOURCE_DIR/extensions/pi-tps.ts"
require_path "$SOURCE_DIR/extensions/skill-gate.ts"
require_path "$SOURCE_DIR/extensions/eko24ive-pi-ask.json"
mkdir -p "$REPO_DIR/extensions"
find "$REPO_DIR/extensions" -mindepth 1 -maxdepth 1 \
  ! -name 'pi-tps.ts' ! -name 'skill-gate.ts' ! -name 'eko24ive-pi-ask.json' -exec rm -rf {} +
cp "$SOURCE_DIR/extensions/pi-tps.ts" "$REPO_DIR/extensions/pi-tps.ts"
cp "$SOURCE_DIR/extensions/skill-gate.ts" "$REPO_DIR/extensions/skill-gate.ts"
cp "$SOURCE_DIR/extensions/eko24ive-pi-ask.json" "$REPO_DIR/extensions/eko24ive-pi-ask.json"

python3 "$SCRIPT_DIR/normalize-config.py"
python3 "$SCRIPT_DIR/scan-secrets.py" "$REPO_DIR"
echo "Sync complete. Live files were not changed."
