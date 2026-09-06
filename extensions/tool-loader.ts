import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

// Tools hidden until first use, via pi's loader-tool pattern
// (docs/extensions.md "Dynamic tool loading"). On Anthropic Fable ≥4.5 and
// OpenAI gpt-5.4+ pi sends hidden definitions as deferred schemas, so they cost
// ~0 tokens until load_tools names them. Their promptSnippet and
// promptGuidelines also leave the system prompt while hidden.
//
// Measured 2026-09-02 (o200k×1.6): lsp 592, ast_grep ×2 831, linear ×2 707,
// fold 311, plus ~200 tokens of guidelines — ~2,650 per session.
export const DEFERRED_TOOLS: Readonly<Record<string, string>> = {
	lsp: "diagnostics, definition, references, hover, rename, code actions",
	ast_grep_search: "structural code search with $VAR/$$$ patterns",
	ast_grep_replace: "structural code rewrite, dry-run by default",
	linear: "Linear issues, comments, projects, cycles, documents",
	linear_get_result: "read a stored Linear result handle",
	fold: "run many read/grep/find/ls calls in one JS body, return one small value",
};

export const LOADER_TOOL = "load_tools";

export function isDeferred(name: string): boolean {
	return Object.hasOwn(DEFERRED_TOOLS, name);
}

/** Active set for session start: everything except the deferred tools. */
export function initialActiveTools(active: readonly string[]): string[] {
	return active.filter((name) => !isDeferred(name));
}

/** Split a load request into names to add and names that are not loadable. */
export function planLoad(
	requested: readonly string[],
	registered: ReadonlySet<string>,
): { load: string[]; unknown: string[] } {
	const load: string[] = [];
	const unknown: string[] = [];
	for (const name of new Set(requested)) {
		if (isDeferred(name) && registered.has(name)) load.push(name);
		else unknown.push(name);
	}
	return { load, unknown };
}

export function loaderDescription(): string {
	const menu = Object.entries(DEFERRED_TOOLS)
		.map(([name, what]) => `${name} (${what})`)
		.join("; ");
	return `Load hidden tools into this session; they stay loaded. Available: ${menu}. Call once with every name the task needs.`;
}

export default function toolLoader(pi: ExtensionAPI) {
	// A child launched by pi-subagents gets its tool set from its agent file.
	if (process.env.PI_SUBAGENT_NAME) return;

	pi.registerTool({
		name: LOADER_TOOL,
		label: "Load tools",
		description: loaderDescription(),
		// Plain JSON schema (what TypeBox produces) so tests import this file
		// without pi's module resolution.
		parameters: {
			type: "object",
			properties: {
				tools: {
					type: "array",
					items: { type: "string" },
					description: "Names from the available list",
				},
			},
			required: ["tools"],
		} as never,
		async execute(_toolCallId, params: { tools: string[] }) {
			const registered = new Set(pi.getAllTools().map((tool) => tool.name));
			const { load, unknown } = planLoad(params.tools, registered);
			if (load.length > 0) {
				// Additive on purpose: pi records the added names on this tool
				// result and exposes them as deferred definitions where supported.
				pi.setActiveTools([...new Set([...pi.getActiveTools(), ...load])]);
			}
			const lines = [
				load.length > 0 ? `Loaded: ${load.join(", ")}` : "Nothing loaded.",
				unknown.length > 0 ? `Not loadable: ${unknown.join(", ")}` : "",
			].filter(Boolean);
			return { content: [{ type: "text", text: lines.join("\n") }], details: { load, unknown } };
		},
	});

	// Hide on the first turn, not at session_start: pi-linear asserts its own
	// initial active set during session_start, and hiding `linear` before that
	// check runs would trip it.
	let hidden = false;
	pi.on("session_start", () => {
		hidden = false;
	});
	pi.on("before_agent_start", () => {
		if (hidden) return;
		hidden = true;
		pi.setActiveTools(initialActiveTools(pi.getActiveTools()));
	});
}
