"use client";

// ─────────────────────────────────────────────────────────────────────────────
// 17104 · First Look — the 10-second lure for 17024-inkpressure.
//
//   WHAT THIS IS (and is not)
//   This is NOT a new concept piece. The ceiling has been frozen at 0/15/0 for
//   ~11 days: fifteen honest prototypes, zero opened by Karel, and the only lever
//   is fifteen seconds of his attention. The 2026-09-08 jury named the single
//   legitimate build inside the immutability rule: not a new prototype competing
//   for a slot, but a LURE — a short auto-looping preview whose entire job is to
//   make inkpressure's swell-and-thin effect irresistible at a glance, so the
//   verification ask compresses from "press play, watch 15s, interpret" to
//   "glance — it's already looping — tap yes or no."
//
//   Immutability forbids editing the shipped 17024-inkpressure, so this is a
//   companion, front-door page. It re-implements inkpressure's exact
//   velocity→ink-width mapping (it is a faithful preview, so it MUST match) on
//   the single most dynamically-contrasty passage of one of Karel's real
//   recordings, and replays that passage's ink as a looping sweep at 3× speed —
//   working MUTED, on his phone, with no mic/camera/permission.
//
//   INPUT   autonomous. It just loops. One button opens the full piece; one
//           optional button plays the actual take (his real recording) in sync.
//   OUTPUT  inline SVG only — the stroke is a real variable-width filled ribbon,
//           its wet head revealed by an animated clip. No canvas, no WebGL.
//   DRIVE   his per-note VELOCITIES (track analysis) → the same recency-weighted
//           dynamic-pressure envelope inkpressure uses → stroke width. The muted
//           loop needs no audio; "hear the take" plays only his real catalog
//           buffer through safeMaster.
//
//   Named references (see README): Calliphony (arXiv 2608.03040, 2026);
//   "Visualising Pianists' Touch" (CHI 2026); and the corroborating 2026 finding
//   (ASAP dataset, Frontiers) that dynamic shaping is the expressive channel most
//   coupled to timing and most independent of note density — i.e. the exact
//   signal inkpressure draws is the one the current literature calls core.
//
//   Degrade: analysis null/empty → a clearly-labelled representative swell/thin
//   contour still demonstrates the effect (audio, if played, is still his real
//   recording). prefers-reduced-motion → no sweep, the whole phrase shown at
//   rest so the swells/thins read as static geometry. Audio is ONLY his real
//   catalog, through safeMaster; exactly one bufferSource; full teardown.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useRef, useState } from "react";
import { WELCOME_HOME_TRACKS, loadRealTrackBuffer } from "../_shared/welcomeHome";
import { loadTrackAnalysis, type TrackNote } from "../_shared/trackAnalysis";
import { createSafeMaster, type SafeMaster } from "../_shared/visionary/safeMaster";

// ── palette: charcoal ink on cool pale ground — matched to 17024-inkpressure ──
const GROUND_A = "#e8ecf3";
const GROUND_B = "#dfe4ee";
const GROUND_EDGE = "#cdd4e0";
const INK = "#242833";
const INK_DEEP = "#12141b";
const ACCENT = "#7c5cff"; // violet, only at peak weight — same as inkpressure

// ── geometry ─────────────────────────────────────────────────────────────────
const SVG_W = 1200;
const SVG_H = 460;
const CENTER_Y = SVG_H * 0.5;
const PAD_X = 40;
const HW_MIN = 0.7; // dry pianissimo hair
const HW_MAX = 30; // heavy forte press
const MEANDER = 58; // gentle vertical wander so it reads as a stroke, not a bar

// ── passage selection + envelope ──────────────────────────────────────────────
const SAMPLE_DT = 0.05; // envelope sampling step (s)
const WINDOW = 1.7; // recency window for the pressure envelope (matches inkpressure)
const TAU = 0.5; // recency half-life (s)
const PASSAGE_DUR = 12; // seconds of his playing to preview
const N_POINTS = 260; // ribbon resolution across the passage
const SWEEP_SPEED = 3; // muted loop plays the passage at 3× real speed
const HOLD = 0.85; // seconds held full before the loop restarts
const FADE = 0.35; // seconds of ramp-in at the head of each loop

