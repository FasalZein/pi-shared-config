# Review report template

Write the review to `$HOME/.pi/artifacts/reviewer/<topic>-<model>-<date>.md`.

- `<topic>` — short task label (e.g. `pied-piper-decentralized-internet-pr-review`, `hooli-nucleus-platform-api-code-review`)
- `<model>` — short token for the model you are running as (`opus`, `glm`, `gpt`, `deepseek`), so parallel reviewers never overwrite each other
- `<date>` — `YYYYMMDD-HHMMSS`

Use this exact format:

```markdown
# Review

## Scope
[what you reviewed — the exact file list or commit range, plus anything in scope you deliberately did not open, with the reason]

## Verdict
APPROVE | NEEDS CHANGES | BLOCKED

## Bottom Line
[2-3 sentences max]

## Findings
- [P0|P1|P2] /absolute/path:line — issue, impact, recommended fix
- [P0|P1|P2] artifact:<name> — issue, impact, recommended fix
- If there are no material issues, write: `- No material issues found.`

## Recommended Path
1. [single primary path]
2. [next concrete step]
3. [only if needed]

## Fix Effort
None | Quick | Short | Medium | Large

## Why
- [optional, max 4 bullets]

## Watch Out For
- [optional, max 3 bullets]

## Uncertainty
- [only if relevant]
```

Severity:

- **P0** — proven security issue, data loss risk, or likely production breakage
- **P1** — likely real bug or operational footgun worth fixing now
- **P2** — meaningful near-term maintainability or correctness concern

When several reviewers run in parallel, make findings machine-comparable so the parent can union them: one finding per line, severity first, then `path:line`, then the issue. Tag confidence in-line — `(confirmed)` if you verified it against the file or a command, `(suspected)` if it depends on runtime behaviour you could not check.
