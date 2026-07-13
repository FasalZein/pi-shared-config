#!/usr/bin/env bash
set -euo pipefail

PI_AGENT_DIR="${PI_AGENT_DIR:-$HOME/.pi/agent}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INSTALL_PI_PACKAGES="${INSTALL_PI_PACKAGES:-true}"

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

copy_skill() {
  local src="$1"
  local name
  local dst
  name="$(basename "$src")"
  dst="$PI_AGENT_DIR/skills/$name"

  if [[ -f "$dst/SKILL.md" && ! -f "$dst/.pi-shared-config" ]]; then
    echo "    keeping existing skill: $name"
    return
  fi
  if [[ ! -f "$dst/SKILL.md" && -f "$HOME/.agents/skills/$name/SKILL.md" ]]; then
    echo "    using existing global skill: $name"
    return
  fi

  copy_dir_contents "$src" "$dst"
}

echo "==> pi-shared-config setup"
echo "    target: $PI_AGENT_DIR"
echo ""

echo "==> Updating Pi config files..."
mkdir -p "$PI_AGENT_DIR"
if [[ -f "$PI_AGENT_DIR/models.json" ]]; then
  echo "    keeping existing models.json (providers are user-specific)"
else
  copy_file "$SCRIPT_DIR/models.json" "$PI_AGENT_DIR/models.json"
fi
if [[ -f "$PI_AGENT_DIR/settings.json" ]]; then
  node "$SCRIPT_DIR/scripts/merge-settings.mjs" "$SCRIPT_DIR/settings.json" "$PI_AGENT_DIR/settings.json"
  echo "    reconciled shared packages; preserved personal settings"
else
  copy_file "$SCRIPT_DIR/settings.json" "$PI_AGENT_DIR/settings.json"
fi
copy_file "$SCRIPT_DIR/AGENTS.md" "$PI_AGENT_DIR/AGENTS.md"
copy_file "$SCRIPT_DIR/APPEND_SYSTEM.md" "$PI_AGENT_DIR/APPEND_SYSTEM.md"
copy_file "$SCRIPT_DIR/keybindings.json" "$PI_AGENT_DIR/keybindings.json"
copy_file "$SCRIPT_DIR/fancy-footer.json" "$PI_AGENT_DIR/fancy-footer.json"

echo "==> Copying themes..."
copy_dir_contents "$SCRIPT_DIR/themes" "$PI_AGENT_DIR/themes"

echo "==> Updating subagent definitions..."
mkdir -p "$PI_AGENT_DIR/agents"
for agent_file in "$SCRIPT_DIR"/agents/*.md; do
  target="$PI_AGENT_DIR/agents/$(basename "$agent_file")"
  if [[ -f "$target" ]]; then
    node "$SCRIPT_DIR/scripts/merge-agent.mjs" "$agent_file" "$target"
  else
    copy_file "$agent_file" "$target"
  fi
done

echo "==> Installing subagent skills..."
for skill_dir in "$SCRIPT_DIR"/skills/*; do
  [[ -d "$skill_dir" ]] || continue
  copy_skill "$skill_dir"
done

echo "==> Copying local extensions..."
mkdir -p "$PI_AGENT_DIR/extensions"
copy_file "$SCRIPT_DIR/extensions/pi-tps.ts" "$PI_AGENT_DIR/extensions/pi-tps.ts"
copy_file "$SCRIPT_DIR/extensions/morph-indicator.ts" "$PI_AGENT_DIR/extensions/morph-indicator.ts"
copy_file "$SCRIPT_DIR/extensions/eko24ive-pi-ask.json" "$PI_AGENT_DIR/extensions/eko24ive-pi-ask.json"

# Remove files previously installed by this repo that current Pi/fancy-footer supersedes.
rm -f "$PI_AGENT_DIR/extensions/full-context-bar.ts"
rm -rf "$PI_AGENT_DIR/extensions/cmux"

if [[ "$INSTALL_PI_PACKAGES" == "true" ]] && command -v pi >/dev/null 2>&1; then
  echo "==> Reconciling Pi packages from settings.json..."
  pi update --extensions 2>/dev/null || echo "    (skip — pi packages will install/reconcile on next pi startup)"
else
  echo "==> Skipping Pi package reconciliation"
fi

echo ""
echo "==> Done!"
echo ""
echo "    Shared config updated. Existing provider/model credentials and personal settings were preserved."
