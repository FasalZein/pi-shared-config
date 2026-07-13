---
name: design-qa
description: Universal UI quality gates — accessibility, consistency, hardening, performance, responsive checks. Pre-ship checklist. Works with any AI agent, any framework.
---

# Design QA

Binary pass/fail quality gates for UI code. Run against any component, page, or feature before shipping. Report ONLY failures — silence = quality.

**Fast scan** (<1s, requires `rg`, optional `sg`):
```bash
bash design-qa/scripts/design-scan.sh [dir] --fix       # fix suggestions
bash design-qa/scripts/design-scan.sh [dir] --json      # CI output
bash design-qa/scripts/design-scan.sh [dir] --no-ui     # skip components/ui/
bash design-qa/scripts/design-scan.sh [dir] --critical-only
```

**Deep review**: Read code → run gates in order → report failures with file:line and fix.

---

## Gate 1: Anti-Slop (Critical)

ANY = immediate flag:

| Check | Pass Condition |
|-------|---------------|
| No purple-blue gradients | Zero purple/blue/violet gradient combos |
| No gradient text | Zero `bg-clip-text text-transparent bg-gradient-*` on headings/metrics |
| No glassmorphism | Zero decorative `backdrop-blur` (functional overlay blur OK) |
| No hero metric template | No big-number-in-card × 3-4 identical row pattern |
| No identical card grid | Cards have varied content/layout |
| No glow effects | Zero colored `box-shadow` spread |
| No nested cards | Zero Card inside Card |
| Font is intentional | Not Inter/Roboto/Arial as default |

---

## Gate 2: Typography

| Check | Verify |
|-------|--------|
| Project type scale only | Grep `text-[*px]`, `text-[*rem]`, `font-size:`. Only project-defined sizes. Exception: `text-[11px]` micro. |
| No letter-spacing mods | Grep `tracking-*`, `letter-spacing`. Zero unless in design spec. |
| Numeric data: tabular-nums | All `<td>/<th>` with numbers, prices, counts, dates use `tabular-nums`. |
| Headings: text-balance | All `<h1>`-`<h6>` use `text-balance` or `text-pretty`. |
| Line length controlled | Body text has `max-w-prose` or 45-75ch equivalent. |
| Max 3 font weights | Count distinct `font-*` weights. >3 = flag. |

---

## Gate 3: Color

| Check | Verify |
|-------|--------|
| No hardcoded colors | Grep hex `#[0-9a-f]`, `rgb(`, `hsl(`, `oklch(` in JSX. All from tokens. |
| No pure black/white | `bg-black`, `bg-white`, `#000`, `#fff` on containers = flag. |
| No gray on colored bg | `text-gray-*` on non-neutral background = flag. Use bg shade. |
| Status colors semantic | Success=green, Error=red, Warning=amber, Info=blue. Inversion = flag. |
| Contrast ≥ 4.5:1 | OKLCH ΔL ≥ 0.4 body, ≥ 0.3 large text. |
| Max 2 accent colors | Count distinct accent/brand colors per view. >2 = flag. |

---

## Gate 4: Spacing

| Check | Verify |
|-------|--------|
| No magic numbers | Grep `p-[*]`, `m-[*]`, `gap-[*]` with non-4px-multiple values. |
| Semantic hierarchy | Sections > groups > items spacing, consistent within page. |
| No triple responsive padding | `p-2 md:p-4 lg:p-6 xl:p-8` = flag. One value per context. |
| 4px grid | All spacing multiples of 4px (0.25rem). |

---

## Gate 5: Component Reuse

| Check | Verify |
|-------|--------|
| Existing primitives used | Custom `<button>`, `<input>`, `<dialog>` when project has equivalents = flag. |
| No primitive mixing | Multiple UI lib imports (Radix + Base UI + Headless) in same file = flag. |
| CVA for variants | Inline ternary chains for 3+ style variants instead of CVA = flag. |
| data-slot attributes | Missing `data-slot` on component roots (if project convention) = flag. |

---

## Gate 6: Interaction States

| Check | Verify |
|-------|--------|
| Hover on all buttons | Every `<Button>`/`<button>` has hover styles. |
| Focus visible everywhere | `:focus-visible` ring on all interactive elements. NEVER `outline: none` without replacement. |
| Disabled state real | `disabled:opacity-* + disabled:pointer-events-none`. Not just visual. |
| Loading states exist | Async actions show indicator. Buttons disable during submit. |
| Icon buttons: aria-label | Every icon-only button has `aria-label`. |
| Destructive → AlertDialog | Delete/discard/overwrite use AlertDialog, not Dialog/confirm. |
| Errors inline | Shown next to trigger, not only toast/banner. |
| Paste not blocked | No `onPaste={e => e.preventDefault()}`. |

