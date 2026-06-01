# pi-shared-config

One-command setup for [pi coding agent](https://pi.dev) with the Rift provider and curated extensions.

## Quick start

```bash
git clone https://github.com/FasalZein/pi-shared-config
cd pi-shared-config
bash setup.sh
```

That installs:
- **Rift provider** — GPT-5.5, GPT-5.4, GPT-5.4 Mini, GPT-5.3-Codex models (keys set to `"dummy"` — replace them)
- **Extensions** — cmux status bar, token rate (TPS), pi-ask, FFF file finder
- **Pi packages** — extmgr, hooks, context, gpt-config, ptc-next, tasks, condensed-milk, vcc, better-skills, context-prune, ask, subagents, fancy-footer, formatter, auto-trees, ralph-loop

## What's included

| Path | Description |
|------|-------------|
| `models.json` | Rift provider — 4 models (GPT-5.5/5.4/5.4 Mini/5.3-Codex) with `thinkingLevelMap` |
| `settings.json` | Global settings — default provider `rift`, model `gpt-5.5`, 16 packages |
| `package.json` | Pi package manifest — extensions auto-load via `pi install` |
| `extensions/cmux/` | cmux terminal status bar (model, state, tokens, cost) |
| `extensions/pi-tps.ts` | Token rate (tok/s) footer display |
| `extensions/eko24ive-pi-ask.json` | pi-ask keymaps, extraction models, behaviour |
| `extensions/fff/` | FFF file finder (re-exports `@ff-labs/pi-fff`) |
| `fancy-footer.json` | Fancy footer widget layout (rows, colors, icons) |
| `themes/` | `tokyonight` (default) + `mocha` themes |
| `agents/` | 8 pi-subagents definitions (scout, spec, planner, worker, reviewer, researcher, design, context-builder) — all on `rift/gpt-5.5` |
| `setup.sh` | One-command installer |
| `install.sh` | Standalone curl-able bootstrap (see below) |

## Standalone bootstrap (no git clone)

```bash
curl -fsSL https://raw.githubusercontent.com/FasalZein/pi-shared-config/main/install.sh | bash
```

## Manual steps

After setup, you still need to:

1. **Set your Rift API key** in `~/.pi/agent/models.json`:
   - Replace `"dummy"` with your key, or
   - Use an env var: `"apiKey": "RIFT_API_KEY"` + `export RIFT_API_KEY=your_key`

2. **Run** `pi`

## Structure

```
pi-shared-config/
├── package.json           ← Pi package (extensions auto-load)
├── models.json            ← Rift provider config
├── settings.json          ← Global settings
├── fancy-footer.json      ← Fancy footer layout
├── setup.sh               ← Full installer
├── install.sh             ← Standalone bootstrap script
├── agents/                ← pi-subagents definitions (rift/gpt-5.5)
├── themes/                ← tokyonight (default) + mocha
└── extensions/
    ├── cmux/index.ts
    ├── pi-tps.ts
    ├── eko24ive-pi-ask.json
    └── fff/index.ts + package.json
```

## Notes

- **Rift API key** is set to `"dummy"` — this is a fixed noop token baked into Rift itself. No need to change it. Just run Rift locally on `http://127.0.0.1:7439/v1`.
- **No real secrets** in this repo — safe to share publicly.