const TRACK = WELCOME_HOME_TRACKS[1]; // "Bath" — inkpressure's own default

interface Pt {
  x: number;
  y: number;
  hw: number;
  p: number; // 0..1 pressure at this point (for accent / tip)
}

const clamp = (v: number, lo: number, hi: number) =>
  v < lo ? lo : v > hi ? hi : v;

// Build a variable-width filled-ribbon `d` — width is geometry, so the swell/thin
// reads even with the sound off. (Same construction as 17024-inkpressure.)
function drawRibbon(pts: Pt[], from: number, to: number): string {
  const n = to - from;
  if (n < 2) return "";
  const top: string[] = [];
  const bot: string[] = [];
  for (let i = from; i < to; i++) {
    const prev = pts[i > from ? i - 1 : i];
    const next = pts[i < to - 1 ? i + 1 : i];
    let dx = next.x - prev.x;
    let dy = next.y - prev.y;
    const len = Math.hypot(dx, dy) || 1;
    dx /= len;
    dy /= len;
    const nx = -dy;
    const ny = dx;
    const hw = pts[i].hw;
    top.push(`${(pts[i].x + nx * hw).toFixed(2)} ${(pts[i].y + ny * hw).toFixed(2)}`);
    bot.push(`${(pts[i].x - nx * hw).toFixed(2)} ${(pts[i].y - ny * hw).toFixed(2)}`);
  }
  bot.reverse();
  return `M${top[0]} L${top.slice(1).join(" L")} L${bot.join(" L")} Z`;
}

// Violet appears ONLY on the heaviest runs (peak weight) — one subpath per run
// where pressure crosses the forte threshold, matching 17024-inkpressure.
function drawAccent(pts: Pt[]): string {
  const THRESH = 0.72;
  let d = "";
  let i = 0;
  while (i < pts.length) {
    if (pts[i].p >= THRESH) {
      let j = i;
      while (j < pts.length && pts[j].p >= THRESH) j++;
      if (j - i >= 2) d += drawRibbon(pts, i, j);
      i = j;
    } else {
      i++;
    }
  }
  return d;
}

// Recency-weighted dynamic-pressure envelope sampled across the whole track, then
// the most dynamically-contrasty PASSAGE_DUR window is chosen. Returns the pts[]
// for that window mapped across the SVG, plus its real start time + duration.
function buildPassage(notes: TrackNote[]): {
  pts: Pt[];
  start: number;
  dur: number;
  synthetic: boolean;
} {
  if (notes.length === 0) return { ...syntheticPassage(), synthetic: true };

  const vmax = notes.reduce((m, n) => Math.max(m, n.velocity), 0);
  const norm = vmax > 1.5 ? 127 : 1;
  const tEnd = notes[notes.length - 1].time + 0.5;
  const steps = Math.max(4, Math.ceil(tEnd / SAMPLE_DT));

  // recency-weighted mean velocity at each sampled instant
  const env = new Float32Array(steps);
  let cursor = 0;
  const recent: { t: number; v: number }[] = [];
  for (let s = 0; s < steps; s++) {
    const t = s * SAMPLE_DT;
    while (cursor < notes.length && notes[cursor].time <= t) {
      recent.push({ t: notes[cursor].time, v: clamp(notes[cursor].velocity / norm, 0, 1) });
      cursor++;
    }
    const lo = t - WINDOW;
    while (recent.length && recent[0].t < lo) recent.shift();
    let wsum = 0;
    let vsum = 0;
    for (const r of recent) {
      const w = Math.exp(-(t - r.t) / TAU);
      wsum += w;
      vsum += w * r.v;
    }
    const mean = wsum > 0 ? vsum / wsum : 0;
    env[s] = Math.pow(mean, 0.82); // same contrast shaping as inkpressure
  }

  // slide a PASSAGE_DUR window; pick the one with the greatest pressure RANGE
  // (max - min) — that is the passage where the swell/thin is most visible.
  const win = Math.max(2, Math.round(PASSAGE_DUR / SAMPLE_DT));
  let bestStart = 0;
  let bestScore = -1;
  const stride = Math.max(1, Math.round(1 / SAMPLE_DT)); // ~1s hop
  for (let a = 0; a + win <= steps; a += stride) {
    let mn = 1;
    let mx = 0;
    let sum = 0;
    for (let i = a; i < a + win; i++) {
      const e = env[i];
      if (e < mn) mn = e;
      if (e > mx) mx = e;
      sum += e;
    }
    const mean = sum / win;
    // reward range AND some overall weight, so we don't pick a dead-quiet stretch
    const score = mx - mn + 0.25 * mean;
    if (score > bestScore) {
      bestScore = score;
      bestStart = a;
    }
  }
  if (bestScore <= 0) {
    // essentially flat dynamics — still show something honest
    bestStart = 0;
  }

  const startT = bestStart * SAMPLE_DT;
  const dur = win * SAMPLE_DT;
  const pts: Pt[] = [];
  const usableW = SVG_W - 2 * PAD_X;
  for (let k = 0; k < N_POINTS; k++) {
    const f = k / (N_POINTS - 1);
    const idx = clamp(bestStart + Math.round(f * (win - 1)), 0, steps - 1);
    const p = env[idx];
    const x = PAD_X + f * usableW;
    // gentle two-tone meander so the mark reads as a calligraphic stroke
    const y =
      CENTER_Y +
      Math.sin(f * Math.PI * 3.1) * MEANDER * 0.7 +
      Math.sin(f * Math.PI * 7.7 + 1.3) * MEANDER * 0.3;
    const hw = HW_MIN + Math.pow(p, 1.15) * (HW_MAX - HW_MIN);
    pts.push({ x, y, hw, p });
  }
  return { pts, start: startT, dur, synthetic: false };
}