---

## Gate 7: Accessibility

| Check | Verify |
|-------|--------|
| Semantic HTML | `<button>` actions, `<a>` navigation, `<nav>/<main>/<header>`. No `<div onClick>`. |
| Heading hierarchy | h1→h2→h3 in order, no skips. One h1/page. |
| Alt text | Every `<img>` has `alt`. Decorative: `alt=""`. |
| Form labels | Every input has `<label>` (htmlFor or wrapping). Not just placeholder. |
| Keyboard nav | Logical tab order. No traps. All functionality keyboard-reachable. |
| ARIA live regions | Dynamic updates use `aria-live="polite"` or `role="status"`. |
| Color not sole indicator | Status paired with icon/text/pattern, never color alone. |
| Touch targets ≥ 44px | `min-h-11 min-w-11` or equivalent on mobile. |
| prefers-reduced-motion | All animations respect it. |
| h-dvh not h-screen | Grep `h-screen`. Replace with `h-dvh`. |

---

## Gate 8: Edge Case Hardening

| Check | Verify |
|-------|--------|
| Empty states designed | Every list/table/grid has message + CTA. Not blank. |
| Long text handled | `truncate`, `line-clamp-*`, or `break-words` on names/titles. |
| Overflow prevented | Flex children: `min-w-0`. Grid children: `min-w-0 min-h-0`. |
| Numbers formatted | `Intl.NumberFormat` for large numbers. Not raw digits. |
| Dates formatted | `Intl.DateTimeFormat` or relative. Not raw ISO. |
| Skeletons match layout | Skeleton shapes mirror actual content structure. |
| Double-submit prevented | Submit buttons disable during async. |
| Error recovery | Every error state has retry or clear path forward. |

---

## Gate 9: Performance

| Check | Verify |
|-------|--------|
| No layout animations | Grep `animate-*`/`transition-*` on width/height/top/left/margin/padding. Only transform+opacity. |
| No transition-all | Grep `transition-all`. Must specify: `transition-colors`, `transition-transform`, `transition-opacity`. |
| No permanent will-change | `will-change` only within animation scope. |
| No animated blur | `backdrop-blur` + `transition`/`animate` together = flag. |
| Images lazy loaded | Below-fold: `loading="lazy"`. |
| No layout shift | Async content has reserved space. |
| Lists virtualized | 100+ items use virtual scrolling. |
| Inputs debounced | Search/filter: 200-300ms debounce. |
| Cleanup on unmount | useEffect returns cleanup (cancel subs, abort fetch, remove listeners). |
| No render-logic useEffect | `useEffect` deriving values from props/state that could be computed during render = flag. |
| No console.log | Grep `console.log/warn/error` not in dev check. |

---

## Gate 10: Responsive

| Check | Verify |
|-------|--------|
| No horizontal scroll | Mobile layout reflows to single column. |
| No hidden core features | `hidden md:block` on essential functionality = flag. |
| Logical CSS properties | `margin-inline-start/end` not `margin-left/right`. |
| No fixed text widths | `w-24`/`w-[200px]` on text containers = flag. |
| Zoom not disabled | No `user-scalable=no`/`maximum-scale=1`. WCAG violation. |
| Input method aware | `@media (pointer: coarse)` for touch targets. |

---

## Gate 11: Error Resilience

| Check | Verify |
|-------|--------|
| API errors differentiated | 401→login, 403→permission, 404→not found, 429→rate limit, 500→generic. |
| Error boundaries | React boundaries around major sections. One crash ≠ full page down. |
| Optimistic rollback | Failed optimistic updates revert state + show error. |

---

## Report Format

Output ONLY failures:
```
## QA Report: [Component/Page]
### Critical — [Gate]: [Check] — File:Line — Issue and fix
### High — [Gate]: [Check] — File:Line — Issue and fix
### Medium — [Gate]: [Check] — File:Line — Issue and fix
Summary: X critical, Y high, Z medium | Top pattern: [most repeated]
```

**Severity**: Critical = a11y violations, anti-slop, broken states. High = missing loading, hardcoded colors, no empty states. Medium = typography, text-balance, debounce.

---

## Quick-Check (5 gates for PR review)

1. No anti-slop (Gate 1)
2. No hardcoded colors (Gate 3)
3. Focus visible (Gate 6)
4. Empty states exist (Gate 8)
5. No layout animations (Gate 9)

All pass → probably fine. Any fail → full gate sequence.
