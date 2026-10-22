#!/usr/bin/env python3
# pyright: reportAny=false, reportUnknownMemberType=false, reportUnknownVariableType=false, reportUnknownArgumentType=false, reportUnknownLambdaType=false, reportUnusedCallResult=false, reportAttributeAccessIssue=false, reportArgumentType=false, reportReturnType=false
"""Exercise acceptance and rejection branches in the portable policy checker."""

import json
import shutil
import subprocess
import tempfile
from collections.abc import Callable
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MATT_SKILLS = {
    "ask-matt", "code-review", "codebase-design", "diagnosing-bugs", "domain-modeling",
    "grill-me", "grill-with-docs", "grilling", "handoff", "implement",
    "improve-codebase-architecture", "research",
    "setup-matt-pocock-skills", "tdd", "teach", "to-questionnaire", "to-spec",
    "to-tickets", "triage", "wait-what", "wayfinder", "wizard", "writing-for-agents",
}
RESEARCH_SKILLS = {
    "find-standards", "why", "context7", "exa", "firecrawl", "tinyfish",
    "convert-documents-to-markdown", "technical-writing",
}


def read_json(path: Path) -> dict[str, object]:
    return json.loads(path.read_text())


def write_json(path: Path, value: object) -> None:
    path.write_text(json.dumps(value, indent=2) + "\n")


def copy_repository(target: Path) -> None:
    shutil.copytree(
        ROOT,
        target,
        symlinks=True,
        ignore=shutil.ignore_patterns(".git", "node_modules", "coverage", ".coverage", "__pycache__"),
    )


def checker(root: Path) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["python3", str(root / "scripts/check-config.py")],
        cwd=root,
        text=True,
        capture_output=True,
        check=False,
    )


def expect_rejection(name: str, mutate: Callable[[Path], None], message: str) -> None:
    with tempfile.TemporaryDirectory(prefix="policy-matrix-") as temporary:
        root = Path(temporary) / "repo"
        copy_repository(root)
        mutate(root)
        result = checker(root)
        output = result.stdout + result.stderr
        if result.returncode == 0:
            raise AssertionError(f"{name}: checker accepted invalid configuration")
        if message not in output:
            raise AssertionError(f"{name}: expected {message!r}, got {output!r}")


def expect_acceptance(name: str, mutate: Callable[[Path], None]) -> None:
    with tempfile.TemporaryDirectory(prefix="policy-matrix-") as temporary:
        root = Path(temporary) / "repo"
        copy_repository(root)
        mutate(root)
        result = checker(root)
        if result.returncode != 0:
            raise AssertionError(f"{name}: checker rejected valid configuration: {result.stdout}{result.stderr}")


def update_json(path: Path, change: Callable[[dict[str, object]], None]) -> None:
    value = read_json(path)
    change(value)
    write_json(path, value)


def replace(path: Path, old: str, new: str) -> None:
    text = path.read_text()
    if old not in text:
        raise AssertionError(f"fixture text missing in {path}: {old!r}")
    path.write_text(text.replace(old, new, 1))


def set_verifier_model(root: Path, route: str) -> None:
    # No retained agent sets a verifier model, so add one to a test copy of worker.
    replace(
        root / "agents/worker.md",
        "\nmodel: anthropic/claude-opus-5-5",
        f"\nmodel: anthropic/claude-opus-5-5\nllm-as-a-verifier-model: {route}",
    )


def remove_skill(root: Path, skill: str) -> None:
    lock_path = root / "skills/.skill-lock.json"
    links_path = root / "skills/symlinks.json"
    lock = read_json(lock_path)
    skills = lock.get("skills", {})
    assert isinstance(skills, dict)
    skills.pop(skill, None)
    write_json(lock_path, lock)
    links = read_json(links_path)
    linked = links.get("links", {})
    assert isinstance(linked, dict)
    linked.pop(skill, None)
    write_json(links_path, links)
    local = root / "skills" / skill
    if local.is_symlink() or local.is_file():
        local.unlink()
    elif local.is_dir():
        shutil.rmtree(local)


