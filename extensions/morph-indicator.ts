/**
 * Working Indicator — morphing braille orb + shimmering verb
 *
 * Replaces pi's default "⠦ Working...":
 *   - a 2-cell braille shape that MORPHS through 9 dense geometric keyframes
 *     (core, X, chunky-X, ring, swirl, flash, spiral, filled orb, star), in a
 *     fresh RANDOM order each turn. Braille dot positions are discrete, so the
 *     morph is carried by BRIGHTNESS crossfade: a dot leaving fades out, a dot
 *     entering fades in, dots in both stay lit. The shape also breathes color.
 *     (A 2-cell braille block is the only thing that fills the full cell box —
 *     single glyphs can't be scaled bigger than text, and Ghostty doesn't render
 *     the OSC-66 text-sizing protocol yet.)
 *   - a playful verb with a SHIMMER: a soft highlight band glides across the
 *     letters, wrapping toroidally so it never flashes — reads smooth.
 *
 * Every frame is exactly 2 cells wide → zero layout shift. Verb is baked into the
 * frames (setWorkingMessage can't animate) so shape + verb move as one unit.
 * Truecolor when COLORTERM advertises it; mono theme-accent fallback otherwise.
 */
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

// ── tunables ────────────────────────────────────────────────────────────────
const FRAMES_PER_LEG = 16;     // frames to morph one shape → next (fast & smooth)
const INTERVAL_MS = 45;        // ~22fps redraw
const STOPS: RGB[] = [[53,18,8],[105,42,22],[181,71,37],[223,113,79],[239,161,136]]; // terracotta
const TEXT_DIM: RGB = [150, 96, 74];   // resting verb color (muted terracotta)
const TEXT_LIT: RGB = [243, 191, 167]; // verb under the shimmer peak (peachy)
const SHIMMER_WIDTH = 1.8;             // gaussian half-width of the highlight band
const SWEEPS_PER_LOOP = 2;             // shimmer sweeps across the verb per full loop (lower = slower)
const VERBS = ["Pondering","Cogitating","Conjuring","Percolating","Tinkering","Brewing","Divining","Synthesizing","Ruminating","Untangling","Mulling","Calibrating"];
// keyframe shapes as braille dot coords (x:0..3, y:0..3). Each turn a fresh RANDOM
// order is built (see randomMorphOrder) so shapes appear in a different sequence.
const K = (arr: number[][]) => arr.map((p) => p[0] + "," + p[1]);
const KEYS: string[][] = [
  K([[1,1],[2,1],[1,2],[2,2]]),                                                // core
  K([[0,0],[3,0],[1,1],[2,1],[1,2],[2,2],[0,3],[3,3]]),                         // X diagonal
  K([[0,0],[1,0],[2,1],[3,0],[1,1],[2,2],[1,2],[0,3],[2,3],[3,3]]),             // chunky X
  K([[1,0],[2,0],[0,1],[3,1],[0,2],[3,2],[1,3],[2,3]]),                         // ring / orb
  K([[0,1],[0,2],[1,0],[1,2],[1,3],[2,0],[2,1],[2,3],[3,1],[3,2]]),             // swirl
  K([[1,0],[2,0],[1,3],[2,3],[0,1],[0,2],[3,1],[3,2],[1,1],[2,2]]),             // flash
  K([[1,0],[2,0],[3,0],[3,1],[0,1],[0,2],[3,2],[0,3],[1,3],[2,3]]),             // spiral
  K([[1,0],[2,0],[0,1],[1,1],[2,1],[3,1],[0,2],[1,2],[2,2],[3,2],[1,3],[2,3]]), // filled orb
  K([[1,0],[2,0],[0,1],[1,1],[2,1],[3,1],[1,2],[2,2],[0,3],[3,3]]),             // star solid
];
// ─────────────────────────────────────────────────────────────────────────────

type RGB = [number, number, number];
const RESET = "\x1b[0m";
const truecolor = /truecolor|24bit/i.test(process.env.COLORTERM ?? "");

