#!/usr/bin/env bash
set -euo pipefail

SOURCE_DIR="${1:-${PI_AGENT_SOURCE_DIR:-$HOME/.pi/agent}}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
SOURCE_DIR="$(cd "$SOURCE_DIR" && pwd)"
SOURCE_HOME="$(cd "$SOURCE_DIR/../.." && pwd)"
SKILL_STORE_DIR="${SKILL_STORE_DIR:-$SOURCE_HOME/.agents}"

ROOT_FILES=(
  AGENTS.md
  settings.json
  models.json
  keybindings.json
  fancy-footer.json
  proxies.json
  trust.json
  REALTIME-SYSTEM-PROMPT.md
  oxlint.config.ts
)
SYNC_DIRS=(templates themes oxlint)
LIVE_AGENTS=(architect cleaner design-builder design github hardener researcher reviewer scout worker)
# Worktree tools that setup.sh installs into ~/.pi/agent/bin.
BIN_FILES=(wt worktrees-landed worktrees-idle ralph-lane lib/worktree-procs.sh)
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
    echo "Live source has no $file; keeping the repository copy." >&2
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
for skill in bro msw cmux browser-checks; do
  require_path "$SOURCE_DIR/skills/$skill"
done
for tool in "${BIN_FILES[@]}"; do
  require_path "$SOURCE_DIR/bin/$tool"
done

echo "Syncing Pi configuration from $SOURCE_DIR"

for file in "${ROOT_FILES[@]}"; do
  if [[ "$file" == "models.json" || ! -e "$SOURCE_DIR/$file" ]]; then
    continue
  fi
  cp "$SOURCE_DIR/$file" "$REPO_DIR/$file"
done

# An extension can supply a retained provider (for example anthropic), so live models.json may omit it.
# Keep the repository entry for any provider that live models.json does not define.
python3 - "$SOURCE_DIR/models.json" "$REPO_DIR/models.json" <<'PY'
import json
import sys

live = json.load(open(sys.argv[1]))
repo = json.load(open(sys.argv[2]))
live["providers"] = {**repo.get("providers", {}), **live.get("providers", {})}
open(sys.argv[2], "w").write(json.dumps(live, indent=2) + "\n")
PY
for directory in "${SYNC_DIRS[@]}"; do
  sync_dir "$SOURCE_DIR/$directory" "$REPO_DIR/$directory"
done
for agent in "${LIVE_AGENTS[@]}"; do
  cp "$SOURCE_DIR/agents/$agent.md" "$REPO_DIR/agents/$agent.md"
done
sync_dir "$SOURCE_DIR/scripts" "$REPO_DIR/agent-scripts"

# The live bin directory also holds host tools (heavy, fd, artifacts-sweep); copy only the shipped ones.
for tool in "${BIN_FILES[@]}"; do
  mkdir -p "$(dirname "$REPO_DIR/bin/$tool")"
  # Drop the comment line that names a host artifact path.
  grep -v '^# Approved proposal: ~/.pi/artifacts/' "$SOURCE_DIR/bin/$tool" > "$REPO_DIR/bin/$tool"
  chmod "$(stat -f %Lp "$SOURCE_DIR/bin/$tool")" "$REPO_DIR/bin/$tool"
done

skill_stage="$(mktemp -d)"
trap 'rm -rf "$skill_stage"' EXIT
for skill in bro msw cmux browser-checks; do
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
    if entry.is_symlink() and entry.name not in {"to-prd", "to-slices", "resolving-merge-conflicts"}
}
target.write_text(json.dumps({"version": 1, "links": links}, indent=2) + "\n")
PY
rsync -a --delete "$skill_stage/" "$REPO_DIR/skills/"

require_path "$SOURCE_DIR/extensions/pi-tps.ts"
require_path "$SOURCE_DIR/extensions/skill-gate.ts"
require_path "$SOURCE_DIR/extensions/eko24ive-pi-ask.json"
require_path "$SOURCE_DIR/extensions/env-wrap/index.ts"
require_path "$SOURCE_DIR/extensions/env-wrap/core.ts"
require_path "$SOURCE_DIR/extensions/shell-guard.ts"
mkdir -p "$REPO_DIR/extensions"
find "$REPO_DIR/extensions" -mindepth 1 -maxdepth 1 \
  ! -name 'pi-tps.ts' ! -name 'skill-gate.ts' ! -name 'eko24ive-pi-ask.json' ! -name 'env-wrap' -exec rm -rf {} +
cp "$SOURCE_DIR/extensions/pi-tps.ts" "$REPO_DIR/extensions/pi-tps.ts"
cp "$SOURCE_DIR/extensions/skill-gate.ts" "$REPO_DIR/extensions/skill-gate.ts"
cp "$SOURCE_DIR/extensions/eko24ive-pi-ask.json" "$REPO_DIR/extensions/eko24ive-pi-ask.json"

# env-wrap imports parseSegments from shell-guard.ts, which is host policy and stays out of this repository.
# Ship the parser as env-wrap/shell-segments.ts and point core.ts at it.
mkdir -p "$REPO_DIR/extensions/env-wrap"
cp "$SOURCE_DIR/extensions/env-wrap/index.ts" "$REPO_DIR/extensions/env-wrap/index.ts"
sed 's#"\.\./shell-guard\.ts"#"./shell-segments.ts"#' "$SOURCE_DIR/extensions/env-wrap/core.ts" > "$REPO_DIR/extensions/env-wrap/core.ts"
python3 - "$SOURCE_DIR/extensions/shell-guard.ts" "$REPO_DIR/extensions/env-wrap/shell-segments.ts" <<'PY'
import re
import sys

text = open(sys.argv[1]).read()
start = text.index("/** dynamic:")
begin = text.index("export function parseSegments")
match = re.search(r"^}$", text[begin:], re.MULTILINE)
assert match, "parseSegments end not found"
end = begin + match.end()
header = (
    "// Command parser that env-wrap uses. Extracted from the live shell-guard.ts by\n"
    "// scripts/sync-from-live.sh; do not edit here.\n\n"
)
open(sys.argv[2], "w").write(header + text[start:end] + "\n")
PY

python3 "$SCRIPT_DIR/normalize-config.py"
python3 "$SCRIPT_DIR/scan-secrets.py" "$REPO_DIR"
echo "Sync complete. Live files were not changed."
