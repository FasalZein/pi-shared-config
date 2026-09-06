/**
 * Pi Lazygit Extension
 *
 * Opens lazygit in the current working directory with a keybind.
 * When you exit lazygit (press `q`), you're back in Pi immediately.
 *
 * Usage:
 *   Press Alt+L to launch lazygit in the current directory.
 *   Press q inside lazygit to return to Pi.
 *
 * Also available as: /lazygit command
 */

import { spawnSync } from "node:child_process";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Key } from "@earendil-works/pi-tui";

async function openLazygit(ctx: { hasUI: boolean; cwd?: string; ui: any }): Promise<void> {
	if (!ctx.hasUI) {
		return;
	}

	const cwd = ctx.cwd ?? process.cwd();

	await ctx.ui.custom<number | null>((tui, _theme, _kb, done) => {
		// Suspend Pi's TUI to release the terminal
		tui.stop();

		// Clear screen for a clean lazygit launch
		process.stdout.write("\x1b[2J\x1b[H");

		// Spawn lazygit with full terminal access via a shell
		const shell = process.env.SHELL || "/bin/sh";
		const result = spawnSync(shell, ["-c", "lazygit"], {
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
	// Register keyboard shortcut: Alt+L
	pi.registerShortcut(Key.alt("l"), {
		description: "Open lazygit in current directory",
		handler: async (ctx) => {
			await openLazygit(ctx);
		},
	});

	// Register /lazygit command as an alternative
	pi.registerCommand("lazygit", {
		description: "Open lazygit in current directory",
		handler: async (_args, ctx) => {
			await openLazygit(ctx);
		},
	});
}
