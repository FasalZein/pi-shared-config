---
name: cmux
description: Manage terminal sessions via cmux for dev servers, tests, harnesses, and side-task monitoring. Use when work should run in a separate cmux surface or workspace.
---

# cmux Workflow

Use cmux when a task should run beside the current Pi session instead of inside it.

## Prerequisite

You must be running inside cmux. Check for `CMUX_SOCKET_PATH` in the environment before relying on cmux commands.

## Default Strategy

Prefer creating a new **surface** in the current workspace so related work stays grouped together. Only create a new workspace when you need full isolation.

## Environment Variables

cmux shells usually expose:

- `CMUX_WORKSPACE_ID`
- `CMUX_SURFACE_ID`
- `CMUX_SOCKET_PATH`

## Core Commands

### Create a new terminal surface

```bash
cmux new-surface --type terminal
```

### Send a command

```bash
cmux send --surface <ref> 'cd /path/to/project && pnpm dev\n'
```

Always include `\n` when you want Enter pressed.

### Read output

```bash
cmux read-screen --surface <ref> --lines 40
cmux read-screen --surface <ref> --scrollback --lines 200
```

### Interrupt or close

```bash
cmux send-key --surface <ref> ctrl+c
cmux close-surface --surface <ref>
```

### Notify

```bash
cmux notify --title "Task finished" --body "Ready for review"
```

## Recommended Patterns

### Start a dev server in a new tab

```bash
SURFACE=$(cmux new-surface --type terminal | awk '{print $2}')
sleep 0.5
cmux send --surface "$SURFACE" 'cd /path/to/project && pnpm dev\n'

for i in $(seq 1 30); do
  OUTPUT=$(cmux read-screen --surface "$SURFACE" --lines 30)
  if echo "$OUTPUT" | grep -qi 'ready\|listening\|started\|compiled'; then
    echo "Server is ready"
    break
  fi
  sleep 1
done
```

### Run a test job in another surface

```bash
SURFACE=$(cmux new-surface --type terminal | awk '{print $2}')
sleep 0.5
cmux send --surface "$SURFACE" 'cd /path/to/project && pnpm test\n'
sleep 10
cmux read-screen --surface "$SURFACE" --scrollback --lines 200
cmux close-surface --surface "$SURFACE"
```

### Run multiple harnesses side by side

```bash
S_API=$(cmux new-surface --type terminal | awk '{print $2}')
S_WEB=$(cmux new-surface --type terminal | awk '{print $2}')

sleep 0.5
cmux send --surface "$S_API" 'cd ./apps/api && pnpm dev\n'
cmux send --surface "$S_WEB" 'cd ./apps/web && pnpm dev\n'

sleep 3
cmux read-screen --surface "$S_API" --lines 30
cmux read-screen --surface "$S_WEB" --lines 30
```

## Rules

- Prefer surfaces over workspaces unless isolation is required
- Capture returned surface refs; never assume a surface number
- Poll output instead of guessing readiness
- Use `--lines` to keep output bounded
- Clean up temporary surfaces when done
- Use cmux for long-running processes, watchers, test jobs, and separate harnesses
