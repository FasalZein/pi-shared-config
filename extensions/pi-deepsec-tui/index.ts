/**
 * Pi deepsec-tui extension
 *
 * Opens deepsec-tui in the current working directory. The wizard reads Pi
 * models from ~/.pi/agent and runs deepsec with --agent pi.
 *
 * Usage:
 *   /deepsec
 *   /deepsec --list
 *
 * Press q inside deepsec-tui to return to Pi.
 */

import { spawnSync } from "node:child_process";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

type PiContext = Pick<ExtensionContext, "hasUI" | "cwd" | "ui">;

function notify(ctx: PiContext, message: string, level: "info" | "warning" | "error" = "info") {
	ctx.ui.notify(message, level);
}

function splitArgs(args: string): string[] {
	const trimmed = args.trim();
	if (!trimmed) {
		return [];
	}
	return trimmed.split(/\s+/);
}

function missingBinaryMessage(bin: string, install: string): string {
	return `${bin} not found on PATH. Install with: ${install}`;
}

async function openDeepsecTui(ctx: PiContext, args: string): Promise<void> {
	if (!ctx.hasUI) {
		return;
	}

	const which = spawnSync("which", ["deepsec-tui"], { encoding: "utf8" });
	if (which.status !== 0) {
		notify(
			ctx,
			missingBinaryMessage(
				"deepsec-tui",
				"cargo install --git https://github.com/edxeth/deepsec-tui --locked --branch master",
			),
			"error",
		);
		return;
	}

	const extra = splitArgs(args);
	const cwd = ctx.cwd ?? process.cwd();

	await ctx.ui.custom<number | null>((tui, _theme, _kb, done) => {
		tui.stop();
		process.stdout.write("\x1b[2J\x1b[H");

		const result = spawnSync("deepsec-tui", extra, {
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
	pi.registerCommand("deepsec", {
		description: "Open deepsec-tui (Pi model picker for deepsec)",
		handler: async (args, ctx) => {
			await openDeepsecTui(ctx, args);
		},
	});
}
