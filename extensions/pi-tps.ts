/**
 * Token Rate Status Extension
 *
 * Shows the average output tokens per second in the footer status line.
 */
import type { AssistantMessage } from "@mariozechner/pi-ai";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  const statusKey = "token-rate";
  let totalOutputTokens = 0;
  let totalSeconds = 0;
  let turnStartMs: number | null = null;
  let turnStreamEndMs: number | null = null;

  const reset = () => {
    totalOutputTokens = 0;
    totalSeconds = 0;
    turnStartMs = null;
    turnStreamEndMs = null;
  };

  const updateStatus = (ctx: {
    hasUI: boolean;
    ui: { setStatus: (key: string, text?: string) => void };
  }) => {
    if (!ctx.hasUI) return;
    if (totalSeconds <= 0 || totalOutputTokens <= 0) return;

    const tps = totalOutputTokens / totalSeconds;
    if (!Number.isFinite(tps)) return;

    const text = `TPS: ${tps.toFixed(1)} tok/s`;
    ctx.ui.setStatus(statusKey, text);
  };

  pi.on("session_start", async () => {
    reset();
  });

  pi.on("turn_start", async (event, ctx) => {
    turnStartMs = event.timestamp ?? Date.now();
    turnStreamEndMs = null;
    updateStatus(ctx);
  });

  pi.on("tool_call", async () => {
    if (turnStartMs !== null && turnStreamEndMs === null) {
      turnStreamEndMs = Date.now();
    }
  });

  pi.on("turn_end", async (event, ctx) => {
    const message = event.message as AssistantMessage | undefined;
    if (!message || message.role !== "assistant") {
      turnStartMs = null;
      turnStreamEndMs = null;
      updateStatus(ctx);
      return;
    }

    const endMs = turnStreamEndMs ?? Date.now();
    const startMs = turnStartMs ?? endMs;
    const elapsedSeconds = Math.max(0.001, (endMs - startMs) / 1000);

    const outputTokens = message.usage?.output ?? 0;
    if (outputTokens > 0) {
      totalOutputTokens += outputTokens;
      totalSeconds += elapsedSeconds;
    }

    turnStartMs = null;
    turnStreamEndMs = null;
    updateStatus(ctx);
  });
}
