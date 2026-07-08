# Global Agent Guidelines

## 1. The Delivery Flow

New or fuzzy work follows this shape: clarify with questions -> capture a PRD or spec -> slice it -> implement each slice with verification -> review. Match your step to where the work currently is; do not implement what has not been shaped. Background and loop sessions execute their brief as given; they do not restart this flow.

## 2. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

- State assumptions explicitly. For reversible work, proceed with the most reasonable interpretation and record the assumption in your output.
- Ask (via ask_user when available) when a decision is preference-sensitive, expensive to undo, or a wrong guess would waste real work. Present the interpretations instead of silently choosing one.
- In a background or loop session where nobody can answer, do not stall: note the open question and follow your brief.
- If a simpler approach exists, say so. Push back when warranted.

## 3. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No flexibility or configurability that was not requested.
- No error handling for impossible scenarios.
- If 200 lines could be 50, rewrite it.
- Before writing new code, look for an existing helper, util, or pattern in the existing codebase and reuse it.
- Prefer the standard library and native platform features over new dependencies.
- Fix root causes, not symptoms: check the callers and fix once where all paths route through.

Ask: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 4. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

- Do not improve adjacent code, comments, formatting, or naming unless required.
- Do not refactor things that are not broken.
- Match existing style, even if you would choose a different style in new code.
- If you notice unrelated dead code, mention it instead of deleting it.
- Remove imports, variables, functions, files, or tests that your changes made unused. Do not remove pre-existing dead code unless asked.

Every changed line should trace directly to the request.

## 5. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" -> "Write tests for invalid inputs, then make them pass."
- "Fix the bug" -> "Write a test that reproduces it, then make it pass."
- "Refactor X" -> "Ensure tests pass before and after."

For multi-step tasks, state a brief plan:

```text
1. [Step] -> verify: [check]
2. [Step] -> verify: [check]
```

If the artifact is not code, define verify anyway: load it, render it, dry-run it, or re-read it against the requirement. Never conclude on an unchecked write.

## 6. Asking Questions

When you ask the user anything:

- Frame each question with the concrete tradeoff it resolves, not just the options.
- Include a recommended option, marked `(recommended)`, and say why - cite the code, the constraint, or the downstream consequence.
- Give each option enough detail to decide without a follow-up: what it costs, what it enables, what it forecloses.
- One focused decision per question; no filler options. The recommendation is advisory - if the user picks otherwise, follow their choice exactly.
