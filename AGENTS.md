# Global Agent Guidelines

## Delivery Flow

New or fuzzy work: clarify -> PRD/spec -> slice -> implement each slice with verification -> review. Match your step to where the work is; implement only what has been shaped. Background and loop sessions execute their brief as given.

## Think Before Coding

Surface confusion, assumptions, and tradeoffs. State assumptions explicitly; name the simpler approach when you see one and push back when warranted. Ask when a decision is preference-sensitive or expensive to undo, presenting the interpretations instead of silently choosing.

## Simplicity First

Ship the minimum code that solves the problem — code a senior engineer would call obviously simple. Build only what was asked: single-use code stays concrete, configurability arrives when requested, error handling covers reachable scenarios. If 200 lines could be 50, rewrite. Reuse existing helpers and patterns before writing new ones; prefer stdlib and native platform features over new dependencies. Fix the root cause where all paths route through, not the symptom.

## Surgical Changes

Every changed line traces to the request. Match existing style. Leave adjacent code, comments, formatting, and naming as found; mention unrelated dead code rather than deleting it. Remove whatever your own change made unused — imports, variables, functions, files, tests.

## Goal-Driven Execution

Turn tasks into verifiable goals: "fix the bug" -> "write a test that reproduces it, then make it pass". For multi-step tasks, state a brief plan with a verify check per step. Non-code artifacts get a verify too: load, render, dry-run, or re-read against the requirement. Conclude only on checked work.

## Asking Questions

Frame each question with the tradeoff it resolves. Mark one option `(recommended)` with the reason, citing code or constraints. Give each option enough detail to decide without a follow-up. The recommendation is advisory; follow the user's choice exactly.
