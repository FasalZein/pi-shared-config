# Global Agent Guidelines

Global defaults for software work. Project-specific instructions take precedence.

Treat the supplied date as current, including dates later than your training data.

## Language

Simplified Technical English (ASD-STE100): active voice, one idea per sentence, one word per meaning, no filler. Imperative for instructions (max 20 words); simple tenses for explanations (max 25 words). Never rewrite code, identifiers, commands, paths, or quoted error text. For documents that must comply, load the `simple-english` skill.

Report context size in tokens; byte counts only in technical artifacts that need exact transport accounting.

## Delivery flow

New or fuzzy work: clarify -> spec -> slice -> implement each slice with verification -> review. Match your step to where the work is; implement only what has been shaped. Background and loop sessions execute their brief as given.

- Each project's `docs/agents/issue-tracker.md` (written by `/setup-matt-pocock-skills`) names its specification location and ticket tracker. Canonical specifications are repository files (default `docs/specs/<name>.md`); `to-spec` writes or updates them and never publishes a spec issue. Delivery tickets are GitHub issues via `gh`; `to-tickets` publishes one per ticket in dependency order, linked to the spec path. Linear and wiki archives are read-only. External writes need explicit authorization.
- Decisions live in the spec, the issues, or ADRs, not in chat history. File a decision before moving on.
- At a phase boundary (shaping, building, reviewing) choose deliberately: continue, `/clear`, or `/compact`.
- Agents that edit the working tree (for example `cleaner` and `hardener`) run one at a time on the same slice.
- `cleaner` and `hardener` are gate stages only (CRAP gate; coverage and mutation landing receipt). Send implementation to `worker` and reviews to `reviewer`; never brief a gate agent to replace its default stage.
- A decided, mechanical ticket frontier (no owner decisions left) goes to a Ralph lane: fill ~/.pi/agent/templates/ralph-lane-template.md, run `ralph-lane <bundle> <repo>`, start the printed pi commands in a visible pane. After COMPLETE: `reviewer` on the batch diff, fixes by `worker` in the same lane, then `wt land`. After STOP: read the blocker report and decide.

## Scope and design

- Prefer the smallest clear, correct change that fully solves the task. Preserve readability and correctness over line count or diff size.
- Before adding code or a dependency, check whether existing code, the standard library, native platform features, or dependencies already declared for the relevant project or package solve the problem.
- If a simpler approach exists, say so before implementation. State assumptions explicitly; push back when warranted.
- Avoid speculative features, single-use abstractions, and unrequested flexibility or configurability.
- Add error handling only for states permitted by an enforced contract or observed boundary.
- Match the existing style. Name literals whose meaning or units are not obvious at the point of use.
- Comment on non-obvious intent, constraints, and trade-offs rather than restating code. For an explicitly accepted shortcut, document its limitation and the condition for revisiting it in the repository's existing convention.
- Preserve unrelated code, comments, formatting, and pre-existing dead code; report relevant problems instead of fixing them. Remove imports, variables, functions, files, and tests made unused by your change.
- Every changed line must support the request or its required verification.

## Evidence-driven changes

Apply this section to tasks that modify software behavior or its verification.

- The user defines the desired outcome, constraints, and product intent. Treat technical diagnoses and proposed implementations as hypotheses.
- Before planning the change, read the relevant source and existing tests. Read every direct use and every use that depends on the changed contract.
- If evidence contradicts the requested mechanism, follow the evidence and explain the conflict. Put the fix at the boundary supported by evidence.
- Define observable acceptance criteria before implementation. For work with multiple material steps, give a brief plan that states how each step will be checked against them.

## Test design

Apply this section when adding or changing software behavior or tests.

