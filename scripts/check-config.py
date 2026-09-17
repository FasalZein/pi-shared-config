#!/usr/bin/env python3
# pyright: reportAny=false, reportUnknownMemberType=false, reportUnknownVariableType=false, reportUnknownArgumentType=false, reportUnusedCallResult=false
"""Check the portable Pi configuration policy."""

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
EXPECTED_PACKAGES = [
    "git:github.com/edxeth/pi-claude-auth@d99968e317b1132efdac7f1722380922af27af62",
    "git:github.com/edxeth/pi-subagents@37c375bf13e3ac0e034856a54a56e62e4ecc6f8a",
    "git:github.com/edxeth/pi-tasks@d4b07692427199d3db4f9f5e6441d9c82ee612d4",
    "npm:@howaboua/pi-codex-conversion@3.0.34",
    "git:github.com/edxeth/pi-better-skills@2deaf5c4b5e93ccd3c1b464c6a2dc3f24cd46205",
    "npm:@eko24ive/pi-ask@1.2.0",
    "npm:pi-fancy-footer@3.0.1",
    "git:github.com/edxeth/pi-ralph-loop@108823f8d1e2089fec1f7202ca3a8905d12df574",
    "npm:pi-grok-cli@0.8.2",
]
ALLOWED_AGENT_EXTENSIONS = set(EXPECTED_PACKAGES) | {"~/.pi/agent/extensions/pi-tps.ts"}
EXPECTED_PROVIDERS = {"anthropic", "openai-codex", "kiro", "cpa", "gnrt"}
FORBIDDEN_TOOLS = {"lsp", "ast_grep_search", "fold"}
MATT_POCOCK_SKILLS = {
    "ask-matt", "code-review", "codebase-design", "diagnosing-bugs", "domain-modeling",
    "grill-me", "grill-with-docs", "grilling", "handoff", "implement",
    "improve-codebase-architecture", "research", "resolving-merge-conflicts",
    "setup-matt-pocock-skills", "tdd", "teach", "to-questionnaire", "to-spec",
    "to-tickets", "triage", "wait-what", "wayfinder", "wizard", "writing-for-agents",
}
RESEARCH_SKILLS = {
    "find-standards", "why", "context7", "exa", "firecrawl", "tinyfish",
    "convert-documents-to-markdown", "technical-writing",
}
EXPECTED_UNLOCKED_AGENT_SKILLS = {"design-md", "find-standards", "ponytail-review"}
errors: list[str] = []


def model_allowed(value: str) -> bool:
    model_id = value.split(":", 1)[0].rsplit("/", 1)[-1]
    return model_id.startswith(("claude-", "gpt-"))


def agent_model_allowed(value: str) -> bool:
    route = value.split(":", 1)[0]
    provider, model_id = route.rsplit("/", 1)
    if model_id.startswith("gpt-"):
        return provider == "openai-codex"
    return model_id.startswith("claude-")


def fail(message: str) -> None:
    errors.append(message)


settings = json.loads((ROOT / "settings.json").read_text())
if settings.get("packages") != EXPECTED_PACKAGES:
    fail("settings.json packages do not match the exact retained package list")
if settings.get("extensions") != []:
    fail("settings.json extensions must be empty; pi-tps uses extension auto-discovery")
for model in settings.get("enabledModels", []):
    if not model_allowed(model):
        fail(f"settings.json enables a non-Claude/GPT model: {model}")

models = json.loads((ROOT / "models.json").read_text())
providers = models.get("providers", {})
if set(providers) != EXPECTED_PROVIDERS:
    fail(f"models.json providers must be exactly {sorted(EXPECTED_PROVIDERS)}")
for provider_name, provider in providers.items():
    for model in provider.get("models", []):
        if not model_allowed(model["id"]):
            fail(f"models.json has a non-Claude/GPT model: {provider_name}/{model['id']}")
    for model_id in provider.get("modelOverrides", {}):
        if not model_allowed(model_id):
            fail(f"models.json has a non-Claude/GPT override: {provider_name}/{model_id}")

agent_dir = ROOT / "agents"
if (agent_dir / "linear.md").exists():
    fail("agents/linear.md must not exist")
