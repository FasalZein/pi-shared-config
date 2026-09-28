#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TEST_HOME="$(mktemp -d)"
trap 'rm -rf "$TEST_HOME"' EXIT
TARGET="$TEST_HOME/.pi/agent"
mkdir -p "$TARGET/extensions"
printf 'old extension\n' > "$TARGET/extensions/old.ts"
printf '{"providers":{"rejected":{}}}\n' > "$TARGET/models.json"
NETWORK_GUARD_BIN="$TEST_HOME/network-guard"
mkdir -p "$NETWORK_GUARD_BIN"
for command in npm npx pi; do
  cat > "$NETWORK_GUARD_BIN/$command" <<'SH'
#!/usr/bin/env bash
printf '%s\n' "$(basename "$0")" >> "$HOME/network-command-invoked"
exit 91
SH
  chmod +x "$NETWORK_GUARD_BIN/$command"
done
cat > "$TARGET/settings.json" <<'JSON'
{
  "personalSetting": true,
  "enabledModels": ["cursor/grok-code-fast-1"],
  "packages": ["npm:rejected@1.0.0"],
  "extensions": ["/tmp/rejected.ts"],
  "retry": {"enabled": false}
}
JSON

HOME="$TEST_HOME" \
PI_AGENT_DIR="$TARGET" \
PATH="$NETWORK_GUARD_BIN:$PATH" \
INSTALL_PI_PACKAGES=false \
INSTALL_CONFIG_DEPENDENCIES=false \
RESTORE_MANAGED_SKILLS=false \
bash "$REPO_DIR/setup.sh"

cmp "$REPO_DIR/models.json" "$TARGET/models.json"
test ! -e "$TEST_HOME/network-command-invoked"
python3 - "$REPO_DIR/settings.json" "$TARGET/settings.json" <<'PY'
import json
import sys
from pathlib import Path

expected = json.loads(Path(sys.argv[1]).read_text())
actual = json.loads(Path(sys.argv[2]).read_text())
for key in ("enabledModels", "packages", "extensions"):
    if actual.get(key) != expected.get(key):
        raise SystemExit(f"restored settings mismatch for {key}")
if actual.get("personalSetting") is not True:
    raise SystemExit("personal settings were not preserved")
if actual.get("retry") != {"enabled": False}:
    raise SystemExit("unmanaged settings were overwritten")
PY

test -f "$TARGET/extensions/pi-tps.ts"
test -f "$TARGET/extensions/skill-gate.ts"
test -f "$TARGET/extensions/eko24ive-pi-ask.json"
test "$(find "$TARGET/extensions" -mindepth 1 -maxdepth 1 | wc -l | tr -d ' ')" = "3"
BACKUP="$(find "$TARGET" -maxdepth 1 -type d -name 'extensions.backup-*' -print -quit)"
test -n "$BACKUP"
cmp <(printf 'old extension\n') "$BACKUP/old.ts"
test ! -e "$TARGET/agents/linear.md"
test -f "$TEST_HOME/.agents/.skill-lock.json"
test ! -e "$TARGET/skills/to-prd"
test ! -e "$TARGET/skills/to-slices"

FAKE_BIN="$TEST_HOME/bin"
mkdir -p "$FAKE_BIN"
cat > "$FAKE_BIN/npx" <<'SH'
#!/usr/bin/env bash
cp "$HOME/skills-lock.json" "$HOME/lock-seen-by-npx.json"
exit "${FAKE_NPX_STATUS:-0}"
SH
chmod +x "$FAKE_BIN/npx"

LOCK_HOME="$TEST_HOME/lock-existing"
mkdir -p "$LOCK_HOME"
printf 'personal lock\n' > "$LOCK_HOME/skills-lock.json"
HOME="$LOCK_HOME" \
PI_AGENT_DIR="$LOCK_HOME/.pi/agent" \
PATH="$FAKE_BIN:/usr/bin:/bin" \
INSTALL_PI_PACKAGES=false \
INSTALL_CONFIG_DEPENDENCIES=false \
RESTORE_MANAGED_SKILLS=true \
bash "$REPO_DIR/setup.sh" >/dev/null
cmp <(printf 'personal lock\n') "$LOCK_HOME/skills-lock.json"
cmp "$REPO_DIR/skills/.skill-lock.json" "$LOCK_HOME/lock-seen-by-npx.json"

