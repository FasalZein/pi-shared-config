#!/usr/bin/env bash
set -euo pipefail

PI_AGENT_DIR="${PI_AGENT_DIR:-$HOME/.pi/agent}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INSTALL_PI_PACKAGES="${INSTALL_PI_PACKAGES:-true}"
INSTALL_CONFIG_DEPENDENCIES="${INSTALL_CONFIG_DEPENDENCIES:-true}"
RESTORE_MANAGED_SKILLS="${RESTORE_MANAGED_SKILLS:-true}"

copy_file() {
  local src="$1"
  local dst="$2"
  mkdir -p "$(dirname "$dst")"
  cp "$src" "$dst"
}

copy_dir_contents() {
  local src="$1"
  local dst="$2"
  mkdir -p "$dst"
  cp -R "$src"/. "$dst"/
}

restore_managed_skills() {
  local home_lock="$HOME/skills-lock.json"
  local backup_lock=""
  local had_lock=false
  local result=0

  if ! command -v npx >/dev/null 2>&1; then
    echo "Error: npx is required to restore managed skills" >&2
    return 1
  fi

  if [[ -e "$home_lock" ]]; then
    backup_lock="$(mktemp)"
    cp "$home_lock" "$backup_lock"
    had_lock=true
  fi

  cp "$SCRIPT_DIR/skills/.skill-lock.json" "$home_lock"
  (cd "$HOME" && npx --yes skills experimental_install) || result=$?

  if [[ "$had_lock" == "true" ]]; then
    cp "$backup_lock" "$home_lock"
    rm -f "$backup_lock"
  else
    rm -f "$home_lock"
  fi

  return "$result"
}

echo "==> pi-shared-config restore"
echo "    target: $PI_AGENT_DIR"
echo ""

mkdir -p "$PI_AGENT_DIR"

if [[ -f "$PI_AGENT_DIR/models.json" ]]; then
  echo "==> Keeping existing models.json (it can contain live credentials)"
else
  copy_file "$SCRIPT_DIR/models.json" "$PI_AGENT_DIR/models.json"
fi

settings_was_existing=false
if [[ -f "$PI_AGENT_DIR/settings.json" ]]; then
  settings_was_existing=true
  node "$SCRIPT_DIR/scripts/merge-settings.mjs" "$SCRIPT_DIR/settings.json" "$PI_AGENT_DIR/settings.json"
  echo "==> Reconciled packages and kept existing personal settings"
else
  copy_file "$SCRIPT_DIR/settings.json" "$PI_AGENT_DIR/settings.json"
fi

for file in \
  AGENTS.md \
  APPEND_SYSTEM.md \
  REALTIME-SYSTEM-PROMPT.md \
  keybindings.json \
  fancy-footer.json \
  pi-codex-conversion.json \
  pi-hub.json \
  pi-auto-trees.json \
  pi-vcc-config.json \
  proxies.json \
  trust.json \
  oxlint.config.ts \
  package.json; do
  copy_file "$SCRIPT_DIR/$file" "$PI_AGENT_DIR/$file"
done

echo "==> Copying agents, documentation, templates, themes, extensions, lint rules, and agent scripts"
for directory in agents docs templates themes extensions oxlint; do
  copy_dir_contents "$SCRIPT_DIR/$directory" "$PI_AGENT_DIR/$directory"
done
copy_dir_contents "$SCRIPT_DIR/agent-scripts" "$PI_AGENT_DIR/scripts"

python3 - "$SCRIPT_DIR/extension-manifest.json" "$PI_AGENT_DIR" "$settings_was_existing" <<'PY'
import json
import sys
from pathlib import Path

manifest_path = Path(sys.argv[1])
target = Path(sys.argv[2])
settings_was_existing = sys.argv[3] == "true"
source_home = json.loads(manifest_path.read_text())["sourceHome"]
current_home = str(Path.home())
if source_home != current_home:
    roots = [
        target / "AGENTS.md",
        target / "APPEND_SYSTEM.md",
        target / "REALTIME-SYSTEM-PROMPT.md",
        target / "keybindings.json",
        target / "fancy-footer.json",
        target / "pi-codex-conversion.json",
        target / "pi-hub.json",
        target / "pi-auto-trees.json",
        target / "pi-vcc-config.json",
        target / "proxies.json",
        target / "trust.json",
        target / "oxlint.config.ts",
        target / "package.json",
        target / "agents",
        target / "docs",
        target / "templates",
        target / "themes",
        target / "extensions",
        target / "oxlint",
        target / "scripts",
    ]
    if not settings_was_existing:
        roots.append(target / "settings.json")
    for root in roots:
        files = [root] if root.is_file() else list(root.rglob("*")) if root.exists() else []
        for path in files:
            if not path.is_file():
                continue
            try:
                text = path.read_text()
            except UnicodeDecodeError:
                continue
            if source_home in text:
                path.write_text(text.replace(source_home, current_home))
PY

if [[ "$INSTALL_CONFIG_DEPENDENCIES" == "true" ]]; then
  if command -v npm >/dev/null 2>&1; then
    echo "==> Installing regenerable configuration dependencies"
    (cd "$PI_AGENT_DIR" && npm install --ignore-scripts --no-package-lock --no-audit --no-fund)
  else
    echo "Error: npm is required to install configuration dependencies" >&2
    exit 1
  fi
else
  echo "==> Skipping configuration dependency installation"
fi

echo "==> Restoring skills"
mkdir -p "$HOME/.agents/skills" "$PI_AGENT_DIR/skills"
if [[ "$RESTORE_MANAGED_SKILLS" == "true" ]]; then
  restore_managed_skills
else
  echo "    skipped managed skill download"
fi
copy_file "$SCRIPT_DIR/skills/.skill-lock.json" "$HOME/.agents/.skill-lock.json"
for skill in bro msw cmux; do
  copy_dir_contents "$SCRIPT_DIR/skills/$skill" "$PI_AGENT_DIR/skills/$skill"
done
python3 - "$SCRIPT_DIR/skills/symlinks.json" "$PI_AGENT_DIR/skills" <<'PY'
import json
import os
import sys
from pathlib import Path

manifest = json.loads(Path(sys.argv[1]).read_text())
target = Path(sys.argv[2])
for name, destination in manifest["links"].items():
    link = target / name
    if link.is_symlink() or link.exists():
        if link.is_symlink() and os.readlink(link) == destination:
            continue
        if not link.is_symlink():
            print(f"    keeping existing non-link skill: {name}")
            continue
        link.unlink()
    link.symlink_to(destination)
PY

if [[ "$INSTALL_PI_PACKAGES" == "true" ]] && command -v pi >/dev/null 2>&1; then
  echo "==> Reconciling Pi packages from settings.json"
  pi update --extensions 2>/dev/null || echo "    Pi will retry package installation on its next start"
else
  echo "==> Skipping Pi package reconciliation"
fi

echo ""
echo "==> Restore complete"
echo "    Add credentials with Pi login flows and the environment variables documented in README.md."
