# pi-shared-config

Shared configuration for [Pi](https://pi.dev): a CPA localhost model catalog, portable settings, themes, keybindings, current subagents, and a small set of local UI extensions.

The repo avoids personal credentials and machine-specific provider routes. Existing `~/.pi/agent/models.json` and personal settings are preserved when setup is re-run.

## What this installs

| Area | What is included |
| --- | --- |
| Provider template | `cpa` at `http://127.0.0.1:8787/v1` with a dummy key |
| CPA models | GPT-5.6 Sol/Terra/Luna, GPT-5.4, GPT-5.4 Mini, GPT-5.3 Codex, Grok 4.5 |
| Pi settings | SSE transport, curated packages, shared UI/task defaults |
| Themes | `tokyonight` and `mocha` |
| Keybindings | Shared keybinding defaults |
| Subagents | architect, design, researcher, reviewer, scout, worker, scout report template |
| Subagent skills | PRD shaping and slicing, design, research, implementation, and review workflows required by the bundled agents |
| Extensions | token-rate footer, morphing working indicator, pi-ask config |
| Footer | `pi-fancy-footer` with native full-width context and capacity widgets |

No real API keys, account tokens, proxy URLs, or private provider endpoints are stored in this repo.

## Requirements

Install Pi first:

```bash
npm install -g --ignore-scripts @earendil-works/pi-coding-agent
```

You also need `git`, `curl`, and Node.js for the bootstrap and settings merge.

## Install or update

```bash
git clone https://github.com/FasalZein/pi-shared-config
cd pi-shared-config
bash setup.sh
```

The setup script:

- installs the CPA model template only when `models.json` is missing;
- preserves existing providers and credentials;
- reconciles the shared package list while preserving personal settings and packages;
- updates shared subagent behavior while preserving each existing agent's `model` and `allowed-models` routing;
- installs all skills explicitly required by bundled subagents, while retaining an existing personal/global copy with the same name;
- copies shared instructions, agents, themes, keybindings, footer config, and local extensions;
- removes the old repo-installed `full-context-bar` patch and CMUX integration;
- reconciles Pi packages when `pi` is available.

Disable package reconciliation when needed:

```bash
INSTALL_PI_PACKAGES=false bash setup.sh
```

## CPA provider

The bundled provider expects a compatible local service at:

```text
http://127.0.0.1:8787/v1
```

Its configured API key is the literal dummy value `dummy`. Setup never overwrites an existing `models.json`, so users can keep different providers or replace the CPA endpoint locally.

The shared settings intentionally do not set `defaultProvider`, `defaultModel`, or `enabledModels`; those remain user choices.

## Package updates

```bash
pi update --extensions
```

The current shared package set uses `npm:pi-fancy-footer`. Its built-in `context-bar` and `context-capacity` widgets replace the old custom full-context-bar extension.

## Installed files

```text
pi-shared-config/
├── AGENTS.md
├── APPEND_SYSTEM.md
├── README.md
├── agents/
│   ├── architect.md
│   ├── design.md
│   ├── researcher.md
│   ├── reviewer.md
│   ├── scout.md
│   ├── scout-report-template.md
│   └── worker.md
├── extensions/
│   ├── eko24ive-pi-ask.json
│   ├── morph-indicator.ts
│   └── pi-tps.ts
├── fancy-footer.json
├── install.sh
├── keybindings.json
├── models.json
├── package.json
├── scripts/merge-settings.mjs
├── skills/
│   ├── grill-with-docs/, grilling/, domain-modeling/, to-prd/, and to-slices/
│   ├── design-craft/, impeccable/, laws-of-ux/, design-md/, design-qa/
│   ├── make-interfaces-feel-better/
│   ├── research/, exa/, firecrawl/, tinyfish/
│   ├── implement/ and tdd/
│   └── code-review/ and thermo-nuclear-code-quality-review/
├── settings.json
├── setup.sh
└── themes/
```

## Standalone bootstrap

```bash
curl -fsSL https://raw.githubusercontent.com/FasalZein/pi-shared-config/main/install.sh | bash
```

## Intentionally excluded

The shared setup excludes provider/proxy-specific patches, generated integration files, local development paths, wiki hooks, elevated permission preferences, backups, and terminal utility integrations such as ghui, lazygit, Lumen, and Yazi.

## Troubleshooting

Restart Pi after changing models, packages, agents, or extensions. If packages did not update, run:

```bash
pi update --extensions
```