FAILED_LOCK_HOME="$TEST_HOME/lock-failed"
mkdir -p "$FAILED_LOCK_HOME"
printf 'personal lock after failure\n' > "$FAILED_LOCK_HOME/skills-lock.json"
if HOME="$FAILED_LOCK_HOME" \
  PI_AGENT_DIR="$FAILED_LOCK_HOME/.pi/agent" \
  PATH="$FAKE_BIN:/usr/bin:/bin" \
  FAKE_NPX_STATUS=7 \
  INSTALL_PI_PACKAGES=false \
  INSTALL_CONFIG_DEPENDENCIES=false \
  RESTORE_MANAGED_SKILLS=true \
  bash "$REPO_DIR/setup.sh" >"$FAILED_LOCK_HOME/output" 2>&1; then
  echo "setup unexpectedly ignored a managed-skill restore failure" >&2
  exit 1
fi
cmp <(printf 'personal lock after failure\n') "$FAILED_LOCK_HOME/skills-lock.json"
cmp "$REPO_DIR/skills/.skill-lock.json" "$FAILED_LOCK_HOME/lock-seen-by-npx.json"

LOCK_HOME="$TEST_HOME/lock-new"
mkdir -p "$LOCK_HOME"
HOME="$LOCK_HOME" \
PI_AGENT_DIR="$LOCK_HOME/.pi/agent" \
PATH="$FAKE_BIN:/usr/bin:/bin" \
INSTALL_PI_PACKAGES=false \
INSTALL_CONFIG_DEPENDENCIES=false \
RESTORE_MANAGED_SKILLS=true \
bash "$REPO_DIR/setup.sh" >/dev/null
test ! -e "$LOCK_HOME/skills-lock.json"
cmp "$REPO_DIR/skills/.skill-lock.json" "$LOCK_HOME/lock-seen-by-npx.json"
cmp "$REPO_DIR/settings.json" "$LOCK_HOME/.pi/agent/settings.json"
cmp "$REPO_DIR/models.json" "$LOCK_HOME/.pi/agent/models.json"

NO_NPX_HOME="$TEST_HOME/no-npx"
mkdir -p "$NO_NPX_HOME"
if HOME="$NO_NPX_HOME" \
  PI_AGENT_DIR="$NO_NPX_HOME/.pi/agent" \
  PATH="/usr/bin:/bin" \
  INSTALL_PI_PACKAGES=false \
  INSTALL_CONFIG_DEPENDENCIES=false \
  RESTORE_MANAGED_SKILLS=true \
  bash "$REPO_DIR/setup.sh" >"$NO_NPX_HOME/output" 2>&1; then
  echo "setup unexpectedly restored managed skills without npx" >&2
  exit 1
fi
grep -q "Error: npx is required to restore managed skills" "$NO_NPX_HOME/output"

