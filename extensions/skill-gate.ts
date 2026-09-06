import {
	formatSkillsForPrompt,
	type ExtensionAPI,
	type Skill,
} from "@earendil-works/pi-coding-agent";

// Skills the model may see in the ambient catalog.
//
// Skills with disable-model-invocation: true stay command-only even when named
// here; formatSkillsForPrompt drops them before the gate runs.
export const MODEL_VISIBLE_SKILLS: readonly string[] = [
	"torpathy",
	"grilling",
	"grill-me",
	"grill-with-docs",
	"domain-modeling",
	"diagnosing-bugs",
	"research",
	"agentsmd",
	"msw",
];

const VISIBLE = new Set(MODEL_VISIBLE_SKILLS);

// The XML catalog pi builds with formatSkillsForPrompt. Matching the block by
// shape instead of by an exact rebuilt string keeps the gate working when
// another extension edits the surrounding preamble first.
const SKILLS_BLOCK = /<available_skills>[\s\S]*?<\/available_skills>/;

// A child that pi-subagents launched with an explicit skill list already has a
// curated catalog (--no-skills, plus one --skill per allowed skill). Gating it
// again would delete the skills its agent definition asked for. A child with no
// skill flags inherited `skills: all`, so it needs the same gate as the parent.
//
// tests/skill-gate-check.ts pins this assumption against pi-subagents.
function hasExplicitSkillList(argv: readonly string[]): boolean {
	return argv.some(
		(arg) => arg === "--no-skills" || arg === "-ns" || arg === "--skill",
	);
}

export function filterSkills(systemPrompt: string, skills: readonly Skill[]): string {
	if (!SKILLS_BLOCK.test(systemPrompt)) return systemPrompt;

	const gatedPrompt = formatSkillsForPrompt(
		skills.filter((skill) => VISIBLE.has(skill.name)),
	);
	const gatedBlock =
		SKILLS_BLOCK.exec(gatedPrompt)?.[0] ?? "<available_skills>\n</available_skills>";
	// Replace with a function so a skill description containing $& or $1 is
	// inserted literally.
	return systemPrompt.replace(SKILLS_BLOCK, () => gatedBlock);
}

// This extension gates the ambient skill catalog and nothing else.
//
// It deliberately leaves the <subagent-roster> and <subagent-rules> blocks
// untouched. An earlier version compacted each roster entry onto one line. That
// saved about 117 tokens and merged default_model, models, and the lifecycle
// fields into one sentence, which made model selection harder to read. Routing
// accuracy is worth more than those tokens.
export default function skillGate(pi: ExtensionAPI) {
	if (process.env.PI_SUBAGENT_NAME && hasExplicitSkillList(process.argv)) return;

	pi.on("before_agent_start", (event) => {
		const skills = event.systemPromptOptions?.skills;
		if (!skills?.length) return;

		const systemPrompt = filterSkills(event.systemPrompt, skills);
		if (systemPrompt === event.systemPrompt) return;
		return { systemPrompt };
	});
}
