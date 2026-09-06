# Workflow — from idea to shipped, with subagents and Linear

How work flows through this setup. One page. The reader is you (the PM) and any orchestrator session that needs the route.

## The one rule: protect the window

You talk to one session — the **orchestrator**. Everything you decide lives in its window.
A model reasons sharply only while its window stays inside the **smart zone** (roughly the first ~150k tokens on strong models). Past it, answers degrade.

So the whole system follows one rule: **the orchestrator carries decisions and paths; agents carry payloads.**
Anything that would **flood** the window — many files, whole diffs, long logs, big reports — runs inside an agent, which burns those bytes in its own window and hands back one line plus a file path.

```
you ──► orchestrator (decisions, paths)
              │ launches
              ▼
        agents (payloads: code, logs, diffs, tickets)
              │ report back
              ▼
        RESULT: + artifact path + plain summary
```

## The main flow

```
idea
 │  grill in main chat            (grilling / grill-with-docs skills)
 ▼
spec                              (to-spec skill → Linear project doc, via linear agent)
 │
 ▼
tickets                           (to-tickets skill → Linear issues with blocking edges)
 │
 ▼  per ticket, blockers first:
scout ──► worker ──► cleaner ──► hardener ──► reviewer ──► linear
(recon)   (build)    (CRAP ≤ 6   (mutants     (advisory    (status update,
           forge      gate)       killed +     verdict)     comment)
           if stakes              green suite
           are high)              = receipt)
```

- **Grilling happens in the main chat by default** — decisions belong in your window.
- A ticket is **done** on hardener's `HARDENED` verdict, not on the implementer's own word. Hardener's step-5 full-suite run against unmutated code is the landing receipt.
- `cleaner` and `hardener` are write-capable and both read the uncommitted tree. Run them **one at a time**, never in parallel on the same slice.
- All Linear reads and writes go through the `linear` agent; the orchestrator holds ticket-brief paths, never issue payloads.

## When each agent fires

| Agent | Launch when | Skip when |
|---|---|---|
| `scout` | A codebase question needs digging (where/how/what exists) | The parent already holds the file path — read it in place |
| `architect` | Shaping would flood the main chat (heavy recon, a whole PRD), or the chat is mid-thread | The idea fits a normal grill in the main chat |
| `worker` | One scoped code slice or fix, brief in hand | UI work (→ design/design-builder); edits small enough to make directly |
| `forge` | The same slice, when a wrong answer is expensive | Routine slices — forge costs 3 agent runs + ~72 scoring calls and needs a clean git tree |
| `cleaner` | A slice's tests pass and the diff needs its complexity gate | No runnable suite, or the suite is red (fix that first) |
| `hardener` | After cleaner — drives coverage to 100%, kills mutants, issues the landing receipt | Same as cleaner |
| `design` | UI work you want to watch and steer | — |
| `design-builder` | UI piece that can build headless / in parallel | You need to steer it live (→ design) |
| `reviewer` | A plan needs a soundness check, or finished work needs review | — |
| `researcher` | External/web questions needing sourced synthesis | Codebase questions (→ scout) |
| `linear` | Any Linear read, write, or audit | A single named-issue fact needed this turn (parent calls the tool) |

## Special flows

- **Huge foggy effort** → `wayfinder` skill in the main chat: chart a map of decision tickets on Linear, resolve one per session, hand off to `to-spec` when the fog clears.
- **Runnable design question** (state model, "what should it look like") → `prototype` skill; UI prototypes can run through the design agent.
- **Bug that resists a first look** → `diagnosing-bugs` skill: build the tight red loop first, then fix.
- **Incoming raw issues** → `triage` skill; publishes agent-ready briefs to Linear.

## Context habits (the "manage context like a pro" part)

1. **Paths, not payloads.** Keep the artifact path plus a 3–5 line summary; re-read a file only for the part you need.
2. **One decision, one home.** Decisions live in Linear (tickets, project docs) or ADRs — not in chat history. When a chat holds a decision worth keeping, file it before moving on.
3. **Phase boundaries.** Between grilling / building / reviewing, choose deliberately: continue, `/clear` (nothing carries over), or `/compact` (compress and continue).
5. **Extensions cost context too.** A child loads only the `extensions:` its agent file names. Anything listed that the agent's `tools:` cannot reach is pure load — see `~/.pi/artifacts/scout/pi-extensions-context-cost-20260827-121111.md` for the per-extension cost map.
4. **A flooded report is a bug.** Every background agent must return `RESULT:` + artifact path + a few lines. An agent that dumps its findings into the chat gets its definition fixed, not forgiven.

## How replies reach you

The orchestrator answers in plain English — verdict first, everyday words, numbers over adjectives. Full technical detail is filed to artifact files and named by path; nothing is lost, it is filed. This contract lives at the end of `~/.pi/agent/APPEND_SYSTEM.md` (`<voice>`), and the test harness for it lives at `~/.pi/agent/tests/voice/` (`./run.sh 2` re-grades the voice on opus-5 after any wording change).
