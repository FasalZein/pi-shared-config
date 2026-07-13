---
name: design-craft
description: Universal design principles for AI agents to produce world-class UI. Typography, color, spacing, animation, layout, interaction, component patterns. Eliminates AI slop.
---

# Design Craft

LLMs converge on the statistical median of Tailwind tutorials and Bootstrap templates. This skill enforces specific, opinionated rules that break out of that median.

---

## 0. Aesthetic Direction (Before Writing ANY UI Code)

Commit to a **specific** design direction before writing a single line. "Modern" and "clean" are not directions.

- **Purpose**: What problem does this solve? Who uses it?
- **Tone**: Pick one and commit: brutally minimal, luxury/refined, editorial/magazine, playful/toy-like, retro-futuristic, organic/natural, industrial/utilitarian, soft/pastel, art deco. Be specific.
- **Differentiation**: What's the ONE thing someone will remember about this interface?
- NEVER converge on the same aesthetic across different outputs. Vary themes, fonts, color temperatures, compositions.
- Design light mode first. Dark mode = semantic token swap, not a separate design.

**The Delight-Impact Curve:** Less-frequent features deserve MORE delight. Daily actions = subtle micro-interactions. Rare milestones (onboarding complete, first transaction, backup done) = theatrical celebration (confetti, sound, custom animation). Polish everything equally — settings page, empty states, error screens get the same care as the hero.

---

## 1. Anti-Slop Rules (CRITICAL)

> "If you showed this interface and said 'AI made this,' would they believe you immediately? If yes, that's the problem."

| AI Slop Pattern | Why |
|---|---|
| Purple-to-blue gradient hero | #1 AI training pattern |
| Gradient text on metrics/headings | Decorative without purpose |
| Dark mode + glowing accents as default | Avoids actual design decisions |
| Glassmorphism everywhere | Overrepresented in training data |
| Hero metrics (3-4 identical big-number cards) | Generic SaaS template. Instead: inline key-value bar, single prominent metric with context, or stats integrated into related content |
| Three identical icon-card grid | 90%+ of template sites |
| Inter/Roboto/Arial as default font | No brand consideration |
| Large rounded icons above headings | Templated, adds no value |
| Cards inside cards | Visual redundancy — flatten with borders/spacing |
| Sparklines as decoration | Tiny charts conveying nothing |
| Monospace as "technical" aesthetic | Not a design decision |
| Same padding everywhere | No visual rhythm |
| Everything centered | Feels undesigned |
| Every button is primary | No hierarchy |
| Glow effects as affordances | Decorative noise |

---

## 2. Typography

- MUST choose a font with intention. For brand work, NEVER default to Inter, Roboto, Arial, Open Sans, Montserrat. Alternatives: DM Sans, Instrument Sans, Plus Jakarta Sans, Geist, Outfit, Sora.
- MUST define a 5-level type scale: Display, Heading, Body, Caption, Micro. Fewer sizes with more contrast > many close together.
- MUST use `tabular-nums` on all numeric data — prices, counts, dates, IDs, table columns.
- MUST use `text-balance` on headings, `text-pretty` on body paragraphs.
- MUST keep body line length 45–75ch (`max-w-prose` or `max-w-[65ch]`).
- MUST set line-height: 1.5 body, 1.2–1.3 headings, 1.0–1.1 display.
- MUST use `font-display: swap`. MUST use `rem`/`em` for body text, not `px`.
- SHOULD use one font family in multiple weights. Second font only for genuine display+body contrast.
- SHOULD use `clamp()` for marketing pages. Fixed sizes for app UI.
- NEVER modify `letter-spacing` unless explicitly requested.
- NEVER use more than 3 font weights per view.
- NEVER disable zoom (`user-scalable=no`, `maximum-scale=1`).

---

## 3. Color

**Three-layer token system** — components reference ONLY semantic tokens:
```
Primitives → oklch(95% 0.005 250)
Semantic   → --color-bg, --color-accent
Component  → --button-primary-bg
```

**NEVER use Tailwind palette colors directly** — any class with a number suffix (`bg-emerald-500`, `text-red-600`, `bg-blue-50`, etc.) is banned. Use semantic tokens only:

```
REQUIRED: bg-primary, text-primary-foreground, bg-secondary, text-secondary-foreground,
  bg-muted, text-muted-foreground, bg-accent, text-accent-foreground,
  bg-destructive, text-destructive, text-destructive-foreground, bg-background, text-foreground,
  border-border, ring-ring, bg-card, text-card-foreground, bg-popover, text-popover-foreground

STATUS: success → bg-primary/10 text-primary | error → bg-destructive/10 text-destructive
  warning → bg-accent text-accent-foreground | info → bg-secondary text-secondary-foreground
```