// braille dot bit per (row, col) within the 4-row × 2-col cell pair
const DOT = [[0x01,0x08],[0x02,0x10],[0x04,0x20],[0x40,0x80]];

// Conflict matrix: two shapes conflict if their dot-union fills the whole cell (>=15
// of 16 dots), which would flash a solid block mid-crossfade. Precomputed once.
const CONFLICT: boolean[][] = KEYS.map((a) => {
  const sa = new Set(a);
  return KEYS.map((b) => new Set([...sa, ...b]).size >= 15);
});

// SAFE_ORDER: a hand-verified conflict-free cycle, used only as the fallback if the
// randomized search ever fails (it can't for the current set, but this guarantees a
// future shape edit can never silently ship the full-block flash the search avoids).
const SAFE_ORDER = [0, 1, 2, 8, 3, 4, 5, 6, 7];

// Build a fresh RANDOM morph cycle (Hamiltonian cycle) where no two adjacent shapes
// — including the wrap from last back to first — conflict. Randomized greedy with
// backtracking: always succeeds for this set, and yields a different order each call.
function randomMorphOrder(): number[] {
  const n = KEYS.length;
  const order: number[] = [];
  const used = new Array(n).fill(false);
  const build = (): boolean => {
    if (order.length === n) return !CONFLICT[order[n - 1]][order[0]]; // close the loop
    const last = order[order.length - 1];
    const cands: number[] = [];
    for (let i = 0; i < n; i++) {
      if (used[i]) continue;
      if (order.length && CONFLICT[last][i]) continue;
      cands.push(i);
    }
    for (let k = cands.length - 1; k > 0; k--) { // shuffle candidates for variety
      const j = Math.floor(Math.random() * (k + 1));
      [cands[k], cands[j]] = [cands[j], cands[k]];
    }
    for (const c of cands) {
      order.push(c); used[c] = true;
      if (build()) return true;
      order.pop(); used[c] = false;
    }
    return false;
  };
  return build() ? order : SAFE_ORDER.slice(); // fallback is itself conflict-free
}

function ramp(t: number): RGB {
  t = Math.max(0, Math.min(1, t)) * (STOPS.length - 1);
  const i = Math.floor(t), f = t - i;
  if (i >= STOPS.length - 1) return STOPS[STOPS.length - 1];
  const a = STOPS[i], b = STOPS[i + 1];
  return [Math.round(a[0]+(b[0]-a[0])*f), Math.round(a[1]+(b[1]-a[1])*f), Math.round(a[2]+(b[2]-a[2])*f)];
}
const lerp = (a: RGB, b: RGB, t: number): RGB => [
  Math.round(a[0]+(b[0]-a[0])*t), Math.round(a[1]+(b[1]-a[1])*t), Math.round(a[2]+(b[2]-a[2])*t),
];
const fg = (c: RGB, s: string) => `\x1b[38;2;${c[0]};${c[1]};${c[2]}m${s}`;

// Morph between two keyframes at fraction u (0..1), color-breathing by `breath`.
// Per-dot alpha: in-both = 1; leaving = 1-ease; entering = ease. Brightness carries
// the morph, so the shape change reads smooth despite discrete dot positions.
function orbMorph(from: Set<string>, to: Set<string>, u: number, breath: number): string {
  const ease = 0.5 - 0.5 * Math.cos(u * Math.PI); // smooth the leg
  let line = "";
  for (let cc = 0; cc < 2; cc++) {
    let bits = 0, isum = 0, icount = 0;
    for (let dy = 0; dy < 4; dy++) for (let dx = 0; dx < 2; dx++) {
      const key = (cc * 2 + dx) + "," + dy;
      const inF = from.has(key), inT = to.has(key);
      let a = 0;
      if (inF && inT) a = 1;
      else if (inF) a = 1 - ease;
      else if (inT) a = ease;
      if (a > 0.06) {
        bits |= DOT[dy][dx];
        isum += 0.12 + 0.88 * a * (0.7 + 0.3 * breath);
        icount++;
      }
    }
    line += bits === 0 ? " " : fg(ramp(isum / icount), String.fromCharCode(0x2800 + bits));
  }
  return line; // always 2 cells (a blank cell is a space, still 2-wide)
}

