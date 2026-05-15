#!/usr/bin/env bash
set -euo pipefail

# pi-shared-config — standalone bootstrap
# Usage: curl -fsSL https://raw.githubusercontent.com/<org>/pi-shared-config/main/install.sh | bash

REPO_URL="https://github.com/<your-org>/pi-shared-config"
TMP_DIR=$(mktemp -d)
trap 'rm -rf "$TMP_DIR"' EXIT

echo "==> Cloning pi-shared-config..."
git clone --depth=1 "$REPO_URL" "$TMP_DIR" 2>/dev/null || {
  echo "Error: could not clone $REPO_URL" >&2
  exit 1
}

cd "$TMP_DIR"
bash setup.sh
