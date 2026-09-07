"use client";

// ─────────────────────────────────────────────────────────────────────────────
// 16992 · vaultloom
//
//   "What if Karel's harmony wove ARCHITECTURE — literal Xenakis ruled-surface
//    vaults lofting into being over the length of a piece, so the finished space
//    is the shape of the whole performance?"
//
//   Not the consonance of one chord — musical FORM over time. As a real take
//   plays, each section / strong chord change LOFTS a new vault: a
//   hyperbolic-paraboloid saddle panel built as a RULED SURFACE — a curved sheet
//   swept from STRAIGHT generatrix lines strung between a ground arc and a raised,
//   inset apex arc, exactly as Xenakis derived the Philips Pavilion vaults from
//   the string glissandi of Metastaseis. Successive vaults nest further out and
//   higher, so minute four is a materially bigger nave than minute one, and the
//   accreted space is the shape of the whole piece. Slender colonnade pillars are
//   secondary — they mark where each vault lands.
//
//   Every vault shares ONE big BufferGeometry per layer (translucent stone shell +
//   luminous straight generatrices), and growth is driven by a single global
//   `uGrowFront` uniform advancing in piece-seconds — allocation-free, coherent,
//   and instantly replayable (technique after Codrops, "Exploring Procedural
//   Geometry with Three.js and WebGPU", 2026-08-11; here on a standard WebGL
//   renderer). A shared world-space breath field pulses the whole structure with
//   the master RMS.
//
//   INPUT: device-orientation gyro tilt to look around (primary); pointer-drag is
//   a fallback ONLY when gyro is denied/absent, plus a slow idle auto-orbit.
//   AUDIO: Karel's catalog only, one AudioBufferSource, everything through the
//   shared ear-safety master — zero synthesis, never ctx.destination.
//   REF: Iannis Xenakis, Metastaseis (1954) → Philips Pavilion (1958).
// ─────────────────────────────────────────────────────────────────────────────

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { PrototypeNav } from "../_shared/prototype-nav";
import {
  createSafeMaster,
  type SafeMaster,
} from "../_shared/visionary/safeMaster";
import {
  COLLECTIONS,
  REAL_TRACKS,
  WELCOME_HOME_TRACKS,
  loadRealTrackBuffer,
} from "../_shared/welcomeHome";
import {
  loadTrackAnalysis,
  chordRoot,
  chordIsMinor,
  pitchClassHue,
  type TrackAnalysis,
} from "../_shared/trackAnalysis";

// Default: "Welcome Home" — a strong, spacious opener whose form reads clearly.
const DEFAULT_TRACK_ID =
  WELCOME_HOME_TRACKS.find((t) => t.title === "Welcome Home")?.id ??
  REAL_TRACKS[0].id;

type Phase = "idle" | "loading" | "running" | "error";

interface AudioEngine {
  ctx: AudioContext;
  master: SafeMaster;
  source: AudioBufferSourceNode;
  gain: GainNode;
  startTime: number;
  duration: number;
  title: string;
  freq: Uint8Array<ArrayBuffer>;
  time: Uint8Array<ArrayBuffer>;
}

// ── a single vault's structural parameters (baked once from the analysis) ──────
interface VaultDesc {
  course: number; // running index — later courses nest further out + higher
  birth: number; // grow-units (piece seconds) when this vault begins lofting
  a0: number; // ground-arc start angle
  a1: number; // ground-arc end angle
  Rg: number; // ground-arc radius
  Ra: number; // apex-arc radius (further IN)
  H: number; // apex height
  twist: number; // apex-arc angular skew → doubly-ruled saddle
  hue: number; // 0..360, already remapped into the cool mineral band
  sat: number;
  light: number;
  minor: boolean;
  span: number; // 0..1 bass-derived half-angle / mass
  sectionLabel: string;
}

// grid resolution per vault
const NU = 22; // generatrices across the arc
const NV = 12; // samples along each straight generatrix
const MAX_VAULTS = 16;
const LOFT = 6.0; // grow-units for one vault to rise from flat to full
const SWEEP = 3.0; // extra spread so the growth front sweeps across the arc

// remap the house (warm-anchored) pitch-class hue into a cool cathedral band
// (cyan ~185° → violet ~280°) so the palette stays cool mineral, never warm.
function coolHue(pc: number): number {
  const h = pitchClassHue(pc); // 0..360
  return 185 + (h / 360) * 95;
}

