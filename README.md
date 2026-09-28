# pi-shared-config

This repository restores a portable, secret-free Pi setup. It contains settings, agents, prompts, themes, selected extensions, and skill records.

## Install

Install Git, Node.js, `npx`, Python 3, and Pi. Then run one command:

```bash
curl -fsSL https://raw.githubusercontent.com/FasalZein/pi-shared-config/main/install.sh | bash
```

The installer copies the configuration to `~/.pi/agent`. It installs or updates the nine packages when Pi is available. The packages are not pinned, so each setup run takes the latest version. It also copies `extensions/pi-tps.ts` and `extensions/skill-gate.ts` for automatic local discovery.

Setup moves an existing `extensions` directory to a timestamped backup. It then installs the three retained files into a new directory.

## Retained extensions

The package list contains only these items:

- `git:github.com/edxeth/pi-claude-auth`;
- `git:github.com/edxeth/pi-subagents`;
- `git:github.com/edxeth/pi-tasks`;
- `npm:@howaboua/pi-codex-conversion`;
- `git:github.com/edxeth/pi-better-skills`;
- `npm:@eko24ive/pi-ask`;
- `npm:pi-fancy-footer`;
- `git:github.com/edxeth/pi-ralph-loop`;
- `npm:pi-grok-cli`.

The repository also keeps two local extensions: `pi-tps.ts` and `skill-gate.ts`. `skill-gate.ts` limits the ambient skill catalog to a fixed visible set. A named child with `--no-skills`, `-ns`, or `--skill` keeps its explicit skill list. A continuation request still receives that same visible catalog. `scripts/skill-gate-test.ts` checks this behavior. The extension file stays a copy of the live file, so this README records the test path. The `eko24ive-pi-ask.json` file configures `pi-ask`; it is not an extension.

`pi-grok-cli` supplies the `grok-cli` provider. A route remains enabled only when its provider is one of the three retained providers. A `grok-cli` model id must be nonempty and start with `grok-`. A model id on another retained provider must start with `claude-` or `gpt-`.

## Models and credentials

Enabled routes use a retained provider. The retained providers are `anthropic` (`pi-claude-auth`), `openai-codex` (`pi-codex-conversion`), and `grok-cli` (`pi-grok-cli`). Each one comes from a retained package. `grok-cli` routes use a nonempty model id that starts with `grok-`. Other retained routes use a model id that starts with `claude-` or `gpt-`. Subagents route all GPT work through `openai-codex`. Personal providers, including `kiro`, `cpa`, `gnrt`, `explabs`, `zai`, `opencode-go`, `9router`, `cursor`, and `cloudflare-workers-ai`, are removed.

Use the normal Pi login flow for Anthropic and OpenAI Codex. Use the `pi-grok-cli` login for Grok. This repository does not store credentials.

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

The sync reads the active local setup. It refreshes the eleven live agent definitions, model data, `pi-tps.ts`, `skill-gate.ts`, the skill lock, and skill links. It then reapplies the exact package list and the provider and model policy. It never changes installed live files.

The sync excludes the retired `to-prd` and `to-slices` links. It keeps the repository versions of policy documents and the `bro`, `cmux`, and `msw` skills.

## Verify

Run:

```bash
npm run verify
```

Verification runs the secret scan, checks package and model policy, checks agent routes and skills, runs `scripts/skill-gate-test.ts`, and runs setup in an isolated home directory. The smoke test disables package, skill, and dependency network work.
