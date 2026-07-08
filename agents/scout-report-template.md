# Scout reconnaissance report template

The exact format for a scout reconnaissance report artifact. Write the file with the `write` tool to:

`${PI_ARTIFACT_PROJECT_ROOT:-$HOME/.pi/artifacts}/scout/<topic>-<YYYYMMDD-HHMMSS>.md`

```markdown
# Context for: [task summary]

## Relevant Files
- /absolute/path/to/file1.ts — [why this file is relevant]
- /absolute/path/to/file2.ts — [why this file is relevant]

## Project Structure
[Brief overview]

## Existing Patterns
[Conventions and patterns]

## Dependencies
[Relevant dependencies]

## Key Findings
[Important discoveries]

## Gotchas
[Things to watch out for]

## Answer
[Direct answer to the actual need]

## Next Steps
[What to do next]
```
