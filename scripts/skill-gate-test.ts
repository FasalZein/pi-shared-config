import assert from "node:assert/strict";
import { describe, test } from "node:test";
import skillGate, { MODEL_VISIBLE_SKILLS } from "../extensions/skill-gate.ts";

// Documented ambient catalog from extensions/skill-gate.ts. The expectation is
// this literal list, not a value recomputed from the extension's filter.
const VISIBLE_SKILLS = [
	"torpathy",
	"grilling",
	"grill-me",
	"grill-with-docs",
	"domain-modeling",
	"diagnosing-bugs",
	"research",
	"agentsmd",
	"msw",
] as const;

const HIDDEN_SKILL = "writing-for-agents";

type NamedSkill = { name: string; description: string };
type SectionMap = Record<string, string | null>;
type SystemMessage = {
	role: "system";
	content: readonly { type: "text"; text: string }[];
	sections?: SectionMap;
	timestamp?: number;
};
type UserMessage = { role: "user"; content: string };
type RequestMessage = SystemMessage | UserMessage;
type Handler = (event: {
	systemPromptOptions?: { skills?: NamedSkill[] };
	messages?: RequestMessage[];
}) => { messages: RequestMessage[] } | undefined;

function withProcess(
	options: { subagent?: string; args: readonly string[] },
	run: () => void,
): void {
	const previousArgv = process.argv;
	const previousName = process.env.PI_SUBAGENT_NAME;
	process.argv = ["node", "pi", ...options.args];
	if (options.subagent === undefined) delete process.env.PI_SUBAGENT_NAME;
	else process.env.PI_SUBAGENT_NAME = options.subagent;
	try {
		run();
	} finally {
		process.argv = previousArgv;
		if (previousName === undefined) delete process.env.PI_SUBAGENT_NAME;
		else process.env.PI_SUBAGENT_NAME = previousName;
	}
}

function install(options: { subagent?: string; args?: readonly string[] } = {}) {
	const handlers = new Map<string, Handler>();
	withProcess({ subagent: options.subagent, args: options.args ?? [] }, () => {
		skillGate({
			on(eventName: string, handler: Handler) {
				handlers.set(eventName, handler);
			},
		} as Parameters<typeof skillGate>[0]);
	});
	return {
		gateSkills(skills: readonly NamedSkill[]): NamedSkill[] {
			const event = {
				systemPromptOptions: {
					skills: skills.map((skill) => ({ ...skill })),
				},
			};
			handlers.get("before_agent_start")?.(event);
			return event.systemPromptOptions.skills ?? [];
		},
		gateMessages(messages: RequestMessage[]): RequestMessage[] {
			const event = { messages };
			const result = handlers.get("context_with_system")?.(event);
			return result?.messages ?? messages;
		},
	};
}

// Pi's formatSkillsForPrompt shape. The gate's contract is that removing whole
// entries leaves the text Pi would render for the retained skills.
function catalog(skills: readonly NamedSkill[]): string {
	const lines = [
		"\n\nThe following skills provide specialized instructions for specific tasks.",
		"Use the read tool to load a skill's file when the task matches its description.",
		"When a skill file references a relative path, resolve it against the skill directory (parent of SKILL.md / dirname of the path) and use that absolute path in tool commands.",
		"",
		"<available_skills>",
	];
	for (const skill of skills) {
		lines.push("  <skill>");
		lines.push(`    <name>${skill.name}</name>`);
		lines.push(`    <description>${skill.description}</description>`);
		lines.push(`    <location>/skills/${skill.name}/SKILL.md</location>`);
		lines.push("  </skill>");
	}
	lines.push("</available_skills>");
	return lines.join("\n");
}

