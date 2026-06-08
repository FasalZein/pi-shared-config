#!/usr/bin/env bash
set -euo pipefail

# Standalone codex-lb beta setup for macOS/Linux.
# - Clones or updates Soju06/codex-lb
# - Selects newest origin/release/beta-* branch unless --branch is supplied
# - Installs Python deps with uv and builds frontend assets with bun
# - Writes a local HTTP-only .env.local
# - On macOS, installs a launchd user service
# - Optionally imports Rift/flat-token account JSON folders into codex-lb
# - Optionally patches Pi models/settings config from rift -> codex
#
# Secrets: this script never prints access_token, refresh_token, id_token, or proxy passwords.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_URL="https://github.com/Soju06/codex-lb.git"
INSTALL_DIR="${HOME}/Dev/code-forge/codex-lb"
DATA_DIR="${HOME}/.codex-lb"
HOST="127.0.0.1"
PORT="2455"
BRANCH=""
LABEL="dev.codex-lb.beta"
AUTH_MODE="disabled"
UPSTREAM_TRANSPORT="http"
CONFIGURE_PI="false"
IMPORT_RIFT="false"
START_SERVICE="true"
BUILD_FRONTEND="true"
ACCOUNT_DIRS=()
PI_AGENT_DIR="${HOME}/.pi/agent"

usage() {
  cat <<'EOF'
Usage:
  setup-codex-lb-beta.sh [options]

Common:
  setup-codex-lb-beta.sh --configure-pi --import-rift
  setup-codex-lb-beta.sh --accounts-dir ~/Downloads/codex-6
  setup-codex-lb-beta.sh --install-dir ~/Dev/code-forge/codex-lb --port 2455

Options:
  --branch <remote-branch>     Beta branch to use, e.g. origin/release/beta-1.20.0-beta.3.
                              Default: newest origin/release/beta-* by semver-ish version sort.
  --install-dir <path>         codex-lb checkout path. Default: ~/Dev/code-forge/codex-lb
  --data-dir <path>            codex-lb data/log/db dir. Default: ~/.codex-lb
  --host <host>                Bind host. Default: 127.0.0.1
  --port <port>                Bind port. Default: 2455
  --auth-mode <mode>           codex-lb dashboard auth mode. Default: disabled
                              Use disabled only for local/private machines.
  --transport <http|auto|websocket>
                              Upstream stream transport. Default: http
  --configure-pi               Backup and patch ~/.pi/agent/models.json and settings.json:
                              rift provider -> codex provider at http://127.0.0.1:<port>/v1,
                              rift/* enabled models -> codex/*, transport -> sse.
  --import-rift                Import JSON accounts from ~/.rift/accounts/codex if present.
  --accounts-dir <path>        Import Rift/flat-token JSON or codex auth.json files from this folder.
                              Can be provided multiple times.
  --no-start                   Do not start/install background service.
  --no-frontend-build          Skip frontend asset build.
  --help                       Show this help.

Account import:
  Accepted inputs:
    1. Rift/flat JSON with top-level access_token, refresh_token, id_token, account_id.
    2. codex-lb/Codex auth.json with nested tokens object.
  Imported through local codex-lb API after service is healthy.
  Temporary converted auth files are written under the data dir with mode 0600 and deleted after import.

macOS background service:
  Installs ~/Library/LaunchAgents/dev.codex-lb.beta.plist and runs codex-lb via uv.

Linux:
  This script installs/builds codex-lb and can run foreground checks, but does not install systemd yet.
EOF
}

log() { printf '[codex-lb-setup] %s\n' "$*"; }
warn() { printf '[codex-lb-setup] WARNING: %s\n' "$*" >&2; }
fail() { printf '[codex-lb-setup] ERROR: %s\n' "$*" >&2; exit 1; }

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || fail "Missing required command: $1"
}

json_escape() {
  python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$1"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --branch) BRANCH="${2:-}"; shift 2 ;;
    --install-dir) INSTALL_DIR="${2:-}"; shift 2 ;;
    --data-dir) DATA_DIR="${2:-}"; shift 2 ;;
    --host) HOST="${2:-}"; shift 2 ;;
    --port) PORT="${2:-}"; shift 2 ;;
    --auth-mode) AUTH_MODE="${2:-}"; shift 2 ;;
    --transport) UPSTREAM_TRANSPORT="${2:-}"; shift 2 ;;
    --configure-pi) CONFIGURE_PI="true"; shift ;;
    --import-rift) IMPORT_RIFT="true"; shift ;;
    --accounts-dir) ACCOUNT_DIRS+=("${2:-}"); shift 2 ;;
    --no-start) START_SERVICE="false"; shift ;;
    --no-frontend-build) BUILD_FRONTEND="false"; shift ;;
    --help|-h) usage; exit 0 ;;
    *) fail "Unknown option: $1" ;;
  esac
done

case "$UPSTREAM_TRANSPORT" in
  http|auto|websocket) ;;
  *) fail "--transport must be http, auto, or websocket" ;;
esac

require_cmd git
require_cmd python3
require_cmd curl
require_cmd uv
if [[ "$BUILD_FRONTEND" == "true" ]]; then
  require_cmd bun
fi

mkdir -p "$DATA_DIR"

select_latest_beta_branch() {
  git -C "$INSTALL_DIR" branch -r --list 'origin/release/beta-*' \
    | sed 's/^ *//' \
    | sort -V \
    | tail -n 1
}

