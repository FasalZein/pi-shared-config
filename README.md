# pi-shared-config

This repository restores a portable, secret-free Pi setup. It contains settings, agents, prompts, themes, selected extensions, and skill records.

## Install

Install Git, Node.js, `npx`, Python 3, and Pi. Then run one command:

```bash
curl -fsSL https://raw.githubusercontent.com/FasalZein/pi-shared-config/main/install.sh | bash
```

The installer copies the configuration to `~/.pi/agent`. It reconciles the nine pinned packages when Pi is available. It also copies `extensions/pi-tps.ts` and `extensions/skill-gate.ts` for automatic local discovery.

Setup moves an existing `extensions` directory to a timestamped backup. It then installs the three retained files into a new directory.

## Retained extensions

The package list contains only these items:

- `git:github.com/edxeth/pi-claude-auth@d99968e317b1132efdac7f1722380922af27af62`;
- `git:github.com/edxeth/pi-subagents@cf6dbf41c17986f3882e6804a68e8fb8282d25e6`;
- `git:github.com/edxeth/pi-tasks@37143ee47610610db5b6cb86d94a7ffbb8ecf54d`;
- `npm:@howaboua/pi-codex-conversion@3.0.39`;
- `git:github.com/edxeth/pi-better-skills@447a0ca98e3131d50106736816d22fbca617a1f5`;
- `npm:@eko24ive/pi-ask@1.2.0`;
- `npm:pi-fancy-footer@3.0.2`;
- `git:github.com/edxeth/pi-ralph-loop@108823f8d1e2089fec1f7202ca3a8905d12df574`;
- `npm:pi-grok-cli@0.9.2`.

The repository also keeps two local extensions: `pi-tps.ts` and `skill-gate.ts`. `skill-gate.ts` limits the ambient skill catalog to a fixed visible set. The `eko24ive-pi-ask.json` file configures `pi-ask`; it is not an extension.

`pi-grok-cli` supplies the `grok-cli` provider. Routes on that provider stay enabled. Routes on other providers stay enabled only when the model id starts with `claude-` or `gpt-`.

## Models and credentials

Enabled routes are Claude models, GPT models, and `grok-cli` models. The retained providers are `anthropic`, `openai-codex`, `kiro`, `cpa`, `gnrt`, and `grok-cli`. Subagents route all GPT work through `openai-codex`. Other providers, including `zai`, `opencode-go`, `9router`, `cursor`, and `cloudflare-workers-ai`, are removed.

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

The sync reads the active local setup. It refreshes the eleven live agent definitions, model data, `pi-tps.ts`, `skill-gate.ts`, the skill lock, and skill links. It then reapplies the exact package pins and the Claude, GPT, and `grok-cli` model policy. It never changes installed live files.

The sync excludes the retired `to-prd` and `to-slices` links. It keeps the repository versions of policy documents and the `bro`, `cmux`, and `msw` skills.

## Verify

Run:

```bash
npm run verify
```

Verification runs the secret scan, checks package and model policy, checks agent routes and skills, and runs setup in an isolated home directory. The smoke test disables package, skill, and dependency network work.