// Representative swell/thin contour used ONLY if his analysis can't be fetched —
// the effect is still demonstrated; any audio played is still his real recording.
function syntheticPassage(): { pts: Pt[]; start: number; dur: number } {
  const pts: Pt[] = [];
  const usableW = SVG_W - 2 * PAD_X;
  // a hand-authored dynamic arc: whisper → surge to forte → lift → second swell
  const arc = (f: number) => {
    const a = Math.exp(-Math.pow((f - 0.34) / 0.14, 2)); // big forte
    const b = 0.7 * Math.exp(-Math.pow((f - 0.72) / 0.11, 2)); // second swell
    const bed = 0.12 + 0.1 * Math.sin(f * Math.PI * 5);
    return clamp(Math.max(a, b) * 0.95 + bed * 0.4, 0, 1);
  };
  for (let k = 0; k < N_POINTS; k++) {
    const f = k / (N_POINTS - 1);
    const p = arc(f);
    const x = PAD_X + f * usableW;
    const y =
      CENTER_Y +
      Math.sin(f * Math.PI * 3.1) * MEANDER * 0.7 +
      Math.sin(f * Math.PI * 7.7 + 1.3) * MEANDER * 0.3;
    const hw = HW_MIN + Math.pow(p, 1.15) * (HW_MAX - HW_MIN);
    pts.push({ x, y, hw, p });
  }
  return { pts, start: 12, dur: PASSAGE_DUR };
}

// find pressure/point at a given x (pts are monotonic in x)
function sampleAtX(pts: Pt[], x: number): Pt {
  if (pts.length === 0) return { x, y: CENTER_Y, hw: HW_MIN, p: 0 };
  if (x <= pts[0].x) return pts[0];
  const last = pts[pts.length - 1];
  if (x >= last.x) return last;
  // linear scan is fine at N_POINTS resolution
  let i = 1;
  while (i < pts.length && pts[i].x < x) i++;
  const a = pts[i - 1];
  const b = pts[i];
  const t = (x - a.x) / ((b.x - a.x) || 1);
  return {
    x,
    y: a.y + (b.y - a.y) * t,
    hw: a.hw + (b.hw - a.hw) * t,
    p: a.p + (b.p - a.p) * t,
  };
}

