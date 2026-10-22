#!/usr/bin/env python3
"""Exercise apply, reapply, drift rejection, and rollback for skill adaptations."""

import json
import os
import shutil
import subprocess
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TOOL = ROOT / "scripts/skill-adaptations.py"
UPSTREAM = ROOT / "skill-adaptations/upstream"
ADAPTED = ROOT / "skill-adaptations/adapted"
MANIFEST = json.loads((ROOT / "skill-adaptations/manifest.json").read_text())
FILES = [(skill, name) for skill, record in MANIFEST["skills"].items() for name in record["files"]]
UNRELATED = {
    "to-spec/agents/openai.yaml": "interface:\n  display_name: \"To Spec\"\n",
    "setup-matt-pocock-skills/issue-tracker-local.md": "# Issue tracker: Local Markdown\n",
    "tdd/SKILL.md": "---\nname: tdd\n---\nunrelated skill\n",
}


def run(command: str, store: Path) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["python3", str(TOOL), command, "--store", str(store)],
        text=True,
        capture_output=True,
        check=False,
    )


def fresh_store(root: Path) -> Path:
    store = root / ".agents/skills"
    shutil.copytree(UPSTREAM, store)
    for relative, text in UNRELATED.items():
        path = store / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text)
    return store


def snapshot(store: Path) -> dict[str, bytes]:
    return {
        str(path.relative_to(store)): path.read_bytes()
        for path in sorted(store.rglob("*"))
        if path.is_file()
    }


def assert_unrelated(store: Path) -> None:
    for relative, text in UNRELATED.items():
        assert (store / relative).read_text() == text, f"unrelated file changed: {relative}"


def test_apply_fresh_store_and_reapply(root: Path) -> None:
    store = fresh_store(root)
    assert run("check", store).returncode == 1, "check accepted an unadapted store"
    result = run("apply", store)
    assert result.returncode == 0, result.stderr
    for skill, name in FILES:
        assert (store / skill / name).read_bytes() == (ADAPTED / skill / name).read_bytes()
    assert_unrelated(store)
    assert f"{len(FILES)} applied, 0 already applied" in result.stdout, result.stdout
    before = snapshot(store)
    again = run("apply", store)
    assert again.returncode == 0, again.stderr
    assert f"0 applied, {len(FILES)} already applied" in again.stdout, again.stdout
    assert snapshot(store) == before, "reapply changed the store"
    assert run("check", store).returncode == 0, "check rejected an adapted store"


def test_drift_rejects_without_writes(root: Path) -> None:
    store = fresh_store(root)
    drifted = store / "to-tickets/SKILL.md"
    drifted.write_text(drifted.read_text() + "\nNew upstream paragraph.\n")
    before = snapshot(store)
    result = run("apply", store)
    assert result.returncode == 1, "apply accepted upstream drift"
    assert "to-tickets/SKILL.md matches neither the supported upstream" in result.stderr, result.stderr
    assert "No file was changed." in result.stderr
    assert snapshot(store) == before, "drift rejection wrote files"


def test_missing_file_in_installed_skill_is_drift(root: Path) -> None:
    store = fresh_store(root)
    (store / "setup-matt-pocock-skills/issue-tracker-github.md").unlink()
    before = snapshot(store)
    result = run("apply", store)
    assert result.returncode == 1, "apply accepted a partial skill install"
    assert snapshot(store) == before, "partial-install rejection wrote files"


def test_absent_skill_is_skipped_and_reported(root: Path) -> None:
    store = fresh_store(root)
    shutil.rmtree(store / "to-tickets")
    result = run("apply", store)
    assert result.returncode == 0, result.stderr
    assert "skipped to-tickets: not installed" in result.stdout, result.stdout
    assert (store / "to-spec/SKILL.md").read_bytes() == (ADAPTED / "to-spec/SKILL.md").read_bytes()
    checked = run("check", store)
    assert checked.returncode == 1 and "not-installed: to-tickets/SKILL.md" in checked.stdout


def test_write_failure_rolls_back(root: Path) -> None:
    store = fresh_store(root)
    last_skill = FILES[-1][0]
    before = snapshot(store)
    locked = store / last_skill
    os.chmod(locked, 0o555)
    try:
        result = run("apply", store)
    finally:
        os.chmod(locked, 0o755)
    assert result.returncode == 1, "apply ignored a write failure"
    assert "restored" in result.stderr, result.stderr
    assert snapshot(store) == before, "write failure left a partial adaptation"


def test_prior_adapted_copy_is_upgraded(root: Path) -> None:
    store = fresh_store(root)
    prior = ROOT / "skill-adaptations/prior-adapted/to-tickets/SKILL.md"
    assert prior.read_bytes() != (ADAPTED / "to-tickets/SKILL.md").read_bytes()
    shutil.copyfile(prior, store / "to-tickets/SKILL.md")
    checked = run("check", store)
    assert checked.returncode == 1 and "prior-adapted: to-tickets/SKILL.md" in checked.stdout, checked.stdout
    result = run("apply", store)
    assert result.returncode == 0, result.stderr
    assert (store / "to-tickets/SKILL.md").read_bytes() == (ADAPTED / "to-tickets/SKILL.md").read_bytes()
    assert_unrelated(store)
    assert run("check", store).returncode == 0


def test_prior_adapted_copy_with_local_edit_is_drift(root: Path) -> None:
    store = fresh_store(root)
    prior = ROOT / "skill-adaptations/prior-adapted/to-tickets/SKILL.md"
    (store / "to-tickets/SKILL.md").write_bytes(prior.read_bytes() + b"\nLocal edit.\n")
    before = snapshot(store)
    result = run("apply", store)
    assert result.returncode == 1, "apply accepted an edited prior adapted copy"
    assert snapshot(store) == before, "edited prior adapted copy was overwritten"


TESTS = [
    test_prior_adapted_copy_is_upgraded,
    test_prior_adapted_copy_with_local_edit_is_drift,
    test_apply_fresh_store_and_reapply,
    test_drift_rejects_without_writes,
    test_missing_file_in_installed_skill_is_drift,
    test_absent_skill_is_skipped_and_reported,
    test_write_failure_rolls_back,
]

for test in TESTS:
    with tempfile.TemporaryDirectory(prefix="skill-adaptations-") as temporary:
        test(Path(temporary))
print(f"Skill adaptation tests passed: {len(TESTS)}.")
