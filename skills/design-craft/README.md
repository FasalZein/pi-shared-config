# Design Craft

Universal design principles for AI agents to produce world-class UI. Typography, color, spacing, animation, layout, interaction, component patterns. Eliminates AI slop.

## Install

```bash
npx skills add /FasalZein/design-craft
```

## What it does

The core problem: LLMs converge on the statistical median of every Tailwind tutorial and Bootstrap template. The result is generic, safe, forgettable. This skill enforces specific, opinionated rules that break out of that median.

### Covers

- **Anti-slop rules** — Detects and prevents the fingerprints of AI-generated UI (purple gradients, glassmorphism, hero metrics, identical card grids, etc.)
- **Typography** — Intentional font choice, type scale, tabular-nums, text-balance, line length control
- **Color** — Semantic token architecture (primitive → semantic → component), OKLCH, 60-30-10 rule, dark mode
- **Spacing** — 4px grid system, semantic spacing tokens, Gestalt proximity
- **Border radius & shadows** — Consistent radius derivation, subtle multi-layer shadows
- **Layout** — CSS Grid/Flexbox, h-dvh, container queries, sidebar hierarchy, progressive disclosure
- **Animation & motion** — Duration scale, easing curves, transform+opacity only, reduced motion
- **Interaction states** — 8-state coverage for every interactive element
- **Empty states & error messages** — Warm CTAs, three-question error format
- **Data-dense UI** — Tables, dashboards, financial data patterns
- **UX writing** — Specific verb+object labels, consistency, active voice
- **Component architecture** — Composition model, CVA variants, data-slot attributes
- **Responsive design** — 44px touch targets, logical CSS properties, RTL support
- **Performance** — Lazy loading, virtual scrolling, debounced inputs, no layout animations

### Includes a mandatory self-check

Every UI output is verified against 7 binary checks before responding. If any fail, the agent fixes them automatically.

## Works with any agent

This is a plain markdown skill file. It works with Claude Code, Codex, OpenCode, Cursor, Windsurf, Copilot, Aider, Cline — any agent that reads markdown instructions.

| Agent | Where to put it |
|-------|----------------|
| Claude Code | `npx @anthropic-ai/claude-code add` (automatic) |
| Codex | `.codex/instructions.md` (inline or import) |
| OpenCode | `.opencode/instructions.md` |
| Cursor | `.cursorrules` |
| Generic | `.ai/design-craft.md` or project rules directory |

## Pairs well with

- [design-qa](https://github.com/FasalZein/design-qa) — 11-gate quality checklist + automated scanner

## License

MIT