baseline = checker(ROOT)
if baseline.returncode != 0:
    raise AssertionError(f"valid repository rejected: {baseline.stdout}{baseline.stderr}")

expect_rejection(
    "package allowlist",
    lambda root: update_json(root / "settings.json", lambda value: value.__setitem__("packages", ["npm:rejected@1"])),
    "packages do not match",
)
expect_rejection(
    "settings extension list",
    lambda root: update_json(root / "settings.json", lambda value: value.__setitem__("extensions", ["/tmp/rejected.ts"])),
    "extensions must be empty",
)
expect_rejection(
    "enabled model",
    lambda root: update_json(root / "settings.json", lambda value: value.__setitem__("enabledModels", ["cursor/grok-4"])),
    "enables a model outside Claude, GPT, and grok-cli",
)
for personal_route in ("kiro/claude-opus-4-8-thinking", "cpa/gpt-6-sol", "gnrt/claude-opus-5"):
    expect_rejection(
        f"personal provider route {personal_route}",
        lambda root, route=personal_route: update_json(root / "settings.json", lambda value: value["enabledModels"].append(route)),  # type: ignore[union-attr]
        "enables a model outside Claude, GPT, and grok-cli",
    )
expect_rejection(
    "pinned package",
    lambda root: update_json(root / "settings.json", lambda value: value.__setitem__("packages", [f"{package}@1.0.0" for package in value["packages"]])),  # type: ignore[union-attr]
    "packages do not match",
)
for provider in ("anthropic", "openai-codex", "grok-cli"):
    def remove_provider(root: Path, name: str = provider) -> None:
        update_json(root / "models.json", lambda value: value["providers"].pop(name))  # type: ignore[union-attr]
    expect_rejection(f"provider {provider}", remove_provider, "providers must be exactly")


def reject_provider_model(root: Path) -> None:
    def change(value: dict[str, object]) -> None:
        providers = value["providers"]
        assert isinstance(providers, dict)
        provider = providers["anthropic"]
        assert isinstance(provider, dict)
        provider["models"] = [{"id": "grok-4"}]
    update_json(root / "models.json", change)


expect_rejection("provider model", reject_provider_model, "has a model outside Claude, GPT, and grok-cli")


def reject_override(root: Path) -> None:
    def change(value: dict[str, object]) -> None:
        providers = value["providers"]
        assert isinstance(providers, dict)
        provider = providers["anthropic"]
        assert isinstance(provider, dict)
        provider["modelOverrides"] = {"grok-4": {}}
    update_json(root / "models.json", change)


expect_rejection("provider override", reject_override, "has an override outside Claude, GPT, and grok-cli")
expect_rejection("retired forge agent", lambda root: (root / "agents/forge.md").write_text("---\nmodel: anthropic/claude-opus-5\n---\n"), "forge.md must not exist")
expect_rejection("retired linear agent", lambda root: (root / "agents/linear.md").write_text("---\nmodel: anthropic/claude-opus-5\n---\n"), "linear.md must not exist")
expect_rejection("invalid frontmatter", lambda root: (root / "agents/worker.md").write_text("---\nmodel: openai-codex/gpt-5.6-sol\n"), "invalid frontmatter")
expect_rejection("agent model", lambda root: replace(root / "agents/worker.md", "\nmodel: anthropic/claude-opus-5-5", "\nmodel: cursor/grok-4"), "has a model outside Claude, GPT, and grok-cli")
expect_rejection("CPA agent model", lambda root: replace(root / "agents/worker.md", "\nmodel: anthropic/claude-opus-5-5", "\nmodel: cpa/gpt-5.6-sol"), "has a model outside Claude, GPT, and grok-cli")
expect_acceptance("verifier model", lambda root: set_verifier_model(root, "anthropic/claude-opus-5-5:high"))
expect_rejection("verifier model", lambda root: set_verifier_model(root, "cursor/grok-4"), "has a llm-as-a-verifier-model outside Claude, GPT, and grok-cli")
expect_rejection("allowed model", lambda root: replace(root / "agents/worker.md", "\nallowed-models:", "\nallowed-models: cursor/grok-4,"), "allows a model outside Claude, GPT, and grok-cli")
expect_rejection("CPA allowed model", lambda root: replace(root / "agents/worker.md", "\nallowed-models:", "\nallowed-models: cpa/gpt-5.6-sol,"), "allows a model outside Claude, GPT, and grok-cli")
expect_rejection("agent extension", lambda root: replace(root / "agents/worker.md", "\nextensions:", "\nextensions: /tmp/rejected.ts,"), "uses a rejected extension")
for tool in ("lsp", "ast_grep_search", "fold"):
    expect_rejection(
        f"frontmatter tool {tool}",
        lambda root, name=tool: replace(root / "agents/worker.md", "\ntools:", f"\ntools: {name},"),
        f"claims unavailable tool: {tool}",
    )
    expect_rejection(
        f"instruction tool {tool}",
        lambda root, name=tool: (root / "agents/worker.md").write_text((root / "agents/worker.md").read_text() + f"\nUse `{name}`.\n"),
        f"instructions claim unavailable tool: {tool}",
    )

