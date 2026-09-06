/**
 * Pi ghui Extension
 *
 * Opens the ghui (GitHub TUI) from Pi.
 *
 * Usage:
 *   Alt+G opens ghui in the current working directory.
 *
 * Commands:
 *   /ghui opens ghui.
 */

import { spawnSync } from "node:child_process";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Key, matchesKey } from "@earendil-works/pi-tui";

type PiContext = Pick<ExtensionContext, "hasUI" | "cwd" | "ui">;

function notify(ctx: PiContext, message: string, level: "info" | "warning" | "error" = "info") {
	ctx.ui.notify(message, level);
}

function isAltG(data: string): boolean {
	return matchesKey(data, Key.alt("g"));
}

async function openGhui(ctx: PiContext): Promise<void> {
	if (!ctx.hasUI) {
		return;
	}

	const cwd = ctx.cwd ?? process.cwd();

	await ctx.ui.custom<number | null>((tui: any, _theme: any, _kb: any, done: (value: number | null) => void) => {
		tui.stop();
		process.stdout.write("\x1b[2J\x1b[H");

		const result = spawnSync("ghui", [], {
			stdio: "inherit",
			cwd,
			env: process.env,
		});

		tui.start();
		tui.requestRender(true);
		done(result.status);

		return {
			render: () => [],
			invalidate: () => {},
		};
	});
}

export default function (pi: ExtensionAPI) {
	let rawShortcutRunning = false;

	pi.on("session_start", async (_event, ctx) => {
		if (!ctx.hasUI) return;

		ctx.ui.onTerminalInput((data) => {
			if (!isAltG(data)) {
				return undefined;
			}

			if (!rawShortcutRunning) {
				rawShortcutRunning = true;
				openGhui(ctx)
					.catch((error) => notify(ctx, error instanceof Error ? error.message : String(error), "error"))
					.finally(() => {
						rawShortcutRunning = false;
					});
			}

			return { consume: true };
		});
	});

	pi.registerShortcut(Key.alt("g"), {
		description: "Open ghui (GitHub TUI)",
		handler: async (ctx) => {
			await openGhui(ctx);
		},
	});

	pi.registerCommand("ghui", {
		description: "Open ghui (GitHub TUI)",
		handler: async (_args, ctx) => {
			await openGhui(ctx);
		},
	});
}
