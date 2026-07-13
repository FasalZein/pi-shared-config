---
name: design-md
description: Use the DMD/design-md CLI to retrieve local style references, generate or improve project-level DESIGN.md files, create screen-level UI plans, and produce agent handoff packs. Use when Codex is asked to use DMD/dmd/design-md, bootstrap UI direction, improve an existing app's design system, retrieve style-vault references, create a DESIGN.md, plan a screen, or coordinate DMD with design-craft, laws-of-ux, and design-qa.
---

# DMD Design

DMD is a local-first design context CLI. It scans a target app, retrieves bounded style evidence from a local `style-vault`, and writes durable design artifacts that agents can use while building UI.

Use DMD as a tool protocol: ask a bounded command for JSON, or write a durable project artifact. Do not load the full style vault into model context.

## Locate The CLI

Prefer an installed `dmd` binary:

```bash
command -v dmd
dmd --help
```

From the DMD repo, prefer the symlinked binary:

```bash
./dmd --help
```

Fallback from the DMD repo:

```bash
bun ./bin/design-md.ts --help
```

In examples below, replace `dmd` with `./dmd` or `bun ./bin/design-md.ts` when needed.

## Preflight

- Inspect the target app enough to understand product type, UI stack, existing routes/components, and likely design needs.
- Verify the local archive before relying on it: `dmd stats --validate --json`.
- For a complete local mirror, `complete`, `compact`, `extended`, and `raw` should match `indexStyles`.
- Treat archive counts as snapshots, not invariants. A 2026-05-04 local snapshot had `1322` indexed styles.
- Build or refresh the optional BM25F retrieval map when retrieval quality or broad style matching matters: `dmd index --archive ./style-vault --json`.

## Main Workflow

1. Use `brief --json` when the agent needs compact design context without writing files.
2. Use `plan-ui --json` when implementing or improving one specific screen.
3. Use `agent-pack --json` when coordinating DMD with `design-craft`, `laws-of-ux`, and `design-qa`.
4. Use `create` for a new or weakly defined project-level UI direction.
5. Use `improve` for an existing app that needs a stronger cohesive design system.
6. Use compact mode by default. Use extended mode when the user asks for richer reference content or when brand/content guidance matters more than context budget.
7. Read generated `DESIGN.md`, `.design-md/style-context.json`, and `.design-md/agent-pack.md` before implementing UI changes.

## Commands

Create a default project-level design brief:

```bash
dmd create --project /path/to/app --query "calm analytics dashboard with dense tables" --out DESIGN.md
```

Improve an existing app with specific design checks:

```bash
dmd improve --project /path/to/app --categories brand,color,typography,layout,components,motion,accessibility --mode extended --out DESIGN.md
```

Search the local vault without generating a file:

```bash
dmd search "editorial minimal commerce" --limit 8 --json
```

Retrieve ranked local references with selected markdown content:

```bash
dmd retrieve "calm analytics dashboard" --limit 6 --mode compact --engine zig --json
dmd retrieve "metrics interface" --limit 6 --mode compact --engine bm25 --json
dmd retrieve "metrics interface" --limit 6 --mode compact --engine auto --json
```

Create bounded JSON design context for an agent:

```bash
dmd brief --project /path/to/app --query "calm analytics dashboard with dense tables" --limit 6 --json
```

Create a screen-level implementation plan:

```bash
dmd plan-ui --project /path/to/app --screen dashboard --query "calm analytics dashboard with dense tables" --limit 6 --json
```

Create the design-engineering handoff pack for use with the design skills:

```bash
dmd agent-pack --project /path/to/app --screen dashboard --query "calm analytics dashboard with dense tables" --engine auto --limit 6 --json
```

Find files or grep local archive content:

```bash
dmd find "calm dashboard" --path ./style-vault --limit 20
dmd grep "tabular numbers" --path ./style-vault --limit 20
```

## Output Contract

DMD writes:

- `DESIGN.md` in the target project unless `--out` is specified.
- `.design-md/style-context.json` with the query, categories, and retrieved style matches.
- `.design-md/agent-pack.md` and `.design-md/agent-pack.json` when `agent-pack` is used.

For tool-style commands:

- `stats --validate --json` returns archive completeness counts and validation status.
- `search --json` returns native style metadata matches.
- `retrieve --json` returns ranked references plus selected compact or extended markdown.
- `retrieve --engine zig --json` uses the native Zig lexical scanner.
- `retrieve --engine bm25 --json` uses `style-vault/index/retrieval-map.json` plus sharded postings with BM25F field weights, query expansion, and lightweight diversity reranking.
- `retrieve --engine auto --json` uses BM25F when the retrieval map exists, otherwise falls back to Zig.
- `brief --json` returns project profile, query, categories, guidance, references, and implementation direction.
- `plan-ui --json` returns a screen-level plan with layout, tokens, components, content, motion, accessibility, and next steps.
- `agent-pack --json` returns a bounded handoff contract for `design-md`, `design-craft`, `laws-of-ux`, and `design-qa`.

`DESIGN.md` should be treated as the UI north-star file for implementation. Use it to drive tokens, typography, layout, component states, content tone, motion, and accessibility decisions.

## Skill Composition

Use DMD with design skills in this order when available:

1. `design-md`: generate `DESIGN.md` and retrieve relevant local style evidence.
2. `design-craft`: convert that evidence into a visual direction, typography system, spacing rhythm, component polish, and anti-slop constraints.
3. `laws-of-ux`: validate navigation, decision load, grouping, feedback, error recovery, and flow.
4. `design-qa`: run the final quality gate and report only failures.

The DMD pack is evidence, not a replacement for design judgment. Do not copy references blindly; use them to constrain the agent so it produces cohesive UI instead of generic templates.

## Implementation Guidance

- Do not fetch from the upstream style service during normal design work; use the local `style-vault`.
- Do not paste all vault content into the model context. Let DMD retrieve relevant compact or extended references.
- Use clear product queries. Include domain, mood, density, interface type, and key components.
- Keep generated output named `DESIGN.md`, not `design.md`.
- If `bm25` fails with missing index guidance, run `dmd index --archive <style-vault> --json`, then retry or use `--engine auto`.
- If `dmd` is not found, do not assume the skill installed the CLI. Locate the DMD repo, use the repo-local binary, or ask the user where DMD is installed.
- If the target project already has a `DESIGN.md`, prefer `improve` over `create` unless the user asks to replace it.
- Keep DMD-generated artifacts project-local. Do not write generated `DESIGN.md` files into the DMD repository root unless the DMD repo itself is the target app.
- If the user asks for fast local retrieval, note that DMD uses Bun for CLI orchestration, Zig for archive hot paths, and an optional sharded BM25F retrieval map for indexed reranking.
- Prefer `brief --json`, `plan-ui --json`, or `agent-pack --json` over MCP context expansion when the agent only needs targeted design context.

## Verification

When changing DMD itself, run from the DMD repo:

```bash
bun run test
bun run check
bun run pack:check
dmd stats --validate --json
bunx desloppify scan . --pack js-ts --json --summary
```

When only using DMD on another project, verify:

```bash
test -f /path/to/app/DESIGN.md
test -f /path/to/app/.design-md/style-context.json
test -f /path/to/app/.design-md/agent-pack.md
```