for skill in sorted(MATT_SKILLS):
    expect_rejection(
        f"Matt skill {skill}",
        lambda root, name=skill: remove_skill(root, name),
        "Matt Pocock lock entries are missing",
    )


def wrong_matt_source(root: Path) -> None:
    def change(value: dict[str, object]) -> None:
        skills = value["skills"]
        assert isinstance(skills, dict)
        entry = skills["tdd"]
        assert isinstance(entry, dict)
        entry["source"] = "rejected/source"
    update_json(root / "skills/.skill-lock.json", change)


expect_rejection("Matt source", wrong_matt_source, "does not use the Matt Pocock skill source")
for skill in sorted(RESEARCH_SKILLS):
    expect_rejection(
        f"research skill {skill}",
        lambda root, name=skill: remove_skill(root, name),
        "research skills are missing",
    )
for skill in ("bro", "cmux", "msw"):
    expect_rejection(
        f"vendored skill {skill}",
        lambda root, name=skill: shutil.rmtree(root / "skills" / name),
        "vendored local skills are missing",
    )


def add_retired_link(root: Path, name: str) -> None:
    def change(value: dict[str, object]) -> None:
        links = value["links"]
        assert isinstance(links, dict)
        links[name] = f"/tmp/{name}"
    update_json(root / "skills/symlinks.json", change)


for retired_link in ("to-prd", "to-slices"):
    expect_rejection(
        f"retired skill link {retired_link}",
        lambda root, name=retired_link: add_retired_link(root, name),
        "retired to-prd or to-slices",
    )
expect_rejection(
    "command-only metadata",
    lambda root: update_json(root / "skills/managed-metadata.json", lambda value: value["grill-me"].__setitem__("disable-model-invocation", False)),  # type: ignore[union-attr]
    "grill-me must remain command-only",
)
expect_rejection("grill lock", lambda root: remove_skill(root, "grill-me"), "grill-me is missing from the managed skill lock")
expect_rejection(
    "missing referenced skill",
    lambda root: replace(root / "agents/worker.md", "\nskills:", "\nskills: unavailable-skill,"),
    "agent skills are unavailable",
)


def add_unlocked_skill(root: Path) -> None:
    def change(value: dict[str, object]) -> None:
        links = value["links"]
        assert isinstance(links, dict)
        links["unexpected-unlocked"] = "/tmp/unexpected-unlocked"
    update_json(root / "skills/symlinks.json", change)
    replace(root / "agents/worker.md", "\nskills:", "\nskills: unexpected-unlocked,")


expect_rejection("unlocked agent skills", add_unlocked_skill, "unexpected unlocked agent skills")
expect_rejection("extension entries", lambda root: (root / "extensions/rejected.ts").write_text("rejected\n"), "extensions directory has unexpected entries")
expect_rejection(
    "extension manifest",
    lambda root: update_json(root / "extension-manifest.json", lambda value: value.__setitem__("packages", [])),
    "extension-manifest.json does not match",
)