// ── GLSL shared by the shell + generatrix-line materials ──────────────────────
const VERT = /* glsl */ `
  uniform float uGrowFront;
  uniform float uLoft;
  uniform float uRms;
  uniform float uAudioPhase;
  uniform vec3 uBreathDir;
  attribute vec3 aStart;
  attribute vec3 aEnd;
  attribute float aBirth;
  attribute float aHue;
  attribute float aSat;
  attribute float aLight;
  attribute float aV;
  varying float vGrow;
  varying float vGlow;
  varying float vV;
  varying float vHue;
  varying float vSat;
  varying float vLight;
  varying float vFog;
  void main() {
    // per-vertex growth: smoothstep across [birth, birth+loft]; birth already
    // carries an along-arc offset so the front sweeps u = 0 → 1.
    float g = smoothstep(aBirth, aBirth + uLoft, uGrowFront);
    vec3 pos = mix(aStart, aEnd, g);
    // coherent world-space breath — one field over the whole structure.
    vec4 wp = modelMatrix * vec4(pos, 1.0);
    float field = sin(dot(wp.xyz, uBreathDir) - uAudioPhase);
    pos.y += field * uRms * 1.1 * g;
    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mv;
    vGrow = g;
    // a bright rim rides the freshly-lofted growth front
    vGlow = smoothstep(0.0, 0.14, g) * (1.0 - smoothstep(0.14, 0.62, g));
    vV = aV;
    vHue = aHue;
    vSat = aSat;
    vLight = aLight;
    vFog = -mv.z;
  }
`;

const FRAG = /* glsl */ `
  precision highp float;
  uniform float uIsLine;
  uniform float uTreble;
  uniform float uOpacity;
  uniform vec3 uFogColor;
  uniform float uFogDensity;
  varying float vGrow;
  varying float vGlow;
  varying float vV;
  varying float vHue;
  varying float vSat;
  varying float vLight;
  varying float vFog;
  vec3 hsl2rgb(float h, float s, float l) {
    h = fract(h / 360.0);
    float c = (1.0 - abs(2.0 * l - 1.0)) * s;
    float x = c * (1.0 - abs(mod(h * 6.0, 2.0) - 1.0));
    float m = l - c * 0.5;
    vec3 rgb;
    float hp = h * 6.0;
    if (hp < 1.0) rgb = vec3(c, x, 0.0);
    else if (hp < 2.0) rgb = vec3(x, c, 0.0);
    else if (hp < 3.0) rgb = vec3(0.0, c, x);
    else if (hp < 4.0) rgb = vec3(0.0, x, c);
    else if (hp < 5.0) rgb = vec3(x, 0.0, c);
    else rgb = vec3(c, 0.0, x);
    return rgb + m;
  }
  void main() {
    if (vGrow < 0.01) discard;
    float light = vLight;
    float sat = vSat;
    // generatrix lines: brighter, and treble energy adds filigree toward the apex
    light += uIsLine * (0.14 + uTreble * 0.5 * vV);
    sat += uIsLine * 0.16;
    // cool rim as the vault is born
    light += vGlow * 0.34;
    vec3 col = hsl2rgb(vHue, clamp(sat, 0.0, 1.0), clamp(light, 0.0, 0.95));
    col += vGlow * vec3(0.12, 0.28, 0.40);
    float alpha = uOpacity * (0.28 + 0.72 * vGrow);
    float fogF = 1.0 - exp(-uFogDensity * uFogDensity * vFog * vFog);
    col = mix(col, uFogColor, clamp(fogF, 0.0, 1.0));
    gl_FragColor = vec4(col, alpha);
  }
`;

// ── binary search: index of the last item with time <= t ──────────────────────
function lastIndexBefore<T extends { time: number }>(arr: T[], t: number): number {
  let lo = 0;
  let hi = arr.length - 1;
  let idx = 0;
  while (lo <= hi) {
    const m = (lo + hi) >> 1;
    if (arr[m].time <= t) {
      idx = m;
      lo = m + 1;
    } else {
      hi = m - 1;
    }
  }
  return idx;
}

