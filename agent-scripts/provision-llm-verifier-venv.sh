#!/usr/bin/env bash
# Provision the llm-verifier venv that pi-subagents' llm-as-a-verifier feature needs.
#
# Why this script exists: pi-subagents auto-provisions the venv with
# `uv pip install llm-verifier==<pinned>`, but ~/.config/uv/uv.toml sets
# `require-hashes = true` (a deliberate supply-chain policy). Bare `uv pip install`
# is refused under that policy, so auto-provisioning always fails.
#
# This script satisfies the policy instead of weakening it: it compiles a fully
# hashed lock file, installs from it, and writes the marker.json that
# ensureVerifierRuntime() looks for so pi reuses the venv instead of rebuilding it.
#
# Re-run this if a forge launch reports the verifier runtime is missing.
set -euo pipefail

VERSION="${LLM_VERIFIER_VERSION:-0.2.0}"
ROOT="${PI_SUBAGENT_LLM_VERIFIER_VENV:-$HOME/.pi/agent/llm-verifier-venv}"
VENV="$ROOT/venv"
LOCK="$ROOT/requirements-locked.txt"

command -v uv >/dev/null || { echo "uv not on PATH" >&2; exit 1; }

echo "==> provisioning llm-verifier==$VERSION into $VENV"
mkdir -p "$ROOT"
rm -rf "$VENV"
uv venv "$VENV"

echo "==> compiling hashed lock file"
printf 'llm-verifier==%s\n' "$VERSION" > "$ROOT/requirements.in"
uv pip compile "$ROOT/requirements.in" --generate-hashes -o "$LOCK" --quiet

echo "==> installing from $LOCK"
uv pip install --python "$VENV/bin/python" -r "$LOCK" --quiet

echo "==> verifying import"
"$VENV/bin/python" -c "import llm_verifier; assert llm_verifier.__version__ == '$VERSION', llm_verifier.__version__; print('llm_verifier', llm_verifier.__version__)"

echo "==> writing marker.json so pi reuses this venv"
cat > "$ROOT/marker.json" <<EOF
{
  "version": "$VERSION",
  "provisioner": "uv",
  "createdAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF

rm -f "$ROOT/install.lock"
echo "==> done"