describe("skill gate", { concurrency: false }, () => {
	test("the ambient catalog is the documented visible set", () => {
		assert.deepEqual([...MODEL_VISIBLE_SKILLS], [...VISIBLE_SKILLS]);
		assert.equal(VISIBLE_SKILLS.includes(HIDDEN_SKILL as (typeof VISIBLE_SKILLS)[number]), false);
	});

	test("an ambient parent request keeps only the visible skill catalog", () => {
		const gate = install();
		const skills: NamedSkill[] = [
			...VISIBLE_SKILLS.map((name) => ({ name, description: `${name} stays visible` })),
			{ name: HIDDEN_SKILL, description: "not in the ambient catalog" },
		];
		assert.deepEqual(
			gate.gateSkills(skills),
			skills.filter((skill) => skill.name !== HIDDEN_SKILL),
		);
	});

	test("a parent request stays gated when argv contains --no-skills", () => {
		const gate = install({ args: ["--no-skills"] });
		const skills = [
			{ name: HIDDEN_SKILL, description: "hidden" },
			{ name: "torpathy", description: "visible" },
		];
		assert.deepEqual(gate.gateSkills(skills), [{ name: "torpathy", description: "visible" }]);
	});

	test("a named child without skill flags is gated like the parent", () => {
		const gate = install({ subagent: "worker" });
		const skills = [
			{ name: HIDDEN_SKILL, description: "inherited from skills all" },
			{ name: "msw", description: "visible" },
		];
		assert.deepEqual(gate.gateSkills(skills), [{ name: "msw", description: "visible" }]);
	});

	for (const flag of ["--no-skills", "-ns", "--skill"] as const) {
		test(`a named child with ${flag} keeps its explicit skill list`, () => {
			const gate = install({
				subagent: "worker",
				args: [flag, "/skills/writing-for-agents"],
			});
			const skills = [
				{ name: HIDDEN_SKILL, description: "requested by the agent definition" },
				{ name: "torpathy", description: "also requested" },
			];
			assert.deepEqual(gate.gateSkills(skills), skills);
			const messages: RequestMessage[] = [
				{
					role: "system",
					content: [{ type: "text", text: "child prompt" }],
					sections: { skills: catalog(skills) },
				},
			];
			const gated = gate.gateMessages(messages);
			assert.equal(gated, messages);
			assert.match(String(messages[0]?.sections?.skills), new RegExp(HIDDEN_SKILL));
		});
	}

	test("a continuation request sends one gated catalog and drops a repeated full catalog", () => {
		const gate = install();
		const visible = [
			{ name: "torpathy", description: "Keep Torpathy" },
			{ name: "msw", description: "Keep MSW" },
		];
		const full = [
			visible[0],
			{ name: HIDDEN_SKILL, description: "Hide this skill" },
			visible[1],
		];
		const fullCatalog = catalog(full as NamedSkill[]);
		const head: SystemMessage = {
			role: "system",
			content: [{ type: "text", text: "prompt" }],
			sections: {
				roster: "<subagent-roster>default_model: kept</subagent-roster>",
				skills: fullCatalog,
			},
			timestamp: 11,
		};
		const user: UserMessage = { role: "user", content: "continue" };
		const repeated: SystemMessage = {
			role: "system",
			content: [],
			sections: { skills: fullCatalog },
		};
		const messages = gate.gateMessages([head, user, repeated]);
		assert.equal(messages.length, 2);
		assert.equal(messages[1], user);
		const gatedHead = messages[0];
		assert.equal(gatedHead?.role, "system");
		assert.ok(gatedHead && gatedHead.role === "system");
		assert.equal(gatedHead.timestamp, 11);
		assert.deepEqual(gatedHead.content, head.content);
		assert.deepEqual(Object.keys(gatedHead.sections ?? {}), ["roster", "skills"]);
		assert.equal(gatedHead.sections?.roster, head.sections.roster);
		assert.equal(gatedHead.sections?.skills, catalog(visible));
		assert.equal(JSON.stringify(messages).includes(HIDDEN_SKILL), false);
	});

	test("a continuation whose catalog is already visible is left unchanged", () => {
		const gate = install();
		const messages: RequestMessage[] = [
			{
				role: "system",
				content: [{ type: "text", text: "prompt" }],
				sections: {
					skills: catalog([
						{ name: "torpathy", description: "Keep Torpathy" },
						{ name: "msw", description: "Keep MSW" },
					]),
				},
			},
		];
		assert.equal(gate.gateMessages(messages), messages);
	});

	test("a continuation head with no visible skills keeps the prompt and omits the catalog", () => {
		const gate = install();
		const head: SystemMessage = {
			role: "system",
			content: [{ type: "text", text: "prompt" }],
			sections: { skills: catalog([{ name: HIDDEN_SKILL, description: "hidden only" }]) },
		};
		const messages = gate.gateMessages([head]);
		assert.equal(messages.length, 1);
		const gatedHead = messages[0];
		assert.ok(gatedHead && gatedHead.role === "system");
		assert.deepEqual(gatedHead.content, head.content);
		assert.equal(gatedHead.sections, undefined);
		assert.equal(JSON.stringify(messages).includes(HIDDEN_SKILL), false);
	});
});
