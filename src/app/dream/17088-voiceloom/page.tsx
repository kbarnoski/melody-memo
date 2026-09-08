"use client";

// ─────────────────────────────────────────────────────────────────────────────
// 17088 · voice loom
//
//   "What if the counterpoint inside Karel's real piano recording were WOVEN —
//    each independent voice a thread on a loom, so when two voices move against
//    each other (contrary motion) the weave crosses and tightens, and when they
//    move together (parallel) the threads run straight and calm?"
//
//   This is a VOICE-LEADING / stream-separation piece. It takes Karel's already
//   recorded polyphony (the note roll from the analysis endpoint) and separates
//   it, CAUSALLY (past + present only, no look-ahead), into up to five independent
//   moving melodic lines — after the horizontal/vertical integration-segregation
//   principle of Cambouropoulos' voice-separation algorithm for symbolic music,
//   and Bregman's auditory stream account (Auditory Scene Analysis, 1990).
//
//   Each living voice is a continuous THREAD scrolling right-to-left along time.
//   Where two threads cross in pitch (contrary motion) they interlace over-under
//   and the weave tightens; where they run parallel they lie flat and calm. A new
//   voice enters the warp as a fresh thread; a voice silent too long frays out.
//
//   OUTPUT: Canvas2D only. AUDIO: Karel's catalog only — one AudioBufferSource
//   through the shared ear-safety master, zero synthesis, never ctx.destination.
// ─────────────────────────────────────────────────────────────────────────────

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { PrototypeNav } from "../_shared/prototype-nav";
import {
  createSafeMaster,
  type SafeMaster,
} from "../_shared/visionary/safeMaster";
import {
  COLLECTIONS,
  REAL_TRACKS,
  loadRealTrackBuffer,
} from "../_shared/welcomeHome";
import { loadTrackAnalysis, type TrackNote } from "../_shared/trackAnalysis";

// Default to "Bath".
const DEFAULT_TRACK_ID =
  REAL_TRACKS.find((t) => t.id === "eba95845-cdbf-41d8-9c5d-8679686811ad")?.id ??
  REAL_TRACKS[0].id;

type Phase = "idle" | "loading" | "running" | "error";
type MotionKind = "parallel" | "contrary" | "oblique" | "—";

// ── tuning constants ─────────────────────────────────────────────────────────
const MAX_VOICES = 5;
const CLUSTER_S = 0.04; // near-simultaneous onset window (a "chord")
const DORMANT_S = 1.6; // silence before a voice frays out
const FRAY_S = 1.1; // seconds a fraying thread lingers as it disperses
const WINDOW_S = 7.0; // seconds of time visible in the weave
const RAMP_S = 0.12; // glide time as a thread moves to its next pitch
const MIN_MIDI = 33;
const MAX_MIDI = 93;

// warm-neutral thread palette: graphite → taupe → sepia → pale-gold.
const THREAD_COLORS = ["#7d7266", "#9a8467", "#b8925c", "#cdae70", "#8a8074"];
const SOPRANO_COLOR = "#a98fd6"; // the ONE violet accent, for the topmost voice

interface TrailPt {
  t: number;
  pitch: number;
  vel: number;
}

interface Voice {
  id: number;
  colorIdx: number;
  curPitch: number;
  prevPitch: number;
  lastTime: number;
  birthT: number;
  trail: TrailPt[];
  alive: boolean;
  frayStart: number; // playhead time the voice went dormant (fray anim origin)
}

interface AssignState {
  voices: Voice[];
  seq: number;
}

interface AudioEngine {
  ctx: AudioContext;
  master: SafeMaster;
  source: AudioBufferSourceNode;
  gain: GainNode;
  startTime: number;
  duration: number;
  title: string;
  freq: Uint8Array<ArrayBuffer>;
}

// ── math helpers ─────────────────────────────────────────────────────────────
function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

function pitchToY(pitch: number, height: number, pad: number): number {
  const n = (clamp(pitch, MIN_MIDI, MAX_MIDI) - MIN_MIDI) / (MAX_MIDI - MIN_MIDI);
  return pad + (1 - n) * (height - 2 * pad);
}

