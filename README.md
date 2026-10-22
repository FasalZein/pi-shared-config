# pi-shared-config

This repository restores a portable, secret-free Pi setup. It contains settings, agents, prompts, themes, selected extensions, and skill records.

## Install

Install Git, Node.js, `npx`, Python 3, and Pi. Then run one command:

```bash
curl -fsSL https://raw.githubusercontent.com/FasalZein/pi-shared-config/main/install.sh | bash
```

The installer copies the configuration to `~/.pi/agent`. It installs or updates the eight packages when Pi is available. The packages are not pinned, so each setup run takes the latest version. It also copies the local extensions `extensions/pi-tps.ts`, `extensions/skill-gate.ts`, and `extensions/env-wrap/` for automatic local discovery, and the worktree tools in `bin/`.

Setup moves an existing `extensions` directory to a timestamped backup. It then installs the retained local extensions into a new directory.

## Retained extensions

The package list contains only these items:

- `git:github.com/edxeth/pi-claude-auth`;
- `git:github.com/edxeth/pi-subagents`;
- `git:github.com/edxeth/pi-tasks`;
- `git:github.com/edxeth/pi-better-skills`;
- `npm:@eko24ive/pi-ask`;
- `npm:pi-fancy-footer`;
- `git:github.com/edxeth/pi-ralph-loop`;
- `npm:pi-grok-cli`.

The repository also keeps three local extensions: `pi-tps.ts`, `skill-gate.ts`, and `env-wrap/`. `skill-gate.ts` limits the ambient skill catalog to a fixed visible set. A named child with `--no-skills`, `-ns`, or `--skill` keeps its explicit skill list. A continuation request still receives that same visible catalog. `scripts/skill-gate-test.ts` checks this behavior. The extension file stays a copy of the live file, so this README records the test path. `env-wrap` replaces the built-in `bash` tool with the same tool plus a spawn hook. Each call runs in the direnv or devenv environment of the worktree it runs in. It does nothing in a directory without an `.envrc`. When `direnv` is not installed, the wrapper cannot load an environment: the command still runs with the plain environment, and a note on stderr says that the `.envrc` did not load. `scripts/env-wrap-test.ts` checks both cases. `env-wrap/shell-segments.ts` is the command parser from the live `shell-guard.ts`. The sync extracts it, so `shell-guard.ts` itself (host policy for shell commands) stays out of this repository.

The `eko24ive-pi-ask.json` file configures `pi-ask`; it is not an extension.

`pi-grok-cli` supplies the `grok-cli` provider. A route remains enabled only when its provider is one of the three retained providers. A `grok-cli` model id must be nonempty and start with `grok-`. A model id on another retained provider must start with `claude-` or `gpt-`.

## Worktree tools

`bin/` holds `wt`, `worktrees-landed`, `worktrees-idle`, `ralph-lane`, and `lib/worktree-procs.sh`. Setup copies them to `~/.pi/agent/bin` and keeps other files in that directory. They need `git`. `gh` and `devenv` are optional: `wt` uses `gh` to check merged pull requests and `devenv` to stop the services of a finished worktree. Run `wt --help` for the commands. `ralph-lane <bundle> <repo>` sets up a Ralph lane from `templates/ralph-lane-template.md`; it needs `jq` and `wt`, and the template requires every gate to run through `heavy`, which this repository does not ship. The `pi-ralph-loop` package runs the lane.

Pi puts `~/.pi/agent/bin` on `PATH` for the `bash` tool of every agent session, so agents find the tools without setup. A normal terminal does not have it. To use the tools there, add this line to your shell profile:

```bash
export PATH="$HOME/.pi/agent/bin:$PATH"
```

## Models and credentials

Enabled routes use a retained provider. The retained providers are `anthropic` (`pi-claude-auth`), `openai-codex`, and `grok-cli` (`pi-grok-cli`). `anthropic` and `grok-cli` come from retained packages. Pi itself supplies `openai-codex`: it has a built-in `openai-codex-responses` API and the ChatGPT login. The repository no longer installs `pi-codex-conversion`, so the `openai-codex` routes keep working through the built-in provider only. `grok-cli` routes use a nonempty model id that starts with `grok-`. Other retained routes use a model id that starts with `claude-` or `gpt-`. Subagents route all GPT work through `openai-codex`. Personal providers, including `kiro`, `cpa`, `gnrt`, `explabs`, `zai`, `opencode-go`, `9router`, `cursor`, and `cloudflare-workers-ai`, are removed.

Use the normal Pi login flow for Anthropic and OpenAI Codex. Use the `pi-grok-cli` login for Grok. This repository does not store credentials.

## Skills

Setup restores the shared skill lock with `npx skills experimental_install`. It then restores all recorded skill links.

The lock includes the current 24 Matt Pocock skills. It includes `grill-me`, which remains command-only. Models cannot invoke it automatically.

The setup also restores the research auxiliary set. This set includes standards, history, documentation, search, browsing, conversion, and technical-writing skills. All skills named by retained subagents are present through the lock, the link manifest, selected packages, or the local `bro`, `cmux`, and `msw` skills.

The retired `to-prd` and `to-slices` links are not restored.

## Local skill adaptations

Canonical specifications are repository files. Delivery tickets are GitHub issues. Upstream `to-spec`, `to-tickets`, and `setup-matt-pocock-skills` publish specifications as issues, so this repository adapts them.

The shared store `~/.agents/skills` keeps the only active copy. Pi skill links still point to it. `skill-adaptations/` holds, for each changed file, the supported upstream copy and the adapted copy. `skill-adaptations/manifest.json` records the upstream source, path, and folder hash. The skill lock keeps the upstream hash, so it does not describe the adapted content.

Setup applies the adaptations after the skill restore. To check or reapply them without a full setup, run:

```bash
python3 scripts/skill-adaptations.py check
python3 scripts/skill-adaptations.py apply
```

`apply` replaces a file only when it equals the supported upstream copy or a recorded prior adapted copy. Prior adapted copies live in `skill-adaptations/prior-adapted/` and are listed under `priorAdapted` in the manifest; they let `apply` upgrade an older adaptation. A second run changes nothing. If any file differs from both copies, `apply` changes no file and fails. Then copy the new upstream file to `skill-adaptations/upstream/`, port the change to `skill-adaptations/adapted/`, and run `npm run verify`. A skill that is not installed is skipped and reported; `check` fails until it is adapted.

Skill updates outside setup, for example `npx skills update`, can overwrite the adapted files. Setup and these commands cannot intercept every installer. Run `check` after such an update.

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

The sync reads the active local setup. It refreshes the ten live agent definitions, `AGENTS.md` (without lines about this Mac or tools the repository does not ship), model data, `pi-tps.ts`, `skill-gate.ts`, `env-wrap/`, the worktree tools, the skill lock, and skill links. The tests `scripts/wt-test.ts`, `scripts/worktrees-test.ts`, and `scripts/env-wrap-test.ts` are copies that the sync does not touch. It then reapplies the exact package list and the provider and model policy. It never changes installed live files. It does not change `skill-adaptations/`.

The sync excludes the retired `to-prd` and `to-slices` links. It keeps the repository versions of policy documents and the `bro`, `cmux`, and `msw` skills.

## Verify

Run:

```bash
npm run verify
```

Verification runs the secret scan, checks package and model policy, checks agent routes and skills, runs the skill adaptation tests, `scripts/skill-gate-test.ts`, and the worktree and env-wrap tests, and runs setup in an isolated home directory. The smoke test disables package, skill, and dependency network work.