ensure_repo() {
  if [[ -d "$INSTALL_DIR/.git" ]]; then
    log "Using existing codex-lb repo: $INSTALL_DIR"
    git -C "$INSTALL_DIR" fetch origin --prune
    local dirty
    dirty="$(git -C "$INSTALL_DIR" status --porcelain)"
    if [[ -n "$dirty" ]]; then
      fail "codex-lb repo has uncommitted changes. Commit/stash them or use --install-dir for a clean checkout."
    fi
  else
    log "Cloning codex-lb into $INSTALL_DIR"
    mkdir -p "$(dirname "$INSTALL_DIR")"
    git clone "$REPO_URL" "$INSTALL_DIR"
    git -C "$INSTALL_DIR" fetch origin --prune
  fi

  if [[ -z "$BRANCH" ]]; then
    BRANCH="$(select_latest_beta_branch)"
    [[ -n "$BRANCH" ]] || fail "Could not find origin/release/beta-* branch"
  fi

  log "Checking out beta branch: $BRANCH"
  git -C "$INSTALL_DIR" checkout -B "${BRANCH#origin/}" "$BRANCH"
}

write_env() {
  log "Writing HTTP-oriented .env.local"
  cat > "$INSTALL_DIR/.env.local" <<EOF
CODEX_LB_DATA_DIR=${DATA_DIR}
CODEX_LB_DATABASE_URL=sqlite+aiosqlite:///${DATA_DIR}/store.db
CODEX_LB_DATABASE_MIGRATE_ON_STARTUP=false
CODEX_LB_DATABASE_SQLITE_PRE_MIGRATE_BACKUP_ENABLED=true
CODEX_LB_DATABASE_SQLITE_PRE_MIGRATE_BACKUP_MAX_FILES=5
CODEX_LB_UPSTREAM_BASE_URL=https://chatgpt.com/backend-api
CODEX_LB_DASHBOARD_AUTH_MODE=${AUTH_MODE}
CODEX_LB_USAGE_REFRESH_ENABLED=false
CODEX_LB_CONVERSATION_ARCHIVE_ENABLED=false
CODEX_LB_METRICS_ENABLED=false
CODEX_LB_LOG_FORMAT=text
CODEX_LB_UPSTREAM_STREAM_TRANSPORT=${UPSTREAM_TRANSPORT}
CODEX_LB_HTTP_RESPONSES_SESSION_BRIDGE_PREWARM_ENABLED=false
EOF
  chmod 600 "$INSTALL_DIR/.env.local"
}

install_deps_and_assets() {
  log "Installing codex-lb dependencies with uv"
  (cd "$INSTALL_DIR" && uv sync --frozen)

  if [[ "$BUILD_FRONTEND" == "true" ]]; then
    log "Building frontend assets"
    (cd "$INSTALL_DIR/frontend" && bun install --frozen-lockfile && bun run build)
  fi
}

run_migrations() {
  log "Running migrations to all heads (beta branch workaround for multiple Alembic heads)"
  (cd "$INSTALL_DIR" && uv run codex-lb-db --db-url "sqlite+aiosqlite:///${DATA_DIR}/store.db" upgrade heads)
}

