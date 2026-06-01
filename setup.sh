#!/usr/bin/env bash
set -euo pipefail

PI_AGENT_DIR="${PI_AGENT_DIR:-$HOME/.pi/agent}"

echo "==> pi-shared-config setup"
echo ""

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

echo "==> Copying mocha theme..."
mkdir -p "$PI_AGENT_DIR/themes"
cp themes/mocha.json "$PI_AGENT_DIR/themes/mocha.json"

echo "==> Copying fancy-footer.json..."
cp fancy-footer.json "$PI_AGENT_DIR/fancy-footer.json"

echo "==> Copying subagent definitions..."
mkdir -p "$PI_AGENT_DIR/agents"
cp agents/*.md "$PI_AGENT_DIR/agents/"

# --- Pi package (extensions auto-load) ---
echo "==> Installing pi package (extensions)..."
pi install . 2>/dev/null || echo "    (run 'pi install .' from repo root after pi is configured)"

# --- Install other pi packages ---
echo "==> Installing pi packages..."
for pkg in \
  "npm:pi-extmgr" \
  "git:github.com/prateekmedia/pi-hooks" \
  "git:github.com/ttttmr/pi-context" \
  "git:github.com/edxeth/pi-gpt-config" \
  "git:github.com/edxeth/pi-ptc-next" \
  "git:github.com/edxeth/pi-tasks" \
  "npm:@tomooshi/condensed-milk-pi" \
  "npm:@sting8k/pi-vcc" \
  "git:github.com/edxeth/pi-better-skills" \
  "npm:pi-context-prune" \
  "git:github.com/eko24ive/pi-ask" \
  "git:github.com/edxeth/pi-subagents" \
  "git:github.com/mavam/pi-fancy-footer" \
  "npm:pi-formatter" \
  "npm:@howaboua/pi-auto-trees" \
  "git:github.com/edxeth/pi-ralph-loop"; do
  echo "  Installing $pkg..."
  pi install "$pkg" 2>/dev/null || echo "  (skip — pi not fully configured yet)"
done

echo ""
echo "==> Done!"
echo ""
echo "    Next step:"
echo "      pi"
echo ""
echo "    Note: Rift API key is baked into Rift itself — no need to change it."
echo "    Just make sure Rift is running on http://127.0.0.1:7439/v1"
