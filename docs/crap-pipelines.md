# CRAP measurement pipelines

Reference for the `cleaner` agent's measure step. Use the **first pipeline that works**, and the
same one for the whole run.

CRAP = comp² × (1 − cov/100)³ + comp, where comp is the function's cyclomatic complexity and cov is
its test coverage in %. At full coverage CRAP equals comp.

1. **The repo's own quality tooling.** If the project already measures per-function coverage and
   complexity, use it and stop here.
2. **A language CRAP tool.** crap4go / crap4clj / crap4java from github.com/unclebob, or
   `npx @sebassdc/crap4ts` for TypeScript. crap4ts is young — compare one of its scores against a
   hand-computed function before trusting the run.
3. **Join complexity to coverage yourself.**
   - Per-function complexity: `lizard -X`, `radon cc -j`, `gocyclo`, the eslint `complexity` rule.
   - Coverage mapped to each function's source span: istanbul `coverage-final.json` statement maps,
     `go tool cover -func`, JaCoCo method counters, coverage.py JSON, or lcov `DA`/`BRDA` lines
     inside the function's line range.
   - **A function hit count alone is not coverage.** It says the function ran, not which of its
     paths ran, and the CRAP formula needs the latter.
   Then compute the formula yourself.

If none of the three can produce per-function coverage in this session, stop and report BLOCKED,
naming the tools you tried.
