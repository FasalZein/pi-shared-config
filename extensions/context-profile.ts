import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

// Model-visible capability gating.
//
// A capability is a group of tools that only earn their tokens together, plus
// any ambient text that is worthless without them. Measured schema costs, from
// a real provider payload:
//
//   delegation   1,259 tool tokens + 1,764 roster + 139 rules = 3,873 measured
//   linear         726
//   code-search    521
//   interview      509
//   lsp            371
//   tasks          370
//
// Ambient total with everything on: 11,974 tokens. `lean` removes 5,659.

type Capability =
	| "delegation"
	| "linear"
	| "code-search"
	| "lsp"
	| "tasks"
	| "interview";
type Profile = "full" | "delivery" | "lean";

const PROFILE_ENTRY = "context-profile";
const PROFILES: Profile[] = ["full", "delivery", "lean"];

// A capability is defined by the extension that owns its tools, not by a list
// of tool names. pi.getAllTools() reports sourceInfo.source for every tool, so
// a tool that upstream adds later joins its capability without an edit here.
//
// `tools` is for packages that register unrelated tools. pi-hooks owns lsp plus
// other features, so naming it by source would swallow them.
type CapabilitySpec = {
	readonly sources?: readonly string[];
	readonly tools?: readonly string[];
};

const CAPABILITY_SPECS: Record<Capability, CapabilitySpec> = {
	delegation: { sources: ["pi-subagents"] },
	linear: { sources: ["pi-linear"] },
	"code-search": { sources: ["pi-ast-grep"] },
	lsp: { tools: ["lsp"] },
	tasks: { sources: ["pi-tasks"] },
	interview: { sources: ["pi-ask"] },
};

const CAPABILITIES = Object.keys(CAPABILITY_SPECS) as Capability[];

/** Tool names a capability owns, given each tool's registering extension. */
export function toolsInCapability(
	capability: Capability,
	toolSource: ReadonlyMap<string, string>,
): Set<string> {
	const spec = CAPABILITY_SPECS[capability];
	const owned = new Set<string>(spec.tools ?? []);
	for (const [tool, source] of toolSource) {
		if (spec.sources?.some((needle) => source.includes(needle))) owned.add(tool);
	}
	return owned;
}

// pi-subagents delivers the roster as a message, not as part of the system
// prompt, so setActiveTools alone leaves 1,903 tokens of roster and rules
// behind. Match the tags rather than the wording: upstream prose changes, tags
// do not. The leading [^\n]* consumes the one-line preamble above the roster.
const AMBIENT_BLOCK: Partial<Record<Capability, RegExp>> = {
	delegation: /[^\n]*\n?<subagent-roster>[\s\S]*?<\/subagent-rules>\n?/,
};

const PROFILE_OFF: Record<Profile, readonly Capability[]> = {
	full: [],
	delivery: ["lsp", "code-search"],
	lean: CAPABILITIES,
};

export function isProfile(value: string): value is Profile {
	return PROFILES.includes(value as Profile);
}

export function isCapability(value: string): value is Capability {
	return CAPABILITIES.includes(value as Capability);
}

/** Capabilities that are off, after per-capability overrides are applied. */
export function capabilitiesOff(
	profile: Profile,
	overrides: ReadonlyMap<Capability, boolean> = new Map(),
): Set<Capability> {
	const off = new Set<Capability>(PROFILE_OFF[profile]);
	for (const [capability, on] of overrides) {
		if (on) off.delete(capability);
		else off.add(capability);
	}
	return off;
}

export function toolsForProfile(
	baselineTools: readonly string[],
	profile: Profile,
	toolSource: ReadonlyMap<string, string> = new Map(),
	overrides: ReadonlyMap<Capability, boolean> = new Map(),
): string[] {
	const hidden = new Set<string>();
	for (const capability of capabilitiesOff(profile, overrides)) {
		for (const tool of toolsInCapability(capability, toolSource)) hidden.add(tool);
	}
	return baselineTools.filter((name) => !hidden.has(name));
}

