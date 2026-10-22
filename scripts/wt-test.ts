import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

// Tests for bin/wt. Each test builds a temp repo with a bare repo
// as origin. A fake `devenv` records its calls; a fake `gh` prints the merged
// PR count from a state file (default 0), so no network is used.
const WT = join(import.meta.dirname, "..", "bin", "wt");
const FAKE_DEVENV = '#!/bin/sh\necho "$PWD $*" >> "$WT_TEST_STATE/devenv-calls"\nexit 0\n';
const FAKE_GH = '#!/bin/sh\necho "$*" >> "$WT_TEST_STATE/gh-calls"\ncat "$WT_TEST_STATE/merged" 2>/dev/null || echo 0\n';

type Run = { status: number | null; stdout: string; stderr: string };

function setup() {
	// realpath: git prints /private/var/... for macOS temp dirs.
	const root = realpathSync(mkdtempSync(join(tmpdir(), "wt-test-")));
	const bin = join(root, "bin");
	const state = join(root, "state");
	for (const d of [bin, state]) mkdirSync(d);
	writeFileSync(join(bin, "devenv"), FAKE_DEVENV);
	writeFileSync(join(bin, "gh"), FAKE_GH);
	chmodSync(join(bin, "devenv"), 0o755);
	chmodSync(join(bin, "gh"), 0o755);
	const env: NodeJS.ProcessEnv = { ...process.env, PATH: `${bin}:${process.env.PATH}`, WT_TEST_STATE: state };
	const git = (cwd: string, ...args: string[]) => {
		const r = spawnSync("git", args, { cwd, encoding: "utf8", env });
		assert.equal(r.status, 0, `git ${args.join(" ")}: ${r.stderr}`);
		return r.stdout.trim();
	};
	const origin = join(root, "origin.git");
	const main = join(root, "main");
	git(root, "init", "-q", "--bare", "-b", "main", origin);
	git(root, "clone", "-q", origin, main);
	git(main, "config", "user.email", "t@t");
	git(main, "config", "user.name", "t");
	writeFileSync(join(main, "a.txt"), "one\n");
	writeFileSync(join(main, ".gitignore"), ".devenv/\n");
	git(main, "add", "-A");
	git(main, "commit", "-qm", "init");
	git(main, "push", "-q", "origin", "main");
	git(main, "remote", "set-head", "origin", "main");
	git(main, "checkout", "-qb", "integration");
	const commit = (dir: string, file: string, text: string) => {
		writeFileSync(join(dir, file), text);
		git(dir, "add", "-A");
		git(dir, "commit", "-qm", `${file}: ${text.trim()}`);
	};
	const run = (args: string[]): Run => {
		const r = spawnSync(WT, args, { cwd: root, env, encoding: "utf8" });
		return { status: r.status, stdout: r.stdout, stderr: r.stderr };
	};
	// wtNew: create a slice with wt new and return its path (last stdout line).
	const wtNew = (branch: string) => {
		const r = run(["new", branch, main]);
		assert.equal(r.status, 0, r.stderr);
		return r.stdout.trim().split("\n").at(-1) ?? "";
	};
	const branches = (ref = "refs/heads") => git(main, "for-each-ref", "--format=%(refname:short)", ref).split("\n");
	const remoteBranches = () => git(main, "ls-remote", "--heads", "origin").split("\n").map((l) => l.replace(/^.*refs\/heads\//, ""));
	const lock = join(main, ".git/wt-land.lock");
	const cleanup = () => rmSync(root, { recursive: true, force: true });
	return { root, main, state, git, commit, run, wtNew, branches, remoteBranches, lock, cleanup };
}

test("new: path from the integration tip, sweep, duplicate issue refusal, detached main refusal", (t) => {
	const h = setup();
	t.after(h.cleanup);
	// A landed worktree from an earlier slice: wt new sweeps it.
	const old = join(h.root, "old");
	h.git(h.main, "worktree", "add", "-q", "-b", "old", old, "integration");
	h.commit(old, "old.txt", "old\n");
	h.git(h.main, "merge", "-q", "--ff-only", "old");

	const r = h.run(["new", "feat/12-first", h.main]);
	assert.equal(r.status, 0, r.stderr);
	const wt = join(h.root, "main-wt/feat-12-first");
	assert.equal(r.stdout.trim(), wt, "stdout is only the path");
	assert.equal(h.git(wt, "branch", "--show-current"), "feat/12-first");
	assert.equal(h.git(wt, "rev-parse", "HEAD"), h.git(h.main, "rev-parse", "integration"));
	assert.ok(!existsSync(old), r.stderr);
	assert.match(r.stderr, /removed .*\/old/);

	// Same leading issue number, other type prefix: refused with the existing path.
	const dup = h.run(["new", "fix/12-second", h.main]);
	assert.notEqual(dup.status, 0);
	assert.equal(dup.stdout.trim().split("\n").at(-1), wt);
	assert.match(dup.stderr, /a worktree for issue 12 exists \(branch feat\/12-first\)/);
	assert.ok(!h.branches().includes("fix/12-second"));
	// 120 is a different issue.
	assert.equal(h.wtNew("120-other"), join(h.root, "main-wt/120-other"));

	h.git(h.main, "checkout", "-q", "--detach");
	const det = h.run(["new", "13-x", h.main]);
	assert.notEqual(det.status, 0);
	assert.match(det.stderr, /is detached/);
	assert.ok(!h.branches().includes("13-x"));
});

test("new: wt.setup runs in the new worktree; a failing setup fails and keeps the worktree", (t) => {
	const h = setup();
	t.after(h.cleanup);
	h.git(h.main, "config", "wt.setup", 'pwd > "$WT_TEST_STATE/setup-cwd"');
	const wt = h.wtNew("1-ok");
	assert.equal(readFileSync(join(h.state, "setup-cwd"), "utf8").trim(), wt);

	h.git(h.main, "config", "wt.setup", "echo setting up; exit 3");
	const r = h.run(["new", "2-fail", h.main]);
	assert.notEqual(r.status, 0);
	assert.match(r.stderr, /wt.setup failed \(exit 3\); kept .*main-wt\/2-fail for inspection/);
	assert.ok(existsSync(join(h.root, "main-wt/2-fail")), "kept for inspection");
	assert.ok(!r.stdout.includes("main-wt/2-fail"), "no path on stdout for a failed setup");
});

test("land: merges into the integration branch with --no-ff, then deletes the worktree and both branches", (t) => {
	const h = setup();
	t.after(h.cleanup);
	h.git(h.main, "config", "wt.landCheck", 'git log -1 --format=%s > "$WT_TEST_STATE/checked"; pwd >> "$WT_TEST_STATE/checked"');
	const wt = h.wtNew("feat/7-slice");
	h.commit(wt, "b.txt", "slice\n");
	h.git(wt, "push", "-q", "origin", "feat/7-slice");
	// The integration branch moved on after the slice was created.
	h.commit(h.main, "c.txt", "other slice\n");
	const integTip = h.git(h.main, "rev-parse", "HEAD");
	const sliceTip = h.git(wt, "rev-parse", "HEAD");

	const r = h.run(["land", "feat/7-slice", h.main]);
	assert.equal(r.status, 0, r.stderr);
	// landCheck ran in the slice on the merged tree (a merge commit is its HEAD).
	assert.deepEqual(readFileSync(join(h.state, "checked"), "utf8").trim().split("\n"), ["Merge commit '" + integTip + "' into feat/7-slice", wt]);
	assert.deepEqual(h.git(h.main, "rev-list", "--parents", "-n1", "HEAD").split(" ").slice(1, 2), [integTip], "--no-ff merge on the old tip");
	assert.equal(h.git(h.main, "merge-base", "--is-ancestor", sliceTip, "HEAD"), "");
	for (const f of ["a.txt", "b.txt", "c.txt"]) assert.ok(existsSync(join(h.main, f)), f);
	assert.ok(!existsSync(wt), r.stdout);
	assert.ok(!h.branches().includes("feat/7-slice"));
	assert.ok(!h.remoteBranches().includes("feat/7-slice"));
	assert.ok(!existsSync(h.lock), "lock released");
	assert.match(r.stdout, /merged feat\/7-slice into integration\n.*removed .*\ndeleted branch feat\/7-slice\ndeleted origin\/feat\/7-slice/s);
});

test("land: a conflict aborts the slice merge and changes nothing", (t) => {
	const h = setup();
	t.after(h.cleanup);
	const wt = h.wtNew("3-conflict");
	h.commit(wt, "a.txt", "slice\n");
	h.commit(h.main, "a.txt", "integration\n");
	const before = [h.git(wt, "rev-parse", "HEAD"), h.git(h.main, "rev-parse", "HEAD")];

	const r = h.run(["land", "3-conflict", h.main]);
	assert.notEqual(r.status, 0);
	assert.match(r.stderr, /rebase or resolve the slice, then land again/);
	assert.deepEqual([h.git(wt, "rev-parse", "HEAD"), h.git(h.main, "rev-parse", "HEAD")], before);
	assert.equal(h.git(wt, "status", "--porcelain"), "", "merge aborted, slice clean");
	assert.ok(!existsSync(join(h.main, ".git/worktrees/3-conflict/MERGE_HEAD")));
	assert.ok(existsSync(wt) && h.branches().includes("3-conflict"));
	assert.ok(!existsSync(h.lock), "lock released");
});

test("land: a failing wt.landCheck leaves the integration branch, worktree and branch in place", (t) => {
	const h = setup();
	t.after(h.cleanup);
	h.git(h.main, "config", "wt.landCheck", "exit 4");
	const wt = h.wtNew("4-check");
	h.commit(wt, "b.txt", "slice\n");
	const integTip = h.git(h.main, "rev-parse", "HEAD");

	const r = h.run(["land", "4-check", h.main]);
	assert.notEqual(r.status, 0);
	assert.match(r.stderr, /wt.landCheck failed \(exit 4\)/);
	assert.equal(h.git(h.main, "rev-parse", "HEAD"), integTip);
	assert.ok(existsSync(wt) && h.branches().includes("4-check"));
	assert.ok(!existsSync(h.lock), "lock released");
});

test("land: a lock held by a live pid refuses; a dead pid's lock is taken over", (t) => {
	const h = setup();
	t.after(h.cleanup);
	const wt = h.wtNew("5-lock");
	h.commit(wt, "b.txt", "slice\n");
	mkdirSync(h.lock);
	writeFileSync(join(h.lock, "pid"), `${process.pid}\n`);
	writeFileSync(join(h.lock, "branch"), "9-other\n");
	const integTip = h.git(h.main, "rev-parse", "HEAD");

	let r = h.run(["land", "5-lock", h.main]);
	assert.notEqual(r.status, 0);
	assert.match(r.stderr, new RegExp(`held by pid ${process.pid} \\(branch 9-other\\)`));
	assert.equal(readFileSync(join(h.lock, "pid"), "utf8").trim(), String(process.pid), "the holder's lock stays");
	assert.equal(h.git(h.main, "rev-parse", "HEAD"), integTip);
	assert.ok(existsSync(wt));

	// A pid that has exited: the lock is stale.
	const dead = spawnSync("true").pid;
	writeFileSync(join(h.lock, "pid"), `${dead}\n`);
	r = h.run(["land", "5-lock", h.main]);
	assert.equal(r.status, 0, r.stderr);
	assert.match(r.stderr, new RegExp(`taking over stale land lock \\(pid ${dead} is gone\\)`));
	assert.ok(!existsSync(wt) && !existsSync(h.lock));
});

test("land: refuses a dirty main checkout, a dirty slice and a slice without commits", (t) => {
	const h = setup();
	t.after(h.cleanup);
	const wt = h.wtNew("6-dirty");
	h.commit(wt, "b.txt", "slice\n");
	const integTip = h.git(h.main, "rev-parse", "HEAD");
	writeFileSync(join(h.main, "scratch.txt"), "x\n");
	let r = h.run(["land", "6-dirty", h.main]);
	assert.notEqual(r.status, 0);
	assert.match(r.stderr, /main checkout .* has uncommitted changes/);
	assert.equal(h.git(h.main, "rev-parse", "HEAD"), integTip);
	assert.equal(h.git(wt, "rev-list", "--count", "integration..HEAD"), "1", "slice not merged");
	assert.ok(existsSync(wt) && !existsSync(h.lock));
	rmSync(join(h.main, "scratch.txt"));

	writeFileSync(join(wt, "b.txt"), "edited\n");
	r = h.run(["land", "6-dirty", h.main]);
	assert.match(r.stderr, /slice worktree .* has uncommitted changes/);
	h.git(wt, "checkout", "--", "b.txt");

	h.wtNew("7-empty");
	r = h.run(["land", "7-empty", h.main]);
	assert.notEqual(r.status, 0);
	assert.match(r.stderr, /7-empty has no commits beyond integration/);
	assert.ok(!existsSync(h.lock));
});

test("retire: refuses without a merged PR or with unlanded worktrees; then starts the next integration branch", (t) => {
	const h = setup();
	t.after(h.cleanup);
	h.commit(h.main, "c.txt", "integration work\n");
	h.git(h.main, "push", "-q", "origin", "integration");

	let r = h.run(["retire", "integration-2", h.main]);
	assert.notEqual(r.status, 0);
	assert.match(r.stderr, /no merged PR has head integration/);
	assert.match(readFileSync(join(h.state, "gh-calls"), "utf8"), /pr list --state merged --head integration/);

	// A PR is reported merged but origin/HEAD does not contain the branch yet.
	writeFileSync(join(h.state, "merged"), "1\n");
	r = h.run(["retire", "integration-2", h.main]);
	assert.match(r.stderr, /integration is not contained in origin\/main/);

	// The PR merges with a merge commit on origin main.
	h.git(h.main, "fetch", "-q", "origin");
	const merge = h.git(h.main, "commit-tree", "integration^{tree}", "-p", "origin/main", "-p", "integration", "-m", "Merge pull request #1");
	h.git(h.main, "push", "-q", "origin", `${merge}:refs/heads/main`);

	// A linked worktree with work not in origin/HEAD blocks the retire.
	const wt = h.wtNew("8-open");
	h.commit(wt, "d.txt", "open\n");
	r = h.run(["retire", "integration-2", h.main]);
	assert.match(r.stderr, /linked worktrees hold work that is not in origin\/main:\n {2}8-open /);
	assert.equal(h.git(h.main, "branch", "--show-current"), "integration");
	h.git(h.main, "worktree", "remove", "--force", wt);

	writeFileSync(join(h.main, "scratch.txt"), "x\n");
	r = h.run(["retire", "integration-2", h.main]);
	assert.match(r.stderr, /main checkout .* has uncommitted changes/);
	rmSync(join(h.main, "scratch.txt"));

	r = h.run(["retire", "integration-2", h.main]);
	assert.equal(r.status, 0, r.stderr);
	assert.equal(h.git(h.main, "branch", "--show-current"), "integration-2");
	assert.equal(h.git(h.main, "rev-parse", "HEAD"), merge);
	assert.equal(spawnSync("git", ["-C", h.main, "rev-parse", "--abbrev-ref", "@{upstream}"]).status, 128, "no upstream: it must not push to main");
	assert.ok(!h.branches().includes("integration"));
	assert.ok(!h.remoteBranches().includes("integration"));
	assert.ok(h.remoteBranches().includes("main"));
});