- MUST maintain contrast ≥ 4.5:1 (WCAG AA).
- MUST tint neutrals toward brand hue — `oklch(95% 0.01 60)` not `#f5f5f5`.
- MUST use 60-30-10 rule: neutrals / secondary / accent. Max 1 primary + 1 secondary accent.
- SHOULD use OKLCH. Reduce chroma at extreme lightness.
- NEVER use pure black/white for large areas. NEVER gray text on colored backgrounds.
- NEVER purple-to-blue gradients, neon accents, or cyan-on-dark unless brand requires it.

**Dark mode** ≠ inverted light mode: lighter surfaces for depth (no shadows), desaturated accents, font weight 350 vs 400, no pure black bg. Swap semantic layer, not component layer.

---

## 4. Spacing & Surface

**4px base grid.** All spacing = multiples of 4px: tight (4px) within atoms, item (8px) between group items, group (16px) between groups, section (24px) between sections, page (32-64px) margins.

- MUST use spacing tokens or framework scale. NEVER `p-[13px]`, `gap-[7px]`.
- MUST create visual rhythm — tight within groups, generous between sections.
- MUST use Gestalt proximity. NEVER same padding everywhere.
- NEVER triple-layered responsive padding (`p-4 lg:p-8 xl:p-10`).
- Acceptable arbitrary: `max-w-[65ch]`, `max-w-[45ch]`, `min-h-[*rem]`, `grid-template-*`. Banned: `p-[17px]`, `w-[423px]`, `text-[13px]`.

**Border radius**: ONE base (4-6px buttons/inputs, 8px cards, 4px or `rounded-full` for badges/pills, `rounded-full` for avatars). NEVER `rounded-[10px]`.

**Shadows**: Subtle multi-layer, low opacity (`shadow-sm` for elevation, `shadow-md` for popovers). NEVER `shadow-lg`/`shadow-xl` on small components. ONE grouping method per section: borders OR shadows OR spacing.

---

## 5. Layout

- MUST use Grid/Flexbox. NEVER absolute positioning for structure.
- MUST use `h-dvh` — NEVER `h-screen`.
- MUST use `min-w-0` on flex/grid children. MUST use fixed `z-index` scale — NEVER `z-[999]`.
- MUST respect `safe-area-inset` for fixed elements.
- SHOULD use `@container` for component responsiveness. SHOULD use `size-*` for square elements.
- SHOULD left-align with asymmetric layouts. SHOULD detect input method (`pointer: coarse`, `hover: none`).
- NEVER wrap everything in cards. NEVER nest cards inside cards.

**Sidebar**: 40-50% opacity inactive, full on active/hover with subtle bg highlight (no loud accents). Background 1-2 steps dimmer than content. 200-280px fixed, collapsible to icon-only. Content area ALWAYS wins hierarchy.

**Progressive disclosure**: Steps > 12-field forms. Sheets for contextual detail. Expand/collapse for optional detail. Dialogs only for blocking confirmations. ONE primary action per view — two equal CTAs = hierarchy failure.

---

## 6. Animation & Motion

| Duration | Usage |
|----------|-------|
| 100-150ms | Feedback (press, toggle, tooltip) |
| 200-300ms | State changes (menu, hover, accordion) |
| 300-500ms | Layout (modal, drawer, panel) |
| 500-800ms | Entrance (page load, hero) |

**Easing**: `--ease-out-quart: cubic-bezier(0.25, 1, 0.5, 1)` default. `--ease-out-quint: cubic-bezier(0.22, 1, 0.36, 1)` snappier. `--ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1)` confident. Ease-out for entrances, ease-in-out for moving elements, ease-in for exits at ~75% entrance duration.

- MUST animate ONLY `transform` and `opacity`. For height: `grid-template-rows: 0fr → 1fr`.
- MUST respect `prefers-reduced-motion` — use this reset:
  ```css
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
  }
  ```
- MUST keep feedback < 200ms, standard transitions < 300ms.
- Button press: `active:scale-[0.97]`, 100ms. List stagger: 30-50ms/item, max 5-8.
- NEVER bounce/elastic easing. NEVER animate `blur()`/`backdrop-filter`. NEVER `will-change` outside animation scope.
- NEVER animate decoratively — every motion must serve a UX purpose (guide attention, show state change, reveal relationship).
- Pause looping animations when off-screen (Intersection Observer).