// ── bake the vault plan from the analysis (or a timed cadence if there is none) ─
function buildPlan(
  analysis: TrackAnalysis | null,
  duration: number,
): VaultDesc[] {
  const dur = Math.max(30, duration || 120);
  const sections = analysis?.summary?.sections ?? [];
  const chords = analysis?.chords ?? [];
  const notes = analysis?.notes ?? [];

  // candidate birth times: section starts ∪ strong chord-root changes
  const cands: { t: number; label: string }[] = [];
  if (sections.length) {
    sections.forEach((s, i) => {
      cands.push({
        t: (i / sections.length) * dur * 0.92,
        label: s.label || `Section ${i + 1}`,
      });
    });
  }
  if (chords.length) {
    let lastRoot = -1;
    let lastT = -1e9;
    for (const ch of chords) {
      const r = chordRoot(ch.chord);
      if (r !== null && r !== lastRoot && ch.time - lastT > dur * 0.045) {
        cands.push({ t: ch.time, label: ch.chord });
        lastRoot = r;
        lastT = ch.time;
      }
    }
  }
  // no analysis at all → an even timed cadence so vaults still loft
  if (cands.length === 0) {
    const n = 12;
    for (let i = 0; i < n; i++) {
      cands.push({ t: (i / n) * dur, label: `Phrase ${i + 1}` });
    }
  }

  cands.sort((a, b) => a.t - b.t);
  const spacing = Math.max(6, dur / (MAX_VAULTS * 1.15));
  const picked: { t: number; label: string }[] = [];
  for (const c of cands) {
    if (picked.length === 0 || c.t - picked[picked.length - 1].t >= spacing) {
      picked.push(c);
    }
    if (picked.length >= MAX_VAULTS) break;
  }
  if (picked.length) picked[0].t = 0; // something must be present at t = 0

  return picked.map((p, course): VaultDesc => {
    // harmony sounding at the vault's birth → hue + mode
    let root: number | null = null;
    let minor = false;
    let label = p.label;
    if (chords.length) {
      const ci = lastIndexBefore(chords, p.t);
      const sym = chords[ci]?.chord ?? "";
      root = chordRoot(sym);
      minor = chordIsMinor(sym);
      if (!sections.length) label = sym || label;
    }
    // bass energy near birth → span / mass
    let bass = 0;
    let bassTot = 0;
    if (notes.length) {
      const win = spacing * 1.2;
      for (let k = lastIndexBefore(notes, p.t); k < notes.length; k++) {
        if (notes[k].time > p.t + win) break;
        bassTot++;
        if (notes[k].midi < 52) bass++;
      }
    }
    const span = bassTot > 0 ? Math.min(1, (bass / bassTot) * 2.2 + 0.25) : 0.55;

    const hue = root !== null ? coolHue(root) : 210 + course * 3;
    const half = 0.62 + span * 0.5 + course * 0.02;
    return {
      course,
      birth: p.t,
      a0: -half,
      a1: half,
      Rg: 6.2 + course * 2.15,
      Ra: Math.max(1.6, 6.2 + course * 2.15 - (3.1 + course * 0.18)),
      H: 4.6 + course * 1.05 + (minor ? 1.6 : 0),
      twist: 0.12 + course * 0.012 + (minor ? 0.16 : 0),
      hue,
      sat: 0.16 + (minor ? 0.1 : 0) + span * 0.06,
      light: minor ? 0.42 : 0.52,
      minor,
      span,
      sectionLabel: label,
    };
  });
}

type V3 = [number, number, number];

