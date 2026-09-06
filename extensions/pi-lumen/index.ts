/**
 * Pi Lumen Extension
 *
 * Opens the Lumen terminal diff viewer from Pi.
 *
 * Usage:
 *   Alt+D opens `lumen diff` for the current working tree.
 *   Alt+Shift+D opens a Pi TUI commit picker, then `lumen diff <sha>`.
 *
 * Commands:
 *   /lumen opens the commit picker.
 *   /rename-session-commit renames the Pi session to the HEAD commit title.
 */

import { spawnSync } from "node:child_process";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Key, matchesKey, truncateToWidth } from "@earendil-works/pi-tui";

type PiContext = Pick<ExtensionContext, "hasUI" | "cwd" | "ui">;

interface CommitItem {
	sha: string;
	date: string;
	author: string;
	subject: string;
	line: string;
}

function notify(ctx: PiContext, message: string, level: "info" | "warning" | "error" = "info") {
	ctx.ui.notify(message, level);
}

function isAltD(data: string): boolean {
	return matchesKey(data, Key.alt("d"));
}

function isAltShiftD(data: string): boolean {
	return (
		matchesKey(data, Key.altShift("d")) ||
		matchesKey(data, Key.shiftAlt("d")) ||
		// Legacy terminals: Alt+Shift+D is ESC followed by uppercase D.
		data === "\x1bD" ||
		// CSI-u / Kitty variants seen across terminals and tmux versions.
		// Some terminals encode Alt+Shift+D as uppercase D + Alt (68;3u)
		// instead of lowercase d + Alt+Shift (100;4u). Do not match 100;3u:
		// that is plain Alt+D.
		/^\x1b\[(?:68;3|68;4|100;4)u$/.test(data) ||
		// xterm modifyOtherKeys variants with the same uppercase-D caveat.
		/^\x1b\[27;(?:3;68|4;(?:68|100))~$/.test(data) ||
		// macOS terminals without Option-as-Meta may emit Option+Shift+D as Î.
		data === "Î" ||
		data === "\x1bÎ"
	);
}

function runGitLog(cwd: string): CommitItem[] {
	const result = spawnSync(
		"git",
		["log", "--date=format:%Y-%m-%d %H:%M", "--format=%h%x09%ad%x09%an%x09%s", "-n", "200"],
		{
			cwd,
			encoding: "utf8",
		},
	);

	if (result.status !== 0) {
		return [];
	}

	return result.stdout
		.split("\n")
		.map((line) => line.trim())
		.filter(Boolean)
		.map((line) => {
			const [sha = "", date = "", author = "", ...subjectParts] = line.split("\t");
			const subject = subjectParts.join("\t");
			return {
				sha,
				date,
				author,
				subject,
				line: `${date} ${author} [${sha}] ${subject}`,
			};
		})
		.filter((commit) => commit.sha.length > 0);
}

function stripTerminalControlChars(value: string): string {
	return value.replace(/[\x00-\x1f\x7f-\x9f]/g, "");
}

function getHeadCommitSessionName(cwd: string): string | null {
	const result = spawnSync("git", ["log", "-1", "--abbrev=8", "--format=%h%x09%s"], {
		cwd,
		encoding: "utf8",
	});

	if (result.status !== 0) {
		return null;
	}

	const [sha = "", ...subjectParts] = result.stdout.trim().split("\t");
	const subject = stripTerminalControlChars(subjectParts.join("\t")).trim();
	if (!sha) {
		return null;
	}

	return subject ? `[${sha}] ${subject}` : `[${sha}]`;
}

function renameSessionToHeadCommit(pi: Pick<ExtensionAPI, "setSessionName">, ctx: PiContext): void {
	const cwd = ctx.cwd ?? process.cwd();
	const sessionName = getHeadCommitSessionName(cwd);
	if (!sessionName) {
		if (ctx.hasUI) notify(ctx, "No git HEAD commit found in this directory", "warning");
		return;
	}

	pi.setSessionName(sessionName);
	if (ctx.hasUI) notify(ctx, `Session renamed: ${sessionName}`, "info");
}

async function openLumen(ctx: PiContext, args: string[] = []): Promise<void> {
	if (!ctx.hasUI) {
		return;
	}

	const cwd = ctx.cwd ?? process.cwd();

	await ctx.ui.custom<number | null>((tui: any, _theme: any, _kb: any, done: (value: number | null) => void) => {
		tui.stop();
		process.stdout.write("\x1b[2J\x1b[H");

		const result = spawnSync("lumen", ["diff", ...args], {
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

async function pickCommit(ctx: PiContext, commits: CommitItem[]): Promise<CommitItem | null> {
	return await ctx.ui.custom<CommitItem | null>(
		(tui: any, theme: any, _kb: any, done: (value: CommitItem | null) => void) => {
			let index = 0;
			let offset = 0;
			let cachedLines: string[] | undefined;

			function refresh() {
				cachedLines = undefined;
				tui.requestRender();
			}

			function move(delta: number) {
				index = Math.max(0, Math.min(commits.length - 1, index + delta));
				refresh();
			}

			function handleInput(data: string) {
				if (matchesKey(data, Key.up)) {
					move(-1);
					return;
				}
				if (matchesKey(data, Key.down)) {
					move(1);
					return;
				}
				if (matchesKey(data, Key.pageUp)) {
					move(-10);
					return;
				}
				if (matchesKey(data, Key.pageDown)) {
					move(10);
					return;
				}
				if (matchesKey(data, Key.enter)) {
					done(commits[index] ?? null);
					return;
				}
				if (matchesKey(data, Key.escape)) {
					done(null);
				}
			}

			function render(width: number, height?: number): string[] {
				if (cachedLines) return cachedLines;

				const visibleHeight = Math.max(5, (height ?? 20) - 6);
				if (index < offset) offset = index;
				if (index >= offset + visibleHeight) offset = index - visibleHeight + 1;

				const lines: string[] = [];
				const add = (line: string) => lines.push(truncateToWidth(line, width));
				const border = "─".repeat(width);

				add(theme.fg("accent", border));
				add(theme.fg("accent", " Select a commit for Lumen"));
				add(theme.fg("dim", " ↑↓ navigate • PgUp/PgDn jump • Enter opens • Esc cancels"));
				lines.push("");

				for (let i = offset; i < Math.min(commits.length, offset + visibleHeight); i++) {
					const commit = commits[i]!;
					const selected = i === index;
					const marker = selected ? "> " : "  ";
					const meta = theme.fg("dim", `${commit.date} ${commit.author}`);
					const sha = selected ? theme.fg("accent", `[${commit.sha}]`) : theme.fg("muted", `[${commit.sha}]`);
					const subject = selected ? theme.fg("accent", commit.subject) : theme.fg("text", commit.subject);
					add(`${marker}${meta} ${sha} ${subject}`);
				}

				lines.push("");
				add(theme.fg("dim", ` ${index + 1}/${commits.length}`));
				add(theme.fg("accent", border));

				cachedLines = lines;
				return lines;
			}

			return { render, invalidate: () => (cachedLines = undefined), handleInput };
		},
		{ overlay: true, overlayOptions: { anchor: "center", width: "90%", maxHeight: 24 } },
	);
}

async function openCommitPicker(ctx: PiContext): Promise<void> {
	if (!ctx.hasUI) {
		return;
	}

	const cwd = ctx.cwd ?? process.cwd();
	const commits = runGitLog(cwd);
	if (commits.length === 0) {
		notify(ctx, "No git commits found in this directory", "warning");
		return;
	}

	const selected = await pickCommit(ctx, commits);
	if (!selected) {
		return;
	}

	await openLumen(ctx, [selected.sha]);
}

export default function (pi: ExtensionAPI) {
	let rawShortcutRunning = false;

	pi.on("session_start", async (_event, ctx) => {
		if (!ctx.hasUI) return;

		ctx.ui.onTerminalInput((data) => {
			const commitPicker = isAltShiftD(data);
			const currentDiff = isAltD(data);
			if (!commitPicker && !currentDiff) {
				return undefined;
			}

			if (!rawShortcutRunning) {
				rawShortcutRunning = true;
				Promise.resolve(commitPicker ? openCommitPicker(ctx) : openLumen(ctx))
					.catch((error) => notify(ctx, error instanceof Error ? error.message : String(error), "error"))
					.finally(() => {
						rawShortcutRunning = false;
					});
			}

			return { consume: true };
		});
	});

	pi.registerShortcut(Key.altShift("d"), {
		description: "Pick a commit and open it in Lumen",
		handler: async (ctx) => {
			await openCommitPicker(ctx);
		},
	});

	pi.registerCommand("lumen", {
		description: "Pick a commit and open it in Lumen",
		handler: async (_args, ctx) => {
			await openCommitPicker(ctx);
		},
	});

	pi.registerCommand("rename-session-commit", {
		description: "Rename the Pi session to the HEAD commit title",
		handler: async (_args, ctx) => {
			renameSessionToHeadCommit(pi, ctx);
		},
	});
}