NORMALIZE_ROOT="$TEST_HOME/normalize"
mkdir -p "$NORMALIZE_ROOT/scripts" "$NORMALIZE_ROOT/agents"
cp "$REPO_DIR/scripts/normalize-config.py" "$NORMALIZE_ROOT/scripts/normalize-config.py"
cp "$REPO_DIR/extension-manifest.json" "$NORMALIZE_ROOT/extension-manifest.json"
cat > "$NORMALIZE_ROOT/settings.json" <<'JSON'
{"enabledModels":["anthropic/claude-opus-5","grok-cli/grok-4.7","cursor/grok-code-fast-1"],"packages":["rejected"],"extensions":["rejected"],"lsp":{}}
JSON
cat > "$NORMALIZE_ROOT/models.json" <<'JSON'
{"providers":{"anthropic":{"models":[{"id":"claude-opus-5"},{"id":"grok-4"}],"modelOverrides":{"claude-opus-5":{},"grok-4":{}}},"openai-codex":{"models":[{"id":"gpt-6-astra"}]},"kiro":{"models":[{"id":"claude-opus-4-8-thinking"}]},"cpa":{"models":[{"id":"gpt-5.6-sol"}]},"gnrt":{"models":[{"id":"claude-opus-5"}]},"grok-cli":{"modelOverrides":{"grok-4.7":{"name":"Grok 4.7"}}},"rejected":{"models":[{"id":"grok-4"}]}}}
JSON
cat > "$NORMALIZE_ROOT/agents/worker.md" <<'EOF_AGENT'
---
model: cpa/gpt-5.6-sol
allowed-models: cpa/gpt-5.6-terra:high, anthropic/claude-opus-5:medium
---
EOF_AGENT
cat > "$NORMALIZE_ROOT/agents/alias.md" <<'EOF_AGENT'
---
model: anthropic/claude-opus-5
extensions: npm:eko24ive/pi-ask@old
---
EOF_AGENT
cat > "$NORMALIZE_ROOT/agents/scout.md" <<'EOF_AGENT'
---
model: grok-cli/grok-4.7
llm-as-a-verifier-model: anthropic/claude-opus-5
allowed-models: anthropic/claude-opus-5, grok-cli/grok-4.7:high, cursor/grok-code-fast-1
extensions: ~/.pi/agent/extensions/pi-tps.ts, git:github.com/edxeth/pi-claude-auth@old, git:github.com/edxeth/pi-subagents@old, git:github.com/edxeth/pi-tasks@old, npm:@howaboua/pi-codex-conversion@old, git:github.com/edxeth/pi-better-skills@old, npm:@eko24ive/pi-ask@old, npm:eko24ive/pi-ask@old, npm:pi-fancy-footer@old, git:github.com/edxeth/pi-ralph-loop@old, npm:pi-grok-cli@old, npm:rejected@1
 tools: unchanged
tools: read,lsp,ast_grep_search,fold,bash
---
Before changing a shared symbol, run `lsp` references.
After every TypeScript edit, read the post-edit `lsp` diagnostics and fix type errors before moving on; use `lsp` `find_references` before renaming a component or prop.
- For any fan-out (scanning many files, counting/grouping matches, reading a tree), use one `fold` call — its nested reads and greps stay out of your context and only the returned value lands. A `bash` loop with compact output is the fallback.
- Prefer `lsp` for symbol definitions, references, and types. Fall back to text search when the language server cannot answer.
- Use `ast_grep_search` only for syntax shapes text search cannot express reliably (calls regardless of formatting, structural patterns, API-migration shapes). Lexical first, AST second.
- ticket or spec context the review depends on is absent from your brief (you have no Linear access; it arrives as a ticket-brief artifact path)
- Prefer static inspection first. Confirm structural smells (Duplicated Code, Repeated Switches, Shotgun Surgery) with `ast_grep_search` when text grep is ambiguous — a pattern match across files is evidence, a hunch is not.
2. Use `lsp` (`goto_definition`, `find_references`, `diagnostics`) to check a symbol's callers and types before rating a finding; fall back to text search only when the server cannot answer.
EOF_AGENT

python3 "$NORMALIZE_ROOT/scripts/normalize-config.py"
python3 "$NORMALIZE_ROOT/scripts/normalize-config.py"
python3 - "$NORMALIZE_ROOT" "$REPO_DIR/extension-manifest.json" <<'PY'
import json
import sys
from pathlib import Path