// ── build the two shared geometries (shell + generatrix lines) from the plan ───
function buildGeometry(plan: VaultDesc[]) {
  // shell (translucent saddle panels + short colonnade pillars)
  const sStart: number[] = [];
  const sEnd: number[] = [];
  const sBirth: number[] = [];
  const sHue: number[] = [];
  const sSat: number[] = [];
  const sLight: number[] = [];
  const sV: number[] = [];
  // generatrix lines (the straight ruled lines, drawn luminous over the shell)
  const lStart: number[] = [];
  const lEnd: number[] = [];
  const lBirth: number[] = [];
  const lHue: number[] = [];
  const lSat: number[] = [];
  const lLight: number[] = [];
  const lV: number[] = [];

  const pushShell = (
    s: V3,
    e: V3,
    b: number,
    h: number,
    sa: number,
    li: number,
    vv: number,
  ) => {
    sStart.push(s[0], s[1], s[2]);
    sEnd.push(e[0], e[1], e[2]);
    sBirth.push(b);
    sHue.push(h);
    sSat.push(sa);
    sLight.push(li);
    sV.push(vv);
  };
  const pushLine = (
    s: V3,
    e: V3,
    b: number,
    h: number,
    sa: number,
    li: number,
    vv: number,
  ) => {
    lStart.push(s[0], s[1], s[2]);
    lEnd.push(e[0], e[1], e[2]);
    lBirth.push(b);
    lHue.push(h);
    lSat.push(sa);
    lLight.push(li);
    lV.push(vv);
  };

  for (const vt of plan) {
    // ground arc (radius Rg, y = 0) and apex arc (radius Ra, raised + skewed):
    // the STRAIGHT generatrix connects ground(u) → apex(u); as u sweeps the arc,
    // the family of straight lines sweeps out the curved hyperbolic-paraboloid.
    const ground = (u: number): V3 => {
      const th = vt.a0 + (vt.a1 - vt.a0) * u;
      return [Math.sin(th) * vt.Rg, 0, Math.cos(th) * vt.Rg];
    };
    const apex = (u: number): V3 => {
      const th = vt.a0 + vt.twist + (vt.a1 - vt.a0) * u;
      const y = vt.H * (0.86 + 0.14 * Math.sin(Math.PI * u)); // arched ridge
      return [Math.sin(th) * vt.Ra, y, Math.cos(th) * vt.Ra];
    };
    // full ruled-surface point at (u,v) = straight interp ground→apex
    const full = (u: number, v: number): V3 => {
      const g = ground(u);
      const a = apex(u);
      return [g[0] + (a[0] - g[0]) * v, g[1] + (a[1] - g[1]) * v, g[2] + (a[2] - g[2]) * v];
    };
    const birthAt = (u: number) => vt.birth + u * SWEEP;

    // ── shell triangles (collapsed start = flat on the ground arc, v folded to 0)
    for (let i = 0; i < NU - 1; i++) {
      for (let j = 0; j < NV - 1; j++) {
        const u0 = i / (NU - 1);
        const u1 = (i + 1) / (NU - 1);
        const v0 = j / (NV - 1);
        const v1 = (j + 1) / (NV - 1);
        // start states lie flat along the ground arc (all v collapsed)
        const s00 = ground(u0);
        const s10 = ground(u1);
        const e00 = full(u0, v0);
        const e10 = full(u1, v0);
        const e11 = full(u1, v1);
        const e01 = full(u0, v1);
        const b0 = birthAt(u0);
        const b1 = birthAt(u1);
        const h = vt.hue;
        const sa = vt.sat;
        const li = vt.light;
        // tri A: 00,10,11
        pushShell(s00, e00, b0, h, sa, li, v0);
        pushShell(s10, e10, b1, h, sa, li, v0);
        pushShell(s10, e11, b1, h, sa, li, v1);
        // tri B: 00,11,01
        pushShell(s00, e00, b0, h, sa, li, v0);
        pushShell(s10, e11, b1, h, sa, li, v1);
        pushShell(s00, e01, b0, h, sa, li, v1);
      }
    }

    // ── generatrix lines: for each u, the straight line ground→apex, drawn as
    //    segments along v so the "curve made of straight lines" is legible.
    for (let i = 0; i < NU; i++) {
      const u = i / (NU - 1);
      const b = birthAt(u);
      const s = ground(u);
      for (let j = 0; j < NV - 1; j++) {
        const v0 = j / (NV - 1);
        const v1 = (j + 1) / (NV - 1);
        pushLine(s, full(u, v0), b, vt.hue, vt.sat + 0.06, vt.light + 0.1, v0);
        pushLine(s, full(u, v1), b, vt.hue, vt.sat + 0.06, vt.light + 0.1, v1);
      }
    }

    // ── colonnade pillars: slender hex prisms where the vault lands (arc feet) —
    //    SECONDARY. They loft up from the floor with the vault.
    const feet: number[] = vt.course % 2 === 0 ? [0, 0.5, 1] : [0, 1];
    const pr = 0.16;
    const pillarH = Math.min(6.5, 2.2 + vt.course * 0.35);
    const NS = 6;
    for (const fu of feet) {
      const base = ground(fu);
      for (let k = 0; k < NS; k++) {
        const a = (k / NS) * Math.PI * 2;
        const a2 = ((k + 1) / NS) * Math.PI * 2;
        const bA: V3 = [base[0] + Math.cos(a) * pr, 0, base[2] + Math.sin(a) * pr];
        const bB: V3 = [base[0] + Math.cos(a2) * pr, 0, base[2] + Math.sin(a2) * pr];
        const tA: V3 = [bA[0], pillarH, bA[2]];
        const tB: V3 = [bB[0], pillarH, bB[2]];
        const b = vt.birth;
        const ph = 218; // neutral limestone grey
        const psat = 0.06;
        const pli = 0.5;
        // side quad: base verts stay on the floor (start=end), top verts loft up
        pushShell(bA, bA, b, ph, psat, pli, 0); // base A
        pushShell(bB, bB, b, ph, psat, pli, 0); // base B
        pushShell(bB, tB, b, ph, psat, pli, 1); // top B
        pushShell(bA, bA, b, ph, psat, pli, 0); // base A
        pushShell(bB, tB, b, ph, psat, pli, 1); // top B
        pushShell(bA, tA, b, ph, psat, pli, 1); // top A
      }
    }
  }

  const mk = (
    start: number[],
    end: number[],
    birth: number[],
    hue: number[],
    sat: number[],
    light: number[],
    vv: number[],
  ) => {
    const g = new THREE.BufferGeometry();
    const endAttr = new THREE.Float32BufferAttribute(end, 3);
    g.setAttribute("position", endAttr); // for frustum/bounds
    g.setAttribute("aEnd", endAttr);
    g.setAttribute("aStart", new THREE.Float32BufferAttribute(start, 3));
    g.setAttribute("aBirth", new THREE.Float32BufferAttribute(birth, 1));
    g.setAttribute("aHue", new THREE.Float32BufferAttribute(hue, 1));
    g.setAttribute("aSat", new THREE.Float32BufferAttribute(sat, 1));
    g.setAttribute("aLight", new THREE.Float32BufferAttribute(light, 1));
    g.setAttribute("aV", new THREE.Float32BufferAttribute(vv, 1));
    g.computeBoundingSphere();
    return g;
  };

  return {
    shell: mk(sStart, sEnd, sBirth, sHue, sSat, sLight, sV),
    lines: mk(lStart, lEnd, lBirth, lHue, lSat, lLight, lV),
  };
}

