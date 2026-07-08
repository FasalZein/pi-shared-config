# pi-shared-config

Shared configuration for [Pi](https://pi.dev): settings, themes, keybindings, subagents, and a small set of local extensions.

This repo is meant to make a fresh Pi install feel ready to use quickly without assuming anyone's provider accounts. Provider credentials and model endpoints stay in each user's own `~/.pi/agent/models.json`.

## What this installs

| Area | What is included |
| --- | --- |
| Providers | none; `models.json` is user-specific |
| Pi settings | SSE transport, curated packages, shared UI/task defaults |
| Themes | `tokyonight` and `mocha` |
| Keybindings | Shared keybinding defaults |
| Subagents | architect, design, researcher, reviewer, scout, worker, scout report template |
| Extensions | cmux status, token-rate footer, full-width context bar, morphing working indicator, pi-ask config |
| Footer | shared fancy-footer layout |

No real API keys, account tokens, proxy URLs, or local provider endpoints are stored in this repo.

## Requirements

Install Pi first:

```bash
npm install -g --ignore-scripts @earendil-works/pi-coding-agent
```

You also need `git` and `curl` for the bootstrap flow.

## Install the Pi configuration

Clone the repo and run the setup script:

```bash
git clone https://github.com/FasalZein/pi-shared-config
cd pi-shared-config
bash setup.sh
```

This copies shared config files into `~/.pi/agent`:

- `settings.json`
- `AGENTS.md`
- `APPEND_SYSTEM.md`
- `keybindings.json`
- themes
- subagent definitions
- local extensions
- `fancy-footer.json`

`setup.sh` only writes `models.json` when one does not already exist. Existing provider credentials and model endpoints are preserved.

## Configure your own models

After installing the shared config, keep your personal providers in:

```text
~/.pi/agent/models.json
```

This repo ships an empty provider template:

```json
{
  "providers": {}
}
```

Add whatever providers your local Pi setup uses. The shared settings intentionally do not set `defaultProvider`, `defaultModel`, or `enabledModels` because those vary per user.

## Re-run package reconciliation

```bash
pi update --extensions
```

`setup.sh` runs this automatically when `pi` is available unless you set:

```bash
INSTALL_PI_PACKAGES=false bash setup.sh
```

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
│   ├── cmux/index.ts
│   ├── eko24ive-pi-ask.json
│   ├── full-context-bar.ts
│   ├── morph-indicator.ts
│   └── pi-tps.ts
├── fancy-footer.json
├── install.sh
├── keybindings.json
├── models.json
├── package.json
├── settings.json
├── setup.sh
└── themes/
```

## Standalone bootstrap

For Pi config only:

```bash
curl -fsSL https://raw.githubusercontent.com/FasalZein/pi-shared-config/main/install.sh | bash
```

## Troubleshooting

### Pi still shows old provider names

Restart Pi after changing your personal `models.json` or model-related settings.

### Packages or extensions did not update

Run:

```bash
pi update --extensions
```

## Notes on extension choices

This config intentionally excludes local provider/proxy-specific extensions and machine-specific paths. It also excludes integration-managed files such as herdr's generated agent-state extension; those should be installed by their owning tool.
