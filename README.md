# pi-shared-config

Shared configuration for [Pi](https://pi.dev): provider models, settings, themes, keybindings, subagents, and a small set of extensions.

This repo is meant to make a fresh Pi install feel ready to use quickly. It also includes an optional helper for running [codex-lb](https://github.com/Soju06/codex-lb) locally as the default Codex/OpenAI-compatible provider.

## What this installs

| Area | What is included |
| --- | --- |
| Providers | `codex` provider pointed at `http://127.0.0.1:2455/v1` |
| Models | GPT-5.5, GPT-5.4, GPT-5.4 Mini, GPT-5.3-Codex |
| Pi settings | SSE transport, enabled `codex/*`, curated packages |
| Themes | `tokyonight` and `mocha` |
| Keybindings | Shared keybinding defaults |
| Subagents | scout, spec, planner, worker, reviewer, researcher, design, context-builder |
| Extensions | cmux status, token-rate footer, pi-ask config, FFF via npm package |
| Footer | shared fancy-footer layout |
| Optional service | codex-lb beta installer/importer for local account load balancing |

No real API keys or account tokens are stored in this repo.

## Requirements

Install Pi first:

```bash
npm install -g --ignore-scripts @earendil-works/pi-coding-agent
```

For the optional codex-lb setup, also install:

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
curl -fsSL https://bun.sh/install | bash
```

You also need `git` and `curl`. The background service helper currently installs a macOS `launchd` service.

## Install the Pi configuration

Clone the repo and run the setup script:

```bash
git clone https://github.com/FasalZein/pi-shared-config
cd pi-shared-config
bash setup.sh
```

This copies config files into `~/.pi/agent`:

- `models.json`
- `settings.json`
- `AGENTS.md`
- `APPEND_SYSTEM.md`
- `keybindings.json`
- themes
- subagent definitions
- local extensions
- `fancy-footer.json`

The script is safe to re-run. It overwrites the shared config files with the repo versions and leaves account credentials alone.

## Optional: set up codex-lb

The default provider in this config is named `codex` and points to:

```text
http://127.0.0.1:2455/v1
```

To make that endpoint available locally, run:

```bash
bash scripts/setup-codex-lb-beta.sh --configure-pi
```

This helper:

1. clones or updates `Soju06/codex-lb`
2. checks out the newest `origin/release/beta-*` branch
3. installs Python dependencies with `uv`
4. builds the frontend with `bun`
5. writes a local HTTP/SSE-oriented `.env.local`
6. runs database migrations
7. installs/restarts a macOS launchd service
8. verifies `http://127.0.0.1:2455/health`

Open the dashboard at:

```text
http://127.0.0.1:2455/
```

codex-lb is configured for HTTP/SSE by default, not WebSocket transport.

## Import accounts into codex-lb

The codex-lb setup script can import account JSON files without printing token values.

### Import from the default Rift account folder

If the machine already has Rift-style account files at `~/.rift/accounts/codex`, run:

```bash
bash scripts/setup-codex-lb-beta.sh --import-rift
```

### Import from any folder

Use `--accounts-dir` for any directory containing account JSON files:

```bash
bash scripts/setup-codex-lb-beta.sh --accounts-dir /path/to/account-json-folder
```

You can pass it multiple times:

```bash
bash scripts/setup-codex-lb-beta.sh \
  --accounts-dir /path/to/accounts-a \
  --accounts-dir /path/to/accounts-b
```

### Install codex-lb, configure Pi, and import accounts together

```bash
bash scripts/setup-codex-lb-beta.sh \
  --configure-pi \
  --import-rift \
  --accounts-dir /path/to/extra-account-json-folder
```

### Supported account input formats

The importer accepts both:

1. Flat Rift-style JSON:

```json
{
  "access_token": "...",
  "refresh_token": "...",
  "id_token": "...",
  "account_id": "..."
}
```

2. Codex/codex-lb auth JSON:

```json
{
  "auth_mode": "chatgpt",
  "tokens": {
    "access_token": "...",
    "refresh_token": "...",
    "id_token": "...",
    "account_id": "..."
  }
}
```

During import, flat files are converted temporarily into codex-lb auth JSON shape, uploaded to the local codex-lb API, and then deleted. Existing codex-lb accounts are checked first so duplicate account IDs or duplicate emails are skipped.

## Managing codex-lb per-account proxies

Keep proxy secrets in a local text file, not in this repo. One proxy per line:

```text
username:password:host:port
```

Example location:

```bash
mkdir -p ~/.codex-lb
chmod 700 ~/.codex-lb
$EDITOR ~/.codex-lb/proxies.txt
chmod 600 ~/.codex-lb/proxies.txt
```

Set up/test proxies, prune unauthenticated accounts, bind active accounts evenly across proxy pools, and restart codex-lb:

```bash
bash scripts/codex-lb-proxy-admin.sh \
  --proxies-file ~/.codex-lb/proxies.txt \
  --reset-proxies \
  --test-proxies \
  --prune-reauth \
  --bind-active \
  --restart
```

Re-bind active accounts later without recreating proxies:

```bash
bash scripts/codex-lb-proxy-admin.sh --bind-active --restart
```

Canary only the first 10 active accounts:

```bash
bash scripts/codex-lb-proxy-admin.sh --bind-active --bind-limit 10 --restart
```

The helper keeps global proxy routing disabled by default and uses per-account bindings. That is safer than global routing because one missing/default pool does not break every account.

## Running codex-lb separately from Pi

Pi and codex-lb are separate processes.

If Pi is already installed or currently running, you can set up codex-lb by itself:

```bash
bash scripts/setup-codex-lb-beta.sh
```

Then patch Pi config later:

```bash
bash scripts/setup-codex-lb-beta.sh --configure-pi --no-start
```

Or install only the Pi config without touching codex-lb:

```bash
bash setup.sh
```

## Idempotency and safety

The scripts are designed for repeated runs:

- existing codex-lb checkout is reused if clean
- dirty codex-lb checkouts are not overwritten
- launchd service is replaced/restarted under the same label
- migrations run to all beta heads
- account import skips existing account IDs/emails
- temporary converted account files are removed after import
- Pi config patching creates timestamped backups when files already exist
- token values are not printed

## Installed files

```text
pi-shared-config/
├── AGENTS.md
├── APPEND_SYSTEM.md
├── README.md
├── agents/
├── extensions/
│   ├── cmux/index.ts
│   ├── eko24ive-pi-ask.json
│   └── pi-tps.ts
├── fancy-footer.json
├── install.sh
├── keybindings.json
├── models.json
├── package.json
├── scripts/
│   ├── codex-lb-proxy-admin.py
│   ├── codex-lb-proxy-admin.sh
│   └── setup-codex-lb-beta.sh
├── settings.json
├── setup.sh
└── themes/
```

## Standalone bootstrap

For Pi config only:

```bash
curl -fsSL https://raw.githubusercontent.com/FasalZein/pi-shared-config/main/install.sh | bash
```

For codex-lb setup and account import, use a persistent clone so the helper script remains available:

```bash
git clone https://github.com/FasalZein/pi-shared-config
cd pi-shared-config
bash scripts/setup-codex-lb-beta.sh --configure-pi --import-rift
```

## Troubleshooting

### `http://127.0.0.1:2455` does not load

Check health:

```bash
curl http://127.0.0.1:2455/health
```

Check logs:

```bash
cat ~/.codex-lb/launchd.err.log
cat ~/.codex-lb/launchd.out.log
```

### Pi still shows old provider names

Restart Pi after changing `models.json` or `settings.json`.

### Re-run package reconciliation

```bash
pi update --extensions
```

## Notes on extension choices

This config avoids a few known startup problems:

- broken `pi-hooks` LSP extension entries are excluded
- `pi-ptc-next` is not installed by default because it requires an explicit sandbox/runtime choice
- FFF is installed through `npm:@ff-labs/pi-fff@0.6.4` instead of a local wrapper path
- Pi transport is set to `sse`