export default function VaultloomPage() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [webglFailed, setWebglFailed] = useState(false);
  const [tiltNote, setTiltNote] = useState<string | null>(null);
  const [notesOpen, setNotesOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string>(DEFAULT_TRACK_ID);
  const [hud, setHud] = useState<{
    title: string;
    section: string;
    vaults: number;
    grown: number;
    src: "form" | "cadence";
  }>({ title: "", section: "—", vaults: 0, grown: 0, src: "cadence" });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<AudioEngine | null>(null);
  const planRef = useRef<VaultDesc[] | null>(null);
  const analysisRef = useRef<TrackAnalysis | null>(null);
  const startedRef = useRef(false);

  // camera look steering (read by the render loop)
  const yawRef = useRef(0);
  const pitchRef = useRef(0.12);
  const gyroActiveRef = useRef(false); // true once real gyro data arrives
  const lastInputRef = useRef(0); // ms of last steering input (for idle orbit)

  // ── audio teardown (also runs on unmount) ───────────────────────────────────
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

  // ── enter: gesture-gated audio boot + analysis + orientation permission ──────
  const enter = useCallback(async () => {
    if (startedRef.current) return;
    startedRef.current = true;
    setPhase("loading");
    setErrorMsg(null);

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

    // fetch the analysis so the vaults are shaped by the actual form; a null
    // result degrades to a timed cadence inside buildPlan.
    let analysis: TrackAnalysis | null = null;
    try {
      analysis = await loadTrackAnalysis(trackId);
    } catch {
      analysis = null;
    }
    analysisRef.current = analysis;
    const plan = buildPlan(analysis, loaded.buffer.duration);
    planRef.current = plan;

    const gain = ctx.createGain();
    gain.gain.value = 0.0001;
    const source = ctx.createBufferSource();
    source.buffer = loaded.buffer;
    source.loop = true;
    source.connect(gain);
    gain.connect(master.input);
    const startTime = ctx.currentTime + 0.06;
    source.start(startTime);
    gain.gain.setTargetAtTime(0.9, startTime, 1.4);

    engineRef.current = {
      ctx,
      master,
      source,
      gain,
      startTime,
      duration: loaded.buffer.duration,
      title: loaded.title,
      freq: new Uint8Array(new ArrayBuffer(master.analyser.frequencyBinCount)),
      time: new Uint8Array(new ArrayBuffer(master.analyser.fftSize)),
    };
    setHud((h) => ({
      ...h,
      title: loaded.title,
      vaults: plan.length,
      src: analysis && (analysis.chords.length || analysis.summary?.sections?.length)
        ? "form"
        : "cadence",
    }));

    // iOS 13+ gates motion behind a gesture-scoped permission request.
    try {
      const doe = window.DeviceOrientationEvent as unknown as {
        requestPermission?: () => Promise<"granted" | "denied">;
      };
      if (doe && typeof doe.requestPermission === "function") {
        const res = await doe.requestPermission();
        if (res !== "granted") {
          setTiltNote("Tilt denied — drag to look around instead.");
        }
      }
    } catch {
      /* non-iOS, or already granted */
    }

    setPhase("running");
  }, [selectedId]);

  // ── three.js scene: the nave that lofts vault by vault ───────────────────────
  useEffect(() => {
    if (phase !== "running") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const plan = planRef.current;
    if (!plan || plan.length === 0) return;

    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: false,
      });
    } catch {
      setWebglFailed(true);
      return; // audio keeps playing; an on-brand notice shows
    }

    const BG = new THREE.Color(0x1b2129); // cool mineral stone — NOT near-dark
    const getSize = () => ({
      w: canvas.clientWidth || window.innerWidth,
      h: canvas.clientHeight || window.innerHeight,
    });
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(dpr);
    let { w, h } = getSize();
    renderer.setSize(w, h, false);

    const scene = new THREE.Scene();
    scene.background = BG;
    scene.fog = new THREE.FogExp2(BG.getHex(), 0.02);

    const camera = new THREE.PerspectiveCamera(60, w / h, 0.1, 400);

    // faint cool backdrop halo for depth
    const bgTex = makeRadialTexture([
      [0, "rgba(120,150,190,0.28)"],
      [0.5, "rgba(60,80,110,0.16)"],
      [1, "rgba(27,33,41,0)"],
    ]);
    const bgSprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: bgTex,
        transparent: true,
        depthWrite: false,
        depthTest: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    bgSprite.scale.set(240, 240, 1);
    bgSprite.position.set(0, 12, 60);
    bgSprite.renderOrder = -10;
    scene.add(bgSprite);

    // a faint radial floor grid grounds the growing nave in space
    const floorGeom = new THREE.BufferGeometry();
    {
      const fp: number[] = [];
      const rings = 9;
      for (let r = 1; r <= rings; r++) {
        const rad = r * 4.2;
        const segs = 96;
        for (let s = 0; s < segs; s++) {
          const a = (s / segs) * Math.PI * 2;
          const a2 = ((s + 1) / segs) * Math.PI * 2;
          fp.push(Math.sin(a) * rad, 0, Math.cos(a) * rad);
          fp.push(Math.sin(a2) * rad, 0, Math.cos(a2) * rad);
        }
      }
      const spokes = 24;
      for (let s = 0; s < spokes; s++) {
        const a = (s / spokes) * Math.PI * 2;
        fp.push(0, 0, 0, Math.sin(a) * rings * 4.2, 0, Math.cos(a) * rings * 4.2);
      }
      floorGeom.setAttribute("position", new THREE.Float32BufferAttribute(fp, 3));
    }
    const floorMat = new THREE.LineBasicMaterial({
      color: 0x3a4656,
      transparent: true,
      opacity: 0.28,
    });
    const floor = new THREE.LineSegments(floorGeom, floorMat);
    floor.position.y = -0.02;
    scene.add(floor);

    // ── the vaults: one shell geometry + one generatrix-line geometry ──────────
    const { shell, lines } = buildGeometry(plan);

    const commonUniforms = () => ({
      uGrowFront: { value: 0 },
      uLoft: { value: LOFT },
      uRms: { value: 0 },
      uAudioPhase: { value: 0 },
      uBreathDir: { value: new THREE.Vector3(0.12, 0.2, 0.09) },
      uTreble: { value: 0 },
      uFogColor: { value: new THREE.Color(BG.getHex()) },
      uFogDensity: { value: 0.02 },
    });

    const shellMat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: { ...commonUniforms(), uIsLine: { value: 0 }, uOpacity: { value: 0.34 } },
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.NormalBlending,
    });
    const lineMat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: { ...commonUniforms(), uIsLine: { value: 1 }, uOpacity: { value: 0.5 } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const shellMesh = new THREE.Mesh(shell, shellMat);
    const lineMesh = new THREE.LineSegments(lines, lineMat);
    // vertices ride between aStart and aEnd (+ breath) during growth, so keep
    // both meshes out of frustum culling to avoid any pop as vaults loft.
    shellMesh.frustumCulled = false;
    lineMesh.frustumCulled = false;
    scene.add(shellMesh);
    scene.add(lineMesh);

    // ── steering: gyro PRIMARY; pointer-drag fallback only when gyro absent ─────
    let usePointerFallback = false;
    let dragging = false;
    let lastX = 0;
    let lastY = 0;

    const onOrient = (e: DeviceOrientationEvent) => {
      if (e.gamma === null && e.beta === null) return;
      gyroActiveRef.current = true;
      usePointerFallback = false; // real gyro wins
      const gamma = e.gamma ?? 0; // left-right tilt → pan (rate)
      const beta = e.beta ?? 0; // front-back tilt → pitch
      yawRef.current += Math.max(-1, Math.min(1, gamma / 45)) * 0.035;
      pitchRef.current = Math.max(
        -0.7,
        Math.min(1.1, pitchRef.current + ((beta - 78) / 90 - pitchRef.current) * 0.08),
      );
      lastInputRef.current = performance.now();
    };
    const onDown = (e: PointerEvent) => {
      if (!usePointerFallback) return;
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
    };
    const onMove = (e: PointerEvent) => {
      if (!usePointerFallback || !dragging) return;
      yawRef.current += (e.clientX - lastX) * 0.005;
      pitchRef.current = Math.max(
        -0.7,
        Math.min(1.1, pitchRef.current - (e.clientY - lastY) * 0.004),
      );
      lastX = e.clientX;
      lastY = e.clientY;
      lastInputRef.current = performance.now();
    };
    const onUp = () => {
      dragging = false;
    };

    window.addEventListener("deviceorientation", onOrient);
    canvas.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);

    // if no gyro data lands shortly, fall back to pointer-drag
    const fallbackTimer = window.setTimeout(() => {
      if (!gyroActiveRef.current) {
        usePointerFallback = true;
        setTiltNote((n) => n ?? "Gyro unavailable — drag to look around.");
      }
    }, 1400);

    const onResize = () => {
      const s = getSize();
      w = s.w;
      h = s.h;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    window.addEventListener("resize", onResize);

    // ── per-frame state ────────────────────────────────────────────────────────
    let rms = 0;
    let treble = 0;
    let audioPhase = 0;
    let growFront = 0; // monotonic non-decreasing piece-time (grow-units)
    let autoYaw = 0;
    let hudAccum = 0;
    let curSection = "—";
    let grownCount = 0;

    const duration = engineRef.current?.duration ?? 120;
    // demo: compress the first several births into ~20s so growth reads at once
    const demoStart = performance.now();
    const DEMO_MS = 20000;
    const demoIdx = Math.min(6, plan.length) - 1;
    const demoSpan = plan[demoIdx].birth + LOFT + SWEEP + 3;

    let raf = 0;
    let last = performance.now();

    const frame = (t: number) => {
      raf = requestAnimationFrame(frame);
      const dtMs = Math.min(64, t - last);
      last = t;
      const dt = dtMs / 1000;

      const eng = engineRef.current;

      // ── audio: RMS + treble band from the ear-safety master analyser ─────────
      let targetRms = 0;
      let targetTreble = 0;
      if (eng) {
        eng.master.analyser.getByteTimeDomainData(eng.time);
        let sq = 0;
        for (let n = 0; n < eng.time.length; n++) {
          const s = (eng.time[n] - 128) / 128;
          sq += s * s;
        }
        targetRms = Math.sqrt(sq / eng.time.length);
        eng.master.analyser.getByteFrequencyData(eng.freq);
        const bins = eng.freq.length;
        let tSum = 0;
        const tLo = Math.floor(bins * 0.45);
        for (let b = tLo; b < bins; b++) tSum += eng.freq[b];
        targetTreble = tSum / ((bins - tLo) * 255);
      }
      rms += (targetRms - rms) * 0.1;
      treble += (targetTreble - treble) * 0.1;
      audioPhase += dt * (0.5 + rms * 3.0);

      // ── growth front: demo-compressed at first, then tracks the playhead ─────
      let target = 0;
      const elapsed = t - demoStart;
      if (elapsed < DEMO_MS) {
        const k = elapsed / DEMO_MS;
        const ease = k * k * (3 - 2 * k); // smoothstep
        target = ease * demoSpan;
      } else if (eng) {
        const play = (eng.ctx.currentTime - eng.startTime) % eng.duration;
        // once we loop past the end, keep the finished space (monotonic)
        target = Math.max(demoSpan, play);
      }
      growFront = Math.max(growFront, target);

      // count vaults visibly grown (for the HUD) + current section label
      let gc = 0;
      let sect = curSection;
      for (const vt of plan) {
        if (growFront >= vt.birth + LOFT * 0.4) {
          gc++;
          sect = vt.sectionLabel;
        }
      }
      grownCount = gc;
      curSection = sect;

      // push uniforms to both materials
      for (const m of [shellMat, lineMat]) {
        m.uniforms.uGrowFront.value = growFront;
        m.uniforms.uRms.value = rms;
        m.uniforms.uAudioPhase.value = audioPhase;
        m.uniforms.uTreble.value = treble;
      }

      // ── camera: look around from a vantage near the nave floor ───────────────
      // idle auto-orbit when no recent steering input
      const idle = t - lastInputRef.current > 2600;
      if (idle) autoYaw += dt * (prefersReduced ? 0.02 : 0.06);
      const yaw = yawRef.current + autoYaw;
      const pitch = pitchRef.current;

      // gentle dolly: rise + ease back as the nave grows so it stays framed
      const gp = Math.min(1, growFront / Math.max(30, duration));
      const camY = 3.2 + gp * 3.4;
      const camZ = -2.5 - gp * 5.0;
      camera.position.set(0, camY, camZ);
      const dir = new THREE.Vector3(
        Math.sin(yaw) * Math.cos(pitch),
        Math.sin(pitch),
        Math.cos(yaw) * Math.cos(pitch),
      );
      camera.lookAt(
        camera.position.x + dir.x,
        camera.position.y + dir.y,
        camera.position.z + dir.z,
      );

      floorMat.opacity = 0.22 + rms * 0.12;

      renderer.render(scene, camera);

      hudAccum += dtMs;
      if (hudAccum > 220) {
        hudAccum = 0;
        const grownPct = Math.round(Math.min(1, growFront / Math.max(30, duration)) * 100);
        setHud((prev) =>
          prev.section === curSection && prev.grown === grownPct
            ? prev
            : { ...prev, section: curSection, grown: grownPct },
        );
      }
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(fallbackTimer);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("deviceorientation", onOrient);
      canvas.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      shell.dispose();
      lines.dispose();
      shellMat.dispose();
      lineMat.dispose();
      floorGeom.dispose();
      floorMat.dispose();
      bgTex.dispose();
      (bgSprite.material as THREE.SpriteMaterial).dispose();
      renderer.dispose();
    };
  }, [phase]);

  return (
    <main className="relative h-[100dvh] w-full overflow-hidden bg-background text-foreground">
      {phase === "running" && !webglFailed && (
        <canvas
          ref={canvasRef}
          className="absolute inset-0 block h-full w-full touch-none"
        />
      )}

      {/* corner back-link */}
      <Link
        href="/dream"
        className="absolute left-4 top-4 z-30 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground transition-colors hover:text-foreground"
      >
        ← dream
      </Link>

      {/* idle / loading / error curtain */}
      {phase !== "running" && (
        <div className="absolute inset-0 flex items-center justify-center p-6">
          <div className="w-full max-w-xl text-center">
            <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-primary">
              harmony woven into architecture
            </p>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
              Vaultloom
            </h1>
            <p className="mt-3 text-base leading-relaxed text-muted-foreground">
              Karel&apos;s music lofts a cathedral in real time. Each section and
              chord change weaves a new Xenakis ruled-surface vault — a saddle sheet
              built from straight lines — and the vaults nest outward and upward, so
              the finished space is the shape of the whole performance.
            </p>

            {/* track selector */}
            <div className="mt-6 flex flex-col items-center gap-2">
              <label
                htmlFor="vl-track"
                className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground/70"
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
              {phase === "loading" ? "Raising the nave…" : "Weave the vault"}
            </button>

            <p className="mt-6 font-mono text-[11px] leading-relaxed text-muted-foreground/70">
              headphones recommended · tilt your phone to look around
            </p>
          </div>
        </div>
      )}

      {/* running HUD */}
      {phase === "running" && (
        <>
          {webglFailed && (
            <div className="absolute inset-0 flex items-center justify-center p-6">
              <div className="max-w-md text-center">
                <p className="text-base text-muted-foreground">
                  Your device could not open a 3D view, so the nave is hidden — but
                  Karel&apos;s take is still playing. Try a WebGL-capable browser to
                  watch the vaults loft into being.
                </p>
              </div>
            </div>
          )}

          <div className="pointer-events-none absolute right-4 top-4 select-none text-right font-mono text-[11px] leading-relaxed text-muted-foreground">
            <div className="text-foreground">{hud.title || "Karel — piano"}</div>
            <div>section · {hud.section}</div>
            <div>
              nave · {Math.min(hud.vaults, Math.round((hud.grown / 100) * hud.vaults) + 1)}/
              {hud.vaults} vaults
            </div>
            <div className="text-muted-foreground/70">
              {hud.src === "form" ? "lofted from the score" : "timed cadence (no analysis)"}
            </div>
          </div>

          {tiltNote && (
            <div className="pointer-events-none absolute bottom-24 left-1/2 -translate-x-1/2 text-center font-mono text-[11px] text-destructive">
              {tiltNote}
            </div>
          )}

          <div className="pointer-events-none absolute bottom-16 left-1/2 -translate-x-1/2 text-center font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70">
            tilt to look around · vaults loft with the music
          </div>

          <button
            onClick={() => setNotesOpen(true)}
            className="absolute bottom-4 right-4 z-30 min-h-[36px] rounded-md border border-border bg-background/60 px-3 text-sm text-muted-foreground backdrop-blur-md transition-colors hover:bg-accent hover:text-foreground"
          >
            Read the design notes
          </button>
        </>
      )}

      {/* design-notes modal */}
      {notesOpen && (
        <div
          className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          onClick={() => setNotesOpen(false)}
        >
          <div
            className="max-h-[80dvh] max-w-lg overflow-y-auto rounded-lg border border-border bg-background p-6 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <h2 className="text-xl font-semibold tracking-tight">
                Vaultloom — design notes
              </h2>
              <button
                onClick={() => setNotesOpen(false)}
                className="min-h-[32px] rounded-md border border-border px-3 text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                close
              </button>
            </div>
            <div className="mt-4 space-y-3 text-sm leading-relaxed text-muted-foreground">
              <p>
                One question: <em>what if Karel&apos;s harmony wove architecture</em>{" "}
                — literal Xenakis ruled-surface vaults lofting into being over the
                length of a piece, so the finished space is the shape of the whole
                performance? This is not the tension of one chord; it is musical{" "}
                <em>form</em> — the accreted built space of an entire take.
              </p>
              <p>
                Each vault is a <em>ruled surface</em>: two guide curves — a ground
                arc and a raised, inset apex arc — with a family of{" "}
                <em>straight generatrix lines</em> strung between them. As the lines
                sweep the arc they carve a hyperbolic-paraboloid saddle, exactly how
                Xenakis turned the string glissandi of <em>Metastaseis</em> (1954)
                into the built vaults of the <em>Philips Pavilion</em> (1958). We
                draw both the translucent stone shell and the straight lines
                themselves, so the &quot;curve made of straight lines&quot; stays
                legible.
              </p>
              <p>
                As a real take plays, each section or strong chord change lofts a new
                vault, nested further out and higher than the last, so minute four is
                a materially bigger nave than minute one. Growth is driven by a
                single global <span className="font-mono text-xs">uGrowFront</span>{" "}
                uniform advancing in piece-seconds — every vertex knows its own birth
                time, so lofting is allocation-free, coherent, and instantly
                replayable (a growth-front technique after Codrops&apos;{" "}
                <em>Exploring Procedural Geometry with Three.js and WebGPU</em>, here
                on a standard WebGL renderer). A shared world-space breath field
                pulses the whole structure with the master RMS.
              </p>
              <p>
                Chord root → hue (cooled into a limestone cyan→violet band); minor
                mode → cooler, steeper, darker saddles; bass energy → vault span and
                mass; treble → the brightness of the filigree generatrices. Tilt your
                phone to look around; if the gyro is denied, drag is the fallback and
                the camera slowly orbits when idle. Audio is Karel&apos;s catalog
                only — one buffer source through the shared ear-safety master, no
                synthesis.
              </p>
            </div>
          </div>
        </div>
      )}

      <PrototypeNav slugs={["16992-vaultloom"]} />
    </main>
  );
}

// ── a soft radial gradient as a canvas texture (backdrop halo only) ───────────
function makeRadialTexture(stops: [number, string][]): THREE.CanvasTexture {
  const size = 256;
  const cv = document.createElement("canvas");
  cv.width = size;
  cv.height = size;
  const g = cv.getContext("2d")!;
  const grad = g.createRadialGradient(
    size / 2,
    size / 2,
    0,
    size / 2,
    size / 2,
    size / 2,
  );
  for (const [pos, col] of stops) grad.addColorStop(pos, col);
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(cv);
  tex.needsUpdate = true;
  return tex;
}
