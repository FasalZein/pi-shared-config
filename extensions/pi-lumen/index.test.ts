import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, test } from "bun:test";
import extension from "./index";

interface RegisteredCommand {
	description?: string;
	handler: (args: string, ctx: unknown) => Promise<void> | void;
}

function createGitRepo(subject: string): string {
	const cwd = mkdtempSync(join(tmpdir(), "pi-lumen-test-"));
	const run = (args: string[]) => {
		const result = spawnSync("git", args, { cwd, encoding: "utf8" });
		if (result.status !== 0) {
			throw new Error(`git ${args.join(" ")} failed: ${result.stderr}`);
		}
		return result.stdout.trim();
	};

	run(["init"]);
	run(["config", "user.name", "Pi Lumen Test"]);
	run(["config", "user.email", "pi-lumen@example.com"]);
	writeFileSync(join(cwd, "file.txt"), "fixture");
	run(["add", "file.txt"]);
	run(["commit", "-m", subject]);
	return cwd;
}

function loadExtension() {
	const commands = new Map<string, RegisteredCommand>();
	let sessionName: string | undefined;

	extension({
		on: () => {},
		registerShortcut: () => {},
		registerCommand: (name: string, command: RegisteredCommand) => {
			commands.set(name, command);
		},
		setSessionName: (name: string) => {
			sessionName = name;
		},
		getSessionName: () => sessionName,
	} as never);

	return {
		commands,
		getSessionName: () => sessionName,
	};
}

async function renameSessionFromHead(cwd: string): Promise<string | undefined> {
	const harness = loadExtension();
	const command = harness.commands.get("rename-session-commit");
	expect(command).toBeDefined();

	await command!.handler("", {
		hasUI: true,
		cwd,
		ui: { notify: () => {} },
	});

	return harness.getSessionName();
}

function getShortHead(cwd: string): string {
	return spawnSync("git", ["rev-parse", "--short=8", "HEAD"], { cwd, encoding: "utf8" }).stdout.trim();
}

describe("rename-session-commit command", () => {
	test("sets the Pi session name to the HEAD commit hash and subject", async () => {
		const subject = "perf(assets): add Sharp build-time image optimization and AVIF delivery";
		const cwd = createGitRepo(subject);
		try {
			await expect(renameSessionFromHead(cwd)).resolves.toBe(`[${getShortHead(cwd)}] ${subject}`);
		} finally {
			rmSync(cwd, { recursive: true, force: true });
		}
	});

	test("strips terminal control characters from the session name", async () => {
		const subject = "feat: \x1b[31mred\x1b[0m \x07bell \x9bmalicious";
		const cwd = createGitRepo(subject);
		try {
			await expect(renameSessionFromHead(cwd)).resolves.toBe(`[${getShortHead(cwd)}] feat: [31mred[0m bell malicious`);
		} finally {
			rmSync(cwd, { recursive: true, force: true });
		}
	});
});