export default function (pi: ExtensionAPI) {
	let baselineTools: string[] = [];
	let toolSource = new Map<string, string>();
	let profile: Profile = "full";
	let overrides = new Map<Capability, boolean>();

	function describe(): string {
		const marks = [...overrides]
			.map(([capability, on]) => `${on ? "+" : "-"}${capability}`)
			.join(" ");
		return marks ? `${profile} ${marks}` : profile;
	}

	function apply(ctx?: { ui?: { setStatus: (key: string, value?: string) => void } }) {
		pi.setActiveTools(toolsForProfile(baselineTools, profile, toolSource, overrides));
		ctx?.ui?.setStatus(PROFILE_ENTRY, `tools:${describe()}`);
	}

	function save() {
		pi.appendEntry(PROFILE_ENTRY, {
			profile,
			overrides: Object.fromEntries(overrides),
		});
	}

	pi.on("session_start", (_event, ctx) => {
		baselineTools = pi.getActiveTools();
		toolSource = new Map(
			(pi.getAllTools() as Array<{ name: string; sourceInfo?: { source?: string } }>)
				.map((tool) => [tool.name, tool.sourceInfo?.source ?? ""] as const)
				.filter(([, source]) => source !== ""),
		);
		profile = "full";
		overrides = new Map();

		for (const entry of ctx.sessionManager.getEntries()) {
			if (entry.type !== "custom" || entry.customType !== PROFILE_ENTRY) continue;
			const data = entry.data as
				| { profile?: string; overrides?: Record<string, boolean> }
				| undefined;
			if (data?.profile && isProfile(data.profile)) profile = data.profile;
			overrides = new Map();
			for (const [key, value] of Object.entries(data?.overrides ?? {})) {
				if (isCapability(key) && typeof value === "boolean") overrides.set(key, value);
			}
		}

		apply(ctx);
	});

	// Remove ambient text belonging to a capability that is off. The blocks
	// arrive as messages, so this runs on context assembly rather than on the
	// system prompt.
	pi.on("context", (event) => {
		const off = capabilitiesOff(profile, overrides);
		const patterns = [...off]
			.map((capability) => AMBIENT_BLOCK[capability])
			.filter((pattern): pattern is RegExp => pattern !== undefined);
		if (patterns.length === 0) return;

		let changed = false;
		const strip = (value: unknown): unknown => {
			if (typeof value === "string") {
				let next = value;
				for (const pattern of patterns) next = next.replace(pattern, "");
				if (next !== value) changed = true;
				return next;
			}
			if (Array.isArray(value)) return value.map(strip);
			if (value && typeof value === "object") {
				const record = { ...(value as Record<string, unknown>) };
				for (const key of ["text", "content", "parts"]) {
					if (key in record) record[key] = strip(record[key]);
				}
				return record;
			}
			return value;
		};

		const messages = event.messages.map((message) =>
			"content" in message
				? ({ ...message, content: strip(message.content) } as typeof message)
				: message,
		);
		if (!changed) return;
		return { messages };
	});

	pi.registerCommand(PROFILE_ENTRY, {
		description:
			"Show or switch tool profile: full, delivery, lean. Also: off <capability>, on <capability>",
		getArgumentCompletions(prefix) {
			const parts = prefix.split(/\s+/);
			if (parts.length > 1 && (parts[0] === "off" || parts[0] === "on")) {
				const verb = parts[0];
				return CAPABILITIES.filter((name) => name.startsWith(parts[1] ?? "")).map(
					(name) => ({
						value: `${verb} ${name}`,
						label: `${verb} ${name}`,
						description:
							[...toolsInCapability(name, toolSource)].join(", ") || "no tools loaded",
					}),
				);
			}
			return [...PROFILES, "off", "on"]
				.filter((name) => name.startsWith(prefix))
				.map((name) => ({
					value: name,
					label: name,
					description:
						name === "full"
							? "Every capability on"
							: name === "delivery"
								? "Hide lsp and code-search"
								: name === "lean"
									? "Hide every capability; file tools only"
									: `${name} <capability>`,
				}));
		},
		handler: async (args, ctx) => {
			const parts = args.trim().toLowerCase().split(/\s+/).filter(Boolean);

			if (parts.length === 0) {
				const off = capabilitiesOff(profile, overrides);
				ctx.ui.notify(
					`Context profile: ${describe()}${off.size ? ` — off: ${[...off].join(", ")}` : ""}`,
					"info",
				);
				return;
			}

			if (parts[0] === "off" || parts[0] === "on") {
				const capability = parts[1];
				if (!capability || !isCapability(capability)) {
					ctx.ui.notify(`Use: /context-profile ${parts[0]} ${CAPABILITIES.join("|")}`, "warning");
					return;
				}
				overrides.set(capability, parts[0] === "on");
				apply(ctx);
				save();
				ctx.ui.notify(`${capability} ${parts[0]}`, "info");
				return;
			}

			const requested = parts[0];
			if (!isProfile(requested)) {
				ctx.ui.notify("Use: /context-profile full|delivery|lean|off <cap>|on <cap>", "warning");
				return;
			}

			profile = requested;
			// A preset is a complete statement, so it clears earlier overrides.
			overrides = new Map();
			apply(ctx);
			save();
			ctx.ui.notify(`Context profile switched to ${profile}`, "info");
		},
	});
}
