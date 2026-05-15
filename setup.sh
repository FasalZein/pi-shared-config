#!/usr/bin/env bash
set -euo pipefail

PI_AGENT_DIR="${PI_AGENT_DIR:-$HOME/.pi/agent}"

echo "==> pi-shared-config setup"
echo ""

# --- tia-runtime (with forked FFF) ---
if ! command -v tia &>/dev/null; then
  echo "==> Installing tia-runtime (FFF fork)..."
  if [[ -d tia-runtime ]]; then
    TIA_FFF_SOURCE=fork bash tia-runtime/install.sh tia install --search
  else
    TIA_FFF_SOURCE=fork bash <(curl -fsSL https://raw.githubusercontent.com/dalist1/tia-runtime/main/install.sh) tia install --search
  fi
  echo ""
else
  echo "==> tia-runtime already installed, skipping"
  echo "    (re-run installer to switch to FFF fork:"
  echo "     TIA_FFF_SOURCE=fork bash tia-runtime/install.sh tia install --search)"
fi

# --- Config files ---
echo "==> Copying models.json..."
mkdir -p "$PI_AGENT_DIR"
cp models.json "$PI_AGENT_DIR/models.json"

echo "==> Copying settings.json..."
cp settings.json "$PI_AGENT_DIR/settings.json"

echo "==> Copying AGENTS.md..."
cp AGENTS.md "$PI_AGENT_DIR/AGENTS.md"

echo "==> Copying APPEND_SYSTEM.md..."
cp APPEND_SYSTEM.md "$PI_AGENT_DIR/APPEND_SYSTEM.md"

echo "==> Copying keybindings.json..."
cp keybindings.json "$PI_AGENT_DIR/keybindings.json"

echo "==> Copying neon-glass theme..."
mkdir -p "$PI_AGENT_DIR/themes"
cp themes/neon-glass.json "$PI_AGENT_DIR/themes/neon-glass.json"

# --- Pi package (extensions auto-load) ---
echo "==> Installing pi package (extensions)..."
pi install . 2>/dev/null || echo "    (run 'pi install .' from repo root after pi is configured)"

# --- Install other pi packages ---
echo "==> Installing pi packages..."
for pkg in \
  "npm:pi-extmgr" \
  "git:github.com/prateekmedia/pi-hooks" \
  "git:github.com/nicobailon/pi-powerline-footer" \
  "git:github.com/ttttmr/pi-context" \
  "git:github.com/edxeth/pi-gpt-config" \
  "git:github.com/edxeth/pi-ptc-next" \
  "npm:pi-executor" \
  "git:github.com/edxeth/pi-tasks" \
  "npm:@tomooshi/condensed-milk-pi" \
  "npm:@sting8k/pi-vcc" \
  "git:github.com/edxeth/pi-better-skills" \
  "git:github.com/eko24ive/pi-ask" \
  "git:github.com/edxeth/pi-subagents"
do
  echo "  Installing $pkg..."
  pi install "$pkg" 2>/dev/null || echo "  (skip — pi not fully configured yet)"
done

echo ""
echo "==> Done!"
echo ""
echo "    Next step:"
echo "      tia pi"
echo ""
echo "    Note: Rift API key is baked into Rift itself — no need to change it."
echo "    Just make sure Rift is running on http://127.0.0.1:7439/v1"