def add_stale_path(root: Path) -> None:
    stale = "/Users/" + "tothemoon/Dev/AI/pi/extensions"
    (root / "stale-path.txt").write_text(stale + "\n")


expect_rejection("stale local path", add_stale_path, "contains a stale local extension path")

GROK_MODEL_IDS = (
    "grok-4.7",
    "grok-4.7-fast",
    "grok-composer-2.5-fast",
    "grok-build",
    "grok-4.7-build-fast",
)
REJECTED_ROUTES = (
    "explabs/claude-opus-5.5",
    "grok-cli/claude-x",
    "grok-cli/",
    "grok-cli/grok",
)


def set_enabled_model(root: Path, route: str) -> None:
    update_json(root / "settings.json", lambda value: value.__setitem__("enabledModels", [route]))


def set_grok_provider_model(root: Path, model_id: str) -> None:
    def change(value: dict[str, object]) -> None:
        providers = value["providers"]
        assert isinstance(providers, dict)
        provider = providers["grok-cli"]
        assert isinstance(provider, dict)
        provider["models"] = [{"id": model_id}]
    update_json(root / "models.json", change)


def set_grok_override(root: Path, model_id: str) -> None:
    def change(value: dict[str, object]) -> None:
        providers = value["providers"]
        assert isinstance(providers, dict)
        provider = providers["grok-cli"]
        assert isinstance(provider, dict)
        overrides = provider["modelOverrides"]
        assert isinstance(overrides, dict)
        overrides[model_id] = {"name": "probe"}
    update_json(root / "models.json", change)


for model_id in GROK_MODEL_IDS:
    expect_acceptance(
        f"grok-cli enabled model {model_id}",
        lambda root, model_id=model_id: set_enabled_model(root, f"grok-cli/{model_id}"),
    )
    expect_acceptance(
        f"grok-cli provider model {model_id}",
        lambda root, model_id=model_id: set_grok_provider_model(root, model_id),
    )
    expect_acceptance(
        f"grok-cli provider override {model_id}",
        lambda root, model_id=model_id: set_grok_override(root, model_id),
    )
    expect_acceptance(
        f"grok-cli agent route {model_id}",
        lambda root, model_id=model_id: replace(
            root / "agents/worker.md", "\nmodel: anthropic/claude-opus-5-5", f"\nmodel: grok-cli/{model_id}"
        ),
    )
    expect_acceptance(
        f"grok-cli allowed model {model_id}",
        lambda root, model_id=model_id: replace(
            root / "agents/worker.md", "\nallowed-models:", f"\nallowed-models: grok-cli/{model_id}:high,"
        ),
    )
    expect_acceptance(
        f"grok-cli verifier model {model_id}",
        lambda root, model_id=model_id: set_verifier_model(root, f"grok-cli/{model_id}:high"),
    )

for route in REJECTED_ROUTES:
    expect_rejection(
        f"enabled model {route}",
        lambda root, route=route: set_enabled_model(root, route),
        "enables a model outside Claude, GPT, and grok-cli",
    )
    expect_rejection(
        f"agent model {route}",
        lambda root, route=route: replace(
            root / "agents/worker.md", "\nmodel: anthropic/claude-opus-5-5", f"\nmodel: {route}"
        ),
        "has a model outside Claude, GPT, and grok-cli",
    )
    expect_rejection(
        f"allowed model {route}",
        lambda root, route=route: replace(
            root / "agents/worker.md", "\nallowed-models:", f"\nallowed-models: {route},"
        ),
        "allows a model outside Claude, GPT, and grok-cli",
    )
    expect_rejection(
        f"verifier model {route}",
        lambda root, route=route: set_verifier_model(root, route),
        "has a llm-as-a-verifier-model outside Claude, GPT, and grok-cli",
    )

