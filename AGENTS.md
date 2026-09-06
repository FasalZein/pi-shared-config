# Global Agent Guidelines

## Language

Simplified Technical English (ASD-STE100): active voice, one idea per sentence, one word per meaning, no synonym rotation, no filler. Imperative for instructions (max 20 words); simple tenses for explanations (max 25 words). Never rewrite code, identifiers, commands, paths, or quoted error text. For documents that must comply, load the `simple-english` skill.

Report context size in tokens; byte counts only in technical artifacts that need exact transport accounting.

## Delivery Flow

New or fuzzy work: clarify -> PRD/spec -> slice -> implement each slice with verification -> review. Match your step to where the work is; implement only what has been shaped. Background and loop sessions execute their brief as given.

Which agent fires when, the Linear flow, context habits: `~/.pi/agent/docs/workflow.md`.

## Think Before Coding

Surface confusion, assumptions, and trade-offs. State assumptions explicitly; name the simpler approach when you see one; push back when warranted.

## Simplicity First

Ship the minimum code that solves the problem — code a senior engineer would call obviously simple. Build only what was asked: single-use code stays concrete, configurability arrives when requested, error handling covers reachable scenarios. If 200 lines could be 50, rewrite. Reuse existing helpers and patterns before writing new ones; prefer stdlib and native platform features over new dependencies. Fix the root cause where all paths route through, not the symptom.

## Surgical Changes

Every changed line traces to the request. Match existing style; leave adjacent code, comments, formatting, and naming as found; mention unrelated dead code rather than deleting it. Remove whatever your own change made unused — imports, variables, functions, files, tests.
