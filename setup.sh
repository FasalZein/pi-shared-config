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

echo "==> pi-shared-config setup"
echo "    target: $PI_AGENT_DIR"
echo ""

# --- Config files ---
echo "==> Copying Pi config files..."
mkdir -p "$PI_AGENT_DIR"
if [[ -f "$PI_AGENT_DIR/models.json" ]]; then
  echo "    keeping existing models.json (providers are user-specific)"
else
  copy_file "$SCRIPT_DIR/models.json" "$PI_AGENT_DIR/models.json"
fi
copy_file "$SCRIPT_DIR/settings.json" "$PI_AGENT_DIR/settings.json"
copy_file "$SCRIPT_DIR/AGENTS.md" "$PI_AGENT_DIR/AGENTS.md"
copy_file "$SCRIPT_DIR/APPEND_SYSTEM.md" "$PI_AGENT_DIR/APPEND_SYSTEM.md"
copy_file "$SCRIPT_DIR/keybindings.json" "$PI_AGENT_DIR/keybindings.json"
copy_file "$SCRIPT_DIR/fancy-footer.json" "$PI_AGENT_DIR/fancy-footer.json"

# --- Themes ---
echo "==> Copying themes..."
copy_dir_contents "$SCRIPT_DIR/themes" "$PI_AGENT_DIR/themes"

# --- Subagents ---
echo "==> Copying subagent definitions..."
copy_dir_contents "$SCRIPT_DIR/agents" "$PI_AGENT_DIR/agents"

# --- Local extensions ---
# Copy explicitly so standalone install.sh can clone into a temp dir and delete it afterwards.
# Do not add this repo as a local Pi package path; that path may not exist later.
echo "==> Copying local extensions..."
mkdir -p "$PI_AGENT_DIR/extensions/cmux"
copy_file "$SCRIPT_DIR/extensions/cmux/index.ts" "$PI_AGENT_DIR/extensions/cmux/index.ts"
copy_file "$SCRIPT_DIR/extensions/pi-tps.ts" "$PI_AGENT_DIR/extensions/pi-tps.ts"
copy_file "$SCRIPT_DIR/extensions/full-context-bar.ts" "$PI_AGENT_DIR/extensions/full-context-bar.ts"
copy_file "$SCRIPT_DIR/extensions/morph-indicator.ts" "$PI_AGENT_DIR/extensions/morph-indicator.ts"
copy_file "$SCRIPT_DIR/extensions/eko24ive-pi-ask.json" "$PI_AGENT_DIR/extensions/eko24ive-pi-ask.json"

# Remove the old repo-managed FFF wrapper. FFF is not part of the current shared setup.
rm -rf "$PI_AGENT_DIR/extensions/fff"

# --- Optional package reconciliation ---
# settings.json is the source of truth. `pi update --extensions` respects package filters
# while raw `pi install <pkg>` can re-add package defaults this config disables.
if [[ "$INSTALL_PI_PACKAGES" == "true" ]] && command -v pi >/dev/null 2>&1; then
  echo "==> Reconciling Pi packages from settings.json..."
  pi update --extensions 2>/dev/null || echo "    (skip — pi packages will install/reconcile on next pi startup)"
else
  echo "==> Skipping Pi package reconciliation"
fi

echo ""
echo "==> Done!"
echo ""
echo "    Pi shared config installed. Keep your provider/model credentials in your own models.json."