// Pitch of a voice at time t: holds the current note, then glides over RAMP_S
// into the next note's pitch. Returns null before the thread was born.
function pitchAtTime(trail: TrailPt[], t: number): number | null {
  const n = trail.length;
  if (n === 0) return null;
  if (t < trail[0].t) return null;
  if (t >= trail[n - 1].t) return trail[n - 1].pitch;
  let lo = 0;
  let hi = n - 1;
  while (lo < hi) {
    const m = (lo + hi + 1) >> 1;
    if (trail[m].t <= t) lo = m;
    else hi = m - 1;
  }
  const a = trail[lo];
  const b = trail[lo + 1];
  const rampStart = b.t - RAMP_S;
  if (t <= rampStart) return a.pitch;
  const k = clamp((t - rampStart) / RAMP_S, 0, 1);
  const s = k * k * (3 - 2 * k); // smoothstep glide
  return a.pitch + (b.pitch - a.pitch) * s;
}

// ── the causal voice-leading assigner (the core algorithm) ───────────────────
// Assigns a near-simultaneous cluster of notes (a chord) to independent voices,
// minimising pitch movement while preferring NO voice-crossing (Cambouropoulos).
// Returns the motion type read from the two most-active voices this cluster.
function assignCluster(
  state: AssignState,
  cluster: TrailPt[],
  playhead: number,
): MotionKind | null {
  if (cluster.length === 0) return null;
  // high → low
  cluster.sort((a, b) => b.pitch - a.pitch);

  // active (living) voices, highest current pitch first
  const active = state.voices
    .filter((v) => v.alive)
    .sort((a, b) => b.curPitch - a.curPitch);

  const touched: Voice[] = [];
  let vptr = 0;

  for (let i = 0; i < cluster.length; i++) {
    const note = cluster[i];
    const remainingNotes = cluster.length - i;
    const remainingVoices = active.length - vptr;

    if (remainingVoices <= 0) {
      // more notes than voices → SPAWN a new voice (a thread enters the warp),
      // unless we're at the cap, in which case fold onto the nearest voice.
      if (state.voices.filter((v) => v.alive).length < MAX_VOICES) {
        const v: Voice = {
          id: state.seq++,
          colorIdx: state.seq % THREAD_COLORS.length,
          curPitch: note.pitch,
          prevPitch: note.pitch,
          lastTime: playhead,
          birthT: playhead,
          trail: [{ t: playhead, pitch: note.pitch, vel: note.vel }],
          alive: true,
          frayStart: 0,
        };
        state.voices.push(v);
        touched.push(v);
      } else {
        // cap reached: attach to the nearest living voice by pitch
        let best: Voice | null = null;
        let bestD = Infinity;
        for (const v of state.voices) {
          if (!v.alive) continue;
          const d = Math.abs(v.curPitch - note.pitch);
          if (d < bestD) {
            bestD = d;
            best = v;
          }
        }
        if (best) {
          best.prevPitch = best.curPitch;
          best.curPitch = note.pitch;
          best.lastTime = playhead;
          best.trail.push({ t: playhead, pitch: note.pitch, vel: note.vel });
          touched.push(best);
        }
      }
      continue;
    }

    // With spare voices we may skip a voice to reach a closer pitch match,
    // as long as order (no crossing) is preserved.
    if (remainingVoices > remainingNotes) {
      while (
        active.length - (vptr + 1) >= remainingNotes &&
        Math.abs(active[vptr + 1].curPitch - note.pitch) <
          Math.abs(active[vptr].curPitch - note.pitch)
      ) {
        vptr++;
      }
    }

    const v = active[vptr++];
    v.prevPitch = v.curPitch;
    v.curPitch = note.pitch;
    v.lastTime = playhead;
    v.trail.push({ t: playhead, pitch: note.pitch, vel: note.vel });
    touched.push(v);
  }

  // ── motion type from the two most-active (largest-moving) voices ───────────
  if (touched.length < 2) return null;
  touched.sort(
    (a, b) =>
      Math.abs(b.curPitch - b.prevPitch) - Math.abs(a.curPitch - a.prevPitch),
  );
  const d0 = touched[0].curPitch - touched[0].prevPitch;
  const d1 = touched[1].curPitch - touched[1].prevPitch;
  const EPS = 0.5;
  if (Math.abs(d0) < EPS || Math.abs(d1) < EPS) return "oblique";
  return Math.sign(d0) === Math.sign(d1) ? "parallel" : "contrary";
}

