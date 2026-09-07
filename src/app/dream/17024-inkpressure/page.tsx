"use client";

// ─────────────────────────────────────────────────────────────────────────────
// 17024 · Inkpressure — SEE THE WEIGHT OF KAREL'S TOUCH.
//
//   ONE QUESTION
//   Can you SEE the WEIGHT of Karel's touch — the physical dynamic pressure of
//   his real piano playing — as living INK under variable pressure: a
//   calligraphic line that swells black-heavy where he leans in and thins to a
//   dry hair where he lifts, with the harmony NOT the subject?
//
//   This is deliberately a NON-CHORD piece. The subject is DYNAMICS — velocity,
//   the weight of touch — not consonance or tension. A single calligraphic brush
//   lays his playing down as ink: WIDTH + darkness = his dynamic pressure. Forte
//   presses black ink; pianissimo barely wets the cool paper.
//
//   INPUT   autonomous. Press "Ink his playing" and his real recording plays and
//           the brush self-propels. No pointer-drag drives anything; the only
//           control is a small track picker.
//   OUTPUT  inline SVG only — the stroke is a real variable-width filled <path>
//           ribbon (never canvas, never WebGL), its `d` mutated per frame via a
//           ref, not re-rendered as React nodes.
//   DRIVE   his per-note VELOCITIES, read from the track analysis, become a
//           recency-weighted dynamic-pressure envelope → stroke weight. The live
//           safeMaster analyser (RMS) only adds a subtle tremor to the wet tip;
//           the STRUCTURE is his touch, not the FFT. Velocity SPREAD widens the
//           calligraphic flourish. Note density steers the brush's turns.
//
//   Named references (see README): Calliphony (arXiv 2608.03040, 2026);
//   "Visualising Pianists' Touch" (CHI 2026); the 2026 finding that velocity
//   spread / std-dev is the clearest positive marker of expressive quality.
//
//   Degrade: analysis null/empty → the pressure envelope is derived from the
//   live analyser RMS (badge "live-envelope fallback"). prefers-reduced-motion →
//   slower draw, no tip tremor, no flicker. Audio is ONLY his real catalog,
//   through safeMaster; exactly one bufferSource; full teardown on unmount.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { WELCOME_HOME_TRACKS, loadRealTrackBuffer } from "../_shared/welcomeHome";
import { loadTrackAnalysis, type TrackNote } from "../_shared/trackAnalysis";
import { createSafeMaster, type SafeMaster } from "../_shared/visionary/safeMaster";

// ── art palette: charcoal ink on a cool pale ground, one violet at peak weight ─
const GROUND_A = "#e8ecf3"; // cool paper, upper band
const GROUND_B = "#dfe4ee"; // cool paper, lower band
const GROUND_EDGE = "#cdd4e0"; // faint cool vignette line
const INK = "#242833"; // graphite ink — settled body
const INK_DEEP = "#12141b"; // near-black graphite — wet, heavy tail
const ACCENT = "#7c5cff"; // restrained violet, ONLY at peak weight

// ── stroke geometry ──────────────────────────────────────────────────────────
const SVG_W = 1200;
const SVG_H = 520;
const CENTER_Y = SVG_H * 0.5;
const HEAD_X = SVG_W * 0.72; // where the wet tip rides while drawing
const HW_MIN = 0.55; // half-width of a dry pianissimo hair (px)
const HW_MAX = 27; // half-width of a heavy forte press (px)
const SPEED = 138; // base rightward pen speed (px/s) — time → path length
const TAIL_N = 150; // points counted as the bright "wet" recent ink
const MAX_POINTS = 1150; // rolling buffer; older ink scrolls off the left
const WINDOW = 1.7; // seconds of recent notes feeding the envelope
const TAU = 0.5; // recency half-life (s) inside the window

interface Pt {
  x: number;
  y: number;
  hw: number; // local half-width = his dynamic pressure at this instant
}

const clamp = (v: number, lo: number, hi: number) =>
  v < lo ? lo : v > hi ? hi : v;

// Italian dynamic marking for the current pressure — makes "this is about
// DYNAMICS, not the chord" legible at a glance.
function dynamicWord(p: number): string {
  if (p < 0.1) return "— (lifted)";
  if (p < 0.24) return "pp";
  if (p < 0.38) return "p";
  if (p < 0.54) return "mp";
  if (p < 0.68) return "mf";
  if (p < 0.84) return "f";
  return "ff";
}

