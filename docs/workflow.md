# Workflow

This page describes the agent route from an idea to shipped work.

## Protect the main session

The main session keeps decisions and artifact paths. Agents handle large file sets, diffs, logs, reports, and implementation work.

```text
you -> main session -> agents -> result and artifact path
```

## Main flow

```text
idea
  -> grill in the main chat
  -> repository specification
  -> GitHub issues with blocking relations
  -> scout
  -> worker
  -> cleaner
  -> hardener
  -> reviewer
```

- Grill small ideas in the main chat.
- Use `architect` when shaping needs a separate session.
- A change is complete after `hardener` reports `HARDENED` on unmodified code.
- Run `cleaner` and `hardener` one at a time. Both can change the same worktree.

## Agent roster

| Agent | Use it for |
|---|---|
| `architect` | Shape a large or unclear idea into a repository specification and GitHub issues. |
| `github` | Read and change GitHub issues, prepare specification drafts for the parent or `architect` to place, and publish authorized delivery tickets. |
| `scout` | Find code and explain current behavior. |
| `worker` | Build one defined code change. |
| `cleaner` | Add coverage and reduce complexity after tests pass. |
| `hardener` | Complete coverage and mutation checks, then run the full test suite. |
| `design` | Build or direct user interface work in a visible session. |
| `design-builder` | Build an independent user interface part without live steering. |
| `reviewer` | Review a plan or completed work. |
| `researcher` | Research external sources and write a sourced report. |

## Context rules

1. Keep paths and short summaries in the main session.
2. Store active specifications in the repository.
3. Store active delivery work in GitHub Issues.
4. Treat Linear and the historical wiki as read-only archives.
5. Return `RESULT:`, a short summary, and an artifact path from background agents.