- Inspect existing tests before adding cases. Extend them where practical; each new case must protect a distinct requirement, boundary, or failure mode. When existing tests cover the change, run them rather than adding redundant cases.
- Derive expected results from requirements, documented contracts, worked examples, or independent references, not by copying outputs or logic from the implementation under test.
- Choose the smallest test boundary that can catch the failure. Exercise real component interactions for integration risks; use focused unit tests for isolated logic.
- Assert observable behavior through stable interfaces. Pin styling, colors, internal structure, or interactions only when they are explicit contracts.
- Prefer real collaborators or faithful fakes; mock external or nondeterministic boundaries when needed. Keep the behavior under test real.
- Verify applicable boundary, error, retry, partial-state, and recovery paths in proportion to risk.
- For a reported bug with a feasible local reproduction, add or reuse a regression test. Verify that it fails for the intended reason against the old behavior and passes after the fix; retain it in the suite. Otherwise, use the strongest available check and report the blocker and residual uncertainty.
- If affected tests are empty, over-mocked, or disconnected from the requirement, strengthen them or add a behavior test.
- Use coverage and mutation reports to find gaps, not as proof of correctness. Meet explicit project or task targets with behavior-asserting tests; stop adding cases once the required behaviors, affected risks, and targets are covered.

## Completion and verification

Apply this section to tasks that modify software behavior or its verification. Read-only agents follow their role-specific completion contract.

- Editing is not completion. Finish only when the changed behavior satisfies the acceptance criteria and the strongest practical repository verification passes.
- Affected tests: the changed files and their dependents (`vitest related <files>`, `vitest run --changed <base>`, `turbo run test --affected`, `cargo test -p <crate>`, `pytest <files>`). Repeat unchanged runs only for a specific diagnostic or required verification.
- Full suite at landing: where the repository has PR CI, the CI run on the ready PR is the full suite; read it with `gh pr checks --watch`. Otherwise the landing-receipt stage runs the repository's verify command (or, without one, the strongest scripts in its package and CI configuration) once, through `heavy`.
- Reuse a green run: when the commit under test is unchanged since a full suite or verify run passed, cite that run and its command instead of running it again.
- Never skip, delete, or weaken a test to obtain a pass. Do not add `.skip` or `.only`; correct a wrong test and explain why.
- If verification remains red after three materially different repair attempts, stop and report the failing evidence and incomplete work.
- Report verification commands and outcomes, plus behavior you did not verify. If executable verification is unavailable, report what you verified, why it is blocked, and the residual risk. Ask only when user input can unblock verification.
- Use non-interactive commands and disable watch mode. Stop commands that wait for input or stop making progress.
- Do not use a stub as a substitute for implementation.
- Self-run verification is not independent review; say so when independent review was requested or the distinction affects confidence.

## Tooling

- Type checks and lints: no LSP tool is installed. Run the checker the project declares through `bash` (its typecheck or lint script, `tsc --noEmit`, `basedpyright`, `cargo check`). Installing a checker the project does not declare is a dependency change.
- Subagent launches: launch `subagent` and `subagent_resume` inside codemode. A launch there returns at once, also next to other calls in the same script (tested 2026-10-23). Keep that codemode call alone in its message.
- GitHub: `gh` CLI is installed and authenticated. Issues, comments, labels, and PRs go through `gh` in `bash`.
- Bash calls already run in the devenv env of the worktree's `.envrc` (env-wrap extension). Run commands directly, without `direnv exec` or `devenv shell`. env-wrap allows a linked worktree whose `.envrc` matches the allowed main checkout. When it still reports an `.envrc` as not allowed, report that: the owner approves a repo's `.envrc`. When it reports that an `.envrc` did not load, read the error; fix `devenv.nix` only inside your assigned slice, otherwise report it.
- Use `ast-grep` for syntax-aware search and rewrites. Parse JSON with `jq`, not Python or Node one-liners.
- `laws-of-ux`, `design-qa`, and `design-craft` are explicit-only: a matching file does not inject them. Load one with `/skill:name` when you need it. In a control-plane session, UI work belongs with `design` or `design-builder`; read only their reports. An open look or flow goes to `design` first, briefed to grill the direction with the owner (grill-design); builders then read the approved DESIGN.md.

## Artifacts and worktrees

- An artifact is a report, a log, or a small proof file. When a proof needs a frozen tree, record the commit SHA and the command that reproduces it.
- Build, install, and test inside the worktree. Keep repositories, `node_modules`, Cargo `target` directories, database data directories, and model weights out of `~/.pi/artifacts`. Delete a clone you made once its report exists.
- Worktrees: one per issue, created with `wt new <issue>-<slug> <repo>` from the main checkout's integration branch; never branch from another unmerged slice. The agent that merges a slice runs `wt land <branch> <repo>` (merge, cleanup, branch deletion); other agents report their worktree path and branch. `wt --help` has the rest.
