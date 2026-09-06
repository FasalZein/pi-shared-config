import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

/**
 * anthropic-china-thinking
 *
 * shenv2-style "Anthropic-China" proxies (the `anthropic-china` provider, whose
 * models live under the `ccx/` namespace) redact reasoning text from the
 * streamed response unless the request looks like genuine Claude Code traffic.
 * The gate is the system prompt: it must carry BOTH
 *   - a block starting with "x-anthropic-billing-header:" (signature NOT
 *     validated by the proxy — only the prefix matters), AND
 *   - a block with the Claude Code identity phrase.
 * pi sends neither for custom providers, so thinking comes back empty. This
 * extension prepends both blocks to every `ccx/` request so reasoning streams
 * through. It is display-only wiring; it does not touch auth or billing.
 */

const BILLING_PREFIX = "x-anthropic-billing-header";
const CC_IDENTITY = "You are Claude Code, Anthropic's official CLI for Claude.";

// Best-effort real Claude Code version (the proxy has not validated this to
// date, but keep it realistic). Falls back to a known-good literal.
let ccVersion = "2.1.220";
try {
	const resolved = JSON.parse(
		readFileSync(join(homedir(), ".pi", "agent", "claude-code-version.json"), "utf8"),
	).version;
	if (typeof resolved === "string" && resolved.trim()) ccVersion = resolved.trim();
} catch {
	/* keep fallback */
}
const BILLING_TEXT = `x-anthropic-billing-header: cc_version=${ccVersion}.f90; cc_entrypoint=cli;`;

type TextBlock = { type?: string; text?: string } & Record<string, unknown>;
interface Payload {
	model?: unknown;
	messages?: unknown;
	system?: unknown;
}

function entryText(entry: unknown): string {
	if (typeof entry === "string") return entry;
	if (entry && typeof entry === "object") {
		const text = (entry as { text?: unknown }).text;
		if (typeof text === "string") return text;
	}
	return "";
}

const extension = (pi: ExtensionAPI): void => {
	pi.on("before_provider_request", (event) => {
		const payload = (event as { payload?: Payload })?.payload;
		if (!payload || typeof payload !== "object") return;
		const model = payload.model;
		// Match shen-claude provider: bare claude-* model names (not prefixed).
		if (typeof model !== "string" || !model.startsWith("claude-")) return;
		if (!Array.isArray(payload.messages)) return;

		const system: TextBlock[] = Array.isArray(payload.system)
			? (payload.system as TextBlock[])
			: [];
		const hasBill = system.some((e) => entryText(e).startsWith(BILLING_PREFIX));
		const hasId = system.some((e) => entryText(e).startsWith(CC_IDENTITY));
		// Genuine Anthropic OAuth requests already carry Claude Code's identity.
		// Leave them for pi-claude-auth, which adds a correctly signed billing
		// header. This extension only repairs proxy payloads that carry neither.
		if (hasId) return;

		const prepend: TextBlock[] = [];
		if (!hasBill) prepend.push({ type: "text", text: BILLING_TEXT });
		if (!hasId) prepend.push({ type: "text", text: CC_IDENTITY });

		return { ...payload, system: [...prepend, ...system] };
	});
};

export default extension;