// Build a variable-width filled-ribbon `d` from a run of centreline points.
// Width is geometry (his pressure), so the swell/thin reads even with sound off.
function buildRibbon(pts: Pt[], from: number, to: number): string {
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
    const nx = -dy; // unit normal
    const ny = dx;
    const hw = pts[i].hw;
    top.push(`${(pts[i].x + nx * hw).toFixed(2)} ${(pts[i].y + ny * hw).toFixed(2)}`);
    bot.push(`${(pts[i].x - nx * hw).toFixed(2)} ${(pts[i].y - ny * hw).toFixed(2)}`);
  }
  bot.reverse();
  return `M${top[0]} L${top.slice(1).join(" L")} L${bot.join(" L")} Z`;
}

const SCATTER_N = 20; // dry-brush light specks when he lifts entirely

export default function Page() {
  const [track, setTrack] = useState(WELCOME_HOME_TRACKS[1]); // "Bath"
  const [phase, setPhase] = useState<"idle" | "loading" | "playing">("idle");
  const [fallback, setFallback] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showNotes, setShowNotes] = useState(false);
  const [reduced, setReduced] = useState(false);

  // audio graph
  const ctxRef = useRef<AudioContext | null>(null);
  const masterRef = useRef<SafeMaster | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const startedAtRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef(0);

  // his note-roll + walking cursor
  const notesRef = useRef<TrackNote[]>([]);
  const velNormRef = useRef(1); // divide velocities by this to reach 0..1
  const cursorRef = useRef(0);
  const lastTRef = useRef(0);
  const recentRef = useRef<{ t: number; v: number }[]>([]);
  const fallbackRef = useRef(false);

  // pen state
  const ptsRef = useRef<Pt[]>([]);
  const headXRef = useRef(0);
  const vyRef = useRef(0);
  const pRef = useRef(0); // smoothed pressure envelope 0..1
  const spreadRef = useRef(0); // velocity std-dev in window
  const densRef = useRef(0); // onsets/sec, recent
  const liveRef = useRef(0); // smoothed analyser RMS (wet-tip tremor only)
  const reducedRef = useRef(false);

  // SVG element refs (mutated per-frame; never React re-render)
  const groupRef = useRef<SVGGElement | null>(null);
  const bleedRef = useRef<SVGPathElement | null>(null);
  const bodyRef = useRef<SVGPathElement | null>(null);
  const tailRef = useRef<SVGPathElement | null>(null);
  const accentRef = useRef<SVGPathElement | null>(null);
  const dotsRef = useRef<(SVGCircleElement | null)[]>([]);
  const readWordRef = useRef<HTMLSpanElement | null>(null);
  const readBarRef = useRef<HTMLDivElement | null>(null);

  const freqBuf = useRef<Float32Array<ArrayBuffer> | null>(null);

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

  // Load his note-roll + detect the velocity scale (0..1 vs 0..127).
  const loadRoll = useCallback(async (id: string): Promise<boolean> => {
    let notes: TrackNote[] = [];
    try {
      const a = await loadTrackAnalysis(id);
      if (a && a.notes.length > 0) notes = a.notes;
    } catch {
      notes = [];
    }
    notesRef.current = notes;
    const vmax = notes.reduce((m, n) => Math.max(m, n.velocity), 0);
    velNormRef.current = vmax > 1.5 ? 127 : 1;
    const useFallback = notes.length === 0;
    fallbackRef.current = useFallback;
    setFallback(useFallback);
    return !useFallback;
  }, []);

  // reset the pen for a fresh performance
  const resetPen = useCallback(() => {
    ptsRef.current = [{ x: 0, y: CENTER_Y, hw: HW_MIN }];
    headXRef.current = 0;
    vyRef.current = 0;
    pRef.current = 0;
    spreadRef.current = 0;
    densRef.current = 0;
    liveRef.current = 0;
    cursorRef.current = 0;
    lastTRef.current = 0;
    recentRef.current = [];
  }, []);

  // Advance the recency-weighted dynamic-pressure envelope from his real
  // per-note velocities in the window [t-WINDOW, t]. Returns {target,spread,dens}.
  const computeEnvelope = useCallback((t: number) => {
    const notes = notesRef.current;
    const norm = velNormRef.current;
    // absorb onsets since the last frame into the recent ring
    let c = cursorRef.current;
    if (t < lastTRef.current) c = 0; // clock reset
    while (c < notes.length && notes[c].time <= t) {
      if (notes[c].time > lastTRef.current) {
        recentRef.current.push({ t: notes[c].time, v: clamp(notes[c].velocity / norm, 0, 1) });
      }
      c++;
    }
    cursorRef.current = c;
    lastTRef.current = t;
    // drop notes older than the window
    const rec = recentRef.current;
    const lo = t - WINDOW;
    let d = 0;
    while (d < rec.length && rec[d].t < lo) d++;
    if (d > 0) rec.splice(0, d);
    // recency-weighted mean (pressure) + std-dev (spread) + density
    let wsum = 0;
    let vsum = 0;
    for (const r of rec) {
      const w = Math.exp(-(t - r.t) / TAU);
      wsum += w;
      vsum += w * r.v;
    }
    const mean = wsum > 0 ? vsum / wsum : 0;
    let vv = 0;
    for (const r of rec) {
      const w = Math.exp(-(t - r.t) / TAU);
      vv += w * (r.v - mean) * (r.v - mean);
    }
    const spread = wsum > 0 ? Math.sqrt(vv / wsum) : 0;
    // count onsets in the last 1s for turn density
    let dens = 0;
    const d1 = t - 1;
    for (const r of rec) if (r.t >= d1) dens++;
    // shape: emphasise the dynamic contrast so forte/pianissimo separate clearly
    const target = Math.pow(mean, 0.82);
    return { target, spread, dens };
  }, []);

  const frame = useCallback(
    (ts: number) => {
      rafRef.current = requestAnimationFrame(frame);
      if (lastTsRef.current === 0) lastTsRef.current = ts;
      let dt = (ts - lastTsRef.current) / 1000;
      lastTsRef.current = ts;
      if (dt <= 0 || dt > 0.05) dt = 0.016;

      const ctx = ctxRef.current;
      const t = ctx ? ctx.currentTime - startedAtRef.current : 0;
      const rm = reducedRef.current;

      // live analyser RMS — subtle wet-tip tremor only (structure ≠ FFT)
      const master = masterRef.current;
      let rms = 0;
      if (master) {
        const an = master.analyser;
        if (!freqBuf.current || freqBuf.current.length !== an.fftSize) {
          freqBuf.current = new Float32Array(an.fftSize) as Float32Array<ArrayBuffer>;
        }
        an.getFloatTimeDomainData(freqBuf.current);
        let s = 0;
        const buf = freqBuf.current;
        for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i];
        rms = Math.sqrt(s / buf.length);
      }
      liveRef.current += (rms - liveRef.current) * (1 - Math.exp(-dt / 0.09));

      // dynamic-pressure envelope from his velocities (or RMS in fallback)
      let target: number;
      let spread: number;
      let dens: number;
      if (fallbackRef.current) {
        target = clamp(liveRef.current * 4.2, 0, 1);
        // crude spread/density proxies from the live signal
        spread = clamp(liveRef.current * 1.6, 0, 0.5);
        dens = clamp(liveRef.current * 30, 0, 8);
      } else {
        const e = computeEnvelope(t);
        target = e.target;
        spread = e.spread;
        dens = e.dens;
      }
      const smoothTau = rm ? 0.26 : 0.13;
      pRef.current += (target - pRef.current) * (1 - Math.exp(-dt / smoothTau));
      spreadRef.current += (spread - spreadRef.current) * (1 - Math.exp(-dt / 0.35));
      densRef.current += (dens - densRef.current) * (1 - Math.exp(-dt / 0.4));
      const P = pRef.current;
      const S = spreadRef.current;
      const D = densRef.current;

      // pen kinematics: rightward speed tied to activity (pauses slow the pen —
      // calligraphy fuses pressure, speed and pauses), meander tied to density,
      // flourish amplitude tied to velocity spread.
      const activity = 0.4 + 0.6 * clamp(P + D * 0.06, 0, 1);
      const speed = SPEED * activity * (rm ? 0.62 : 1);
      const pts = ptsRef.current;
      const head = pts[pts.length - 1];

      // vertical velocity: curl (density-scaled), spread flourish, centre restore
      const curlFreq = 0.7 + D * 0.5;
      const curl = Math.sin(t * curlFreq) * (18 + S * 220);
      const restore = -(head.y - CENTER_Y) * 1.5;
      const flourish = rm ? 0 : Math.sin(t * (2.1 + D * 0.7)) * S * 120;
      let vy = vyRef.current;
      vy += (curl + restore + flourish - vy) * (1 - Math.exp(-dt / 0.22));
      vy = clamp(vy, -260, 260);
      vyRef.current = vy;

      // wet-tip tremor from the live sound (never flicker; small, smoothed)
      const trem = rm ? 0 : (liveRef.current * 3.4) * Math.sin(t * 34);
      const nx = head.x + speed * dt;
      const ny = clamp(head.y + vy * dt, 40, SVG_H - 40);
      const hw = HW_MIN + Math.pow(P, 1.15) * (HW_MAX - HW_MIN) + Math.abs(trem);
      pts.push({ x: nx, y: ny, hw });
      headXRef.current = nx;
      if (pts.length > MAX_POINTS) pts.splice(0, pts.length - MAX_POINTS);

      // scroll the whole stroke so the wet tip rides at HEAD_X
      const tx = HEAD_X - nx;
      groupRef.current?.setAttribute("transform", `translate(${tx.toFixed(2)},0)`);

      // build the ribbons (string mutation on 3 DOM nodes; not React nodes)
      const to = pts.length;
      const bodyD = buildRibbon(pts, 0, to);
      const tailFrom = Math.max(0, to - TAIL_N);
      const tailD = buildRibbon(pts, tailFrom, to);
      bodyRef.current?.setAttribute("d", bodyD);
      bleedRef.current?.setAttribute("d", bodyD);
      tailRef.current?.setAttribute("d", tailD);
      accentRef.current?.setAttribute("d", tailD);

      // violet only at peak weight — a smooth threshold, no flicker
      const accentMix = clamp((P - 0.72) / 0.24, 0, 1);
      accentRef.current?.setAttribute("opacity", (accentMix * 0.6).toFixed(3));

      // dry-brush scatter of light when he lifts entirely
      const dots = dotsRef.current;
      const dryMix = clamp((0.16 - P) / 0.16, 0, 1);
      for (let i = 0; i < dots.length; i++) {
        const el = dots[i];
        if (!el) continue;
        if (dryMix > 0.05 && to > 4) {
          const idx = to - 1 - ((i * 7 + 1) % Math.min(to, TAIL_N));
          const q = pts[Math.max(0, idx)];
          const off = ((i % 5) - 2) * 6;
          el.setAttribute("cx", (q.x).toFixed(1));
          el.setAttribute("cy", (q.y + off).toFixed(1));
          el.setAttribute("r", (0.7 + (i % 3) * 0.5).toFixed(1));
          el.setAttribute("opacity", (dryMix * 0.5).toFixed(3));
        } else {
          el.setAttribute("opacity", "0");
        }
      }

      // live readout (DOM refs, throttled by rAF) — the dynamic marking + bar
      if (readWordRef.current) readWordRef.current.textContent = dynamicWord(P);
      if (readBarRef.current) readBarRef.current.style.width = `${(P * 100).toFixed(1)}%`;
    },
    [computeEnvelope],
  );

  const stopAudio = useCallback(() => {
    try {
      sourceRef.current?.stop();
    } catch {
      /* already stopped */
    }
    sourceRef.current = null;
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    setPhase("idle");
  }, []);

  const play = useCallback(async () => {
    setError(null);
    setPhase("loading");
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
      await loadRoll(track.id);
      const wh = await loadRealTrackBuffer(ctx, track.id);
      try {
        sourceRef.current?.stop();
      } catch {
        /* none playing */
      }
      const src = ctx.createBufferSource();
      src.buffer = wh.buffer;
      src.connect(master.input);
      src.onended = () => {
        if (sourceRef.current === src) stopAudio();
      };
      resetPen();
      startedAtRef.current = ctx.currentTime;
      lastTsRef.current = 0;
      src.start();
      sourceRef.current = src;
      setPhase("playing");
      if (rafRef.current === null) rafRef.current = requestAnimationFrame(frame);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start his recording.");
      setPhase("idle");
    }
  }, [track, loadRoll, resetPen, frame, stopAudio]);

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

  const dots = useMemo(
    () => Array.from({ length: SCATTER_N }, (_, i) => i),
    [],
  );

  const busy = phase === "loading";
  const playing = phase === "playing";

  return (
    <main className="min-h-screen bg-background px-5 py-8 text-foreground sm:px-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-5 flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
              17024 · inkpressure
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">
              The weight of his touch, as ink
            </h1>
            <p className="mt-2 text-base text-muted-foreground">
              His real playing drives one calligraphic brush — the line swells
              black-heavy where he leans in and thins to a dry hair where he
              lifts. The subject is his dynamics, not the chord.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowNotes((s) => !s)}
            className="min-h-[44px] shrink-0 rounded-md border border-border bg-background/60 px-4 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            {showNotes ? "Hide notes" : "Read the design notes"}
          </button>
        </header>

        {showNotes && (
          <div className="mb-5 rounded-md border border-border bg-background/60 p-4 text-sm text-muted-foreground">
            <p>
              Every note he plays carries a <strong className="text-foreground">velocity</strong> —
              how hard the key was struck. Those velocities, recency-weighted over
              the last ~1.7 s, become a smoothed <strong className="text-foreground">dynamic-pressure
              envelope</strong> that sets the brush&apos;s half-width and darkness. The
              spread (std-dev) of recent velocities widens the calligraphic
              flourish; note density steers its turns; a soft passage decays the
              line to a dry, pale hair and scatters light. The live analyser adds
              only a faint tremor to the wet tip — the structure is his hands. No
              synth: exactly his decoded recording through the ear-safety master.
            </p>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={playing ? stopAudio : play}
            disabled={busy}
            className="min-h-[44px] rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            {busy ? "Loading…" : playing ? "Stop" : "Ink his playing"}
          </button>

          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="font-mono text-xs uppercase tracking-[0.18em]">track</span>
            <select
              value={track.id}
              disabled={playing || busy}
              onChange={(e) => {
                const t = WELCOME_HOME_TRACKS.find((x) => x.id === e.target.value);
                if (t) setTrack(t);
              }}
              className="min-h-[44px] rounded-md border border-border bg-background/60 px-3 text-sm text-foreground hover:bg-accent disabled:opacity-60"
            >
              {WELCOME_HOME_TRACKS.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
          </label>

          {/* live dynamic readout */}
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
              pressure
            </span>
            <div className="h-2 w-28 overflow-hidden rounded-full bg-border">
              <div
                ref={readBarRef}
                className="h-full bg-primary"
                style={{ width: "0%" }}
              />
            </div>
            <span
              ref={readWordRef}
              className="min-w-[3.2rem] font-mono text-xs text-foreground"
            >
              —
            </span>
          </div>

          {fallback && (
            <span className="rounded-md border border-border px-2 py-1 font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
              live-envelope fallback
            </span>
          )}
        </div>

        {error && (
          <p className="mt-3 text-sm text-destructive">{error}</p>
        )}

        <div className="mt-5 overflow-hidden rounded-md border border-border">
          <svg
            viewBox={`0 0 ${SVG_W} ${SVG_H}`}
            width="100%"
            preserveAspectRatio="xMidYMid meet"
            role="img"
            aria-label="A calligraphic ink stroke whose thickness tracks the dynamic pressure of Karel's piano playing."
            style={{ display: "block", background: GROUND_A }}
          >
            <defs>
              <linearGradient id="ip-ground" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor={GROUND_A} />
                <stop offset="1" stopColor={GROUND_B} />
              </linearGradient>
              <filter id="ip-bleed" x="-10%" y="-40%" width="120%" height="180%">
                <feGaussianBlur stdDeviation="3.2" />
              </filter>
            </defs>

            <rect x="0" y="0" width={SVG_W} height={SVG_H} fill="url(#ip-ground)" />
            <rect
              x="0"
              y="0"
              width={SVG_W}
              height={SVG_H}
              fill="none"
              stroke={GROUND_EDGE}
              strokeWidth="1"
            />

            <g ref={groupRef} transform="translate(0,0)">
              {/* wet-ink bleed underlay */}
              <path
                ref={bleedRef}
                d=""
                fill={INK}
                opacity="0.12"
                filter="url(#ip-bleed)"
              />
              {/* settled body — the whole stroke, older ink low-opacity */}
              <path ref={bodyRef} d="" fill={INK} opacity="0.34" />
              {/* wet recent tail — heavy, dark */}
              <path ref={tailRef} d="" fill={INK_DEEP} opacity="0.9" />
              {/* violet only at peak weight */}
              <path ref={accentRef} d="" fill={ACCENT} opacity="0" />
              {/* dry-brush scatter when he lifts */}
              {dots.map((i) => (
                <circle
                  key={i}
                  ref={(el) => {
                    dotsRef.current[i] = el;
                  }}
                  cx="0"
                  cy="0"
                  r="1"
                  fill={INK}
                  opacity="0"
                />
              ))}
            </g>
          </svg>
        </div>

        <p className="mt-3 font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
          {playing
            ? "reading his velocities · width = pressure"
            : "press play — the brush self-propels on his recording"}
        </p>
      </div>
    </main>
  );
}