install_launchd() {
  [[ "$(uname -s)" == "Darwin" ]] || { warn "launchd install skipped: not macOS"; return 0; }
  local plist="${HOME}/Library/LaunchAgents/${LABEL}.plist"
  local uv_path
  uv_path="$(command -v uv)"
  mkdir -p "${HOME}/Library/LaunchAgents" "$DATA_DIR"
  log "Installing launchd agent: $plist"
  cat > "$plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${uv_path}</string>
    <string>run</string>
    <string>codex-lb</string>
    <string>--host</string>
    <string>${HOST}</string>
    <string>--port</string>
    <string>${PORT}</string>
  </array>
  <key>WorkingDirectory</key>
  <string>${INSTALL_DIR}</string>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <dict>
    <key>SuccessfulExit</key>
    <false/>
  </dict>
  <key>StandardOutPath</key>
  <string>${DATA_DIR}/launchd.out.log</string>
  <key>StandardErrorPath</key>
  <string>${DATA_DIR}/launchd.err.log</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>${HOME}/.local/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
  </dict>
</dict>
</plist>
EOF

  launchctl bootout "gui/$(id -u)" "$plist" >/dev/null 2>&1 || true
  launchctl bootstrap "gui/$(id -u)" "$plist"
  launchctl kickstart -k "gui/$(id -u)/${LABEL}"
}

wait_for_health() {
  log "Waiting for codex-lb health at http://${HOST}:${PORT}/health"
  for _ in $(seq 1 40); do
    if curl -fsS "http://${HOST}:${PORT}/health" >/dev/null 2>&1; then
      log "codex-lb is healthy: http://${HOST}:${PORT}/"
      return 0
    fi
    sleep 1
  done
  fail "codex-lb did not become healthy. Check ${DATA_DIR}/launchd.err.log"
}