root = Path(sys.argv[1])
packages = json.loads(Path(sys.argv[2]).read_text())["packages"]
settings = json.loads((root / "settings.json").read_text())
assert settings["enabledModels"] == ["anthropic/claude-opus-5", "grok-cli/grok-4.7"]
assert settings["packages"] == packages
assert settings["extensions"] == []
assert "lsp" not in settings
models = json.loads((root / "models.json").read_text())["providers"]
assert set(models) == {"anthropic", "openai-codex", "kiro", "cpa", "gnrt", "grok-cli"}
assert models["anthropic"]["models"] == [{"id": "claude-opus-5"}]
assert models["anthropic"]["modelOverrides"] == {"claude-opus-5": {}}
assert models["grok-cli"]["modelOverrides"] == {"grok-4.7": {"name": "Grok 4.7"}}
agent = (root / "agents/scout.md").read_text()
alias = (root / "agents/alias.md").read_text()
worker = (root / "agents/worker.md").read_text()
assert "npm:@eko24ive/pi-ask@1.2.0" in alias
assert "model: openai-codex/gpt-5.6-sol" in worker
assert "openai-codex/gpt-5.6-terra:high" in worker
assert "anthropic/claude-opus-5:medium" in worker
assert "cpa/gpt-" not in worker
assert "model: grok-cli/grok-4.7" in agent
assert "grok-cli/grok-4.7:high" in agent
assert "thinking:" not in agent
assert "cursor/grok" not in agent
assert "tools: read,bash" in agent
assert "npm:rejected" not in agent
for package in packages:
    assert package in agent
assert "Before changing a shared symbol, search for every reference." in agent
assert "run the project typecheck and fix errors" in agent
assert "use one bounded `bash` command" in agent
assert "you have no Linear access" not in agent
assert "Confirm structural smells with targeted searches" in agent
assert "Use targeted text search and the project typecheck" in agent
PY

cat > "$NORMALIZE_ROOT/agents/worker.md" <<'EOF_AGENT'
---
model: cursor/grok-code-fast-1
---
EOF_AGENT
if python3 "$NORMALIZE_ROOT/scripts/normalize-config.py" >"$NORMALIZE_ROOT/error" 2>&1; then
  echo "normalizer unexpectedly accepted a model outside Claude, GPT, and grok-cli" >&2
  exit 1
fi
grep -q "no Claude, GPT, or grok-cli replacement specified" "$NORMALIZE_ROOT/error"

SYNC_REPO="$TEST_HOME/sync-repo"
SYNC_HOME="$TEST_HOME/live-home"
LIVE_AGENT="$SYNC_HOME/.pi/agent"
mkdir -p "$SYNC_REPO" "$LIVE_AGENT/agents" "$LIVE_AGENT/extensions" \
  "$LIVE_AGENT/scripts" "$LIVE_AGENT/skills" "$SYNC_HOME/.agents"
rsync -a --exclude '.git' "$REPO_DIR/" "$SYNC_REPO/"
for file in settings.json models.json keybindings.json fancy-footer.json \
  pi-codex-conversion.json proxies.json trust.json REALTIME-SYSTEM-PROMPT.md \
  oxlint.config.ts; do
  cp "$SYNC_REPO/$file" "$LIVE_AGENT/$file"
done
for directory in templates themes oxlint; do
  cp -R "$SYNC_REPO/$directory" "$LIVE_AGENT/$directory"
done
for agent in architect cleaner design-builder design forge github hardener researcher reviewer scout worker; do
  cp "$SYNC_REPO/agents/$agent.md" "$LIVE_AGENT/agents/$agent.md"
done
for skill in bro msw cmux; do
  cp -R "$SYNC_REPO/skills/$skill" "$LIVE_AGENT/skills/$skill"
done
python3 - "$SYNC_REPO/skills/symlinks.json" "$LIVE_AGENT/skills" <<'PY'
import json
import os
import sys
from pathlib import Path

manifest = json.loads(Path(sys.argv[1]).read_text())
target = Path(sys.argv[2])
for name, destination in manifest["links"].items():
    os.symlink(destination, target / name)
os.symlink("/tmp/retired-prd", target / "to-prd")
os.symlink("/tmp/retired-slices", target / "to-slices")
PY
printf '// live pi-tps marker\n' > "$LIVE_AGENT/extensions/pi-tps.ts"
printf '// live skill-gate marker\n' > "$LIVE_AGENT/extensions/skill-gate.ts"
printf '{"liveSyncMarker":true}\n' > "$LIVE_AGENT/extensions/eko24ive-pi-ask.json"
cp "$SYNC_REPO/skills/.skill-lock.json" "$SYNC_HOME/.agents/.skill-lock.json"
for file in keybindings.json fancy-footer.json pi-codex-conversion.json proxies.json trust.json; do
  printf '{"liveSyncMarker":"%s"}\n' "$file" > "$LIVE_AGENT/$file"