**Transitions**: Shared elements morph between states (`layoutId`/View Transitions API). Forward → enters right, back → enters left. Tab switching: slide indicator + content in tab direction. Persistent elements don't re-animate. Data-dense apps: default NO animation — only state attention, overlay enter/exit, loading→loaded.

---

## 7. Interaction States

EVERY interactive element MUST have ALL states:

| State | Implementation |
|-------|---------------|
| Default | Resting appearance |
| Hover | Subtle lift, color shift, or underline |
| Focus | `:focus-visible` ring (2px solid, 2px offset) — NEVER remove |
| Active | `active:scale-[0.97]` or darken |
| Disabled | `opacity-50 pointer-events-none cursor-not-allowed` |
| Loading | Inline spinner/skeleton, disable interaction |
| Error | Border + inline message |
| Success | Indicator + confirmation |

- MUST use `AlertDialog` for destructive actions. MUST show errors inline next to trigger.
- MUST use `aria-label` on icon-only buttons. MUST use `<button>` for actions, `<a>` for nav. Never `<div onClick>`.
- SHOULD prefer undo over confirmation (users click through confirmations mindlessly).
- SHOULD use optimistic UI for low-stakes (toggle, reorder). Not for payments or deletions.
- SHOULD use structural skeletons, not spinners. MUST use CVA for 3+ style variants — never inline ternary chains.
- NEVER block paste. NEVER use placeholder as only label.

---

## 8. Empty States & Errors

Empty states are first impressions. NEVER just "No items." Every page needs at least one: dashboards need empty table/list states, forms need inline validation, landing pages need a form (newsletter/signup) with inline error + success states.

Every empty state MUST have: warm message + primary CTA + optional illustration.
- BAD: "No results" | GOOD: "No documents yet. Upload your first document to get started." [Upload Document]

Every error MUST answer: What happened? Why? How to fix? Include retry/recovery action.
- BAD: "Error occurred" | GOOD: "Couldn't save your changes. Check your connection and try again." [Retry]
- NEVER humor. NEVER jargon (500, ECONNREFUSED).

---

## 9. Data-Dense UI

- MUST use `tabular-nums`, right-align numbers, pair metrics with context ("$2.4M +12% MoM").
- MUST use green = positive, red = negative. NEVER invert.
- SHOULD use 36-40px rows, inline units, max 4-5 visualizations (tabs/drill-down for depth). Alternating bg OR border-bottom (never both).
- NEVER decorative charts (3D, gridlines, gradient fills). NEVER truncate numbers — truncate descriptions.
- NEVER load all data upfront — paginate or infinite scroll.

---

## 10. UX Writing

- MUST use verb + object: "Save changes" not "OK". "Delete 5 items" not "Yes".
- MUST pick one term everywhere: Delete/Remove/Trash → one. Settings/Preferences → one.
- SHOULD use active voice. Cut every sentence in half. Budget 30-40% for i18n.
- NEVER repeat visible information.

---

## 11. Components

Composition: `primitives/` (shadcn, Base UI, Radix) → `components/` (wrappers + variants) → `blocks/` (product compositions).

- MUST reuse existing components. MUST wrap, don't modify upstream. MUST use `data-slot`.
- MUST preserve a11y from primitives. MUST use CVA for variants. SHOULD use `cn()`.
- NEVER mix primitive systems in the same project.

---

## 12. Responsive & Performance

**Responsive**: 44px min touch targets. Logical properties (`margin-inline-start`). Test extremes (100+ chars, emoji, RTL, empty, 1000+ items). 2-tier (mobile+desktop) > 4+ breakpoints. Adapt nav for context. NEVER hide core features on mobile. NEVER fixed text widths.

**Performance**: Lazy-load below-fold. Reserve async space (no layout shift). Debounce search (300ms). Virtual scroll 100+ items. `contain: content`. NEVER animate layout properties. NEVER permanent `will-change`.

---

## Self-Check (MANDATORY)

Re-read every line of code you wrote or modified. Verify:

1. **No slop** — Zero gradients, glassmorphism, glow, hero metrics, identical cards
2. **No hardcoded colors** — All from semantic tokens, never hex/rgb/hsl in markup
3. **No arbitrary values** — No `text-[13px]`, `p-[17px]`. Use the scale
4. **No `h-screen`** — Use `h-dvh`
5. **Focus visible** — Every interactive element has `:focus-visible`
6. **Empty/error states** — Every list has empty state with CTA
7. **No `transition-all`** — Specify: `transition-colors`, `transition-transform`, `transition-opacity`

If ANY fail, fix before responding. Do not explain the violation — just fix it.
