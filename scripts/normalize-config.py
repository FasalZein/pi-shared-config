#!/usr/bin/env python3
# pyright: reportAny=false, reportUnknownMemberType=false, reportUnknownVariableType=false, reportUnknownArgumentType=false, reportUnusedCallResult=false
"""Apply the repository's portable package and model policy after a live sync."""

import json
from pathlib import Path

from model_policy import RETAINED_PROVIDERS, model_allowed

ROOT = Path(__file__).resolve().parent.parent

manifest = json.loads((ROOT / "extension-manifest.json").read_text())
PACKAGES = manifest["packages"]
PIN_BY_NAME = {
    "edxeth/pi-claude-auth": PACKAGES[0],
    "edxeth/pi-subagents": PACKAGES[1],
    "edxeth/pi-tasks": PACKAGES[2],
    "@howaboua/pi-codex-conversion": PACKAGES[3],
    "edxeth/pi-better-skills": PACKAGES[4],
    "@eko24ive/pi-ask": PACKAGES[5],
    "eko24ive/pi-ask": PACKAGES[5],
    "pi-fancy-footer": PACKAGES[6],
    "edxeth/pi-ralph-loop": PACKAGES[7],
    "pi-grok-cli": PACKAGES[8],
}
REMOVED_TOOLS = {"lsp", "ast_grep_search", "fold"}


def canonical_extension(value: str) -> str | None:
    value = value.strip()
    if value in {"~/.pi/agent/extensions/pi-tps.ts", "~/.pi/agent/extensions/skill-gate.ts"}:
        return value
    if value.startswith("git:github.com/"):
        name = value.removeprefix("git:github.com/").split("@", 1)[0]
        return PIN_BY_NAME.get(name)
    if value.startswith("npm:"):
        name = value.removeprefix("npm:")
        if name.startswith("@"):
            name = name.rsplit("@", 1)[0]
        else:
            name = name.split("@", 1)[0]
        return PIN_BY_NAME.get(name)
    return None


def normalize_settings() -> None:
    path = ROOT / "settings.json"
    data = json.loads(path.read_text())
    data["enabledModels"] = [model for model in data.get("enabledModels", []) if model_allowed(model)]
    data["packages"] = PACKAGES
    data["extensions"] = []
    data.pop("lsp", None)
    path.write_text(json.dumps(data, indent=2) + "\n")


def allowed_models(provider: str, models: list[dict[str, object]]) -> list[dict[str, object]]:
    return [model for model in models if model_allowed(str(model["id"]), provider=provider)]


def allowed_model_overrides(provider: str, overrides: dict[str, object]) -> dict[str, object]:
    return {
        model_id: value
        for model_id, value in overrides.items()
        if model_allowed(model_id, provider=provider)
    }


def normalize_provider(name: str, provider: dict[str, object]) -> dict[str, object]:
    if "models" in provider:
        models = provider["models"]
        assert isinstance(models, list)
        provider["models"] = allowed_models(name, models)
    if "modelOverrides" in provider:
        overrides = provider["modelOverrides"]
        assert isinstance(overrides, dict)
        provider["modelOverrides"] = allowed_model_overrides(name, overrides)
    return provider


def normalize_models() -> None:
    path = ROOT / "models.json"
    data = json.loads(path.read_text())
    providers = data.get("providers", {})
    kept = {name: normalize_provider(name, providers[name]) for name in RETAINED_PROVIDERS}
    path.write_text(json.dumps({"providers": kept}, indent=2) + "\n")


def normalize_extensions_line(line: str) -> str:
    values = [canonical_extension(value) for value in line.split(":", 1)[1].split(",")]
    kept = [value for value in dict.fromkeys(values) if value is not None]
    return "extensions: " + ", ".join(kept)


def normalize_tools_line(line: str) -> str:
    tools = [value.strip() for value in line.split(":", 1)[1].split(",")]
    return "tools: " + ",".join(tool for tool in tools if tool not in REMOVED_TOOLS)


def canonical_agent_model(value: str) -> str:
    route, separator, thinking = value.partition(":")
    provider, model_id = route.rsplit("/", 1)
    if model_id.startswith("gpt-"):
        provider = "openai-codex"
    normalized = f"{provider}/{model_id}"
    return f"{normalized}:{thinking}" if separator else normalized