for model_id in ("claude-x", "", "grok"):
    expect_rejection(
        f"grok-cli provider model {model_id!r}",
        lambda root, model_id=model_id: set_grok_provider_model(root, model_id),
        "has a model outside Claude, GPT, and grok-cli",
    )
    expect_rejection(
        f"grok-cli provider override {model_id!r}",
        lambda root, model_id=model_id: set_grok_override(root, model_id),
        "has an override outside Claude, GPT, and grok-cli",
    )


def revert_adaptation(root: Path, relative: str) -> None:
    shutil.copyfile(root / "skill-adaptations/upstream" / relative, root / "skill-adaptations/adapted" / relative)


expect_rejection(
    "spec issue in global guidance",
    lambda root: replace(root / "AGENTS.md", "never publishes a spec issue", "publishes the spec as an issue"),
    "AGENTS.md contradicts the repository specification policy",
)
expect_rejection(
    "spec issue in architect hand-off",
    lambda root: replace(root / "agents/architect.md", "SPEC: <repository path of the specification>", "- Spec issue: <number and URL>"),
    "agents/architect.md contradicts the repository specification policy",
)
expect_rejection(
    "architect vault writes",
    lambda root: replace(root / "agents/architect.md", "edit documentation, specifications", "edit documentation, vault records, specifications"),
    "agents/architect.md contradicts the repository specification policy: 'vault records'",
)
expect_rejection(
    "github spec publication",
    lambda root: replace(root / "agents/github.md", "Do not publish the specification as an issue.", "Publish the spec as the skill instructs."),
    "agents/github.md contradicts the repository specification policy",
)
for relative in ("to-spec/SKILL.md", "setup-matt-pocock-skills/issue-tracker-github.md"):
    expect_rejection(
        f"upstream {relative} restored as adapted",
        lambda root, relative=relative: revert_adaptation(root, relative),
        "contradicts the repository specification policy",
    )
for relative in ("to-tickets/SKILL.md", "setup-matt-pocock-skills/SKILL.md"):
    expect_rejection(
        f"upstream {relative} restored as adapted",
        lambda root, relative=relative: revert_adaptation(root, relative),
        f"skill adaptation {relative.split('/')[0]}/SKILL.md has no local change",
    )


def unlink_adapted_skill(root: Path) -> None:
    update_json(root / "skills/symlinks.json", lambda value: value["links"].update({"to-spec": "/tmp/pi-only-to-spec"}))


expect_rejection("Pi-only adapted skill copy", unlink_adapted_skill, "skill adaptation to-spec must stay a link to the shared skill store")


def mismatch_adaptation_hash(root: Path) -> None:
    update_json(
        root / "skills/.skill-lock.json",
        lambda value: value["skills"]["setup-matt-pocock-skills"].update({"skillFolderHash": "ec07f82df54064d01aa1648670e81da41e2cbdc2"}),
    )


expect_rejection(
    "adaptation upstream hash differs from lock",
    mismatch_adaptation_hash,
    "skill adaptation setup-matt-pocock-skills upstreamSkillFolderHash does not match the locked skillFolderHash",
)
expect_rejection(
    "architect file-path rule without spec exception",
    lambda root: replace(root / "agents/architect.md", " The canonical specification path is a reference, not an implementation detail: every ticket links to it.", ""),
    "agents/architect.md is missing repository specification policy text",
)
expect_rejection(
    "github workflow row publishes specifications",
    lambda root: replace(root / "docs/workflow.md", "prepare specification drafts for the parent or `architect` to place, and publish authorized delivery tickets", "and publish settled specifications and tickets"),
    "docs/workflow.md contradicts the repository specification policy",
)
expect_rejection(
    "local ticket template without spec field",
    lambda root: replace(root / "skill-adaptations/adapted/to-tickets/SKILL.md", "**Spec:** the canonical spec path", "the canonical spec path"),
    "to-tickets/SKILL.md is missing repository specification policy text",
)
expect_rejection(
    "missing prior adapted copy",
    lambda root: (root / "skill-adaptations/prior-adapted/to-tickets/SKILL.md").unlink(),
    "skill adaptation to-tickets/SKILL.md lists a prior adapted copy that is missing",
)

print("Policy acceptance and rejection matrix passed.")