done
printf 'live prompt\n' > "$LIVE_AGENT/REALTIME-SYSTEM-PROMPT.md"
printf 'export default { liveSyncMarker: true };\n' > "$LIVE_AGENT/oxlint.config.ts"
printf 'live script\n' > "$LIVE_AGENT/scripts/live-script"
for directory in templates themes oxlint; do
  printf 'live %s\n' "$directory" > "$LIVE_AGENT/$directory/live-sync-marker"
done
for agent in architect cleaner design-builder design forge github hardener researcher reviewer scout worker; do
  printf '\nLive agent marker: %s.\n' "$agent" >> "$LIVE_AGENT/agents/$agent.md"
done
for skill in bro msw cmux; do
  printf 'live %s\n' "$skill" > "$LIVE_AGENT/skills/$skill/live-sync-marker"
done
python3 - "$LIVE_AGENT/settings.json" "$LIVE_AGENT/models.json" "$LIVE_AGENT/agents/scout.md" <<'PY'
import json
import sys
from pathlib import Path

settings_path, models_path, scout_path = map(Path, sys.argv[1:])
settings = json.loads(settings_path.read_text())
settings["liveSyncMarker"] = True
settings["enabledModels"].extend(["grok-cli/grok-4.7", "cursor/grok-4"])
settings["packages"] = ["npm:rejected@1"]
settings["extensions"] = ["/tmp/rejected.ts"]
settings_path.write_text(json.dumps(settings, indent=2) + "\n")
models = json.loads(models_path.read_text())
models["providers"]["anthropic"]["models"].extend([{"id": "claude-live-sync"}, {"id": "grok-4"}])
models["providers"]["grok-cli"]["modelOverrides"]["grok-live-sync"] = {"name": "Live Grok"}
models["providers"]["rejected"] = {"models": [{"id": "grok-4"}]}
models_path.write_text(json.dumps(models, indent=2) + "\n")
scout = scout_path.read_text()
if "model: grok-cli/grok-4.7" not in scout or "\nallowed-models:" not in scout:
    raise SystemExit("live scout fixture lost its grok-cli route before sync")
scout_path.write_text(
    scout.replace("\nallowed-models:", "\nallowed-models: cursor/grok-4, grok-cli/grok-4.7:high,", 1)
)
PY
printf 'remove me\n' > "$SYNC_REPO/skills/remove-me"
printf 'remove me\n' > "$SYNC_REPO/extensions/remove-me"

mv "$LIVE_AGENT/models.json" "$LIVE_AGENT/models.json.missing"
if bash "$SYNC_REPO/scripts/sync-from-live.sh" "$LIVE_AGENT" >"$TEST_HOME/sync-error" 2>&1; then
  echo "live sync unexpectedly accepted a missing required file" >&2
  exit 1
fi
grep -q "Missing required source: $LIVE_AGENT/models.json" "$TEST_HOME/sync-error"
mv "$LIVE_AGENT/models.json.missing" "$LIVE_AGENT/models.json"

METADATA_BEFORE="$TEST_HOME/managed-metadata.before.json"
cp "$SYNC_REPO/skills/managed-metadata.json" "$METADATA_BEFORE"
LIVE_MODELS_BEFORE="$TEST_HOME/live-models.before.json"
LIVE_SETTINGS_BEFORE="$TEST_HOME/live-settings.before.json"
LIVE_WORKER_BEFORE="$TEST_HOME/live-worker.before.md"
cp "$LIVE_AGENT/models.json" "$LIVE_MODELS_BEFORE"
cp "$LIVE_AGENT/settings.json" "$LIVE_SETTINGS_BEFORE"
cp "$LIVE_AGENT/agents/worker.md" "$LIVE_WORKER_BEFORE"
bash "$SYNC_REPO/scripts/sync-from-live.sh" "$LIVE_AGENT" >/dev/null
cmp "$METADATA_BEFORE" "$SYNC_REPO/skills/managed-metadata.json"
cmp "$LIVE_MODELS_BEFORE" "$LIVE_AGENT/models.json"
cmp "$LIVE_SETTINGS_BEFORE" "$LIVE_AGENT/settings.json"
cmp "$LIVE_WORKER_BEFORE" "$LIVE_AGENT/agents/worker.md"
for file in keybindings.json fancy-footer.json pi-codex-conversion.json proxies.json trust.json \
  REALTIME-SYSTEM-PROMPT.md oxlint.config.ts; do
  cmp "$LIVE_AGENT/$file" "$SYNC_REPO/$file"