def normalize_allowed_models_line(line: str) -> str:
    values = [value.strip() for value in line.split(":", 1)[1].split(",")]
    return "allowed-models: " + ", ".join(
        canonical_agent_model(value) for value in values if model_allowed(value)
    )


def normalize_model_line(path: Path, line: str) -> str:
    key, value = line.split(":", 1)
    value = value.strip()
    if model_allowed(value):
        return f"{key}: {canonical_agent_model(value)}"
    raise SystemExit(f"no Claude, GPT, or grok-cli replacement specified for {path}: {line}")


def normalize_frontmatter_line(path: Path, line: str) -> str:
    if line.startswith("extensions:"):
        return normalize_extensions_line(line)
    if line.startswith("tools:"):
        return normalize_tools_line(line)
    if line.startswith("allowed-models:"):
        return normalize_allowed_models_line(line)
    if line.startswith(("model:", "llm-as-a-verifier-model:")):
        return normalize_model_line(path, line)
    return line


def replace_removed_tool_instructions(text: str) -> str:
    replacements = [
        ("After every TypeScript edit, read the post-edit `lsp` diagnostics and fix type errors before moving on; use `lsp` `find_references` before renaming a component or prop.", "After every TypeScript edit, run the project typecheck and fix errors before moving on. Search all callers before renaming a component or prop."),
        ("Before changing a shared symbol, run `lsp` references.", "Before changing a shared symbol, search for every reference."),
        ("- For any fan-out (scanning many files, counting/grouping matches, reading a tree), use one `fold` call — its nested reads and greps stay out of your context and only the returned value lands. A `bash` loop with compact output is the fallback.\n- Prefer `lsp` for symbol definitions, references, and types. Fall back to text search when the language server cannot answer.\n- Use `ast_grep_search` only for syntax shapes text search cannot express reliably (calls regardless of formatting, structural patterns, API-migration shapes). Lexical first, AST second.", "- For any fan-out, use one bounded `bash` command with compact output.\n- Use targeted text search for symbol definitions and references. Read the best matches before searching again."),
        ("- ticket or spec context the review depends on is absent from your brief (you have no Linear access; it arrives as a ticket-brief artifact path)", "- ticket or spec context the review depends on is absent from your brief"),
        ("- Prefer static inspection first. Confirm structural smells (Duplicated Code, Repeated Switches, Shotgun Surgery) with `ast_grep_search` when text grep is ambiguous — a pattern match across files is evidence, a hunch is not.", "- Prefer static inspection first. Confirm structural smells with targeted searches across files. A repeated match is evidence; a hunch is not."),
        ("2. Use `lsp` (`goto_definition`, `find_references`, `diagnostics`) to check a symbol's callers and types before rating a finding; fall back to text search only when the server cannot answer.", "2. Use targeted text search and the project typecheck to check a symbol's callers and types before rating a finding."),
        ("- For symbol definitions and references, use `ast_grep_search` for structural matches and `rg -n -w` for names.", "- For symbol definitions and references, use targeted text search for structural matches and `rg -n -w` for names."),
        ("- Use `ast_grep_search` only for syntax shapes text search cannot express reliably (calls regardless of formatting, structural patterns, API-migration shapes). Lexical first, AST second.", "- Use targeted text search for symbol definitions and references. Read the best matches before searching again."),
        ("use `ast_grep_search` to enumerate matching shapes", "use targeted text search to enumerate matching shapes"),
        ("find every caller with `ast_grep_search` or `rg -n -w`", "find every caller with `rg -n -w`"),
        ("2. Check a symbol's definition and callers (`ast_grep_search` or `rg -n -w`) and its types (the project's type checker) before rating a finding.", "2. Check a symbol's definition and callers (`rg -n -w`) and its types (the project's type checker) before rating a finding."),
    ]
    for old, new in replacements:
        text = text.replace(old, new)
    return text


def normalize_agent(path: Path) -> None:
    parts = path.read_text().split("---", 2)
    if len(parts) != 3:
        raise SystemExit(f"missing frontmatter: {path}")
    frontmatter = [normalize_frontmatter_line(path, line) for line in parts[1].splitlines()]
    parts[1] = "\n".join(frontmatter) + "\n"
    path.write_text(replace_removed_tool_instructions("---".join(parts)))


def normalize_agents() -> None:
    for path in sorted((ROOT / "agents").glob("*.md")):
        normalize_agent(path)


normalize_settings()
normalize_models()
normalize_agents()