// Toroidal shimmer band gliding across the verb. `phase` is continuous (not reset
// per leg), and distance wraps around the word so the band re-enters the left as it
// leaves the right — it glides smoothly, never flashes. SWEEPS_PER_LOOP sets speed.
function shimmerVerb(verb: string, phase: number): string {
  const L = verb.length;
  const center = (phase % 1) * L;
  let s = "";
  for (let i = 0; i < L; i++) {
    let d = i - center;
    d = ((d % L) + L) % L; if (d > L / 2) d -= L; // wrap into [-L/2, L/2]
    const band = Math.exp(-(d * d) / (2 * SHIMMER_WIDTH * SHIMMER_WIDTH));
    s += fg(lerp(TEXT_DIM, TEXT_LIT, band), verb[i]);
  }
  return s + fg(TEXT_DIM, "…");
}

// One full loop = morph through every keyframe (in a fresh RANDOM order) and wrap.
function framesTrue(verb: string): string[] {
  const order = randomMorphOrder();
  const sets = order.map((i) => new Set(KEYS[i]));
  const total = sets.length * FRAMES_PER_LEG;
  const out: string[] = [];
  for (let g = 0; g < total; g++) {
    const leg = Math.floor(g / FRAMES_PER_LEG) % sets.length;
    const u = (g % FRAMES_PER_LEG) / FRAMES_PER_LEG;
    const breath = 0.5 - 0.5 * Math.cos((g / total) * Math.PI * 2); // continuous over the loop
    const shimmerPhase = (g / total) * SWEEPS_PER_LOOP;             // continuous glide, no per-leg reset
    const orb = orbMorph(sets[leg], sets[(leg + 1) % sets.length], u, breath);
    out.push(orb + " " + shimmerVerb(verb, shimmerPhase) + RESET);
  }
  return out;
}

// Mono fallback: static orb ring (theme accent) + plain verb — no smooth color.
function framesMono(verb: string, themeFg: (tone: string, s: string) => string): string[] {
  const ring = new Set(KEYS[3]); // the ring/orb shape for a recognizable static glyph
  let dots = "";
  for (let cc = 0; cc < 2; cc++) {
    let bits = 0;
    for (let dy = 0; dy < 4; dy++) for (let dx = 0; dx < 2; dx++) {
      if (ring.has((cc * 2 + dx) + "," + dy)) bits |= DOT[dy][dx];
    }
    dots += bits === 0 ? " " : themeFg("accent", String.fromCharCode(0x2800 + bits)) + RESET;
  }
  return [`${dots} ${verb}…`];
}

export default function (pi: ExtensionAPI) {
  let enabled = true;
  const verb = () => VERBS[Math.floor(Math.random() * VERBS.length)];

  const apply = (ctx: ExtensionContext) => {
    if (!enabled) return;
    const v = verb();
    const frames = truecolor ? framesTrue(v) : framesMono(v, (t, s) => ctx.ui.theme.fg(t as any, s));
    ctx.ui.setWorkingIndicator({ frames, intervalMs: INTERVAL_MS });
    ctx.ui.setWorkingMessage(""); // verb is baked into the frames so it can shimmer
  };

  pi.on("session_start", async (_e, ctx) => apply(ctx));
  pi.on("turn_start", async (_e, ctx) => apply(ctx)); // fresh verb each turn

  pi.registerCommand("morph", {
    description: "Working indicator: 'on' (orb morph + shimmer), or 'off' (pi default).",
    handler: async (args, ctx) => {
      if (args.trim().toLowerCase() === "off") {
        enabled = false;
        ctx.ui.setWorkingIndicator();
        ctx.ui.setWorkingMessage();
        ctx.ui.notify("Working indicator: pi default restored.", "info");
      } else {
        enabled = true;
        apply(ctx);
        ctx.ui.notify(`Working indicator: orb morph + shimmer (${truecolor ? "color" : "mono"}).`, "info");
      }
    },
  });
}
