import assert from "node:assert/strict";
import { type ChildProcess, spawn, spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

// Tests for bin/worktrees-landed and worktrees-idle. Each test
// builds temp git repos. A fake `devenv` on PATH records its calls and kills
// the fake service; a fake `gh` reports no merged PRs so no network is used.
const BIN = join(import.meta.dirname, "..", "bin");
const FAKE_DEVENV = `#!/bin/sh
echo "$PWD $*" >> "$WT_TEST_STATE/devenv-calls"
[ -f "$WT_TEST_STATE/svcpid" ] && [ ! -f "$WT_TEST_STATE/nokill" ] && kill "$(cat "$WT_TEST_STATE/svcpid")" 2>/dev/null
exit 0
`;
const FAKE_GH = "#!/bin/sh\necho 0\n";

type Run = { status: number | null; stdout: string; stderr: string };

function setup() {
	// realpath: lsof and git print /private/var/... for macOS temp dirs.
	const root = realpathSync(mkdtempSync(join(tmpdir(), "worktrees-test-")));
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
		return r.stdout;
	};
	const origin = join(root, "origin.git");
	const main = join(root, "main");
	git(root, "init", "-q", "--bare", "-b", "main", origin);
	git(root, "clone", "-q", origin, main);
	git(main, "config", "user.email", "t@t");
	git(main, "config", "user.name", "t");
	writeFileSync(join(main, "a.txt"), "one\n");
	writeFileSync(join(main, "devenv.nix"), "{ }\n");
	writeFileSync(join(main, ".gitignore"), ".devenv/\n");
	git(main, "add", "-A");
	git(main, "commit", "-qm", "init");
	git(main, "push", "-q", "origin", "main");
	git(main, "remote", "set-head", "origin", "main");
	// The main checkout works on an integration branch, as Bayland does.
	git(main, "checkout", "-qb", "integration");
	const worktree = (name: string, commit: boolean, detached = false) => {
		const wt = join(root, name);
		if (detached) git(main, "worktree", "add", "-q", "--detach", wt, "integration");
		else git(main, "worktree", "add", "-q", "-b", name, wt, "integration");
		if (commit) {
			writeFileSync(join(wt, `${name}.txt`), `${name}\n`);
			git(wt, "add", "-A");
			git(wt, "commit", "-qm", name);
		}
		return wt;
	};
	const run = (tool: string, args: string[]): Run => {
		const r = spawnSync(join(BIN, tool), args, { cwd: root, env, encoding: "utf8" });
		return { status: r.status, stdout: r.stdout, stderr: r.stderr };
	};
	const procs: ChildProcess[] = [];
	// holdFile: a background process opens a file under <dir>/.devenv/state
	// with its cwd outside the worktree, as a devenv Postgres does with its data.
	const holdFile = async (dir: string) => {
		mkdirSync(join(dir, ".devenv/state"), { recursive: true });
		const child = spawn("sh", ["-c", 'exec 3>>"$1"; echo ready; exec sleep 300', "sh", join(dir, ".devenv/state/pg.lock")], { cwd: root });
		procs.push(child);
		await new Promise<void>((resolve) => child.stdout?.once("data", () => resolve()));
		writeFileSync(join(state, "svcpid"), String(child.pid));
		return child;
	};
	const useCwd = (dir: string) => {
		const child = spawn("sleep", ["300"], { cwd: dir });
		procs.push(child);
		return child;
	};
	const devenvCalls = () => (existsSync(join(state, "devenv-calls")) ? readFileSync(join(state, "devenv-calls"), "utf8").split("\n").filter(Boolean) : []);
	const cleanup = () => {
		for (const p of procs) p.kill("SIGKILL");
		rmSync(root, { recursive: true, force: true });
	};
	const flag = (name: string) => writeFileSync(join(state, name), "");
	return { root, main, git, flag, worktree, run, holdFile, useCwd, devenvCalls, cleanup };
}

// stateOf: the STATE column of the row whose PATH is wt.
const stateOf = (out: string, wt: string) => out.split("\n").find((l) => l.endsWith(` ${wt}`))?.split(/\s+/)[0];
const exited = (child: ChildProcess) => new Promise<void>((resolve) => (child.exitCode !== null || child.signalCode !== null ? resolve() : child.once("exit", () => resolve())));

test("fresh: a worktree without a commit yet is never landed or removed", (t) => {
	const h = setup();
	t.after(h.cleanup);
	// Both are clean and contained in the main checkout's branch tip.
	const fresh = h.worktree("fresh", false);
	const freshDetached = h.worktree("fresh-detached", false, true);
	const doneDetached = h.worktree("done-detached", true, true);
	h.git(h.main, "merge", "-q", "--ff-only", h.git(doneDetached, "rev-parse", "HEAD").trim());

	const r = h.run("worktrees-landed", [h.main, "--remove"]);
	assert.equal(r.status, 0, r.stderr);
	assert.equal(stateOf(r.stdout, fresh), "fresh", r.stdout);
	assert.equal(stateOf(r.stdout, freshDetached), "fresh", r.stdout);
	assert.equal(stateOf(r.stdout, doneDetached), "landed", r.stdout);
	assert.ok(existsSync(fresh) && existsSync(freshDetached), r.stdout);
	assert.ok(!existsSync(doneDetached), r.stdout);
});

