# Design QA

Universal UI quality gates — 11-gate pre-ship checklist + a sub-second ripgrep/ast-grep scanner that catches anti-patterns automatically. Binary pass/fail — no ambiguity.

## Install

```bash
npx skills add /FasalZein/design-qa
```

## What it does

A structured quality gate for UI code. Run this against any component, page, or feature before shipping.

### 11 Gates

1. **Anti-Slop Check** (Critical) — AI-generated aesthetic fingerprints
2. **Typography Consistency** — Type scale, tabular-nums, text-balance
3. **Color Consistency** — No hardcoded colors, contrast ratios, semantic tokens
4. **Spacing Consistency** — No magic numbers, 4px grid alignment
5. **Component Reuse** — Existing primitives, no library mixing, CVA variants
6. **Interaction States** — Hover, focus, disabled, loading, error coverage
7. **Accessibility** — Semantic HTML, heading hierarchy, ARIA, keyboard nav
8. **Edge Case Hardening** — Empty states, long text, overflow, number formatting
9. **Performance** — No layout animations, lazy loading, virtual scrolling
10. **Responsive Design** — Touch targets, logical properties, no hidden features
11. **Error Resilience** — API error handling, error boundaries, optimistic rollback

### Automated Scanner

Scans a full React/Tailwind project in <0.5 seconds:

```bash
# Full scan with fix suggestions
bash design-qa/scripts/design-scan.sh [target-dir] --fix

# Skip upstream UI primitives (components/ui/)
bash design-qa/scripts/design-scan.sh [target-dir] --fix --no-ui

# JSON output for CI/tooling
bash design-qa/scripts/design-scan.sh [target-dir] --json

# Critical issues only
bash design-qa/scripts/design-scan.sh [target-dir] --critical-only
```

**Requires:** ripgrep (`rg`). Optional: ast-grep (`sg`) for structural checks.

### Scanner detects

- AI slop patterns (purple gradients, glassmorphism, glow effects)
- Hardcoded colors in Tailwind classes
- `h-screen` (broken on iOS Safari)
- Arbitrary spacing/typography values
- `transition-all` (should specify exact properties)
- `<div onClick>` (should be `<button>`)
- Nested cards (via ast-grep)
- Missing aria-labels on icon buttons (via ast-grep)

### Includes ast-grep rules

- `button-missing-aria.yml` — Self-closing Button without aria-label
- `nested-card.yml` — Card nested inside another Card
- `h-screen.yml` — h-screen viewport issues
- `div-onclick.yml` — onClick on div instead of button

## Works with any agent

This is a plain markdown skill file + shell scanner. Works with Claude Code, Codex, OpenCode, Cursor, Windsurf, Copilot, Aider, Cline — any agent that reads markdown instructions.

| Agent | Where to put it |
|-------|----------------|
| Claude Code | `npx @anthropic-ai/claude-code add` (automatic) |
| Codex | `.codex/instructions.md` (inline or import) |
| OpenCode | `.opencode/instructions.md` |
| Cursor | `.cursorrules` |
| Generic | `.ai/design-qa.md` or project rules directory |

## Pairs well with

- [design-craft](https://github.com/FasalZein/design-craft) — Universal design principles that prevent issues before they happen

## License

MIT