// ── the loom renderer (Canvas2D only) ────────────────────────────────────────
// Returns this frame's crossing density (0..1-ish) so the caller can smooth the
// weave tightness across frames.
function drawLoom(
  g: CanvasRenderingContext2D,
  state: AssignState,
  playhead: number,
  energy: number,
  tightness: number,
  width: number,
  height: number,
): number {
  const pad = 34;
  const x0 = 0;
  const x1 = width;
  const tStart = playhead - WINDOW_S;

  // warm parchment-dark ground
  g.clearRect(0, 0, width, height);
  const bg = g.createLinearGradient(0, 0, 0, height);
  bg.addColorStop(0, "#211a12");
  bg.addColorStop(1, "#171009");
  g.fillStyle = bg;
  g.fillRect(0, 0, width, height);

  // faint loom "reed" — horizontal reference lines, breathing with energy
  g.lineWidth = 1;
  for (let m = MIN_MIDI + 3; m < MAX_MIDI; m += 6) {
    const y = pitchToY(m, height, pad);
    g.strokeStyle = `rgba(190,160,110,${0.03 + energy * 0.04})`;
    g.beginPath();
    g.moveTo(x0, y);
    g.lineTo(x1, y);
    g.stroke();
  }

  // sample grid shared by every thread
  const step = 3;
  const N = Math.max(2, Math.floor((x1 - x0) / step));
  const xs = new Float64Array(N + 1);
  const ts = new Float64Array(N + 1);
  for (let i = 0; i <= N; i++) {
    xs[i] = x0 + (i / N) * (x1 - x0);
    ts[i] = tStart + (i / N) * WINDOW_S;
  }

  // living + fraying voices with a trail
  const shown = state.voices.filter(
    (v) => v.trail.length > 0 && (v.alive || playhead - v.frayStart < FRAY_S),
  );
  if (shown.length === 0) return 0;

  // topmost living voice → violet accent
  let topId = -1;
  let topPitch = -Infinity;
  for (const v of shown) {
    if (v.alive && v.curPitch > topPitch) {
      topPitch = v.curPitch;
      topId = v.id;
    }
  }

  const V = shown.length;
  const ys: Float64Array[] = [];
  const present: Uint8Array[] = [];
  const hidden: Uint8Array[] = [];
  const wobSpeed = 5.5;
  const wobAmp = 2 + tightness * 12;

  for (let v = 0; v < V; v++) {
    const vc = shown[v];
    const yy = new Float64Array(N + 1);
    const pr = new Uint8Array(N + 1);
    for (let i = 0; i <= N; i++) {
      const t = ts[i];
      const p = pitchAtTime(vc.trail, t);
      const live = vc.alive ? true : t <= vc.frayStart;
      if (p === null || !live) {
        pr[i] = 0;
        yy[i] = pitchToY(vc.curPitch, height, pad);
        continue;
      }
      pr[i] = 1;
      // weave undulation — amplitude rises with contrapuntal tightness, and
      // eases to zero at the playhead so the thread head sits on true pitch.
      const headFade = clamp((playhead - t) / 0.5, 0, 1);
      const wob = Math.sin(t * wobSpeed + vc.id * 1.7) * wobAmp * headFade;
      yy[i] = pitchToY(p, height, pad) + wob;
    }
    ys.push(yy);
    present.push(pr);
    hidden.push(new Uint8Array(N + 1));
  }

  // ── crossings → interlace (alternating over/under) + tightening ────────────
  let crossings = 0;
  const knots: { x: number; y: number; color: string }[] = [];
  const KW = 2; // half-width of the under-thread gap, in samples
  for (let a = 0; a < V; a++) {
    for (let b = a + 1; b < V; b++) {
      for (let i = 1; i <= N; i++) {
        if (!present[a][i] || !present[a][i - 1] || !present[b][i] || !present[b][i - 1])
          continue;
        const d0 = ys[a][i - 1] - ys[b][i - 1];
        const d1 = ys[a][i] - ys[b][i];
        if (d0 === 0) continue;
        if ((d0 < 0) !== (d1 < 0)) {
          crossings++;
          const overIsA = crossings % 2 === 0; // alternate the weave
          const over = overIsA ? a : b;
          const under = overIsA ? b : a;
          for (let k = i - KW; k <= i + KW; k++) {
            if (k >= 0 && k <= N) hidden[under][k] = 1;
          }
          const ov = shown[over];
          const col = ov.id === topId ? SOPRANO_COLOR : THREAD_COLORS[ov.colorIdx];
          knots.push({ x: xs[i], y: (ys[a][i] + ys[b][i]) / 2, color: col });
        }
      }
    }
  }

  // ── stroke each thread, broken where it passes UNDER another ───────────────
  g.lineCap = "round";
  g.lineJoin = "round";
  for (let v = 0; v < V; v++) {
    const vc = shown[v];
    const isTop = vc.id === topId;
    const color = isTop ? SOPRANO_COLOR : THREAD_COLORS[vc.colorIdx];
    const frayK = vc.alive ? 0 : clamp((playhead - vc.frayStart) / FRAY_S, 0, 1);
    const alpha = (isTop ? 0.95 : 0.82) * (1 - frayK);
    // thread weight from the most recent note's velocity
    const vel = vc.trail[vc.trail.length - 1]?.vel ?? 70;
    const lw = 1.4 + (vel / 127) * 3.2;

    g.globalAlpha = alpha;
    g.strokeStyle = color;
    g.lineWidth = lw;
    g.shadowColor = color;
    g.shadowBlur = (isTop ? 8 : 5) * (0.4 + energy);

    let drawing = false;
    for (let i = 0; i <= N; i++) {
      const vis = present[v][i] && !hidden[v][i];
      if (vis) {
        // as a thread frays, splay it apart near the head
        const frayOff =
          frayK > 0 ? Math.sin(i * 0.6 + vc.id) * frayK * 10 : 0;
        if (!drawing) {
          g.beginPath();
          g.moveTo(xs[i], ys[v][i] + frayOff);
          drawing = true;
        } else {
          g.lineTo(xs[i], ys[v][i] + frayOff);
        }
      } else if (drawing) {
        g.stroke();
        drawing = false;
      }
    }
    if (drawing) g.stroke();
  }
  g.shadowBlur = 0;

  // ── knots at the crossings — where the weave tightens ──────────────────────
  g.globalAlpha = 0.9;
  for (const kn of knots) {
    g.strokeStyle = kn.color;
    g.lineWidth = 2.4 + tightness * 2;
    g.beginPath();
    g.moveTo(kn.x - 3, kn.y - 3);
    g.lineTo(kn.x + 3, kn.y + 3);
    g.stroke();
  }

  // ── thread heads at the playhead — a node per living voice ─────────────────
  for (let v = 0; v < V; v++) {
    const vc = shown[v];
    if (!vc.alive) continue;
    const isTop = vc.id === topId;
    const color = isTop ? SOPRANO_COLOR : THREAD_COLORS[vc.colorIdx];
    const y = pitchToY(vc.curPitch, height, pad);
    // newborn threads pulse brighter as they enter the warp
    const age = playhead - vc.birthT;
    const born = clamp(1 - age / 0.6, 0, 1);
    g.globalAlpha = 1;
    g.fillStyle = color;
    g.shadowColor = color;
    g.shadowBlur = 6 + born * 10 + energy * 6;
    g.beginPath();
    g.arc(x1 - 3, y, (isTop ? 3.6 : 2.8) + born * 3, 0, Math.PI * 2);
    g.fill();
  }
  g.shadowBlur = 0;
  g.globalAlpha = 1;

  return Math.min(1, crossings / 6);
}