import_accounts() {
  if [[ "$IMPORT_RIFT" == "true" ]]; then
    ACCOUNT_DIRS+=("${HOME}/.rift/accounts/codex")
  fi
  [[ ${#ACCOUNT_DIRS[@]} -gt 0 ]] || return 0

  log "Importing account JSON folders into codex-lb"
  python3 - "$HOST" "$PORT" "$DATA_DIR" "${ACCOUNT_DIRS[@]}" <<'PY'
import json, os, shutil, subprocess, sys, urllib.request
from datetime import datetime, timezone
from pathlib import Path

host, port, data_dir, *dirs = sys.argv[1:]
base = Path(data_dir) / "tmp-import"
if base.exists():
    shutil.rmtree(base)
base.mkdir(parents=True, mode=0o700)
converted = []
skipped = []
existing_account_ids = set()
existing_emails = set()
try:
    with urllib.request.urlopen(f"http://{host}:{port}/api/accounts", timeout=20) as response:
        payload = json.load(response)
    accounts = payload.get("accounts", payload if isinstance(payload, list) else [])
    for account in accounts:
        if not isinstance(account, dict):
            continue
        account_id = account.get("account_id") or account.get("accountId")
        email = account.get("email")
        if isinstance(account_id, str) and account_id:
            existing_account_ids.add(account_id)
        if isinstance(email, str) and email:
            existing_emails.add(email.lower())
except Exception as exc:
    print(f"existing_account_lookup=failed:{type(exc).__name__}")

for raw_root in dirs:
    root = Path(raw_root).expanduser()
    if not root.exists():
        skipped.append((str(root), "missing-dir"))
        continue
    for path in sorted(root.rglob("*.json")):
        try:
            data = json.loads(path.read_text())
        except Exception as exc:
            skipped.append((str(path), f"invalid-json:{type(exc).__name__}"))
            continue
        if not isinstance(data, dict):
            skipped.append((str(path), "not-object"))
            continue

        # Already codex auth.json shape.
        if isinstance(data.get("tokens"), dict):
            tokens = data["tokens"]
            if all(isinstance(tokens.get(k), str) and tokens.get(k) for k in ("access_token", "refresh_token", "id_token")):
                out = data
            else:
                skipped.append((str(path), "nested-tokens-missing-required-fields"))
                continue
        else:
            # Rift/flat JSON shape.
            if not all(isinstance(data.get(k), str) and data.get(k) for k in ("access_token", "refresh_token", "id_token")):
                skipped.append((str(path), "missing-token-field"))
                continue
            out = {
                "auth_mode": "chatgpt",
                "openai_api_key": None,
                "tokens": {
                    "access_token": data["access_token"],
                    "refresh_token": data["refresh_token"],
                    "id_token": data["id_token"],
                },
                "last_refresh": data.get("last_refresh") if isinstance(data.get("last_refresh"), str) else datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            }
            if isinstance(data.get("account_id"), str) and data.get("account_id"):
                out["tokens"]["account_id"] = data["account_id"]

        account_id = out.get("tokens", {}).get("account_id") if isinstance(out.get("tokens"), dict) else None
        email = data.get("email") if isinstance(data.get("email"), str) else None
        if isinstance(account_id, str) and account_id in existing_account_ids:
            skipped.append((str(path), "already-imported-account-id"))
            continue
        if isinstance(email, str) and email.lower() in existing_emails:
            skipped.append((str(path), "already-imported-email"))
            continue

        target = base / f"{len(converted)+1:04d}-{path.stem}.auth.json"
        target.write_text(json.dumps(out, separators=(",", ":")))
        os.chmod(target, 0o600)
        converted.append((path, target, email or path.name))

print(f"converted={len(converted)} skipped={len(skipped)}")
for path, reason in skipped:
    print(f"skipped {Path(path).name}: {reason}")

imported = 0
failed = 0
for src, authfile, label in converted:
    proc = subprocess.run([
        "curl", "-fsS", "-X", "POST", f"http://{host}:{port}/api/accounts/import", "-F", f"auth_json=@{authfile}"
    ], capture_output=True, text=True)
    if proc.returncode == 0:
        imported += 1
        print(f"imported {label}")
    else:
        failed += 1
        msg = (proc.stderr or proc.stdout or "").strip().replace("\n", " ")[:180]
        print(f"failed {label}: {msg}")

shutil.rmtree(base)
print(f"import_summary imported={imported} failed={failed} temp_removed=true")
if failed:
    sys.exit(1)
PY
}

configure_pi() {
  [[ "$CONFIGURE_PI" == "true" ]] || return 0
  local models="${PI_AGENT_DIR}/models.json"
  local settings="${PI_AGENT_DIR}/settings.json"
  mkdir -p "$PI_AGENT_DIR"

  log "Backing up and patching Pi config"
  python3 - "$models" "$settings" "$PORT" "$SCRIPT_DIR/models.json" "$SCRIPT_DIR/settings.json" <<'PY'
import json, shutil, sys
from datetime import datetime
from pathlib import Path
models = Path(sys.argv[1])
settings = Path(sys.argv[2])
port = sys.argv[3]
template_models = Path(sys.argv[4])
template_settings = Path(sys.argv[5])
stamp = datetime.now().strftime("%Y%m%d-%H%M%S")

if models.exists():
    shutil.copy2(models, models.with_name(f"models.json.backup-codexlb-{stamp}"))
    data = json.loads(models.read_text())
else:
    data = json.loads(template_models.read_text())
providers = data.setdefault("providers", {})
source = providers.pop("rift", None) or providers.get("codex") or providers.get("codex-openai")
if source is None:
    source = json.loads(template_models.read_text()).get("providers", {}).get("codex")
if source is None:
    raise SystemExit("No rift/codex/codex-openai provider found to copy")
source = json.loads(json.dumps(source))
source["api"] = "openai-responses"
source["baseUrl"] = f"http://127.0.0.1:{port}/v1"
source["apiKey"] = "dummy"
for model in source.get("models", []):
    if isinstance(model.get("name"), str):
        model["name"] = model["name"].replace("Rift ", "Codex ")
providers["codex"] = source
models.write_text(json.dumps(data, indent=2) + "\n")

if settings.exists():
    shutil.copy2(settings, settings.with_name(f"settings.json.backup-codexlb-{stamp}"))
    s = json.loads(settings.read_text())
else:
    s = json.loads(template_settings.read_text())
enabled = s.get("enabledModels", [])
if isinstance(enabled, list):
    s["enabledModels"] = [(m.replace("rift/", "codex/", 1) if isinstance(m, str) and m.startswith("rift/") else m) for m in enabled]
s["defaultProvider"] = "codex"
s["transport"] = "sse"
settings.write_text(json.dumps(s, indent=2) + "\n")

print("pi_config_updated=true")
PY
}

main() {
  ensure_repo
  write_env
  install_deps_and_assets
  run_migrations
  if [[ "$START_SERVICE" == "true" ]]; then
    install_launchd
    wait_for_health
    import_accounts
  else
    warn "Skipping service start and account import because --no-start was provided"
  fi
  configure_pi
  log "Done"
  log "Dashboard: http://${HOST}:${PORT}/"
}

main
