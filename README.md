# pi-shared-config

One-command setup for [pi coding agent](https://pi.dev) with a local **codex-lb beta** provider and curated extensions.

This config no longer uses Rift by default. Rift caused account health/routing issues for our setup, so the shared default is now codex-lb on `http://127.0.0.1:2455/v1` with Pi transport set to `sse`.

## Quick start

```bash
git clone https://github.com/FasalZein/pi-shared-config
cd pi-shared-config
bash setup.sh
```

That installs Pi config only. It is safe to run while Pi is already installed; it overwrites the shared config files in `~/.pi/agent` but does not start Pi or run inference.

To install/start codex-lb beta too:

```bash
bash scripts/setup-codex-lb-beta.sh --configure-pi --import-rift
```

## Full setup with accounts

Most friends should run this from the cloned repo:

```bash
bash setup.sh
bash scripts/setup-codex-lb-beta.sh --configure-pi --import-rift
```

This does four things:

1. clones or updates `Soju06/codex-lb`
2. checks out the newest `origin/release/beta-*` branch
3. builds frontend assets and runs codex-lb in the background with launchd on macOS
4. imports accounts from `~/.rift/accounts/codex` if that folder exists

Dashboard:

```text
http://127.0.0.1:2455/
```

Health check:

```bash
curl http://127.0.0.1:2455/health
```

## Importing accounts

The setup script supports two account formats:

1. **Rift/flat JSON** — top-level `access_token`, `refresh_token`, `id_token`, `account_id`
2. **Codex/codex-lb auth JSON** — nested `tokens` object

The script does not print token values. Temporary converted files are written under `~/.codex-lb/tmp-import` with private permissions and deleted after import.

### Import existing Rift accounts

```bash
bash scripts/setup-codex-lb-beta.sh --import-rift
```

This imports from:

```text
~/.rift/accounts/codex
```

### Import an extra folder

```bash
bash scripts/setup-codex-lb-beta.sh --accounts-dir ~/Downloads/codex-6
```

You can pass multiple folders:

```bash
bash scripts/setup-codex-lb-beta.sh \
  --accounts-dir ~/Downloads/codex-6 \
  --accounts-dir ~/Downloads/more-codex-accounts
```

### Import accounts and patch Pi config together

```bash
bash scripts/setup-codex-lb-beta.sh \
  --configure-pi \
  --import-rift \
  --accounts-dir ~/Downloads/codex-6
```

### Idempotency

The script is designed to be safe to re-run:

- existing codex-lb repo is fetched and checked out only if clean
- launchd service is replaced/restarted using the same label
- codex-lb database migrations run to all beta heads
- account import checks existing codex-lb accounts and skips duplicate account IDs/emails
- Pi config files are backed up before patching when they already exist

## Running codex-lb separately

If Pi is already running or already installed, codex-lb can be installed/started independently:

```bash
bash scripts/setup-codex-lb-beta.sh
```

Then separately patch Pi config:

```bash
bash scripts/setup-codex-lb-beta.sh --configure-pi --no-start
```

Or run only Pi config setup:

```bash
bash setup.sh
```

## What's included

| Path | Description |
|------|-------------|
| `models.json` | `codex` provider pointed at `http://127.0.0.1:2455/v1` using normal OpenAI Responses API |
| `settings.json` | Global settings — default provider `codex`, enabled `codex/*`, transport `sse` |
| `package.json` | Pi package manifest — only stable local extensions are auto-loaded |
| `extensions/cmux/` | cmux terminal status bar |
| `extensions/pi-tps.ts` | Token rate footer display |
| `extensions/eko24ive-pi-ask.json` | pi-ask config copied as a config asset |
| `fancy-footer.json` | Fancy footer widget layout |
| `themes/` | `tokyonight` default + `mocha` theme |
| `agents/` | pi-subagent definitions using `codex/gpt-5.5` |
| `setup.sh` | Idempotent Pi config installer |
| `install.sh` | Standalone curl-able bootstrap |
| `scripts/setup-codex-lb-beta.sh` | Standalone codex-lb beta installer/importer |

## Fixed install issues

This version avoids the install errors seen on a friend's machine:

- excludes broken `pi-hooks` LSP extensions that import `vscode-languageserver-protocol/node.js`
- does not install `pi-ptc-next` by default, avoiding the sandbox runtime error
- uses `npm:@ff-labs/pi-fff@0.6.4` directly instead of a local wrapper path that can disappear after temp bootstrap install
- configures Pi transport as `sse`, not WebSocket cached transport

## Standalone bootstrap without keeping the repo clone

```bash
curl -fsSL https://raw.githubusercontent.com/FasalZein/pi-shared-config/main/install.sh | bash
```

That installs Pi config. To install codex-lb and import accounts, use a normal clone so the reusable script remains available:

```bash
git clone https://github.com/FasalZein/pi-shared-config
cd pi-shared-config
bash scripts/setup-codex-lb-beta.sh --configure-pi --import-rift
```

## Manual requirements

You need:

- `pi`
- `git`
- `uv`
- `bun`
- `curl`
- macOS for launchd background service support

Install `uv` and `bun` if missing:

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
curl -fsSL https://bun.sh/install | bash
```

## Notes

- No real secrets are stored in this repo.
- `apiKey` is set to `dummy` because codex-lb local proxy accepts a placeholder unless dashboard API-key auth is enabled.
- The codex-lb setup script disables live usage refresh by default. It does not run inference.
