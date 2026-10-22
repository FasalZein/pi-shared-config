import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { homedir } from "node:os";

// Use the installed pi-ralph-loop parser for items.json when it exists, so the
// test checks the format the loop really accepts (tested with v1.3.3). Without
// the package the test falls back to plain JSON.parse and checks the same fields.
type Parsed = { items: { passes: boolean; description: string; steps: string[] }[]; runtime_contract?: { verification_gates?: unknown; require_one_item_per_iteration?: boolean } };
const agentDir = process.env.PI_AGENT_DIR ?? join(homedir(), ".pi/agent");
let parseBundleItemsJson: (text: string) => Parsed = (text) => JSON.parse(text);
try {
	({ parseBundleItemsJson } = await import(join(agentDir, "git/github.com/edxeth/pi-ralph-loop/src/bundle/schema.ts")));
} catch {
	// package not installed
}

// Tests for bin/ralph-lane. Each test builds a temp repo whose
// main checkout is on an integration branch; the launcher calls the real wt.
const LANE = join(import.meta.dirname, "..", "bin", "ralph-lane");
const TEMPLATE = join(import.meta.dirname, "..", "templates", "ralph-lane-template.md");

type Run = { status: number | null; stdout: string; stderr: string };

function setup() {
	// realpath: git prints /private/var/... for macOS temp dirs.
	const root = realpathSync(mkdtempSync(join(tmpdir(), "ralph-lane-test-")));
	const main = join(root, "main");
	const git = (cwd: string, ...args: string[]) => {
		const r = spawnSync("git", args, { cwd, encoding: "utf8" });
		assert.equal(r.status, 0, `git ${args.join(" ")}: ${r.stderr}`);
		return r.stdout.trim();
	};
	git(root, "init", "-q", "-b", "integration", main);
	git(main, "config", "user.email", "t@t");
	git(main, "config", "user.name", "t");
	writeFileSync(join(main, "a.txt"), "one\n");
	git(main, "add", "-A");
	git(main, "commit", "-qm", "init");
	const run = (bundleText: string, name = "bundle.md"): Run => {
		const file = join(root, name);
		writeFileSync(file, bundleText);
		const r = spawnSync(LANE, [file, main], { cwd: root, encoding: "utf8" });
		return { status: r.status, stdout: r.stdout, stderr: r.stderr };
	};
	const worktrees = () => git(main, "worktree", "list", "--porcelain").split("\n").filter((l) => l.startsWith("branch "));
	const cleanup = () => rmSync(root, { recursive: true, force: true });
	return { root, main, git, run, worktrees, cleanup };
}

