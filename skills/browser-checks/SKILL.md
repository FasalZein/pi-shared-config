---
name: browser-checks
description: Rules for agent-browser checks - session lifecycle, snapshot cost, committed flow files, headed vs background, cleanup, and fixes for common failures. Use before any e2e, QA, screenshot, or browser step.
---

# Browser checks

## Engine
- `agent-browser-chrome` for e2e, QA, and screenshots. Plain `agent-browser` (Lightpanda) only reads pages: its screenshots drop CSS colors and are not evidence.
- Keep one engine for a whole session; a mismatch relaunches the browser.

## Session lifecycle
- Name your session: `agent-browser-chrome --session <task>-<id> ...`. The default session is shared with every agent.
- A session is a background daemon. It survives the end of a bash call, a codemode script, and your own run. It ends on `close`, or after 1 hour idle (headed sessions never idle out).
- A cancelled or timed-out call kills only the CLI client; the daemon still finishes that command, and the next command waits for it or fails with "os error 35". Set the bash timeout above the whole command chain.
- For a fresh browser, use a new session name. A command on the same name right after `close` fails with "Invalid response: EOF" or "Could not configure browser".
- Close your own session as the last step: `agent-browser-chrome --session <name> close`. `close --all` closes other agents' sessions: leave it to the owner.
- Without `--restore`, closing discards tabs and cookies. Use `--restore` only for logins the task needs.

## Read pages cheaply (about 2.4 characters per token)
- Default: `snapshot -i --delta`. The first call returns the full interactive tree (about 1.3k tokens on a 60-row table page); later calls return only changes (about 10 tokens when nothing changed, about 140 after one click).
- `snapshot -i --delta --full` resets the baseline; take one after navigation.
- A full snapshot (no `-i`) is about 8x larger. `-u` adds every href: skip it on link-heavy pages.
- Each screenshot you read adds about 1.4k tokens and stays in context. Take one only to check looks; use `snapshot` or `get text` for content.
- Refs (`@eN`) belong to the last snapshot. Re-snapshot after navigation or a DOM change.

## Flow files
- Committed flows live in `e2e/<flow>.json`: a JSON array of string arrays, one command each. Use selectors, roles, labels, and text; refs change between runs.
  `[["open","http://localhost:4321/login"],["wait","--text","Sign in"],["find","label","Email","fill","user@example.com"],["find","role","button","click","--name","Sign in"],["wait","--url","**/today"]]`
- Run: `agent-browser-chrome --session <name> batch --bail < e2e/<flow>.json`. It exits 1 at the first failed step (a failed wait or a missing element).
- Put a wait (`--text`, `--url`, `--fn`, or a selector) after every step that changes the page; fixed delays and networkidle make flows flaky.

## Headed vs background
- Default: headless. It opens no window and uses its own temporary profile.
- `--headed` only when the owner must watch or act (login, 2FA, CAPTCHA). It opens a window on the owner's desktop, takes focus, and never idles out: close it when done. Lightpanda cannot run headed.
- `--auto-connect` prompts the owner's running Chrome: leave it to the owner.

## Fixes
- Timeout: `wait --text|--url|--fn|<selector>`; split long chains.
- Element not found: `snapshot -i`, then a ref, or `find role button click --name "X"`; `wait --text` first.
- Covered by another element: close the dialog or banner; `scrollintoview @ref` under sticky headers; re-snapshot.
- Unknown ref: re-snapshot.
- eval errors: `eval --stdin` with a quoted heredoc; wrap the code in `(() => { ... })()`; guard nulls with `?.`.
- find syntax: `find role|text|label <value> <click|fill|check|hover|text> [--name X]`; `fill`, not `type`.
- Screenshot path: `mkdir -p` the directory first.
- Navigation refused: `curl -fsS <url>` first; start the dev server in the background before `open`.
- In codemode there is no setTimeout or process: use `agent-browser wait`.