done
for directory in templates themes oxlint; do
  cmp "$LIVE_AGENT/$directory/live-sync-marker" "$SYNC_REPO/$directory/live-sync-marker"
done
cmp "$LIVE_AGENT/scripts/live-script" "$SYNC_REPO/agent-scripts/live-script"
for agent in architect cleaner design-builder design forge github hardener researcher reviewer scout worker; do
  grep -q "Live agent marker: $agent" "$SYNC_REPO/agents/$agent.md"
done
for skill in bro msw cmux; do
  cmp "$LIVE_AGENT/skills/$skill/live-sync-marker" "$SYNC_REPO/skills/$skill/live-sync-marker"
done
cmp "$LIVE_AGENT/extensions/pi-tps.ts" "$SYNC_REPO/extensions/pi-tps.ts"
cmp "$LIVE_AGENT/extensions/skill-gate.ts" "$SYNC_REPO/extensions/skill-gate.ts"
cmp "$LIVE_AGENT/extensions/eko24ive-pi-ask.json" "$SYNC_REPO/extensions/eko24ive-pi-ask.json"
grep -q 'claude-live-sync' "$SYNC_REPO/models.json"
grep -q 'grok-live-sync' "$SYNC_REPO/models.json"
grep -q 'grok-cli/grok-4.7' "$SYNC_REPO/settings.json"
grep -q 'model: grok-cli/grok-4.7' "$SYNC_REPO/agents/scout.md"
grep -q 'grok-cli/grok-4.7:high' "$SYNC_REPO/agents/scout.md"
python3 - "$SYNC_REPO/models.json" "$SYNC_REPO/settings.json" "$SYNC_REPO/agents/scout.md" <<'PY'
import json
import sys
from pathlib import Path

models, settings, scout = map(Path, sys.argv[1:])
provider_names = set(json.loads(models.read_text())["providers"])
if "rejected" in provider_names or "grok-cli" not in provider_names:
    raise SystemExit(f"live sync kept the wrong providers: {sorted(provider_names)}")
if "cursor/grok-4" in settings.read_text() or "cursor/grok-4" in scout.read_text():
    raise SystemExit("live sync kept a rejected cursor grok route")
PY
grep -q '"liveSyncMarker": true' "$SYNC_REPO/settings.json"
test ! -e "$SYNC_REPO/skills/remove-me"
test ! -e "$SYNC_REPO/extensions/remove-me"
test "$(find "$SYNC_REPO/extensions" -mindepth 1 -maxdepth 1 | wc -l | tr -d ' ')" = "3"
python3 "$SYNC_REPO/scripts/check-config.py" >/dev/null
python3 - "$SYNC_REPO/skills/managed-metadata.json" "$SYNC_REPO/skills/symlinks.json" <<'PY'
import json
import sys
from pathlib import Path

metadata = json.loads(Path(sys.argv[1]).read_text())
if metadata.get("grill-me", {}).get("disable-model-invocation") is not True:
    raise SystemExit("live sync did not preserve the grill-me command-only rule")
manifest = json.loads(Path(sys.argv[2]).read_text())
if manifest.get("version") != 1:
    raise SystemExit("live sync wrote the wrong skill-link manifest version")
links = manifest["links"]
if "design-md" not in links:
    raise SystemExit("live sync did not retain an active skill link")
if {"to-prd", "to-slices"} & links.keys():
    raise SystemExit("live sync retained a retired skill link")
PY

echo "Isolated setup, normalization, and live-sync smoke tests passed."