// fill: the template with a branch, items and an optional retries line.
function fill(branch: string, items: string[], retries?: string, gates = ["typecheck: heavy -- npm run typecheck"]) {
	let text = readFileSync(TEMPLATE, "utf8");
	text = text.replace(/^- branch: <issue>-<slug>$/m, `- branch: ${branch}`);
	text = text.replace(/^- retries: .*$/m, retries === undefined ? "" : `- retries: ${retries}`);
	text = text.replace(/## Gates\n(- .*\n)+/, `## Gates\n${gates.map((g) => `- ${g}`).join("\n")}\n`);
	text = text.replace(/## Items\n(- .*\n)+/, `## Items\n${items.join("\n")}\n`);
	return text;
}

const THREE = [
	"- [ ] #101 Remove dead export | check: `heavy -- npm test a.test.ts` passes",
	"- [ ] #102 Rename helper | check: rg finds 0 uses of oldName",
	"- [ ] #103 Drop unused flag | check: `heavy -- npm test b.test.ts` passes",
];

test("happy path: wt new creates the lane, max-iterations = items + default retries, .ralph excluded, bundle parses", (t) => {
	const h = setup();
	t.after(h.cleanup);
	const r = h.run(fill("100-cuts-epic", THREE));
	assert.equal(r.status, 0, r.stderr);
	const lane = join(h.root, "main-wt/100-cuts-epic");
	// wt new ran: the lane worktree exists on the bundle's branch.
	assert.ok(h.worktrees().includes("branch refs/heads/100-cuts-epic"));
	assert.equal(h.git(lane, "branch", "--show-current"), "100-cuts-epic");
	// 3 items + 3 retries (one per item) = 6, with the derivation in a comment.
	assert.match(r.stdout, /^\/ralph-loop "@\.ralph\/prompt\.md" --max-iterations=6$/m);
	assert.match(r.stdout, /^# max-iterations 6 = 3 items \+ 3 retries \(default: 1 per item\)$/m);
	assert.match(r.stdout, new RegExp(`^cd '${lane}' && RALPH_BLOCKED_TOOLS=ask_user pi `, "m"));
	// The four files the package requires exist; items.json passes its parser.
	for (const f of ["plan.md", "items.json", "prompt.md", "progress.md"]) assert.ok(existsSync(join(lane, ".ralph", f)), f);
	const parsed = parseBundleItemsJson(readFileSync(join(lane, ".ralph/items.json"), "utf8"));
	assert.equal(parsed.items.length, 3);
	assert.ok(parsed.items.every((i) => i.passes === false));
	assert.equal(parsed.items[1].description, "#102 Rename helper");
	assert.deepEqual(parsed.items[1].steps, ["Acceptance check: rg finds 0 uses of oldName"]);
	assert.deepEqual(parsed.runtime_contract?.verification_gates, [{ name: "typecheck", command: "heavy -- npm run typecheck" }]);
	assert.equal(parsed.runtime_contract?.require_one_item_per_iteration, true);
	assert.equal(parsed.runtime_contract?.require_commit, true);
	// prompt.md carries the instructions and the lane facts, not the usage comment.
	const prompt = readFileSync(join(lane, ".ralph/prompt.md"), "utf8");
	assert.match(prompt, /## Per-iteration instructions/);
	assert.match(prompt, new RegExp(`- Lane path: ${lane}`));
	assert.doesNotMatch(prompt, /<!--/);
	// .ralph/ is ignored through info/exclude: the lane is clean and no repo file changed.
	assert.equal(h.git(lane, "status", "--porcelain", "--ignored=no"), "");
	assert.equal(h.git(lane, "check-ignore", ".ralph/prompt.md"), ".ralph/prompt.md");
	assert.equal(h.git(h.main, "status", "--porcelain"), "");
	assert.ok(!existsSync(join(lane, ".gitignore")));
});

test("stated retries replace the default; a second run keeps one exclude line", (t) => {
	const h = setup();
	t.after(h.cleanup);
	const r = h.run(fill("200-audit", THREE, "1"));
	assert.equal(r.status, 0, r.stderr);
	assert.match(r.stdout, /--max-iterations=4$/m);
	assert.match(r.stdout, /# max-iterations 4 = 3 items \+ 1 retries \(stated in the bundle\)/);
	const r2 = h.run(fill("201-audit-more", THREE.slice(0, 1), "0"), "b2.md");
	assert.equal(r2.status, 0, r2.stderr);
	assert.match(r2.stdout, /--max-iterations=1$/m);
	const exclude = readFileSync(join(h.main, ".git/info/exclude"), "utf8");
	assert.equal(exclude.split("\n").filter((l) => l === "/.ralph/").length, 1);
});

test("branch naming: refuses a branch without a leading issue number, including the unfilled template", (t) => {
	const h = setup();
	t.after(h.cleanup);
	for (const text of [fill("cuts-api", THREE), readFileSync(TEMPLATE, "utf8")]) {
		const r = h.run(text);
		assert.equal(r.status, 1);
		assert.match(r.stderr, /must start with an issue number/);
	}
	assert.equal(h.worktrees().length, 1, "no lane worktree was created");
});

test("wt duplicate check: a second lane for the same issue number is refused", (t) => {
	const h = setup();
	t.after(h.cleanup);
	assert.equal(h.run(fill("300-first", THREE)).status, 0);
	const r = h.run(fill("300-second", THREE), "b2.md");
	assert.equal(r.status, 1);
	assert.match(r.stderr, /a worktree for issue 300 exists/);
	assert.equal(h.worktrees().length, 2);
});

test("bundle checks: missing check, pre-checked item, gate without heavy, tracked .ralph", (t) => {
	const h = setup();
	t.after(h.cleanup);
	const cases: [string, RegExp][] = [
		[fill("400-x", ["- [ ] #401 No check here"]), /items without '\| check:/],
		[fill("400-x", ["- [x] #401 Done | check: ok", ...THREE]), /checked items/],
		[fill("400-x", THREE, undefined, ["tests: npm test"]), /gates must run through heavy/],
		[fill("400-x", THREE, "two"), /must be a whole number/],
	];
	for (const [text, err] of cases) {
		const r = h.run(text);
		assert.equal(r.status, 1, r.stdout);
		assert.match(r.stderr, err);
	}
	mkdirSync(join(h.main, ".ralph"));
	writeFileSync(join(h.main, ".ralph/prompt.md"), "old\n");
	h.git(h.main, "add", "-f", ".ralph/prompt.md");
	h.git(h.main, "commit", "-qm", "track ralph");
	const r = h.run(fill("400-x", THREE));
	assert.equal(r.status, 1);
	assert.match(r.stderr, /tracks files under \.ralph/);
	assert.equal(h.worktrees().length, 1, "no lane worktree was created");
});
