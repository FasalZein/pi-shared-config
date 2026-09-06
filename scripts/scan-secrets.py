#!/usr/bin/env python3
"""Fail when a Pi configuration backup contains likely credentials."""

from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path
from typing import Any

FORBIDDEN_FILES = {
    "auth.json",
    "models-store.json",
    "mcp-cache.json",
    "mcp-onboarding.json",
    "cursor-sdk-context-windows.json",
    "cursor-sdk-model-list.json",
    "claude-account-source.txt",
    "claude-code-version.json",
    "howaboua-pi-stuff-changelog.json",
    "run-history.jsonl",
}
SECRET_KEYS = {
    "apikey",
    "accesstoken",
    "refreshtoken",
    "authtoken",
    "bearertoken",
    "clientsecret",
    "password",
    "privatekey",
    "secret",
    "token",
}
ALLOWED_VALUES = {"", "dummy", "cursor-responses-local"}
RAW_PATTERNS = {
    "private key": re.compile(r"-----BEGIN (?:[A-Z ]+ )?PRIVATE KEY-----"),
    "GitHub token": re.compile(r"\b(?:github_pat_|gh[oprsu]_)[A-Za-z0-9_]{20,}\b"),
    "OpenAI-style key": re.compile(r"\bsk-(?:proj-|ant-)?[A-Za-z0-9_-]{16,}\b"),
    "AWS access key": re.compile(r"\b(?:AKIA|ASIA)[A-Z0-9]{16}\b"),
    "GitLab token": re.compile(r"\bglpat-[A-Za-z0-9_-]{16,}\b"),
    "Slack token": re.compile(r"\bxox[baprs]-[A-Za-z0-9-]{10,}\b"),
    "credential in URL": re.compile(r"https?://[^\s/:]+:[^\s/@]+@"),
}


def normalized_key(value: str) -> str:
    return re.sub(r"[^a-z0-9]", "", value.lower())


def allowed_secret_value(value: Any) -> bool:
    if value is None:
        return True
    if not isinstance(value, str):
        return False
    stripped = value.strip()
    if stripped in ALLOWED_VALUES:
        return True
    if re.fullmatch(r"\$\{[A-Z][A-Z0-9_]*\}", stripped):
        return True
    lowered = stripped.lower()
    return any(marker in lowered for marker in ("example", "placeholder", "changeme", "your_", "your-"))


def inspect_json(value: Any, path: str, findings: list[str]) -> None:
    if isinstance(value, dict):
        for key, child in value.items():
            child_path = f"{path}.{key}" if path else str(key)
            if normalized_key(str(key)) in SECRET_KEYS and not allowed_secret_value(child):
                findings.append(f"credential value at {child_path}")
            inspect_json(child, child_path, findings)
    elif isinstance(value, list):
        for index, child in enumerate(value):
            inspect_json(child, f"{path}[{index}]", findings)


def read_text(path: Path) -> str | None:
    try:
        data = path.read_bytes()
    except OSError as error:
        return f"<read error: {error}>"
    if b"\0" in data:
        return None
    try:
        return data.decode("utf-8")
    except UnicodeDecodeError:
        return None


def scan_text(label: str, text: str, findings: list[str]) -> None:
    for name, pattern in RAW_PATTERNS.items():
        if pattern.search(text):
            findings.append(f"{label}: {name}")


def scan_repo(root: Path) -> list[str]:
    findings: list[str] = []
    for path in sorted(root.rglob("*")):
        if ".git" in path.parts or not path.is_file():
            continue
        relative = path.relative_to(root)
        if path.name in FORBIDDEN_FILES:
            findings.append(f"forbidden file: {relative}")
            continue
        text = read_text(path)
        if text is None:
            continue
        if text.startswith("<read error:"):
            findings.append(f"{relative}: {text}")
            continue
        scan_text(str(relative), text, findings)
        if path.suffix == ".json":
            try:
                inspect_json(json.loads(text), str(relative), findings)
            except json.JSONDecodeError as error:
                findings.append(f"invalid JSON: {relative}: {error}")

    git_dir = root / ".git"
    if git_dir.exists():
        result = subprocess.run(
            ["git", "-C", str(root), "diff", "--cached", "--no-ext-diff", "--no-color"],
            check=False,
            capture_output=True,
            text=True,
        )
        if result.returncode != 0:
            findings.append(f"could not read staged changes: {result.stderr.strip()}")
        else:
            added_lines = "\n".join(
                line[1:]
                for line in result.stdout.splitlines()
                if line.startswith("+") and not line.startswith("+++")
            )
            scan_text("staged changes", added_lines, findings)
    return findings


def main() -> int:
    root = Path(sys.argv[1] if len(sys.argv) > 1 else ".").resolve()
    findings = scan_repo(root)
    if findings:
        print("Credential scan failed:", file=sys.stderr)
        for finding in findings:
            print(f"  - {finding}", file=sys.stderr)
        return 1
    print(f"Credential scan clean: {root}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
