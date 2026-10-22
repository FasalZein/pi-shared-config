# Ralph lane: <short title>

<!--
How to use this template (parent session):
1. Copy this file to $HOME/.pi/artifacts/<agent>/<lane>/bundle.md and fill every <...> field.
2. Run: ralph-lane <bundle.md> [repo]
   The launcher checks this file, creates the lane with `wt new <branch>`,
   writes the .ralph/ bundle (prompt.md, items.json, plan.md, progress.md)
   in the lane, keeps .ralph/ out of commits, and prints the pi commands.
3. Start pi in a visible pane with the printed commands, or give them to the owner.

Format rules the launcher enforces:
- "## Lane": `- branch: <issue>-<slug>`. The branch starts with an issue
  number (the epic or the first ticket), so `wt new` can refuse a duplicate.
  Optional `- retries: <n>`. Default: one retry per item.
  max-iterations = item count + retries.
- "## Gates": `- <name>: heavy -- <command>`. Every gate runs through heavy.
- "## Items": `- [ ] <item> | check: <acceptance check>`. One GitHub issue or
  one decided item per line. Every item has a check. No item is pre-checked.
- Use only decided, mechanical items. An item that needs an owner decision
  does not go into a lane.
-->

## Lane
- branch: <issue>-<slug>
- retries: <n, or delete this line for the default of one per item>

## Goal
<One paragraph: the outcome of the whole lane, and the spec or epic it serves
(path or issue URL).>

## Gates
- typecheck: heavy -- <typecheck command>
- tests: heavy -- <affected-test command>

## Items
- [ ] #<issue> <title> | check: <observable acceptance check, for example `heavy -- bun test path/to/file.test.ts` passes>
- [ ] #<issue> <title> | check: <acceptance check>

## Constraints
- Files and areas this lane must not change: <paths, or "none">.
- Owner approvals already given: <date, text, or "none">.

## Per-iteration instructions
You run unattended. Nobody answers questions during this run.

1. Startup checks. `pwd` must equal the lane path and `git branch --show-current`
   must equal the lane branch (see "Lane facts" at the end). If not, write the
   STOP blocker report and stop.
2. Read `.ralph/items.json` and the end of `.ralph/progress.md`. Pick the first
   item with `"passes": false`. Work on that item only.
3. Implement the item. Keep the change small and in the style of the code.
   Follow the repository AGENTS.md.
4. Run the item's acceptance check and every gate in "Gates". Run each
   typecheck, lint, test and build through `heavy -- <command>`. Do not run
   the full suite; the landing step runs it.
5. If a check fails, repair it. After three materially different repair
   attempts, write the STOP blocker report and stop.
6. Commit the item on the lane branch with a message that names the item
   (for example `#123: <title>`). Do not push, merge, rebase or switch branches.
   Never commit `.ralph/`.
7. Check the item off: set its `"passes"` to `true` in `.ralph/items.json`.
   Change no other item field.
8. Append one block to `.ralph/progress.md`: the item, the commit SHA, the
   checks you ran and their outcome.
9. End the reply with the promise tag (see "Promise rules").

Never:
- Ask the user, or call a tool that waits for a person. Write the STOP
  blocker report instead.
- Add, remove, split or reword items. Record a new finding in progress.md as a
  note for the parent.
- Work on two items in one iteration.
- Weaken, skip or delete a test to get a pass.
- Start background processes and wait for them across turns.

## Promise rules
The last non-empty line of every reply is exactly one promise tag.
- `<promise>NEXT</promise>`: this iteration finished one item, committed it,
  checked it off and appended progress, and unchecked items remain.
- `<promise>COMPLETE</promise>`: every item has `"passes": true`. Write the
  lane report first.
- `<promise>STOP</promise>`: a blocker stops the lane (a failed check after
  three repair attempts, a needed owner decision, a missing service or
  permission, a startup check failure). Write the STOP blocker report first.
- Do not use `<promise>WAIT</promise>`.

## Report
Write the report to the path in "Lane facts" before COMPLETE or STOP.

After COMPLETE:
- Status: COMPLETE.
- Branch, lane path, first and last commit SHA.
- One line per item: item, commit SHA, acceptance check and outcome.
- Gates run in the last iteration and their outcome.
- Notes for the parent (findings outside the item list).

After STOP (blocker report):
- Status: STOP.
- The blocked item and the exact blocker (command, error text, missing decision).
- What you tried (each repair attempt).
- Items done (with SHA) and items left.
- The decision or action the parent needs to unblock the lane.

## Landing (parent only; the loop ignores this section)
After COMPLETE:
1. Read the lane report.
2. Send the batch diff (`git diff <integration branch>...<lane branch>`) to
   `reviewer`.
3. Apply review fixes through a `worker` in the same lane worktree.
4. Run `wt land <lane branch> <repo>`. It merges, runs `wt.landCheck`, and
   removes the worktree and the branch.

After STOP:
1. Read the blocker report.
2. Decide: fix the blocker (worker in the lane or an owner decision), then
   start a fresh `/ralph-loop` in the lane, or land the finished items, or
   drop the lane. `/ralph-resume` replays the last STOP, so start fresh.
