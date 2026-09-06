"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  WELCOME_HOME_TRACKS,
  SNOWFLAKE_TRACKS,
  loadRealTrackBuffer,
  type WelcomeHomeTrack,
} from "../_shared/welcomeHome";
import {
  loadTrackAnalysis,
  chordRoot,
  chordIsMinor,
  pitchClassHue,
  type TrackChord,
} from "../_shared/trackAnalysis";
import { createSafeMaster, type SafeMaster } from "../_shared/visionary/safeMaster";

// ── just-intonation interval table, semitone (mod 12) → small-integer ratio ──
// Consonant intervals are simple fractions; dissonant ones climb the harmonic
// series. Fed straight into the harmonograph as pendulum frequency multipliers.
const JUST_RATIO: readonly number[] = [
  1 / 1, // 0  unison
  16 / 15, // 1  minor second
  9 / 8, // 2  major second
  6 / 5, // 3  minor third
  5 / 4, // 4  major third
  4 / 3, // 5  perfect fourth
  45 / 32, // 6  tritone
  3 / 2, // 7  perfect fifth
  8 / 5, // 8  minor sixth
  5 / 3, // 9  major sixth
  9 / 5, // 10 minor seventh
  15 / 8, // 11 major seventh
];

// Sensory-dissonance weight per interval (0 = pure, ~1 = grinding).
const DISSONANCE: readonly number[] = [
  0.0, 0.85, 0.4, 0.22, 0.15, 0.12, 0.8, 0.05, 0.28, 0.18, 0.45, 0.5,
];

interface ChordShape {
  /** interval offsets present, root (0) first, sorted low→high. */
  semitones: number[];
  /** 0 (pure) … 1 (grinding) sensory dissonance for the whole chord. */
  dissonance: number;
}

