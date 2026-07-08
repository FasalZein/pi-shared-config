/**
 * Full-width context bar widget for pi-fancy-footer.
 *
 * Renders, across the entire footer row it occupies:
 *
 *     <used>k ███████████░░░░░░░░░░ <total>k
 *
 * - left  : context actually used, as a hard token count (e.g. "42k") — not a percent
 * - middle: a gauge that grows to fill all remaining width (severity-coloured)
 * - right : total available context window, as a hard token count (e.g. "200k")
 *
 * Full width only works when this widget is ALONE on its footer row: the
 * fancy-footer layout reserves fixed widgets first and lets `grow` widgets
 * split the leftover, so siblings on the same row shrink the bar.
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const DISCOVER_EVENT = "pi-fancy-footer:discover-widgets";
const REQUEST_DISCOVERY_EVENT = "pi-fancy-footer:request-widget-discovery";

const FILLED_GLYPH = "█";
const EMPTY_GLYPH = "░";
const MIN_CELLS = 3;

function severityColor(remainingPercent: number): "ok" | "warning" | "error" {
  if (remainingPercent <= 10) return "error";
  if (remainingPercent <= 25) return "warning";
  return "ok";
}

export default function (pi: ExtensionAPI) {
  const widget = {
    id: "pi-shared.full-context-bar",
    label: "Full-width context bar",
    description: "Context gauge: used tokens (left), full-width bar, total context (right).",
    row: 0,
    order: 1,
    align: "middle" as const,
    grow: true,
    minWidth: 20,
    icon: false as const,
    textColor: "text" as const,
    styled: true,
    render: (ctx: any, availableWidth?: number): string | undefined => {
      const metrics = ctx.metrics;
      if (!metrics) return undefined;

      const total = Math.max(1, Math.floor(metrics.totalTokens));
      const used = Math.max(0, Math.min(total, Math.floor(metrics.usedTokensForBar)));
      const usedK = Math.max(0, Math.floor(used / 1000));
      const totalK = Math.max(0, Math.floor(total / 1000));
      const usedPercent = (used / total) * 100;
      const remainingPercent = ((total - used) / total) * 100;

      const leftLabel = `${usedK}k`;
      const rightLabel = `${totalK}k`;

      if (availableWidth === undefined) return undefined;
      // reserve: leftLabel + one space + (gauge) + one space + rightLabel
      let cells = Math.floor(availableWidth) - leftLabel.length - rightLabel.length - 2;
      if (cells < MIN_CELLS) cells = MIN_CELLS;

      let filled = Math.round((usedPercent / 100) * cells);
      if (usedPercent > 0 && filled === 0) filled = 1;
      if (usedPercent < 100 && filled === cells) filled = cells - 1;
      const empty = cells - filled;

      const severity = severityColor(remainingPercent);
      const gaugeColors = ctx.gaugeColors ?? { ok: "accent", warning: "warning", error: "error" };
      const color = gaugeColors[severity] ?? "accent";
      const textColor = ctx.defaultTextColor ?? "text";

      return (
        ctx.theme.fg(textColor, `${leftLabel} `) +
        ctx.theme.fg(color, FILLED_GLYPH.repeat(filled)) +
        ctx.theme.fg("dim", EMPTY_GLYPH.repeat(empty)) +
        ctx.theme.fg(textColor, ` ${rightLabel}`)
      );
    },
  };

  pi.events.on(DISCOVER_EVENT, (payload: any) => {
    if (payload && typeof payload.registerWidget === "function") {
      payload.registerWidget(widget);
    }
  });

  pi.events.emit(REQUEST_DISCOVERY_EVENT, {});

  pi.on("session_start", async () => {
    pi.events.emit(REQUEST_DISCOVERY_EVENT, {});
  });
}
