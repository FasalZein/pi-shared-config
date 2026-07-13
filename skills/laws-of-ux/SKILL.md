---
name: laws-of-ux
description: User-psychology rules for UX decisions — cognitive load, attention, memory, mental models, motor cost, perception. Use when choosing nav structure, form length, decision flows, content ordering, error recovery, onboarding, progress indicators, or microcopy. Complements design-craft (craft) with the WHY (psychology).
globs: ["**/*.tsx", "**/*.jsx", "**/*.vue", "**/*.svelte", "**/*.html"]
---

# Laws of UX

Psychology-driven constraints for interface decisions, organized by **engineering decision**. Rules lead; law names follow in parentheses as justification.

---

## Global Principles

These three principles cut across every category below. Apply them everywhere before category-specific rules.

- **Remove every element that doesn't serve comprehension.** After building, delete one element at a time — if the page still works and communicates clearly, leave it deleted. (Cognitive Load / Occam's Razor)
- **Focus engineering on the 20% of features used by 80% of users.** The primary flow must be flawless; edge cases adequate. (Pareto / 80-20 Rule)
- **Push complexity into the system, not onto the user.** Auto-detect timezones, infer file types, pre-fill from context. If the user configures something the system could detect, the system failed. (Tesler's Law)

---

## 1. Navigation & Information Architecture

Apply when: designing primary nav, menus, sidebars, site structure, breadcrumbs.

- **Limit primary nav to 5–7 items.** Highlight the single recommended/current path. Use progressive disclosure for anything beyond 7. (Hick's Law: decision time grows log-linearly with the number of choices)
- **Put the logo top-left, search top-right, settings behind a gear icon.** Don't innovate on navigation placement — innovate on content. Users expect yours to work like the last 10 sites they used. (Jakob's Law)
- **Name 3 prior products your users use for this task. Your IA structure should match at least 2 of them.** If it doesn't, adapt to their model, not your data model. (Mental Model)
- **Show breadcrumbs and persist context across screens.** Use comparison tables instead of asking users to remember screen 1. Never make users carry mental state across views. (Working Memory / Recognition over Recall)
- **Place the most important nav items at the first and last positions.** Key toolbar actions belong at edges, not center. (Serial Position Effect: first and last positions are remembered best)

---

## 2. Forms & Data Input

Apply when: building input forms, settings pages, data entry flows, search.

- **Group related fields into named blocks, not a flat list.** Address, payment, and identity fields should each form a distinct visual unit — never 12 flat fields. Aim for ≤7 items per group. (Miller's Law: working memory holds ~7±2 items)
- **Accept every reasonable date, phone, and name format.** "Jan 5", "1/5", "2026-01-05" are all valid inputs. Validate on submit, not per-keystroke. Normalize and display consistently. (Postel's Law)
- **Pre-fill every value the system can infer.** Name from session, country from IP, timezone from browser. Every field the user doesn't have to fill is friction removed. (Tesler's Law — see Global Principles)
- **Pre-select the best default option.** Users anchor on the first value they see and default to pre-selected choices. Frame options to reduce regret. Never deceive, but never leave defaults unset. (Cognitive Bias: anchoring and status quo bias)
- **Every text input must have a visible label, not just placeholder text.** Placeholder disappears on focus, leaving no memory aid mid-entry. (Working Memory)

---

## 3. Multi-Step Flows & Progress

Apply when: building onboarding, checkout, wizards, setup flows, long tasks.

- **Every multi-step flow must show a step indicator or progress bar.** "Step 3 of 5" or a segmented bar with completed segments filled. Zero progress indicators on multi-step = fail. (Zeigarnik Effect: incomplete tasks stay top-of-mind; Goal-Gradient Effect: motivation increases near the goal)
- **Show artificial early progress for new users.** "Profile 20% complete — add a photo" increases completion. Use it to accelerate initial engagement, not to deceive. (Goal-Gradient Effect)
- **Never interrupt a user mid-task with a modal or blocking dialog.** Inline notifications, toasts, and banner alerts only. Modals during data entry kill flow. (Flow: optimal engagement requires no interruption and immediate feedback)
- **Set time expectations explicitly.** "This takes about 2 minutes." Don't give open-ended inputs where 2-word answers will do. Autofill and smart defaults cut completion time. (Parkinson's Law: tasks expand to fill available time)
- **Invest disproportionately in the final screen of every flow.** It should include: a summary of what was done, a clear next-action CTA, and a polished visual moment. The peak moment and the ending are what users remember; everything in between fades. (Peak-End Rule)

---

## 4. CTAs & Action Hierarchy

Apply when: designing buttons, action bars, toolbars, confirmation dialogs.

- **Exactly 1 visually distinct primary CTA per view.** Every other action must be visually quieter. If everything is emphasized, nothing is. (Von Restorff Effect: the distinct item gets remembered)
- **Make touch targets ≥ 44×44px.** Place primary actions near the resting thumb position (bottom of screen on mobile). Place destructive actions — Delete, Remove, Deactivate — small and far from Save. (Fitts's Law: target acquisition time = f(distance, size))
- **Primary nav items at first and last positions in any list; key actions at edges, not center.** (Serial Position Effect — see Navigation for full context)
- **Limit visible options in any action menu to ≤7.** For large catalogs, use filters or search. Add "Recommended" badges to the best option. (Hick's Law / Choice Overload)

---

## 5. Feedback & Response Time

Apply when: building async actions, loading states, real-time updates, async submits.

- **Every button that triggers an async action must have 3 states: default, loading (disabled + "Processing..." label), and result.** Zero buttons that go static after click. (Doherty Threshold)
- **Response under 400ms keeps flow unbroken.** For anything taking 400ms–3s, use a skeleton screen or optimistic UI update. For 3s+, use a progress indicator with percentage or estimated time remaining. (Doherty Threshold: sub-400ms keeps the user engaged; over 400ms breaks concentration)
- **Provide immediate visual feedback for every user action.** Every button needs hover, `focus-visible`, and active state. No silent-on-click interactions anywhere. (Flow: clear feedback is required for optimal engagement)

---

## 6. Visual Grouping & Layout

Apply when: organizing any layout, grouping controls, building grids, designing cards.

- **Use spacing to signal grouping before using borders or backgrounds.** Tight within a group, generous between groups, largest between sections. Proximity is stronger than common region. (Gestalt Proximity)
- **Identical visual style signals identical function.** Buttons look like buttons everywhere; static content never looks clickable. Don't make links and headings share the same weight at the same size. (Gestalt Similarity)
- **Use a background or border region to group related controls only when spacing isn't enough.** Regions are heavier-handed than proximity — use them for genuinely distinct semantic containers (a card, a panel, a modal). (Gestalt Common Region)
- **Use lines, arrows, or connectors when you need to express a relationship stronger than proximity or similarity can.** Step connectors in wizards, callout lines on diagrams. Connectedness overrides all other grouping cues. (Gestalt Connectedness)
- **Align all elements to a visible grid. Use consistent shapes — all rounded or all sharp corners, not mixed.** Whitespace should form clean rectangles. If a layout looks messy, the shapes aren't resolving to simple forms. (Gestalt Prägnanz: people perceive the simplest possible form)
- **Invest in visual polish: consistent spacing rhythm, refined typography, smooth transitions.** Polished interfaces are perceived as more usable and earn forgiveness for minor friction. Threshold check: ≤2 font families, consistent corner radius scale (don't mix 4px and 16px on same-level surfaces), spacing values from a token system. Note: never skip usability testing because it "looks good" — the halo effect masks real problems. (Aesthetic-Usability Effect)

---

## 7. Content & Copy

Apply when: writing labels, empty states, onboarding copy, tooltips, confirmation messages.

- **Make the primary action visible without scrolling and discoverable without a tutorial.** Every primary action needs an inline affordance — tooltip, empty-state CTA, helper text. Design for the user who skipped every tutorial and never reads documentation. (Active User Paradox: users never read manuals)
- **Never place important content in banner-like positions at top of page.** Users develop banner blindness and filter out anything resembling an advertisement in position and style. Use size contrast (2× difference between primary and secondary elements), weight, and left-alignment to guide the eye instead. (Selective Attention / Banner Blindness)
- **Avoid placing important content where it will be ignored.** (Selective Attention — use position, weight, and size contrast to direct focus, not color alone)

---

## 8. Error Handling & Recovery

Apply when: designing validation, error states, empty states, destructive action flows.

- **Validate on submit, not per-keystroke.** Show errors inline, adjacent to the field that caused them — not in a toast, not in a banner at the top. (Postel's Law + Working Memory: put the error where the user is looking)
- **Accept format variation; normalize internally.** If the user types "555-867-5309" and your model wants "5558675309", convert silently. Never reject valid intent due to format. (Postel's Law)
- **Destructive actions must require a confirmation step and must be visually distinct (smaller, lower contrast, further from the primary CTA).** Never place Delete adjacent to Save. (Fitts's Law: distance creates safety margin)
- **Every empty state must have a CTA.** "No results" is not a complete state. "No results — try adjusting your filters" or "You haven't added anything yet — add your first item" is. (Active User Paradox: discoverable actions over passive empty states)

---

## Decision Matrix

| Engineering decision | Rule | Laws |
|---|---|---|
| How many nav items? | ≤7, highlight the recommended/current one | Hick + Miller |
| Form feels too long? | Multi-step; push complexity into system; pre-fill what you can | Tesler + Miller + Chunking |
| Where to place the CTA? | Big target (≥44px), bottom on mobile, edge in toolbar | Fitts + Serial Position |
| What to emphasize? | ONE element per view is visually distinct; everything else quieter | Von Restorff |
| Multi-step flow stalling? | Show step indicator + early artificial progress | Zeigarnik + Goal-Gradient |
| Users confused by navigation? | Match the convention; match their existing mental model | Jakob + Mental Model |
| Slow response (>400ms)? | Skeleton or optimistic UI; disable + label submit button | Doherty Threshold |
| Users ignoring important content? | Avoid ad-like positions; use size contrast 2×+, not color alone | Selective Attention + Banner Blindness |
| Low satisfaction after a flow? | Redesign the peak moment and the final screen | Peak-End Rule |
| Too many options in a menu? | ≤7 visible; add filter/search for larger lists; pre-select best | Hick + Choice Overload |
| Grouping visually unclear? | Spacing first → similarity → common region → connectedness | Gestalt (subtlety order) |
| Accepting user input? | Accept any reasonable format, normalize on the back end | Postel's Law |
| Users forgetting prior screen? | Breadcrumbs, persistent context, comparison views | Working Memory |
| Where to invest engineering time? | Primary flow flawless; edge cases adequate | Pareto 80/20 |
| Mid-task interruptions? | No modals during data entry; toasts and banners only | Flow |

---

## Self-Check

Before finishing any UX-significant work, run each check. Fix failures before responding.

**1. Decision load**
- Count primary buttons per route/view component — must be exactly 1
- Count nav items — must be ≤7
- Count visible options in any dropdown or menu — must be ≤7 or have a search/filter

**2. Conventions**
- Logo top-left links to home
- Search in the header
- Settings behind a gear icon
- Native form controls used where available

**3. Progress**
- `grep -r "step" src/` — every multi-step flow has a step counter or progress bar
- Every multi-step route component renders a `<ProgressBar>`, `<Steps>`, or equivalent

**4. Feedback on every action**
- `grep -rn "onClick\|onSubmit" src/` — each handler has a corresponding loading/disabled state
- Zero submit buttons without a `loading` or `disabled` state in async paths
- Every interactive element has `:hover`, `focus-visible`, and `:active` states

**5. Attention hierarchy**
- Scan the view at arm's length — exactly 1 element draws the eye first
- If 2+ elements compete equally in size, weight, and color, hierarchy has failed

**6. Error recovery**
- `grep -rn "validate\|onBlur" src/` — no per-keystroke validation, only on submit
- Error messages are inline, adjacent to the field, not in a top banner

**7. Peak + end**
- Final screen of every flow has: summary, next-action CTA, polished visual moment
- Every empty state has a CTA — search for `empty` or `no results` in component files

**8. Touch targets (mobile)**
- Interactive elements: minimum 44×44px
- Destructive actions are not adjacent to primary Save/Submit

---

## Coverage Table

Every entry from the original skill mapped to its new home.

| Law / Principle | Primary Category | Cross-reference |
|---|---|---|
| Hick's Law | 1. Navigation | 4. CTAs (menus) |
| Miller's Law | 2. Forms | — |
| Working Memory / Recognition | 1. Navigation | 2. Forms |
| Cognitive Load | Global Principles | All |
| Choice Overload | 4. CTAs | 1. Navigation |
| Tesler's Law | Global Principles | 2. Forms |
| Occam's Razor | Global Principles | All |
| Jakob's Law | 1. Navigation | — |
| Mental Model | 1. Navigation | — |
| Active User Paradox | 7. Content & Copy | 8. Error Handling |
| Von Restorff Effect | 4. CTAs | — |
| Selective Attention / Banner Blindness | 7. Content & Copy | — |
| Serial Position Effect | 1. Navigation | 4. CTAs |
| Aesthetic-Usability Effect | 6. Visual Grouping | — |
| Peak-End Rule | 3. Multi-step Flows | — |
| Zeigarnik Effect | 3. Multi-step Flows | — |
| Goal-Gradient Effect | 3. Multi-step Flows | — |
| Flow | 3. Multi-step Flows | 5. Feedback |
| Fitts's Law | 4. CTAs | 8. Error Handling |
| Doherty Threshold | 5. Feedback | — |
| Parkinson's Law | 3. Multi-step Flows | — |
| Gestalt: Proximity | 6. Visual Grouping | — |
| Gestalt: Similarity | 6. Visual Grouping | — |
| Gestalt: Common Region | 6. Visual Grouping | — |
| Gestalt: Connectedness | 6. Visual Grouping | — |
| Gestalt: Prägnanz | 6. Visual Grouping | — |
| Postel's Law | 2. Forms | 8. Error Handling |
| Pareto / 80-20 | Global Principles | — |
| Cognitive Bias | 2. Forms | — |