// Heuristic chord-symbol reader → the interval set + a dissonance scalar.
function readChordShape(symbol: string): ChordShape {
  const body0 = symbol.replace(/^[A-Ga-g][#b]?/, "");
  const b = body0.split("/")[0]; // drop the bass/inversion note
  const s = new Set<number>([0]);

  // triad quality
  if (/^(m|min|-)(?!aj)/.test(b)) {
    s.add(3);
    s.add(7);
  } else if (/^(dim|°|o)/.test(b)) {
    s.add(3);
    s.add(6);
  } else if (/^(aug|\+)/.test(b)) {
    s.add(4);
    s.add(8);
  } else if (/^sus2/.test(b)) {
    s.add(2);
    s.add(7);
  } else if (/^sus/.test(b)) {
    s.add(5);
    s.add(7);
  } else {
    s.add(4);
    s.add(7);
  }

  // sevenths
  if (/maj7|maj9|maj11|maj13|Δ|M7/.test(b)) s.add(11);
  else if (/(^|[^s])7|9|11|13/.test(b)) s.add(10);

  // extensions & added tones
  if (/9|add9/.test(b)) s.add(2);
  if (/11/.test(b)) s.add(5);
  if (/6|13/.test(b)) s.add(9);

  // alterations
  if (/b5|-5/.test(b)) {
    s.delete(7);
    s.add(6);
  }
  if (/#5|\+5/.test(b)) {
    s.delete(7);
    s.add(8);
  }
  if (/b9/.test(b)) s.add(1);
  if (/#9/.test(b)) s.add(3);
  if (/#11/.test(b)) s.add(6);
  if (/b13/.test(b)) s.add(8);

  const semitones = [...s].sort((a, c) => a - c);
  let acc = 0;
  for (const iv of semitones) acc += DISSONANCE[iv % 12] ?? 0.3;
  let dissonance = acc / Math.max(1, semitones.length);
  // extended stacks read as more restless even when each interval is mild.
  if (semitones.length >= 5) dissonance += 0.12;
  if (semitones.length >= 6) dissonance += 0.1;
  return { semitones, dissonance: Math.min(1, dissonance) };
}

// Deterministic ±1-ish detune direction per voice (no RNG, stable per frame).
function detuneSign(k: number): number {
  const g = (k + 1) * 0.6180339887498949;
  return (g - Math.floor(g)) * 2 - 1;
}

interface Pendulum {
  freq: number; // radians per t-unit
  amp: number;
  phase: number;
  damp: number;
}

interface Config {
  x: Pendulum[];
  y: Pendulum[];
  hue: number;
  sat: number;
  consonance: number; // 0..1, 1 = locks into a closed figure
}

const BASE_F = 2.0;

// Build the two-axis pendulum set from a chord's interval ratios.
function buildConfig(shape: ChordShape, root: number | null, minor: boolean): Config {
  const ratios = shape.semitones.slice(0, 5).map((semi) => JUST_RATIO[semi % 12]);
  if (ratios.length === 0) ratios.push(1);
  const detune = shape.dissonance * 0.055; // dissonant → quasi-irrational drift

  const x: Pendulum[] = [];
  const y: Pendulum[] = [];
  ratios.forEach((ratio, k) => {
    const eps = 1 + detuneSign(k) * detune;
    const pend: Pendulum = {
      freq: BASE_F * ratio * eps,
      amp: 1 / (1 + k * 0.85),
      phase: k * 0.9,
      // dissonant chords fray faster; consonant loops persist longer.
      damp: 0.018 + k * 0.006 + shape.dissonance * 0.02,
    };
    if (k % 2 === 0) x.push(pend);
    else y.push(pend);
  });
  if (y.length === 0) {
    // single-voice fallback so the y-axis is never flat.
    y.push({ freq: BASE_F * 1.5, amp: 0.6, phase: 1.2, damp: 0.03 });
  }

  // cool cyan→violet: compress the warm-anchored circle-of-fifths hue into 178..288.
  const pcHue = root == null ? 210 : pitchClassHue(root);
  const hue = 178 + (pcHue / 360) * 110;
  const sat = minor ? 62 : 92;
  const consonance = Math.max(0, Math.min(1, 1 - shape.dissonance * 1.15));
  return { x, y, hue, sat, consonance };
}

const DEFAULT_CONFIG: Config = buildConfig(readChordShape("Cmaj7"), 0, false);

// A slow default progression used when a track has no published analysis.
const FALLBACK_PROGRESSION: TrackChord[] = [
  { time: 0, chord: "Cmaj7", duration: 6 },
  { time: 6, chord: "Am9", duration: 6 },
  { time: 12, chord: "Fmaj9", duration: 6 },
  { time: 18, chord: "G13", duration: 4 },
  { time: 22, chord: "E7b9", duration: 4 },
  { time: 26, chord: "Dm7", duration: 6 },
];

interface Engine {
  ctx: AudioContext;
  master: SafeMaster;
  source: AudioBufferSourceNode;
  bytes: Uint8Array<ArrayBuffer>;
  chords: TrackChord[];
  startTime: number;
  raf: number;
  // smoothed live config
  cur: Config;
  target: Config;
  // pointer perturbation, decays toward 0 when released
  perturbX: number;
  perturbY: number;
  perturbActive: boolean;
  trail: string[]; // recent path d-strings for the ghost trail
  frame: number;
}

const MAX_POINTS = 1600;
const MIN_POINTS = 640;
const T_STEP = 0.045;
const SVG_SIZE = 1000;
const CENTER = SVG_SIZE / 2;
const SCALE = 360;

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpPend(a: Pendulum, b: Pendulum, t: number): Pendulum {
  return {
    freq: lerp(a.freq, b.freq, t),
    amp: lerp(a.amp, b.amp, t),
    phase: lerp(a.phase, b.phase, t),
    damp: lerp(a.damp, b.damp, t),
  };
}

function lerpAxis(a: Pendulum[], b: Pendulum[], t: number): Pendulum[] {
  const n = Math.max(a.length, b.length);
  const out: Pendulum[] = [];
  for (let i = 0; i < n; i++) {
    const pa = a[i] ?? { ...b[i], amp: 0 };
    const pb = b[i] ?? { ...a[i], amp: 0 };
    out.push(lerpPend(pa, pb, t));
  }
  return out;
}

// Trace the summed-decaying-sinusoid figure into an SVG path `d` string.
function traceFigure(cfg: Config, points: number, rot: number, pPhase: number, pDamp: number): string {
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);
  let d = "";
  for (let i = 0; i < points; i++) {
    const t = i * T_STEP;
    let px = 0;
    let py = 0;
    for (const p of cfg.x) {
      px += p.amp * Math.sin(p.freq * t + p.phase + pPhase) * Math.exp(-(p.damp + pDamp) * t);
    }
    for (const p of cfg.y) {
      py += p.amp * Math.sin(p.freq * t + p.phase + pPhase) * Math.exp(-(p.damp + pDamp) * t);
    }
    const norm = 1 / (cfg.x.length * 0.9 + 0.6);
    px *= norm;
    py *= norm;
    // slow global precession so the figure is alive even when closed
    const rx = px * cos - py * sin;
    const ry = px * sin + py * cos;
    const X = CENTER + rx * SCALE;
    const Y = CENTER + ry * SCALE;
    d += (i === 0 ? "M" : "L") + X.toFixed(1) + " " + Y.toFixed(1);
  }
  return d;
}

const TRACK_GROUPS: { name: string; tracks: readonly WelcomeHomeTrack[] }[] = [
  { name: "Welcome Home", tracks: WELCOME_HOME_TRACKS },
  { name: "Snowflake", tracks: SNOWFLAKE_TRACKS },
];

export default function NodalFigurePage() {
  const [status, setStatus] = useState<"idle" | "loading" | "playing" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [trackId, setTrackId] = useState<string>(WELCOME_HOME_TRACKS[0].id);
  const [title, setTitle] = useState<string>("");
  const [chordLabel, setChordLabel] = useState<string>("—");
  const [lockLabel, setLockLabel] = useState<string>("");
  const [consonancePct, setConsonancePct] = useState<number>(0);
  const [analysisMissing, setAnalysisMissing] = useState<boolean>(false);
  const [showNotes, setShowNotes] = useState<boolean>(false);

  const engineRef = useRef<Engine | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const mainPathRef = useRef<SVGPathElement | null>(null);
  const ghost1Ref = useRef<SVGPathElement | null>(null);
  const ghost2Ref = useRef<SVGPathElement | null>(null);
  const glowRef = useRef<SVGCircleElement | null>(null);

  const teardown = useCallback(() => {
    const e = engineRef.current;
    if (!e) return;
    cancelAnimationFrame(e.raf);
    try {
      e.source.stop();
    } catch {
      /* already stopped */
    }
    try {
      e.source.disconnect();
    } catch {
      /* noop */
    }
    e.master.disconnect();
    void e.ctx.close();
    engineRef.current = null;
  }, []);

  useEffect(() => teardown, [teardown]);

  const frame = useCallback(() => {
    const e = engineRef.current;
    if (!e) return;

    // ── RMS / energy from the tamed master analyser ──
    e.master.analyser.getByteFrequencyData(e.bytes);
    let sum = 0;
    for (let i = 0; i < e.bytes.length; i++) {
      const v = e.bytes[i] / 255;
      sum += v * v;
    }
    const rms = Math.sqrt(sum / e.bytes.length); // 0..~1
    const energy = Math.min(1, rms * 2.2);

    // ── walk the chord list against playback time ──
    const elapsed = e.ctx.currentTime - e.startTime;
    let active: TrackChord | null = null;
    for (let i = e.chords.length - 1; i >= 0; i--) {
      if (e.chords[i].time <= elapsed) {
        active = e.chords[i];
        break;
      }
    }
    if (!active && e.chords.length) active = e.chords[0];
    if (active) {
      const root = chordRoot(active.chord);
      const shape = readChordShape(active.chord);
      e.target = buildConfig(shape, root, chordIsMinor(active.chord));
      if (e.frame % 6 === 0) {
        setChordLabel(active.chord);
        setConsonancePct(Math.round(e.target.consonance * 100));
        setLockLabel(e.target.consonance > 0.6 ? "closing — locked figure" : "drifting — open web");
      }
    }

    // glide toward the target config
    const k = 0.06;
    e.cur = {
      x: lerpAxis(e.cur.x, e.target.x, k),
      y: lerpAxis(e.cur.y, e.target.y, k),
      hue: lerp(e.cur.hue, e.target.hue, k),
      sat: lerp(e.cur.sat, e.target.sat, k),
      consonance: lerp(e.cur.consonance, e.target.consonance, k),
    };

    // pointer perturbation decays when released
    if (!e.perturbActive) {
      e.perturbX *= 0.94;
      e.perturbY *= 0.94;
    }
    const pPhase = e.perturbX * 2.4;
    const pDamp = e.perturbY * 0.03;

    // point count follows energy; capped for phones
    const points = Math.round(MIN_POINTS + energy * (MAX_POINTS - MIN_POINTS));
    // slow precession — consonant figures rotate rigidly, dissonant ones spread
    const rot = elapsed * 0.06 * (0.4 + e.cur.consonance * 0.6);

    const d = traceFigure(e.cur, points, rot, pPhase, pDamp);

    const hue = e.cur.hue;
    const sat = e.cur.sat;
    const light = 58 + e.cur.consonance * 8;
    const stroke = `hsl(${hue.toFixed(0)} ${sat.toFixed(0)}% ${light.toFixed(0)}%)`;
    const opacity = (0.5 + energy * 0.5).toFixed(2);
    const width = (1.2 + energy * 2.2).toFixed(2);

    if (mainPathRef.current) {
      mainPathRef.current.setAttribute("d", d);
      mainPathRef.current.setAttribute("stroke", stroke);
      mainPathRef.current.setAttribute("stroke-opacity", opacity);
      mainPathRef.current.setAttribute("stroke-width", width);
    }
    // ghost trail: reuse the last couple of frames' paths, fading behind
    if (ghost1Ref.current && e.trail[0]) {
      ghost1Ref.current.setAttribute("d", e.trail[0]);
      ghost1Ref.current.setAttribute("stroke", stroke);
    }
    if (ghost2Ref.current && e.trail[1]) {
      ghost2Ref.current.setAttribute("d", e.trail[1]);
      ghost2Ref.current.setAttribute("stroke", stroke);
    }
    if (e.frame % 3 === 0) {
      e.trail.unshift(d);
      if (e.trail.length > 2) e.trail.pop();
    }
    if (glowRef.current) {
      glowRef.current.setAttribute("fill", stroke);
      glowRef.current.setAttribute("fill-opacity", (0.05 + energy * 0.09).toFixed(3));
      glowRef.current.setAttribute("r", (120 + energy * 90).toFixed(0));
    }

    e.frame++;
    e.raf = requestAnimationFrame(frame);
  }, []);

  const play = useCallback(async () => {
    teardown();
    setError(null);
    setStatus("loading");
    setAnalysisMissing(false);
    try {
      const Ctor: typeof AudioContext =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctor();
      if (ctx.state === "suspended") await ctx.resume();

      const master = createSafeMaster(ctx);
      const [{ buffer, title: t }, analysis] = await Promise.all([
        loadRealTrackBuffer(ctx, trackId),
        loadTrackAnalysis(trackId),
      ]);

      const chords =
        analysis && analysis.chords.length ? analysis.chords : FALLBACK_PROGRESSION;
      if (!analysis || !analysis.chords.length) setAnalysisMissing(true);

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(master.input);

      const bytes = new Uint8Array(master.analyser.frequencyBinCount) as Uint8Array<ArrayBuffer>;
      source.start();

      engineRef.current = {
        ctx,
        master,
        source,
        bytes,
        chords,
        startTime: ctx.currentTime,
        raf: 0,
        cur: DEFAULT_CONFIG,
        target: DEFAULT_CONFIG,
        perturbX: 0,
        perturbY: 0,
        perturbActive: false,
        trail: [],
        frame: 0,
      };
      setTitle(t);
      setStatus("playing");
      source.onended = () => {
        if (engineRef.current) setStatus("idle");
      };
      engineRef.current.raf = requestAnimationFrame(frame);
    } catch (err) {
      console.error(err);
      teardown();
      setError("Could not load Karel's recording. Check the connection and try again.");
      setStatus("error");
    }
  }, [trackId, teardown, frame]);

  const stop = useCallback(() => {
    teardown();
    setStatus("idle");
  }, [teardown]);

  // ── pointer / touch perturbation over the figure ──
  const applyPointer = useCallback((clientX: number, clientY: number, active: boolean) => {
    const e = engineRef.current;
    const svg = svgRef.current;
    if (!e || !svg) return;
    const r = svg.getBoundingClientRect();
    const nx = ((clientX - r.left) / r.width) * 2 - 1; // -1..1
    const ny = ((clientY - r.top) / r.height) * 2 - 1;
    e.perturbX = nx;
    e.perturbY = ny;
    e.perturbActive = active;
  }, []);

  const onPointerDown = useCallback(
    (ev: React.PointerEvent) => applyPointer(ev.clientX, ev.clientY, true),
    [applyPointer],
  );
  const onPointerMove = useCallback(
    (ev: React.PointerEvent) => {
      if (ev.buttons === 0 && ev.pointerType === "mouse") return;
      applyPointer(ev.clientX, ev.clientY, true);
    },
    [applyPointer],
  );
  const onPointerUp = useCallback(() => {
    const e = engineRef.current;
    if (e) e.perturbActive = false;
  }, []);

  const playing = status === "playing";

  return (
    <main className="relative min-h-screen w-full overflow-hidden bg-background text-foreground">
      {/* ── the SVG vector-ink figure ── */}
      <svg
        ref={svgRef}
        viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}
        preserveAspectRatio="xMidYMid meet"
        className="absolute inset-0 h-full w-full touch-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        aria-hidden
      >
        <circle ref={glowRef} cx={CENTER} cy={CENTER} r="140" fill="#5fd0ff" fillOpacity="0.06" />
        <g fill="none" strokeLinejoin="round" strokeLinecap="round">
          <path ref={ghost2Ref} d="" stroke="#5fd0ff" strokeOpacity="0.1" strokeWidth="1" />
          <path ref={ghost1Ref} d="" stroke="#5fd0ff" strokeOpacity="0.2" strokeWidth="1.2" />
          <path ref={mainPathRef} d="" stroke="#7fe0ff" strokeOpacity="0.85" strokeWidth="1.6" />
        </g>
      </svg>

      {/* ── chrome ── */}
      <div className="pointer-events-none relative z-10 flex min-h-screen flex-col justify-between p-6 sm:p-10">
        <header className="max-w-xl space-y-3">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
            Resonance · Dream Lab
          </p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Nodal Figure</h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            A harmonograph drawn in living SVG ink, its pendulum frequencies tuned to the
            just-intonation intervals of Karel&apos;s sounding chord. When his harmony is consonant
            the figure locks into a clean closed loop; when it tenses, it frays into a slowly
            drifting web. Drag across it to bend the standing wave.
          </p>
        </header>

        <div className="pointer-events-auto w-full max-w-xl space-y-4">
          {status === "playing" && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
              <span className="text-foreground">{title}</span>
              <span>chord {chordLabel}</span>
              <span>
                consonance <span className="text-primary">{consonancePct}%</span>
              </span>
              {lockLabel && <span>{lockLabel}</span>}
            </div>
          )}

          {analysisMissing && status === "playing" && (
            <p className="text-sm leading-relaxed text-muted-foreground">
              No published chord analysis for this take — tracing a slow default progression instead.
            </p>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex flex-wrap items-center gap-3">
            {!playing ? (
              <button
                onClick={play}
                disabled={status === "loading"}
                className="inline-flex min-h-[44px] items-center justify-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
              >
                {status === "loading" ? "Loading…" : "Play"}
              </button>
            ) : (
              <button
                onClick={stop}
                className="inline-flex min-h-[44px] items-center justify-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Stop
              </button>
            )}

            <select
              value={trackId}
              onChange={(ev) => setTrackId(ev.target.value)}
              disabled={playing || status === "loading"}
              className="min-h-[44px] rounded-md border border-border bg-background/60 px-4 text-sm text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-60"
            >
              {TRACK_GROUPS.map((g) => (
                <optgroup key={g.name} label={g.name}>
                  {g.tracks.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>

            <button
              onClick={() => setShowNotes(true)}
              className="inline-flex min-h-[44px] items-center justify-center rounded-md border border-border bg-background/60 px-4 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              Read the design notes
            </button>
          </div>
        </div>
      </div>

      {/* ── design-notes overlay ── */}
      {showNotes && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-background/80 p-6 backdrop-blur-sm">
          <div className="max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-border bg-background p-8">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold tracking-tight">Design notes</h2>
              <button
                onClick={() => setShowNotes(false)}
                className="inline-flex min-h-[44px] items-center justify-center rounded-md border border-border bg-background/60 px-4 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                Close
              </button>
            </div>
            <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
              <p>
                The centre of the screen holds one evolving harmonograph — a curve traced by summed
                decaying sinusoids,{" "}
                <span className="font-mono text-xs">x(t) = Σ Aᵢ·sin(fᵢt + φᵢ)·e^(−dᵢt)</span>. The
                pendulum frequency ratios fᵢ:gᵢ are read from the just-intonation intervals of the
                chord sounding in Karel&apos;s recording, walked against playback time.
              </p>
              <p>
                Consonant chords resolve to simple small-integer ratios (a fifth is 3:2, a major
                third 5:4), so the summed curve is periodic and retraces one clean closed loop.
                Extended and altered chords push the ratios toward irrational detunings, so the
                figure never closes — it precesses into an open lacework. That visible “does it close
                or drift” read is the whole piece.
              </p>
              <p>
                RMS energy from the ear-safe master analyser sets the number of traced points, stroke
                weight and opacity; the chord root sets hue (compressed into a cool cyan→violet band),
                and minor chords cool and desaturate. A short ghost-trail of two fading paths gives it
                life. Drag a fingertip or pointer across the figure to perturb the pendulum phases and
                damping — you feel like you&apos;re bending the standing wave.
              </p>
              <p>
                References: Ernst Chladni&apos;s Klangfiguren (1787 sand-figure standing waves), the
                Victorian harmonograph (pendulum-drawn Lissajous figures of musical intervals), and
                VectraSynth (2026) — a browser tool generating real-time audio-reactive SVG from
                contour lines tracing 2D standing-wave fields.
              </p>
              <p>
                <Link href="/dream" className="text-primary hover:underline">
                  ← Back to the dream lab
                </Link>
              </p>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
