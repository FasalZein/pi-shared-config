/**
 * Token Rate (TPS) Extension
 *
 * Shows the average output tokens per second as a pi-fancy-footer widget.
 * Registers via the fancy-footer widget discovery event so no direct import
 * of the package is required.
 */
import type { AssistantMessage } from "@earendil-works/pi-ai";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const DISCOVER_EVENT = "pi-fancy-footer:discover-widgets";
const REQUEST_DISCOVERY_EVENT = "pi-fancy-footer:request-widget-discovery";
const REQUEST_REFRESH_EVENT = "pi-fancy-footer:request-widget-refresh";

export default function (pi: ExtensionAPI) {
  let totalOutputTokens = 0;
  let totalSeconds = 0;
  let turnStartMs: number | null = null;
  let turnStreamEndMs: number | null = null;
  let currentTps = 0;

  const reset = () => {
    totalOutputTokens = 0;
    totalSeconds = 0;
    turnStartMs = null;
    turnStreamEndMs = null;
    currentTps = 0;
  };

  // Register the TPS widget with pi-fancy-footer.
  const widget = {
    id: "pi-tps.token-rate",
    label: "Token rate (TPS)",
    description: "Average output tokens per second for the session.",
    row: 0,
    order: 3,
    align: "right" as const,
    icon: false as const,
    textColor: "success" as const,
    render: (): string | undefined => {
      if (currentTps <= 0 || !Number.isFinite(currentTps)) return undefined;
      return `${currentTps.toFixed(1)} tok/s`;
    },
  };

  pi.events.on(DISCOVER_EVENT, (payload: any) => {
    if (payload && typeof payload.registerWidget === "function") {
      payload.registerWidget(widget);
    }
  });
  // Ask fancy-footer to re-discover in case it already ran discovery before
  // this extension's listener was attached.
  pi.events.emit(REQUEST_DISCOVERY_EVENT, {});

  const refreshFooter = () => {
    pi.events.emit(REQUEST_REFRESH_EVENT, {});
  };

  pi.on("session_start", async () => {
    reset();
    pi.events.emit(REQUEST_DISCOVERY_EVENT, {});
  });

  pi.on("turn_start", async (event) => {
    turnStartMs = event.timestamp ?? Date.now();
    turnStreamEndMs = null;
  });

  pi.on("tool_call", async () => {
    if (turnStartMs !== null && turnStreamEndMs === null) {
      turnStreamEndMs = Date.now();
    }
  });

  pi.on("turn_end", async (event) => {
    const message = event.message as AssistantMessage | undefined;
    if (!message || message.role !== "assistant") {
      turnStartMs = null;
      turnStreamEndMs = null;
      return;
    }

    const endMs = turnStreamEndMs ?? Date.now();
    const startMs = turnStartMs ?? endMs;
    const elapsedSeconds = Math.max(0.001, (endMs - startMs) / 1000);

    const outputTokens = message.usage?.output ?? 0;
    if (outputTokens > 0) {
      totalOutputTokens += outputTokens;
      totalSeconds += elapsedSeconds;
      if (totalSeconds > 0) currentTps = totalOutputTokens / totalSeconds;
    }

    turnStartMs = null;
    turnStreamEndMs = null;
    refreshFooter();
  });
}
