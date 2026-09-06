/**
 * kiro-transient-retry
 *
 * The kiro2api proxy surfaces failures to pi as a finalized assistant message
 * with `stopReason: "error"`. pi's built-in auto-retry only fires when the
 * error TEXT matches its transient regex. The proxy's transient failures
 * (upstream 502, stream-read failures, empty-output) are phrased in their own
 * way, so without help they never match pi's regex and long-running agent
 * tasks die on a blip that a single retry would have cleared.
 *
 * Strategy: retry-by-default for the kiro provider, EXCLUDING errors the proxy
 * marks as terminal. We invert pi's allowlist into a denylist scoped to this
 * one provider, so transient errors we haven't enumerated still get retried,
 * while terminal ones never loop.
 *
 * The proxy's own classification (src/anthropic/handlers.rs, provider.rs):
 *   - Terminal  -> HTTP 400 invalid_request_error: "Context window is full",
 *                  "Input is too long"; HTTP 402: quota exhausted / all
 *                  credentials exhausted (MONTHLY_REQUEST_COUNT).
 *   - Transient -> HTTP 502 api_error: "upstream API call failed",
 *                  "failed to read response stream"; empty-output guard
 *                  (src/anthropic/stream.rs) which warns the request "may
 *                  still be billed by upstream" but is safe to retry.
 *
 * pi retries up to its configured maxRetries (default 3, 2s exponential
 * backoff) once the message matches its transient regex; prefixing
 * "provider returned error" puts the message on that path.
 *
 * Drop-in: ~/.pi/agent/extensions/kiro-transient-retry.ts
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const KIRO_PROVIDER = "anthropic-kiro";

// Phrase pi's _isRetryableError recognizes.
const RETRY_TRIGGER = "provider returned error";

// Terminal failures that must NEVER be retried. Retrying these wastes money
// (quota/billing) or loops forever (the request is structurally rejected).
// Uses PRECISE terminal phrases: the empty-output warning says the request
// "may still be billed by upstream" but is transient, so we match the word
// "exhausted" (quota/credentials) rather than the bare word "billed".
const TERMINAL_PATTERN =
  /Context window is full|Input is too long|invalid_request_error|CONTENT_LENGTH_EXCEEDS_THRESHOLD|exhausted|MONTHLY_REQUEST_COUNT|GoUsageLimitError|FreeUsageLimitError|Monthly usage limit|available balance|insufficient_quota|out of budget|quota exceeded|billing|unauthorized|invalid.?api.?key|forbidden/i;

export default function (pi: ExtensionAPI) {
  pi.on("message_end", async (event, ctx) => {
    const message = event.message;
    if (message.role !== "assistant") return;
    if (message.stopReason !== "error") return;

    // Scope strictly to the kiro proxy so other providers are untouched.
    const isKiro =
      message.provider === KIRO_PROVIDER || ctx.model?.provider === KIRO_PROVIDER;
    if (!isKiro) return;

    const errorMessage = message.errorMessage ?? "";
    if (!errorMessage) return;
    // Idempotent: don't re-rewrite a message already flagged for retry.
    if (errorMessage.startsWith(RETRY_TRIGGER)) return;
    // Never retry terminal failures (context overflow, oversized input, quota,
    // auth, content policy). Let pi's compaction / normal error path handle them.
    if (TERMINAL_PATTERN.test(errorMessage)) return;

    // Everything else from this provider is treated as transient and retried.
    return {
      message: {
        ...message,
        errorMessage: `${RETRY_TRIGGER}: kiro transient failure, retrying. ${errorMessage}`,
      },
    };
  });
}
