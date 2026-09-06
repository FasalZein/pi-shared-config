# Mutation testing pipelines

Reference for the `hardener` agent's mutate step. Use the **first mechanism that runs**.

1. **The repo's existing mutation setup**, if one exists.
2. **The ecosystem tool for the language:**
   - JS/TS — StrykerJS with its vitest runner. **No Bun runner exists**; under Bun use Stryker's
     command runner with the repo's test command, or fall back to the manual loop.
   - JVM — PIT
   - Python — mutmut or cosmic-ray
   - Rust — cargo-mutants
   - Go — gremlins, avito-tech/go-mutesting, or unclebob/mutate4go
   - Multi-language fallback — trailofbits/mewt
   Prefer the tool's incremental or differential mode when it has one.
3. **The manual loop.**
   First list every applicable mutation site in the file (operator × location). The census covers
   that whole list. Then, per site:
   1. Save the file's exact bytes.
   2. Apply the one mutation.
   3. Run the narrowest tests that reach it.
   4. Record the outcome.
   5. Restore the saved bytes.

   Operator set: `+ ↔ -`, `* ↔ /`, `< ↔ <=`, `> ↔ >=`, `== ↔ !=`, `&& ↔ ||`, negate condition,
   `true ↔ false`, `0 ↔ 1`.

A timeout counts as a kill only when the same tests pass on the unmutated code.