test("landed rules: origin/HEAD, main checkout branch, detached main, dirty, local; --remove deletes merged local branches only", (t) => {
	const h = setup();
	t.after(h.cleanup);
	const viaOrigin = h.worktree("via-origin", true);
	h.git(viaOrigin, "push", "-q", "origin", "via-origin:main");
	const viaMain = h.worktree("via-main", true);
	h.git(h.main, "merge", "-q", "--ff-only", "via-main");
	const local = h.worktree("local-only", true);
	const dirty = h.worktree("dirty", false);
	writeFileSync(join(dirty, "untracked.txt"), "x\n");

	let r = h.run("worktrees-landed", [h.main]);
	assert.equal(r.status, 0, r.stderr);
	assert.equal(stateOf(r.stdout, viaOrigin), "landed");
	assert.equal(stateOf(r.stdout, viaMain), "landed", "contained in the main checkout's branch");
	assert.equal(stateOf(r.stdout, local), "local");
	assert.equal(stateOf(r.stdout, dirty), "dirty");
	assert.equal(stateOf(r.stdout, h.main), undefined, "the main checkout is not listed");

	// A detached main checkout gives no branch rule.
	h.git(h.main, "checkout", "-q", "--detach");
	r = h.run("worktrees-landed", [h.main]);
	assert.equal(stateOf(r.stdout, viaMain), "local");
	assert.equal(stateOf(r.stdout, viaOrigin), "landed");
	h.git(h.main, "checkout", "-q", "integration");

	h.git(viaMain, "push", "-q", "origin", "via-main");
	r = h.run("worktrees-landed", [h.main, "--remove"]);
	assert.equal(r.status, 0, r.stderr);
	assert.ok(!existsSync(viaOrigin) && !existsSync(viaMain), r.stdout);
	assert.ok(existsSync(local) && existsSync(dirty), r.stdout);
	const branches = h.git(h.main, "branch", "--format=%(refname:short)");
	// via-origin is in origin/HEAD but not in the main checkout's HEAD: git branch -d keeps it.
	for (const b of ["via-origin", "local-only", "dirty"]) assert.match(branches, new RegExp(`^${b}$`, "m"));
	assert.doesNotMatch(branches, /^via-main$/m);
	assert.match(r.stdout, /deleted branch via-main/);
	assert.match(r.stdout, /kept branch via-origin: git branch -d refused/);
	assert.match(r.stdout, /remote branch origin\/via-main remains/, "remote branches are never deleted");
	assert.match(h.git(h.main, "ls-remote", "--heads", "origin"), /refs\/heads\/via-main$/m);
	assert.deepEqual(h.devenvCalls(), [], "no devenv services ran");
});

test("devenv services: not busy, idle detection, --stop and --remove stop them first", async (t) => {
	const h = setup();
	t.after(h.cleanup);
	const wt = h.worktree("svc", true);
	h.git(h.main, "merge", "-q", "--ff-only", "svc");
	const svc = await h.holdFile(wt);

	let r = h.run("worktrees-landed", [h.main]);
	assert.equal(stateOf(r.stdout, wt), "landed", r.stdout);
	assert.match(r.stdout, /note: devenv services run here \(1 processes hold files under \.devenv\)/);
	r = h.run("worktrees-idle", [h.main]);
	assert.equal(r.status, 0, r.stderr);
	assert.equal(stateOf(r.stdout, wt), "idle", r.stdout);

	// Another process with its cwd inside: in use, busy, and never touched.
	const user = h.useCwd(wt);
	r = h.run("worktrees-idle", [h.main, "--stop"]);
	assert.equal(stateOf(r.stdout, wt), "in-use", r.stdout);
	assert.match(r.stdout, new RegExp(`used by ${user.pid} sleep 300`));
	r = h.run("worktrees-landed", [h.main, "--remove"]);
	assert.equal(stateOf(r.stdout, wt), "busy", r.stdout);
	assert.ok(existsSync(wt));
	assert.deepEqual(h.devenvCalls(), []);
	user.kill("SIGKILL");
	await exited(user);

	// Idle: --stop runs `devenv processes down` in the worktree.
	r = h.run("worktrees-idle", [h.main, "--stop"]);
	assert.equal(stateOf(r.stdout, wt), "idle", r.stdout);
	assert.deepEqual(h.devenvCalls(), [`${wt} processes down`]);
	await exited(svc);
	r = h.run("worktrees-idle", [h.main]);
	assert.equal(stateOf(r.stdout, wt), undefined, "no services, not listed");

	// Services that survive `devenv processes down`: one re-check, kept.
	const svc2 = await h.holdFile(wt);
	h.flag("nokill");
	r = h.run("worktrees-landed", [h.main, "--remove"]);
	assert.match(r.stdout, /kept: devenv services still run after devenv processes down; the next sweep removes it/);
	assert.ok(existsSync(wt), r.stdout);
	rmSync(join(h.root, "state/nokill"));

	// Landed with services: --remove stops them, then removes the worktree.
	r = h.run("worktrees-landed", [h.main, "--remove"]);
	assert.equal(r.status, 0, r.stderr);
	assert.match(r.stdout, /stopped devenv services/);
	assert.ok(!existsSync(wt), r.stdout);
	assert.deepEqual(h.devenvCalls(), Array(3).fill(`${wt} processes down`));
	await exited(svc2);
	assert.doesNotMatch(h.git(h.main, "branch", "--format=%(refname:short)"), /^svc$/m);
});

test("worktrees-idle lists the main checkout too", async (t) => {
	const h = setup();
	t.after(h.cleanup);
	await h.holdFile(h.main);
	const r = h.run("worktrees-idle", [h.main]);
	assert.equal(stateOf(r.stdout, h.main), "idle", r.stdout);
	assert.deepEqual(h.devenvCalls(), [], "read-only without --stop");
});