export default function Page() {
  const [ready, setReady] = useState(false);
  const [hearing, setHearing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [synthetic, setSynthetic] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reduced, setReduced] = useState(false);

  // passage geometry (built once from his analysis)
  const passageRef = useRef<{ pts: Pt[]; start: number; dur: number }>({
    pts: [],
    start: 0,
    dur: PASSAGE_DUR,
  });

  // audio graph
  const ctxRef = useRef<AudioContext | null>(null);
  const masterRef = useRef<SafeMaster | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const startedAtRef = useRef(0);
  const bufRef = useRef<AudioBuffer | null>(null);

  // loop clock
  const rafRef = useRef<number | null>(null);
  const loopStartRef = useRef(0);
  const hearingRef = useRef(false);
  const reducedRef = useRef(false);
  const bloomRef = useRef(0);
  const freqBuf = useRef<Float32Array<ArrayBuffer> | null>(null);

  // SVG refs (mutated per frame; never React re-render)
  const clipRectRef = useRef<SVGRectElement | null>(null);
  const tipRef = useRef<SVGCircleElement | null>(null);
  const tipGlowRef = useRef<SVGCircleElement | null>(null);
  const accentRef = useRef<SVGPathElement | null>(null);
  const bodyRef = useRef<SVGPathElement | null>(null);
  const wetRef = useRef<SVGPathElement | null>(null);
  const bleedRef = useRef<SVGPathElement | null>(null);

  useEffect(() => {
    reducedRef.current = reduced;
  }, [reduced]);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduced(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  // paint the full phrase into the static paths (whole ribbon), once geometry set
  const paintStatic = useCallback(() => {
    const { pts } = passageRef.current;
    const d = drawRibbon(pts, 0, pts.length);
    bodyRef.current?.setAttribute("d", d);
    wetRef.current?.setAttribute("d", d);
    bleedRef.current?.setAttribute("d", d);
    accentRef.current?.setAttribute("d", drawAccent(pts));
  }, []);

  const frame = useCallback((ts: number) => {
    rafRef.current = requestAnimationFrame(frame);
    const { pts, dur } = passageRef.current;
    if (pts.length < 2) return;
    if (loopStartRef.current === 0) loopStartRef.current = ts;

    // live bloom from his real audio, only while hearing
    const master = masterRef.current;
    let rms = 0;
    if (hearingRef.current && master) {
      const an = master.analyser;
      if (!freqBuf.current || freqBuf.current.length !== an.fftSize) {
        freqBuf.current = new Float32Array(an.fftSize) as Float32Array<ArrayBuffer>;
      }
      an.getFloatTimeDomainData(freqBuf.current);
      const buf = freqBuf.current;
      let s = 0;
      for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i];
      rms = Math.sqrt(s / buf.length);
    }
    bloomRef.current += (rms - bloomRef.current) * 0.08;

    // reveal fraction 0..1 across the passage
    let f: number;
    if (reducedRef.current) {
      f = 1; // static: show the whole phrase at rest
    } else if (hearingRef.current && ctxRef.current) {
      const t = ctxRef.current.currentTime - startedAtRef.current;
      f = clamp(t / dur, 0, 1);
    } else {
      const cycle = dur / SWEEP_SPEED + HOLD;
      const local = ((ts - loopStartRef.current) / 1000) % cycle;
      f = clamp(local / (dur / SWEEP_SPEED), 0, 1);
    }

    const usableW = SVG_W - 2 * PAD_X;
    const sweepX = PAD_X + f * usableW;

    // reveal the wet ink up to the sweep (clip rect grows left→right)
    clipRectRef.current?.setAttribute("width", (sweepX + 2).toFixed(1));

    // ramp-in at the head so each loop enters softly, not as a hard wipe
    const headIn =
      reducedRef.current || hearingRef.current
        ? 1
        : clamp((f * dur) / SWEEP_SPEED / FADE, 0, 1);
    wetRef.current?.setAttribute("opacity", (0.9 * headIn).toFixed(3));

    // wet tip riding the ribbon edge, sized by local pressure + audio bloom
    const tip = sampleAtX(pts, sweepX);
    const bloom = 1 + bloomRef.current * 2.4;
    const tipR = (2 + tip.hw * 0.45) * bloom;
    if (tipRef.current) {
      tipRef.current.setAttribute("cx", sweepX.toFixed(1));
      tipRef.current.setAttribute("cy", tip.y.toFixed(1));
      tipRef.current.setAttribute("r", tipR.toFixed(1));
      tipRef.current.setAttribute("opacity", f < 1 && !reducedRef.current ? "0.95" : "0");
    }
    if (tipGlowRef.current) {
      tipGlowRef.current.setAttribute("cx", sweepX.toFixed(1));
      tipGlowRef.current.setAttribute("cy", tip.y.toFixed(1));
      tipGlowRef.current.setAttribute("r", (tipR * 2.4).toFixed(1));
      const g = clamp((tip.p - 0.55) / 0.35, 0, 1) * 0.4;
      tipGlowRef.current.setAttribute(
        "opacity",
        (f < 1 && !reducedRef.current ? g : 0).toFixed(3),
      );
    }
  }, []);

  // build geometry from his analysis on mount, then start the muted loop
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let notes: TrackNote[] = [];
      try {
        const a = await loadTrackAnalysis(TRACK.id);
        if (a && a.notes.length > 0) notes = a.notes;
      } catch {
        notes = [];
      }
      if (cancelled) return;
      const built = buildPassage(notes);
      passageRef.current = { pts: built.pts, start: built.start, dur: built.dur };
      setSynthetic(built.synthetic);
      setReady(true);
      paintStatic();
      loopStartRef.current = 0;
      if (rafRef.current === null) rafRef.current = requestAnimationFrame(frame);
    })();
    return () => {
      cancelled = true;
    };
  }, [frame, paintStatic]);

  const stopHearing = useCallback(() => {
    try {
      sourceRef.current?.stop();
    } catch {
      /* already stopped */
    }
    sourceRef.current = null;
    hearingRef.current = false;
    setHearing(false);
    loopStartRef.current = 0; // resume muted loop cleanly
  }, []);

  // play the ACTUAL take (his real recording), in sync with the sweep
  const hearTake = useCallback(async () => {
    if (hearingRef.current) {
      stopHearing();
      return;
    }
    setError(null);
    setBusy(true);
    try {
      let ctx = ctxRef.current;
      if (!ctx || ctx.state === "closed") {
        ctx = new AudioContext();
        ctxRef.current = ctx;
      }
      if (ctx.state === "suspended") await ctx.resume();
      let master = masterRef.current;
      if (!master) {
        master = createSafeMaster(ctx);
        masterRef.current = master;
      }
      let buffer = bufRef.current;
      if (!buffer) {
        const wh = await loadRealTrackBuffer(ctx, TRACK.id);
        buffer = wh.buffer;
        bufRef.current = buffer;
      }
      try {
        sourceRef.current?.stop();
      } catch {
        /* none */
      }
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.connect(master.input);
      const { start, dur } = passageRef.current;
      const offset = synthetic ? 0 : clamp(start, 0, Math.max(0, buffer.duration - 0.1));
      src.onended = () => {
        if (sourceRef.current === src) stopHearing();
      };
      startedAtRef.current = ctx.currentTime;
      src.start(0, offset, Math.min(dur, buffer.duration - offset));
      sourceRef.current = src;
      hearingRef.current = true;
      setHearing(true);
      if (rafRef.current === null) rafRef.current = requestAnimationFrame(frame);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not play his recording.");
    } finally {
      setBusy(false);
    }
  }, [frame, stopHearing, synthetic]);

  // full teardown
  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      try {
        sourceRef.current?.stop();
      } catch {
        /* already stopped */
      }
      sourceRef.current = null;
      masterRef.current?.disconnect();
      masterRef.current = null;
      const ac = ctxRef.current;
      ctxRef.current = null;
      if (ac && ac.state !== "closed") void ac.close();
    };
  }, []);

  return (
    <main className="min-h-screen bg-background px-5 py-8 text-foreground sm:px-8">
      <div className="mx-auto max-w-4xl">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
          17104 · first look · 15 seconds
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
          One line, drawn by the weight of his hands
        </h1>
        <p className="mt-2 max-w-2xl text-base text-muted-foreground">
          This loops on its own — no sound needed. It&apos;s a preview of{" "}
          <span className="text-foreground">inkpressure</span>, sped up 3×. Watch
          the ink line: it{" "}
          <span className="text-foreground">swells black where he leans into a forte</span>{" "}
          and <span className="text-foreground">thins to a dry hair where he lifts</span>.
          That&apos;s his real dynamics — the weight of his touch — as a single
          brushstroke.
        </p>

        <div className="relative mt-5 overflow-hidden rounded-md border border-border">
          <svg
            viewBox={`0 0 ${SVG_W} ${SVG_H}`}
            width="100%"
            preserveAspectRatio="xMidYMid meet"
            role="img"
            aria-label="A calligraphic ink line whose thickness tracks the dynamic pressure of Karel's real piano playing — thick where he plays loud, thin where he plays soft."
            style={{ display: "block", background: GROUND_A }}
          >
            <defs>
              <linearGradient id="fl-ground" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor={GROUND_A} />
                <stop offset="1" stopColor={GROUND_B} />
              </linearGradient>
              <filter id="fl-bleed" x="-10%" y="-60%" width="120%" height="220%">
                <feGaussianBlur stdDeviation="3.4" />
              </filter>
              <clipPath id="fl-reveal">
                <rect ref={clipRectRef} x="0" y="0" width="0" height={SVG_H} />
              </clipPath>
            </defs>

            <rect x="0" y="0" width={SVG_W} height={SVG_H} fill="url(#fl-ground)" />
            <rect
              x="0"
              y="0"
              width={SVG_W}
              height={SVG_H}
              fill="none"
              stroke={GROUND_EDGE}
              strokeWidth="1"
            />

            {/* wet-ink bleed underlay for the whole phrase */}
            <path ref={bleedRef} d="" fill={INK} opacity="0.1" filter="url(#fl-bleed)" />
            {/* the whole phrase, settled/ghosted — its swells + thins read at rest */}
            <path ref={bodyRef} d="" fill={INK} opacity="0.28" />
            {/* the wet, heavy re-inking, revealed left→right by the clip */}
            <g clipPath="url(#fl-reveal)">
              <path ref={wetRef} d="" fill={INK_DEEP} opacity="0.9" />
              <path ref={accentRef} d="" fill={ACCENT} opacity="0.5" />
            </g>
            {/* wet tip riding the reveal edge */}
            <circle ref={tipGlowRef} cx="0" cy="0" r="0" fill={ACCENT} opacity="0" />
            <circle ref={tipRef} cx="0" cy="0" r="0" fill={INK_DEEP} opacity="0" />
          </svg>

          {/* baked caption — the whole point is that the ask reads at a glance */}
          <div className="pointer-events-none absolute left-3 top-3 rounded bg-background/70 px-2 py-1 font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground backdrop-blur-sm">
            {reduced
              ? "his phrase at rest · width = how hard he pressed"
              : synthetic
                ? "preview shape · width = how hard he pressed"
                : "his real velocities · width = how hard he pressed"}
          </div>
        </div>

        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

        {/* the ask — one line, one tap */}
        <div className="mt-6 rounded-lg border border-border bg-background/60 p-5">
          <p className="text-base text-foreground">
            <span className="font-semibold">Does that read?</span> If the line
            visibly swells where he leans in and thins where he lifts, that&apos;s
            the whole idea working — a &ldquo;yes&rdquo; unfreezes eleven days of a
            stuck ceiling. If it doesn&apos;t, that&apos;s just as useful to know.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <a
              href="/dream/17024-inkpressure"
              className="inline-flex min-h-[44px] items-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Open the full piece →
            </a>
            <button
              type="button"
              onClick={hearTake}
              disabled={busy || !ready}
              className="inline-flex min-h-[44px] items-center rounded-md border border-border bg-background/60 px-4 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-60"
            >
              {busy ? "Loading…" : hearing ? "Stop the take" : "▶ Hear the actual take"}
            </button>
            <span className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
              {hearing ? "playing his recording · in sync" : "looping · muted · 3× speed"}
            </span>
          </div>
        </div>

        <p className="mt-5 text-sm leading-relaxed text-muted-foreground">
          Why this page exists: fifteen prototypes are built and none has been
          opened — the only thing that moves the lab now is one real verdict, and
          the fastest one to give is this. Everything you see is drawn from
          Karel&apos;s own recording (&ldquo;{TRACK.title},&rdquo; Welcome Home);
          the loop needs no audio so it works on a phone with the sound off. Full
          design notes ship in this folder&apos;s README.
        </p>
      </div>
    </main>
  );
}
