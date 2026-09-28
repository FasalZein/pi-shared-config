#!/usr/bin/env python3
"""Shared provider and model-id policy for the portable Pi setup."""

RETAINED_PROVIDERS = ("anthropic", "openai-codex", "kiro", "cpa", "gnrt", "grok-cli")


def model_allowed(value: str, *, provider: str | None = None) -> bool:
    """Return whether a route or model id matches the retained model policy.

    A route may include a thinking suffix after the first colon. When the value
    has no provider, provider is the models.json provider that owns the id.
    A grok-cli model id must be nonempty and start with grok-. Any other
    retained provider must use a model id that starts with claude- or gpt-.
    """
    route = value.split(":", 1)[0]
    route_provider, _, model_id = route.rpartition("/")
    provider_name = route_provider or provider
    if provider_name not in RETAINED_PROVIDERS:
        return False
    if provider_name == "grok-cli":
        return model_id.startswith("grok-")
    return model_id.startswith(("claude-", "gpt-"))


def agent_model_allowed(value: str) -> bool:
    """Return whether an agent route matches the retained model policy.

    GPT routes must use openai-codex. Other rules match model_allowed.
    """
    if not model_allowed(value):
        return False
    route = value.split(":", 1)[0]
    route_provider, model_id = route.rsplit("/", 1)
    if model_id.startswith("gpt-"):
        return route_provider == "openai-codex"
    return True
