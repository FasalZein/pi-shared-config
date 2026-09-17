# pi-shared-config

This repository restores a portable, secret-free Pi setup. It contains settings, agents, prompts, themes, selected extensions, and skill records.

## Install

Install Git, Node.js, `npx`, Python 3, and Pi. Then run one command:

```bash
curl -fsSL https://raw.githubusercontent.com/FasalZein/pi-shared-config/main/install.sh | bash
```

The installer copies the configuration to `~/.pi/agent`. It reconciles the nine pinned packages when Pi is available. It also copies `extensions/pi-tps.ts` for automatic local discovery.

Setup moves an existing `extensions` directory to a timestamped backup. It then installs the two retained files into a new directory.

## Retained extensions

The package list contains only these items:

- `pi-claude-auth`;
- `pi-subagents`;
- `pi-tasks`;
- `pi-codex-conversion`;
- `pi-better-skills`;
- `pi-ask`;
- `pi-fancy-footer`;
- `pi-ralph-loop`;
- `pi-grok-cli`.

The repository also keeps local `pi-tps.ts`. The `eko24ive-pi-ask.json` file configures `pi-ask`; it is not an extension.

`pi-grok-cli` remains installed for explicit command use. Grok models are not present in `models.json`, enabled models, or agent routes.

## Models and credentials

Only model identifiers that start with `claude-` or `gpt-` are enabled. The retained providers are `anthropic`, `openai-codex`, `kiro`, `cpa`, and `gnrt`. Subagents route all GPT work through `openai-codex`.

Use the normal Pi login flow for Anthropic and OpenAI Codex. Start the local Kiro and CPA proxy services before using their models. Configure GNRT through its supported login or environment setup. This repository does not store credentials.

## Skills

Setup restores the shared skill lock with `npx skills experimental_install`. It then restores all recorded skill links.

The lock includes the current 24 Matt Pocock skills. It includes `grill-me`, which remains command-only. Models cannot invoke it automatically.

The setup also restores the research auxiliary set. This set includes standards, history, documentation, search, browsing, conversion, and technical-writing skills. All skills named by retained subagents are present through the lock, the link manifest, selected packages, or the local `bro`, `cmux`, and `msw` skills.

The retired `to-prd` and `to-slices` links are not restored.

## Configuration behavior

On a new machine, setup copies `models.json` and `settings.json`. On an existing machine, setup preserves other personal settings but replaces these managed fields:

- `enabledModels`;
- `packages`;
- `extensions`.

The `grill-me` skill stays command-only. Use it only through its explicit command.

## Safe setup controls

Use these environment variables for an isolated or offline check:

```bash
RESTORE_MANAGED_SKILLS=false \
INSTALL_CONFIG_DEPENDENCIES=false \
INSTALL_PI_PACKAGES=false \
PI_AGENT_DIR=/tmp/pi-agent \
bash setup.sh
```

These controls prevent skill downloads, dependency installation, and Pi package network work.

## Update this repository

Run:

```bash
./scripts/sync-from-live.sh
```

The sync reads the active local setup. It refreshes the six live agent definitions, model data, selected local extension files, skill lock, and skill links. It then reapplies the exact package and Claude/GPT model policy. It never changes installed live files.

The sync excludes the retired `to-prd` and `to-slices` links. It keeps the repository versions of policy documents and the `bro`, `cmux`, and `msw` skills.

## Verify

Run:

```bash
npm run verify
```

Verification runs the secret scan, checks package and model policy, checks agent routes and skills, and runs setup in an isolated home directory. The smoke test disables package, skill, and dependency network work.
