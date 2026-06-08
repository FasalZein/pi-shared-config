#!/usr/bin/env bash
set -euo pipefail

# pi-shared-config — standalone Pi config bootstrap
# Usage: curl -fsSL https://raw.githubusercontent.com/FasalZein/pi-shared-config/main/install.sh | bash
#
# This installs Pi config only. For codex-lb setup/account import, clone the repo
# and run scripts/setup-codex-lb-beta.sh so the reusable script remains on disk.

REPO_URL="https://github.com/FasalZein/pi-shared-config"
TMP_DIR=$(mktemp -d)
trap 'rm -rf "$TMP_DIR"' EXIT

echo "==> Cloning pi-shared-config..."
git clone --depth=1 "$REPO_URL" "$TMP_DIR" 2>/dev/null || {
  echo "Error: could not clone $REPO_URL" >&2
  exit 1
}

cd "$TMP_DIR"
bash setup.sh

echo ""
echo "For codex-lb setup/account import, clone the repo persistently and run:"
echo "  bash scripts/setup-codex-lb-beta.sh --configure-pi --import-rift"
