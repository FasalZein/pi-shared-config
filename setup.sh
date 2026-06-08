#!/usr/bin/env bash
set -euo pipefail

PI_AGENT_DIR="${PI_AGENT_DIR:-$HOME/.pi/agent}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUN_CODEX_LB_SETUP="${RUN_CODEX_LB_SETUP:-false}"
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
copy_file "$SCRIPT_DIR/models.json" "$PI_AGENT_DIR/models.json"
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
copy_file "$SCRIPT_DIR/extensions/eko24ive-pi-ask.json" "$PI_AGENT_DIR/extensions/eko24ive-pi-ask.json"

# The FFF extension is installed as npm:@ff-labs/pi-fff from settings.json.
# The old local wrapper imported an internal package path and failed on some machines.
rm -rf "$PI_AGENT_DIR/extensions/fff"

# --- Optional package reconciliation ---
# settings.json is the source of truth. `pi update --extensions` respects package filters
# while raw `pi install <pkg>` could re-add broken default extension entries.
if [[ "$INSTALL_PI_PACKAGES" == "true" ]] && command -v pi >/dev/null 2>&1; then
  echo "==> Reconciling Pi packages from settings.json..."
  pi update --extensions 2>/dev/null || echo "    (skip — pi packages will install/reconcile on next pi startup)"
else
  echo "==> Skipping Pi package reconciliation"
fi

# --- Optional codex-lb setup ---
if [[ "$RUN_CODEX_LB_SETUP" == "true" ]]; then
  echo "==> Running codex-lb beta setup..."
  bash "$SCRIPT_DIR/scripts/setup-codex-lb-beta.sh" --configure-pi --import-rift
else
  echo "==> codex-lb setup not run automatically"
  echo "    To install/start codex-lb beta separately:"
  echo "      bash scripts/setup-codex-lb-beta.sh --configure-pi --import-rift"
fi

echo ""
echo "==> Done!"
echo ""
echo "    Pi is configured for codex-lb at http://127.0.0.1:2455/v1"
echo "    Start codex-lb separately if it is not already running:"
echo "      bash scripts/setup-codex-lb-beta.sh --configure-pi --import-rift"
