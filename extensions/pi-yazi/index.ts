/**
 * Pi Yazi Extension
 *
 * Opens Yazi (terminal file manager) in the current working directory.
 * When you exit Yazi (press `q` inside Yazi), you're back in Pi immediately.
 *
 * Usage:
 *   Press Ctrl+Shift+Y to launch Yazi in the current directory.
 *   Press q inside Yazi to return to Pi.
 *
 * Also available as: /yazi command
 */

import { spawnSync } from "node:child_process";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Key } from "@earendil-works/pi-tui";

async function openYazi(ctx: { hasUI: boolean; cwd?: string; ui: any }): Promise<void> {
	if (!ctx.hasUI) {
		return;
	}

	const cwd = ctx.cwd ?? process.cwd();

	await ctx.ui.custom<number | null>((tui, _theme, _kb, done) => {
		// Suspend Pi's TUI to release the terminal
		tui.stop();

		// Clear screen for a clean Yazi launch
		process.stdout.write("\x1b[2J\x1b[H");

		// Spawn Yazi with full terminal access via a shell
		const shell = process.env.SHELL || "/bin/sh";
		const result = spawnSync(shell, ["-c", "yazi"], {
			stdio: "inherit",
			cwd,
			env: process.env,
		});

		// Restart Pi's TUI
		tui.start();
		tui.requestRender(true);

		// Signal completion
		done(result.status);

		return {
			render: () => [],
			invalidate: () => {},
		};
	});
}

export default function (pi: ExtensionAPI) {
	// Avoid Alt+Y, which Pi reserves for tui.editor.yankPop.
	pi.registerShortcut(Key.ctrlShift("y"), {
		description: "Open Yazi file manager in current directory",
		handler: async (ctx) => {
			await openYazi(ctx);
		},
	});

	// Register /yazi command as an alternative
	pi.registerCommand("yazi", {
		description: "Open Yazi file manager in current directory",
		handler: async (_args, ctx) => {
			await openYazi(ctx);
		},
	});
}
