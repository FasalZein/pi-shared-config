#!/usr/bin/env bash
set -euo pipefail

SOURCE_DIR="${1:-${PI_AGENT_SOURCE_DIR:-$HOME/.pi/agent}}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
SOURCE_DIR="$(cd "$SOURCE_DIR" && pwd)"
SOURCE_HOME="$(cd "$SOURCE_DIR/../.." && pwd)"
SKILL_STORE_DIR="${SKILL_STORE_DIR:-$SOURCE_HOME/.agents}"
LOCAL_EXTENSIONS_DIR="${LOCAL_EXTENSIONS_DIR:-$SOURCE_HOME/Dev/AI/pi/extensions}"

ROOT_FILES=(
  settings.json
  models.json
  keybindings.json
  fancy-footer.json
  pi-codex-conversion.json
  pi-hub.json
  pi-auto-trees.json
  pi-vcc-config.json
  proxies.json
  trust.json
  AGENTS.md
  APPEND_SYSTEM.md
  REALTIME-SYSTEM-PROMPT.md
  oxlint.config.ts
  package.json
)
SYNC_DIRS=(agents docs templates themes extensions oxlint)
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
require_path "$SOURCE_DIR/npm/package.json"
require_path "$LOCAL_EXTENSIONS_DIR"
command -v rsync >/dev/null || { echo "rsync is required" >&2; exit 1; }
command -v python3 >/dev/null || { echo "python3 is required" >&2; exit 1; }

for file in "${ROOT_FILES[@]}"; do
  require_path "$SOURCE_DIR/$file"
done
for directory in "${SYNC_DIRS[@]}"; do
  require_path "$SOURCE_DIR/$directory"
done
for skill in bro msw cmux; do
  require_path "$SOURCE_DIR/skills/$skill"
done

echo "Syncing Pi configuration from $SOURCE_DIR"

for file in "${ROOT_FILES[@]}"; do
  if [[ "$file" != "models.json" ]]; then
    cp "$SOURCE_DIR/$file" "$REPO_DIR/$file"
  fi
done

python3 - "$SOURCE_DIR/models.json" "$REPO_DIR/models.json" <<'PY'
import json
import sys
from pathlib import Path

source, target = map(Path, sys.argv[1:])
data = json.loads(source.read_text())
try:
    data["providers"]["nahcrof"]["apiKey"] = "${NAHCROF_API_KEY}"
except (KeyError, TypeError) as error:
    raise SystemExit(f"models.json has no providers.nahcrof.apiKey: {error}")
target.write_text(json.dumps(data, indent=2) + "\n")
PY

for directory in "${SYNC_DIRS[@]}"; do
  sync_dir "$SOURCE_DIR/$directory" "$REPO_DIR/$directory"
done
sync_dir "$SOURCE_DIR/scripts" "$REPO_DIR/agent-scripts"

python3 - "$REPO_DIR/agents/verifiers/or-gpt4o.md" <<'PY'
import re
import sys
from pathlib import Path

path = Path(sys.argv[1])
if path.exists():
    text = path.read_text()
    text, count = re.subn(
        r"(?m)^\s*OPENAI_API_KEY=.*\n?",
        "",
        text,
    )
    if count > 1:
        raise SystemExit(f"expected at most one OPENAI_API_KEY assignment in {path}")
    path.write_text(text)
PY

skill_stage="$(mktemp -d)"
trap 'rm -rf "$skill_stage"' EXIT
for skill in bro msw cmux; do
  sync_dir "$SOURCE_DIR/skills/$skill" "$skill_stage/$skill"
done
cp "$SKILL_STORE_DIR/.skill-lock.json" "$skill_stage/.skill-lock.json"
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
    if entry.is_symlink()
}
target.write_text(json.dumps({"version": 1, "links": links}, indent=2) + "\n")
PY
rsync -a --delete "$skill_stage/" "$REPO_DIR/skills/"

python3 - "$SOURCE_DIR/npm/package.json" "$SOURCE_DIR/settings.json" "$LOCAL_EXTENSIONS_DIR" "$REPO_DIR/extension-manifest.json" "$SOURCE_HOME" <<'PY'
import json
import subprocess
import sys
from pathlib import Path

npm_path, settings_path, extensions_path, output_path = map(Path, sys.argv[1:5])
source_home = sys.argv[5]

def git_output(directory: Path, *args: str) -> str | None:
    result = subprocess.run(
        ["git", "-C", str(directory), *args],
        check=False,
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        return None
    value = result.stdout.strip()
    return value or None

npm_config = json.loads(npm_path.read_text())
settings = json.loads(settings_path.read_text())
extensions = []
for directory in sorted((path for path in extensions_path.iterdir() if path.is_dir() and not path.name.startswith(".")), key=lambda path: path.name):
    root = git_output(directory, "rev-parse", "--show-toplevel")
    if root != str(directory):
        extensions.append({
            "name": directory.name,
            "status": "not-a-git-repository",
            "remote": None,
            "commit": None,
        })
        continue
    commit = git_output(directory, "rev-parse", "--verify", "HEAD")
    extensions.append({
        "name": directory.name,
        "status": "git" if commit else "git-no-commits",
        "remote": git_output(directory, "remote", "get-url", "origin"),
        "commit": commit,
    })

manifest = {
    "version": 1,
    "sourceHome": source_home,
    "npmExtensions": dict(sorted(npm_config.get("dependencies", {}).items())),
    "piPackages": settings.get("packages", []),
    "localExtensions": extensions,
    "cursorBridge": {
        "name": "pi-cursor",
        "isPiExtension": False,
        "privateRepository": "https://github.com/isthatyousaf/pi-cursor.git",
        "repositoryAccess": "Only the FasalZein GitHub account can read this repository.",
        "startCommand": "bun run start",
        "loginCommand": "bun run login",
        "endpoint": "http://127.0.0.1:4001/v1",
        "modelProvider": "cursor",
        "runtimeContextCache": ".data/context-windows.json",
        "fastModelContextWindows": {
            "cursor-grok-4.6-high-fast": 256000,
            "cursor-grok-4.6-medium-fast": 256000,
            "cursor-grok-4.6-xhigh-fast": 256000,
        },
    },
}
output_path.write_text(json.dumps(manifest, indent=2) + "\n")
PY

python3 "$SCRIPT_DIR/scan-secrets.py" "$REPO_DIR"
echo "Sync complete. The live models.json was not changed."
