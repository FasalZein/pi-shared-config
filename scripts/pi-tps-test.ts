import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, test } from "node:test";
import piTps from "../extensions/pi-tps.ts";

type Handler = (event: any) => void;
type WidgetMessage = { type: string; widget?: { content: { text: string } } };

const realNow = Date.now;
let now = 0;

function install() {
	const handlers = new Map<string, Handler>();
	const widgetTexts: string[] = [];
	piTps({
		on(eventName: string, handler: Handler) {
			handlers.set(eventName, handler);
		},
		events: {
			on: () => () => {},
			emit(_channel: string, message: WidgetMessage) {
				if (message.type === "upsert" && message.widget) widgetTexts.push(message.widget.content.text);
			},
		},
	} as never);
	const fire = (eventName: string, event: object = {}) => handlers.get(eventName)?.(event);
	const shown = () => widgetTexts.at(-1);
	// One model response that streams outputTokens over durationMs.
	const turn = (outputTokens: number, durationMs: number) => {
		fire("turn_start", { timestamp: now });
		now += durationMs;
		fire("turn_end", { message: { role: "assistant", usage: { output: outputTokens } } });
	};
	return { fire, shown, turn };
}

const modelA = { provider: "anthropic", id: "model-a" };
const modelB = { provider: "openai", id: "model-b" };

describe("pi-tps model switch", () => {
	beforeEach(() => {
		now = 1_000_000;
		Date.now = () => now;
	});
	afterEach(() => {
		Date.now = realNow;
	});

	test("a model switch clears the old rate and averages only the new model", () => {
		const tps = install();
		tps.fire("model_select", { model: modelA, previousModel: undefined, source: "restore" });
		tps.turn(100, 1_000); // 100 tok/s on model A
		assert.equal(tps.shown(), "100.0 tok/s");

		tps.fire("model_select", { model: modelB, previousModel: modelA, source: "set" });
		assert.equal(tps.shown(), "-- tok/s");

		tps.turn(20, 1_000); // 20 tok/s on model B; a mixed average would show 60.0
		assert.equal(tps.shown(), "20.0 tok/s");
	});

	test("selecting the same model again keeps the session average", () => {
		const tps = install();
		tps.fire("model_select", { model: modelA, previousModel: undefined, source: "restore" });
		tps.turn(100, 1_000);
		tps.fire("model_select", { model: { ...modelA }, previousModel: modelA, source: "set" });
		assert.equal(tps.shown(), "100.0 tok/s");
	});

	test("a turn in flight during a model switch does not count for the new model", () => {
		const tps = install();
		tps.fire("model_select", { model: modelA, previousModel: undefined, source: "restore" });
		tps.fire("turn_start", { timestamp: now });
		now += 1_000;
		tps.fire("model_select", { model: modelB, previousModel: modelA, source: "cycle" });
		tps.fire("turn_end", { message: { role: "assistant", usage: { output: 100 } } });
		assert.equal(tps.shown(), "-- tok/s");
	});
});
