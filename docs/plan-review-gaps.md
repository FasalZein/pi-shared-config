# Plan review — the gap classes

Reference for the reviewer agent's plan/PRD branch. Read it before reviewing a plan,
a PRD, a Ralph plan, or a step that has not been built yet.

This is the gate between phases: fast, judgment-first, no diff required, no artifact
format required. A short written verdict is enough. A gap found here is worth more than
the same gap found after the loop has built on top of it.

Hunt for each class explicitly:

- **Missing slices/steps** — work the goal needs that the plan never lists.
- **Ordering/dependency gaps** — a step that depends on a later one, or a slice that cannot run standalone.
- **Unstated assumptions** — things the plan treats as given that are not established.
- **Missing acceptance criteria** — slices with no verifiable "done".
- **Untested seams** — integration points or behaviours with no test or verification planned.
- **Scope drift** — steps beyond the stated goal, or requested goals with no covering step.
- **Biggest risk** — the one thing most likely to derail the build, named plainly.

## The completed-work lenses

For reference when a task names one. Run exactly the lens(es) named, in the order given.

1. **code-review** — two axes: **Standards** (does the diff follow this repo's documented
   coding standards plus the Fowler smell baseline the skill carries?) and **Spec** (does it
   faithfully implement the originating issue or PRD?). The reviewer is a non-spawning leaf,
   so the skill's inline fallback applies: run both axes yourself as two labelled sub-sections.
2. **thermo-nuclear-code-quality-review** — strict maintainability, correctness, abstraction
   quality, giant files, spaghetti conditions.
3. **ponytail-review** — over-engineering and simplification: what to delete, reinvented
   stdlib, speculative abstractions, dead flexibility.

When several are named, order them code-review → thermo-nuclear → ponytail.