for path in sorted(agent_dir.glob("*.md")):
    text = path.read_text()
    parts = text.split("---", 2)
    if len(parts) != 3:
        fail(f"{path.relative_to(ROOT)} has invalid frontmatter")
        continue
    frontmatter = parts[1]
    for key in ("model", "llm-as-a-verifier-model"):
        match = re.search(rf"^{key}:\s*(.+)$", frontmatter, re.MULTILINE)
        if match and not agent_model_allowed(match.group(1).strip()):
            fail(f"{path.relative_to(ROOT)} has a non-Claude/GPT {key}: {match.group(1)}")
    match = re.search(r"^allowed-models:\s*(.*)$", frontmatter, re.MULTILINE)
    if match:
        for model in match.group(1).split(","):
            if model.strip() and not agent_model_allowed(model.strip()):
                fail(f"{path.relative_to(ROOT)} allows a non-Claude/GPT model: {model.strip()}")
    match = re.search(r"^extensions:\s*(.*)$", frontmatter, re.MULTILINE)
    if match:
        for extension in match.group(1).split(","):
            extension = extension.strip()
            if extension and extension not in ALLOWED_AGENT_EXTENSIONS:
                fail(f"{path.relative_to(ROOT)} uses a rejected extension: {extension}")
    match = re.search(r"^tools:\s*(.*)$", frontmatter, re.MULTILINE)
    if match:
        tools = {tool.strip() for tool in match.group(1).split(",")}
        for tool in sorted(tools & FORBIDDEN_TOOLS):
            fail(f"{path.relative_to(ROOT)} claims unavailable tool: {tool}")
    for tool in FORBIDDEN_TOOLS:
        if re.search(rf"`{re.escape(tool)}`|\b{re.escape(tool)}\b", parts[2]):
            fail(f"{path.relative_to(ROOT)} instructions claim unavailable tool: {tool}")

lock = json.loads((ROOT / "skills/.skill-lock.json").read_text())
locked_skills = set(lock.get("skills", {}))
symlink_manifest = json.loads((ROOT / "skills/symlinks.json").read_text())
symlinked_skills = set(symlink_manifest.get("links", {}))
vendor_skills = {path.name for path in (ROOT / "skills").iterdir() if path.is_dir()}
available_skills = locked_skills | symlinked_skills | vendor_skills
if not MATT_POCOCK_SKILLS <= locked_skills:
    fail(f"Matt Pocock lock entries are missing: {sorted(MATT_POCOCK_SKILLS - locked_skills)}")
for skill in sorted(MATT_POCOCK_SKILLS & locked_skills):
    if lock["skills"][skill].get("source") != "mattpocock/skills":
        fail(f"{skill} does not use the Matt Pocock skill source")
if not RESEARCH_SKILLS <= available_skills:
    fail(f"research skills are missing: {sorted(RESEARCH_SKILLS - available_skills)}")
if not {"bro", "cmux", "msw"} <= vendor_skills:
    fail("one or more vendored local skills are missing")
if {"to-prd", "to-slices"} & symlinked_skills:
    fail("retired to-prd or to-slices skill links are present")
metadata = json.loads((ROOT / "skills/managed-metadata.json").read_text())
if metadata.get("grill-me", {}).get("disable-model-invocation") is not True:
    fail("grill-me must remain command-only")
if "grill-me" not in locked_skills:
    fail("grill-me is missing from the managed skill lock")

referenced_skills: set[str] = set()
for path in sorted(agent_dir.glob("*.md")):
    parts = path.read_text().split("---", 2)
    if len(parts) != 3:
        continue
    frontmatter = parts[1]
    for key in ("skills", "inject-skills"):
        match = re.search(rf"^{key}:\s*(.*)$", frontmatter, re.MULTILINE)
        if match:
            referenced_skills.update(
                value.strip().split("=", 1)[0]
                for value in match.group(1).split(",")
                if value.strip()
            )
missing_agent_skills = referenced_skills - available_skills
if missing_agent_skills:
    fail(f"agent skills are unavailable: {sorted(missing_agent_skills)}")
unlocked_agent_skills = (referenced_skills & symlinked_skills) - locked_skills
if unlocked_agent_skills != EXPECTED_UNLOCKED_AGENT_SKILLS:
    fail(f"unexpected unlocked agent skills: {sorted(unlocked_agent_skills)}")

extension_entries = {path.name for path in (ROOT / "extensions").iterdir()}
if extension_entries != {"pi-tps.ts", "eko24ive-pi-ask.json"}:
    fail(f"extensions directory has unexpected entries: {sorted(extension_entries)}")

manifest = json.loads((ROOT / "extension-manifest.json").read_text())
if manifest.get("packages") != EXPECTED_PACKAGES:
    fail("extension-manifest.json does not match the exact retained package list")

for path in ROOT.rglob("*"):
    if not path.is_file() or ".git" in path.parts:
        continue
    try:
        text = path.read_text()
    except UnicodeDecodeError:
        continue
    if path == Path(__file__).resolve():
        continue
    if "/Users/tothemoon/Dev/AI/pi/extensions" in text or "~/Dev/AI/pi/extensions" in text:
        fail(f"{path.relative_to(ROOT)} contains a stale local extension path")

if errors:
    for error in errors:
        print(f"ERROR: {error}")
    raise SystemExit(1)
print("Configuration policy check passed.")
