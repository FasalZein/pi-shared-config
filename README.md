# pi-shared-config

This public repository is a restorable, secret-free backup of one Pi environment. It mirrors the live configuration without copying login tokens, API keys, caches, sessions, or other machine state.

## Backup contents

The repository includes:

- Pi settings, model definitions, keybindings, themes, prompts, trust settings, package metadata, and custom lint rules;
- all live agent definitions, documentation, templates, extensions, and agent helper scripts;
- the local `bro`, `msw`, and `cmux` skills;
- `skills/.skill-lock.json`, which identifies the source of 125 managed skills;
- `skills/symlinks.json`, which records all 130 Pi skill links into `~/.agents/skills`;
- `extension-manifest.json`, which records installed npm extensions, Pi packages, and local extension repositories;
- `scripts/sync-from-live.sh`, which regenerates this backup from the live machine;
- `scripts/scan-secrets.py`, which checks the repository and staged changes for likely credentials.

The live Pi helper script is stored in `agent-scripts/`. The repository's own restore and sync tools remain in `scripts/`.

## Deliberately absent

This repository never contains `auth.json`. Create that file through Pi's normal login flows on the restored machine.

The backup also excludes generated model stores, MCP caches, Cursor SDK caches, account markers, changelogs, run history, sessions, temporary files, package installations, virtual environments, backups, and web-run state. See `.gitignore` and `scripts/sync-from-live.sh` for the complete list.

`extensions/linear/credentials.json` is also excluded because it contains a Linear API key. Configure the Linear extension with credentials from the new owner after restore.

## Credentials and environment variables

Set these variables before starting Pi:

```bash
export NAHCROF_API_KEY='your Nahcrof API key'
export OPENAI_API_KEY='your OpenRouter API key for the gpt-4o verifier'
```

The committed `models.json` contains `${NAHCROF_API_KEY}` at `providers.nahcrof.apiKey`. Pi resolves this environment variable at runtime. The committed OpenRouter verifier profile omits its embedded key, so the child process inherits `OPENAI_API_KEY` from the environment.

Other providers use Pi's login system or their own local login flow. Placeholder values such as `dummy` and `cursor-responses-local` are intentional configuration values, not credentials.

## Requirements

Install these tools first:

- Git;
- Node.js and `npx`;
- Bun for the Cursor bridge;
- Python 3;
- `rsync`;
- Pi:

```bash
npm install -g --ignore-scripts @earendil-works/pi-coding-agent
```

## Restore order on an empty Mac

### 1. Clone this repository

```bash
git clone https://github.com/FasalZein/pi-shared-config
cd pi-shared-config
```

Place the repository under `~/Dev` if you want the same directory layout as the source machine.

### 2. Restore local extension repositories

Read `extension-manifest.json`. For each entry with a `remote`, clone that URL under `~/Dev/AI/pi/extensions/<name>`, then check out the recorded commit.

Some entries have no remote. `pi-autoresearch` and `pi-hooks` are Git repositories with commits but no configured remote. `pi-researcher` is a Git repository with no commit and no remote. `pi-fold` is not a Git repository. The manifest records these states honestly, but it cannot recover their source from a remote. Supply those directories from their owner if they are needed.

The `piPackages` list also contains local paths. Ensure each required local package exists before Pi reconciles extensions. You can run setup with `INSTALL_PI_PACKAGES=false` until those paths are ready.

### 3. Bring up the Cursor bridge

`pi-cursor` is a private repository:

```text
https://github.com/isthatyousaf/pi-cursor.git
```

Only the `FasalZein` GitHub account can read it. It is not a Pi extension. It is a local server used by the `cursor` provider in `models.json`.

```bash
cd ~/Dev/AI/pi/extensions
git clone https://github.com/isthatyousaf/pi-cursor.git
cd pi-cursor
git checkout e25b101f21e1b44f62025c1f652c599fd53dcca2
bun install
bun run login
bun run start
```

`bun run login` authenticates against a Cursor account. The server listens at `http://127.0.0.1:4001/v1`, which matches `models.json`.

The bridge learns Cursor model context limits at runtime and stores them in `.data/context-windows.json`. The three fast Grok models have a context limit of 256000:

- `cursor-grok-4.6-high-fast`;
- `cursor-grok-4.6-medium-fast`;
- `cursor-grok-4.6-xhigh-fast`.

### 4. Set credentials

Export `NAHCROF_API_KEY` and `OPENAI_API_KEY` as shown above. Start Pi after setup and complete the normal login flow for Anthropic, OpenAI Codex, zai, and any other account-backed provider you use.

### 5. Run the restore

```bash
bash setup.sh
```

On an empty machine, setup copies the backed-up configuration. It installs the regenerable lint dependencies, restores managed skills into `~/.agents/skills`, copies the three local skills, and recreates the Pi symlinks.

Setup keeps an existing `models.json`, because that file can contain working local credentials. It merges package entries into an existing `settings.json` and keeps other personal settings.

Use these controls when needed:

```bash
RESTORE_MANAGED_SKILLS=false bash setup.sh
INSTALL_CONFIG_DEPENDENCIES=false bash setup.sh
INSTALL_PI_PACKAGES=false bash setup.sh
PI_AGENT_DIR=/another/path bash setup.sh
```

If the new Mac has a different home directory, setup rewrites source-home paths in copied files to the current `$HOME`.

### 6. Verify the restored models

With the Cursor bridge running and required credentials available:

```bash
pi --list-models gpt-6-astra
pi --list-models cursor-grok
```

The first command must show a 372K context limit. The second command must show 256K for all three fast models.

## Update the backup from a live machine

Run one command from this repository:

```bash
./scripts/sync-from-live.sh
```

The source defaults to `~/.pi/agent`. Override it with either a positional path or `PI_AGENT_SOURCE_DIR`:

```bash
./scripts/sync-from-live.sh /path/to/.pi/agent
PI_AGENT_SOURCE_DIR=/path/to/.pi/agent ./scripts/sync-from-live.sh
```

For a nonstandard source machine layout, also set:

```bash
SKILL_STORE_DIR=/path/to/.agents \
LOCAL_EXTENSIONS_DIR=/path/to/Dev/AI/pi/extensions \
./scripts/sync-from-live.sh /path/to/.pi/agent
```

The sync is idempotent. It leaves the live `models.json` unchanged, scrubs copied credentials, regenerates both manifests, and fails if the credential scan finds a likely secret.

Before a local commit, run:

```bash
python3 scripts/scan-secrets.py .
```

Do not push until the staged changes also pass this scan.

## Standalone bootstrap

```bash
curl -fsSL https://raw.githubusercontent.com/FasalZein/pi-shared-config/main/install.sh | bash
```

The bootstrap clones this repository into a temporary directory and runs `setup.sh`.

## Archive

`archive/retired-agents/` holds agent definitions that are no longer active: `sidekick`, `verify` and `linear-auditor`. They existed only in local backup folders that have since been removed. `setup.sh` does not install them.
