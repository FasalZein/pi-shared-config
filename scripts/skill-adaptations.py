#!/usr/bin/env python3
"""Apply or check the local adaptations of shared upstream skills.

The shared skill store (default ``~/.agents/skills``) stays the one canonical copy.
Each adapted file has a pristine upstream copy and an adapted copy in
``skill-adaptations/``. A store file is replaced only when it still equals the
pristine upstream copy, or a prior adapted copy listed under ``priorAdapted``
in the manifest (``skill-adaptations/prior-adapted/``) so an older adaptation
can be upgraded. Any other content is upstream drift: the command then fails
before it writes anything.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import tempfile
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ADAPTATIONS = ROOT / "skill-adaptations"


@dataclass(frozen=True)
class Entry:
    skill: str
    name: str
    upstream: bytes
    adapted: bytes
    prior: bytes | None


def load_entries() -> list[Entry]:
    manifest = json.loads((ADAPTATIONS / "manifest.json").read_text())
    if manifest.get("version") != 1:
        raise SystemExit("skill-adaptations/manifest.json: unsupported version")
    entries: list[Entry] = []
    for skill, record in manifest["skills"].items():
        for name in record["files"]:
            upstream = (ADAPTATIONS / "upstream" / skill / name).read_bytes()
            adapted = (ADAPTATIONS / "adapted" / skill / name).read_bytes()
            if upstream == adapted:
                raise SystemExit(f"skill-adaptations: {skill}/{name} has no local change")
            prior = None
            if name in record.get("priorAdapted", []):
                prior = (ADAPTATIONS / "prior-adapted" / skill / name).read_bytes()
            entries.append(Entry(skill, name, upstream, adapted, prior))
    return entries


def classify(store: Path, entry: Entry) -> str:
    skill_dir = store / entry.skill
    if not skill_dir.is_dir():
        return "not-installed"
    target = skill_dir / entry.name
    if target.is_symlink() or not target.is_file():
        return "drift"
    content = target.read_bytes()
    if content == entry.adapted:
        return "adapted"
    if content == entry.upstream:
        return "upstream"
    if entry.prior is not None and content == entry.prior:
        return "prior-adapted"
    return "drift"


def write_atomically(path: Path, content: bytes) -> None:
    mode = path.stat().st_mode & 0o777
    descriptor, temporary = tempfile.mkstemp(dir=path.parent, prefix=f".{path.name}.")
    try:
        with os.fdopen(descriptor, "wb") as handle:
            handle.write(content)
        os.chmod(temporary, mode)
        os.replace(temporary, path)
    except BaseException:
        Path(temporary).unlink(missing_ok=True)
        raise


def apply(store: Path, entries: list[Entry]) -> int:
    states = [(entry, classify(store, entry)) for entry in entries]
    drift = [entry for entry, state in states if state == "drift"]
    if drift:
        for entry in drift:
            print(
                f"ERROR: {store / entry.skill / entry.name} matches neither the supported upstream "
                "nor an adapted copy; upstream drift is unsupported. No file was changed.",
                file=sys.stderr,
            )
        print(
            "Update skill-adaptations/ for the new upstream content, then rerun this command.",
            file=sys.stderr,
        )
        return 1
    for skill in dict.fromkeys(entry.skill for entry in entries):
        skill_states = {state for entry, state in states if entry.skill == skill}
        if skill_states == {"not-installed"}:
            print(f"skipped {skill}: not installed in {store}")
    pending = [(entry, state) for entry, state in states if state in ("upstream", "prior-adapted")]
    written: list[tuple[Entry, str]] = []
    try:
        for entry, state in pending:
            write_atomically(store / entry.skill / entry.name, entry.adapted)
            written.append((entry, state))
    except OSError as error:
        for entry, state in reversed(written):
            original = entry.upstream if state == "upstream" else entry.prior
            assert original is not None
            write_atomically(store / entry.skill / entry.name, original)
        print(f"ERROR: write failed ({error}); restored {len(written)} written file(s).", file=sys.stderr)
        return 1
    for entry, state in pending:
        print(f"adapted {entry.skill}/{entry.name}" + (" (upgraded prior adaptation)" if state == "prior-adapted" else ""))
    already = sum(1 for _, state in states if state == "adapted")
    print(f"Skill adaptations: {len(pending)} applied, {already} already applied.")
    return 0


def check(store: Path, entries: list[Entry]) -> int:
    result = 0
    for entry in entries:
        state = classify(store, entry)
        print(f"{state}: {entry.skill}/{entry.name}")
        if state != "adapted":
            result = 1
    return result


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("command", choices=("apply", "check"))
    parser.add_argument(
        "--store",
        type=Path,
        default=Path.home() / ".agents" / "skills",
        help="shared skill store (default: ~/.agents/skills)",
    )
    arguments = parser.parse_args()
    entries = load_entries()
    if arguments.command == "apply":
        return apply(arguments.store, entries)
    return check(arguments.store, entries)


if __name__ == "__main__":
    raise SystemExit(main())