export default function VoiceLoomPage() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string>(DEFAULT_TRACK_ID);
  const [noAnalysis, setNoAnalysis] = useState(false);
  const [readout, setReadout] = useState<{
    title: string;
    voices: number;
    motion: MotionKind;
  }>({ title: "", voices: 0, motion: "—" });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<AudioEngine | null>(null);
  const notesRef = useRef<TrackNote[]>([]);
  const noteIdxRef = useRef(0);
  const pendingRef = useRef<TrailPt[]>([]);
  const clusterStartRef = useRef(0);
  const stateRef = useRef<AssignState>({ voices: [], seq: 0 });
  const motionRef = useRef<MotionKind>("—");
  const tightnessRef = useRef(0);
  const startedRef = useRef(false);

  // ── audio teardown (also runs on unmount) ──────────────────────────────────
  const teardownAudio = useCallback(() => {
    const eng = engineRef.current;
    engineRef.current = null;
    if (!eng) return;
    try {
      eng.source.stop();
    } catch {
      /* already stopped */
    }
    try {
      eng.source.disconnect();
      eng.gain.disconnect();
    } catch {
      /* noop */
    }
    eng.master.disconnect();
    void eng.ctx.close().catch(() => {});
  }, []);

  useEffect(() => teardownAudio, [teardownAudio]);

  // ── enter: gesture-gated audio boot + analysis fetch ────────────────────────
  const enter = useCallback(async () => {
    if (startedRef.current) return;
    startedRef.current = true;
    setPhase("loading");
    setErrorMsg(null);
    setNoAnalysis(false);

    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AC) {
      startedRef.current = false;
      setErrorMsg("This browser has no Web Audio support.");
      setPhase("error");
      return;
    }
    const ctx = new AC();
    try {
      await ctx.resume();
    } catch {
      /* may already be running */
    }

    const master = createSafeMaster(ctx);
    master.setGain(0.85);

    const trackId = selectedId;
    let loaded: { buffer: AudioBuffer; title: string };
    try {
      loaded = await loadRealTrackBuffer(ctx, trackId);
    } catch {
      master.disconnect();
      void ctx.close().catch(() => {});
      startedRef.current = false;
      setErrorMsg(
        "Karel's recording could not be reached right now. Please try again.",
      );
      setPhase("error");
      return;
    }

    // pull the note roll so the loom can separate the real polyphony; a null
    // analysis still plays audio (motion glow derives from the analyser).
    let notes: TrackNote[] = [];
    try {
      const analysis = await loadTrackAnalysis(trackId);
      notes = analysis?.notes ?? [];
    } catch {
      notes = [];
    }
    notesRef.current = notes;
    setNoAnalysis(notes.length === 0);

    // reset the causal assigner state
    noteIdxRef.current = 0;
    pendingRef.current = [];
    clusterStartRef.current = 0;
    stateRef.current = { voices: [], seq: 0 };
    motionRef.current = "—";
    tightnessRef.current = 0;

    const gain = ctx.createGain();
    gain.gain.value = 0.0001;
    const source = ctx.createBufferSource();
    source.buffer = loaded.buffer;
    source.loop = false;
    source.connect(gain);
    gain.connect(master.input);
    const startTime = ctx.currentTime + 0.06;
    source.start(startTime);
    gain.gain.setTargetAtTime(0.92, startTime, 0.9);

    engineRef.current = {
      ctx,
      master,
      source,
      gain,
      startTime,
      duration: loaded.buffer.duration,
      title: loaded.title,
      freq: new Uint8Array(master.analyser.frequencyBinCount),
    };
    setReadout({ title: loaded.title, voices: 0, motion: "—" });
    setPaused(false);
    setPhase("running");
  }, [selectedId]);

  // ── pause / resume (autonomous playback, no drag/keyboard driver) ───────────
  const togglePause = useCallback(() => {
    const eng = engineRef.current;
    if (!eng) return;
    if (eng.ctx.state === "running") {
      void eng.ctx.suspend().then(() => setPaused(true));
    } else {
      void eng.ctx.resume().then(() => setPaused(false));
    }
  }, []);

  // ── the animation loop: causal ingest + weave render ────────────────────────
  useEffect(() => {
    if (phase !== "running") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const g = canvas.getContext("2d");
    if (!g) return;

    let width = 0;
    let height = 0;
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = canvas.clientWidth || window.innerWidth;
      height = canvas.clientHeight || window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    let energy = 0;
    let raf = 0;
    let readoutAccum = 0;
    let last = performance.now();

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dtMs = Math.min(64, now - last);
      last = now;

      const eng = engineRef.current;
      if (!eng) return;
      const playhead = Math.max(0, eng.ctx.currentTime - eng.startTime);

      // ── causal note ingest → cluster → voice-leading assignment ────────────
      const notes = notesRef.current;
      const pending = pendingRef.current;
      let idx = noteIdxRef.current;
      while (idx < notes.length && notes[idx].time <= playhead) {
        const n = notes[idx];
        if (pending.length === 0) {
          pending.push({ t: n.time, pitch: n.midi, vel: n.velocity });
          clusterStartRef.current = n.time;
          idx++;
        } else if (n.time - clusterStartRef.current <= CLUSTER_S) {
          pending.push({ t: n.time, pitch: n.midi, vel: n.velocity });
          idx++;
        } else {
          break; // next note opens a new cluster — flush the current one first
        }
      }
      noteIdxRef.current = idx;
      // flush the pending cluster once it is provably closed (causal):
      // either the playhead has passed its window, or a later note exists.
      if (
        pending.length > 0 &&
        (playhead > clusterStartRef.current + CLUSTER_S ||
          (idx < notes.length &&
            notes[idx].time - clusterStartRef.current > CLUSTER_S))
      ) {
        const m = assignCluster(stateRef.current, pending.slice(), playhead);
        if (m) motionRef.current = m;
        pendingRef.current = [];
      }

      // ── dormancy → fray; prune fully-dispersed threads; cap trails ─────────
      const st = stateRef.current;
      for (const v of st.voices) {
        if (v.alive && playhead - v.lastTime > DORMANT_S) {
          v.alive = false;
          v.frayStart = playhead;
        }
        const cutoff = playhead - WINDOW_S - 0.5;
        while (v.trail.length > 2 && v.trail[1].t < cutoff) v.trail.shift();
      }
      st.voices = st.voices.filter(
        (v) => v.alive || playhead - v.frayStart < FRAY_S,
      );

      // ── analyser energy (global weave glow) ────────────────────────────────
      eng.master.analyser.getByteFrequencyData(eng.freq);
      let sum = 0;
      for (let i = 0; i < eng.freq.length; i++) sum += eng.freq[i];
      const target = sum / (eng.freq.length * 255);
      energy += (target - energy) * 0.12;

      // ── tightness: contrapuntal crossing density + motion bias, smoothed ────
      const motionBias =
        motionRef.current === "contrary"
          ? 0.55
          : motionRef.current === "oblique"
            ? 0.2
            : 0.05;

      const crossDensity = drawLoom(
        g,
        st,
        playhead,
        energy,
        tightnessRef.current,
        width,
        height,
      );
      const tightTarget = clamp(crossDensity * 0.7 + motionBias, 0, 1);
      tightnessRef.current += (tightTarget - tightnessRef.current) * 0.06;

      // ── throttled readout ──────────────────────────────────────────────────
      readoutAccum += dtMs;
      if (readoutAccum > 200) {
        readoutAccum = 0;
        const vc = st.voices.filter((v) => v.alive).length;
        setReadout((prev) =>
          prev.voices === vc && prev.motion === motionRef.current
            ? prev
            : { ...prev, voices: vc, motion: motionRef.current },
        );
      }
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [phase]);

  return (
    <main className="relative h-[100dvh] w-full overflow-hidden bg-background text-foreground">
      {phase === "running" && (
        <canvas
          ref={canvasRef}
          className="absolute inset-0 block h-full w-full"
        />
      )}

      {/* corner back-link */}
      <Link
        href="/dream"
        className="absolute left-4 top-4 z-30 font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground transition-colors hover:text-foreground"
      >
        ← dream
      </Link>

      {/* idle / loading / error curtain */}
      {phase !== "running" && (
        <div className="absolute inset-0 flex items-center justify-center p-6">
          <div className="w-full max-w-xl text-center">
            <p className="font-mono text-xs uppercase tracking-[0.3em] text-primary">
              counterpoint on a loom
            </p>
            <h1 className="mt-3 text-xl font-semibold tracking-tight sm:text-3xl">
              voice loom
            </h1>
            <p className="mt-3 text-base leading-relaxed text-muted-foreground">
              Karel&apos;s recorded polyphony, separated in real time into
              independent moving threads — when two voices move against each other
              the weave crosses and tightens; when they move together the threads
              run straight and calm.
            </p>

            {/* track selector */}
            <div className="mt-6 flex flex-col items-center gap-2">
              <label
                htmlFor="vl-track"
                className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground"
              >
                choose a take
              </label>
              <select
                id="vl-track"
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
                disabled={phase === "loading"}
                className="min-h-[44px] w-full max-w-xs rounded-md border border-border bg-background/60 px-4 text-base text-foreground transition-colors hover:bg-accent disabled:opacity-60"
              >
                {COLLECTIONS.map((c) => (
                  <optgroup key={c.name} label={c.name}>
                    {c.tracks.map((tr) => (
                      <option key={tr.id} value={tr.id}>
                        {tr.title}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            {phase === "error" && (
              <p className="mt-6 text-base text-destructive">{errorMsg}</p>
            )}

            <button
              onClick={enter}
              disabled={phase === "loading"}
              className="mt-6 inline-flex min-h-[44px] items-center justify-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
            >
              {phase === "loading" ? "Threading the loom…" : "Play"}
            </button>

            <p className="mt-6 font-mono text-xs leading-relaxed text-muted-foreground">
              headphones recommended · it runs itself
            </p>
          </div>
        </div>
      )}

      {/* running chrome */}
      {phase === "running" && (
        <>
          {/* live readout */}
          <div className="pointer-events-none absolute right-4 top-4 select-none text-right">
            <div className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
              {readout.title || "Karel — piano"}
            </div>
            <div className="mt-1 font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
              {readout.voices} {readout.voices === 1 ? "voice" : "voices"} ·{" "}
              {readout.motion}
            </div>
            {noAnalysis && (
              <div className="mt-1 font-mono text-xs uppercase tracking-[0.18em] text-destructive">
                no note analysis — audio only
              </div>
            )}
          </div>

          {/* transport + notes */}
          <div className="absolute bottom-4 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2">
            <button
              onClick={togglePause}
              className="inline-flex min-h-[44px] items-center justify-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              {paused ? "Play" : "Pause"}
            </button>
            <button
              onClick={() => setNotesOpen(true)}
              className="inline-flex min-h-[44px] items-center justify-center rounded-md border border-border bg-background/60 px-4 text-sm text-muted-foreground backdrop-blur-md transition-colors hover:bg-accent hover:text-foreground"
            >
              Design notes
            </button>
          </div>
        </>
      )}

      {/* design-notes modal */}
      {notesOpen && (
        <div
          className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          onClick={() => setNotesOpen(false)}
        >
          <div
            className="max-h-[80dvh] max-w-lg overflow-y-auto rounded-md border border-border bg-background p-6 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <h2 className="text-xl font-semibold tracking-tight">
                voice loom — design notes
              </h2>
              <button
                onClick={() => setNotesOpen(false)}
                className="min-h-[44px] rounded-md border border-border px-3 text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                close
              </button>
            </div>
            <div className="mt-4 space-y-3 text-base leading-relaxed text-muted-foreground">
              <p>
                One question: <em>what if the counterpoint inside Karel&apos;s
                real piano recording were woven</em> — each independent voice a
                thread on a loom, so contrary motion crosses and tightens the weave
                and parallel motion lets the threads run straight and calm?
              </p>
              <p>
                As the take plays, a <strong>causal</strong> assigner walks the
                note roll using past and present only — no look-ahead. Notes whose
                onsets fall inside a ~40&nbsp;ms window are read as one chord and
                sorted high&nbsp;→&nbsp;low, then handed to up to five independent
                voices to <em>minimise pitch movement while preferring no
                voice-crossing</em> (after Cambouropoulos&apos; horizontal/vertical
                integration–segregation principle for symbolic music). More notes
                than voices spawns a new thread into the warp; a voice silent past
                ~1.6&nbsp;s frays out.
              </p>
              <p>
                Each frame the two most-active voices are compared by the sign of
                their pitch deltas — same sign is <em>parallel</em>, opposite is{" "}
                <em>contrary</em>, one held is <em>oblique</em>. Where threads cross
                in pitch they interlace over-under and the weave tightens; the
                crossing density plus the motion type drive the undulation
                amplitude, so contrapuntally busy moments visibly knot up.
              </p>
              <p>
                Streaming into separate lines follows Bregman&apos;s auditory scene
                account (<em>Auditory Scene Analysis</em>, 1990). Audio is
                Karel&apos;s catalog only — one buffer source through the shared
                ear-safety master, no synthesis, driving the global weave glow from
                the analyser.
              </p>
            </div>
          </div>
        </div>
      )}

      <PrototypeNav slugs={["17088-voiceloom"]} />
    </main>
  );
}
