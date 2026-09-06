"use client";

// ─────────────────────────────────────────────────────────────────────────────
// 16960 · tense thread
//
//   "What if you could SEE and HEAR the tonal tension in Karel's piano as a
//    physical force — his consonant chords let a hanging web of light relax into
//    a calm standing shimmer, his tense harmony stretches it taut, shears it, and
//    reddens it?"
//
//   One of Karel's real piano takes plays. A suspended 3D web of luminous
//   filaments (a grid of ~3,500 vertices, drawn as an indexed net of line
//   segments plus glowing points) hangs in a dark space. Every frame we compute a
//   continuous tonal-tension scalar in [0,1] from the harmony sounding RIGHT NOW:
//   we take the active pitch-classes (the notes actually held under the playhead,
//   plus the current chord root), embed each on the circle of fifths, and measure
//   their angular SPREAD (circular variance). A tight cluster on the circle of
//   fifths = consonant = low tension; a wide spread = high tension. Minor /
//   diminished chords add a small bump. The scalar is smoothed over ~0.3s so it
//   glides.
//
//   Tension is a PHYSICAL FORCE on the web: low tension → the net relaxes into its
//   hanging catenary sag and a slow pearl/silver standing shimmer; rising tension
//   stretches it taut (vertices pulled outward), shears/twists it, sets it
//   trembling, and shifts the color pearl → violet → and, only at the extreme, the
//   destructive red. RMS from the master analyser makes the whole web breathe;
//   spectral bands ripple individual rows of filaments. Drag to orbit; tilt on
//   mobile is a bonus.
//
//   AUDIO: Karel's catalog ONLY — a single AudioBufferSource, everything through
//   the shared ear-safety master, zero synthesis. REF: the Tonal Interval Space
//   tonal-tension model (Herremans & Chew, "A Computational Model of Tonal
//   Tension") and arXiv 2511.19342 (Nov 2025, explicit tonal-tension conditioning).
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
  type TrackAnalysis,
} from "../_shared/trackAnalysis";

// Default take: "2019", a piece that wanders through real harmonic strain.
const DEFAULT_TRACK_ID =
  WELCOME_HOME_TRACKS.find((t) => t.title === "2019")?.id ?? REAL_TRACKS[0].id;

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

// grid resolution of the web
const NX = 76;
const NY = 46;

// ── HSL → linear-ish RGB (0..1) for the three.js art layer only ───────────────
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  h = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return [r + m, g + m, b + m];
}

const smoothstep = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

// tension → base color: pearl/silver (calm) → violet (taut) → red (extreme only)
function computeTensionColor(t: number): [number, number, number] {
  if (t < 0.6) {
    const k = t / 0.6;
    return hslToRgb(228 + (272 - 228) * k, 0.12 + 0.5 * k, 0.84 - 0.22 * k);
  }
  const k = (t - 0.6) / 0.4;
  const red = smoothstep(0, 1, k); // red bleeds in only near the top
  return hslToRgb(272 + 96 * red, 0.62 + 0.28 * k, 0.6 - 0.08 * k);
}

// ── tonal-tension from the pitch-classes sounding NOW ─────────────────────────
// Embed each active pitch-class on the circle of fifths (angle = (pc*7 % 12)*30°),
// then measure the circular variance of the set: a tight cluster (consonant)
// → variance near 0 → low tension; a wide spread (dissonant) → near 1.
function computeTonalTension(
  pcs: number[],
  minorBump: number,
): number {
  if (pcs.length === 0) return -1; // caller falls back to spectral
  let sx = 0;
  let sy = 0;
  for (const pc of pcs) {
    const ang = ((pc * 7) % 12) * (Math.PI / 6); // 30° steps on circle of fifths
    sx += Math.cos(ang);
    sy += Math.sin(ang);
  }
  const r = Math.sqrt(sx * sx + sy * sy) / pcs.length; // 0..1 concentration
  let tension = 1 - r; // circular variance
  // a lone note has r=1 → tension 0; nudge single/double notes up a touch so a
  // sparse dissonant interval still registers
  if (pcs.length <= 2) tension *= 0.7;
  tension += minorBump;
  return Math.min(1, Math.max(0, tension));
}

export default function TenseThreadPage() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [webglFailed, setWebglFailed] = useState(false);
  const [tiltNote, setTiltNote] = useState<string | null>(null);
  const [notesOpen, setNotesOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string>(DEFAULT_TRACK_ID);
  const [hud, setHud] = useState<{
    title: string;
    chord: string;
    tension: number;
    src: "harmony" | "spectral";
  }>({ title: "", chord: "—", tension: 0, src: "spectral" });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<AudioEngine | null>(null);
  const analysisRef = useRef<TrackAnalysis | null>(null);
  const startedRef = useRef(false);

  // camera steering, read by the render loop
  const dragAzRef = useRef(0.5);
  const dragElRef = useRef(0.12);
  const camRadiusRef = useRef(18);
  const tiltAzVelRef = useRef(0);
  const tiltElRef = useRef(0);

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

  // ── enter: gesture-gated audio boot + orientation permission ────────────────
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
    setHud((h) => ({ ...h, title: loaded.title }));

    // harmony analysis loads in the background; the web breathes either way.
    analysisRef.current = null;
    void loadTrackAnalysis(trackId).then((a) => {
      analysisRef.current = a;
    });

    // iOS 13+ gates motion behind a gesture-scoped permission request.
    try {
      const doe = window.DeviceOrientationEvent as unknown as {
        requestPermission?: () => Promise<"granted" | "denied">;
      };
      if (doe && typeof doe.requestPermission === "function") {
        const res = await doe.requestPermission();
        if (res !== "granted") {
          setTiltNote("Tilt denied — drag still orbits the web.");
        }
      }
    } catch {
      /* non-iOS, or already granted */
    }

    setPhase("running");
  }, [selectedId]);

  // ── three.js scene: a suspended web of luminous filaments ───────────────────
  useEffect(() => {
    if (phase !== "running") return;
    const canvas = canvasRef.current;
    if (!canvas) return;

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

    const getSize = () => ({
      w: canvas.clientWidth || window.innerWidth,
      h: canvas.clientHeight || window.innerHeight,
    });
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(dpr);
    let { w, h } = getSize();
    renderer.setSize(w, h, false);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x05060a);
    scene.fog = new THREE.FogExp2(0x05060a, 0.028);

    const camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 220);

    // faint cold backdrop halo so the web reads against depth (a backdrop, not a
    // full-screen generative field)
    const bgTex = makeRadialTexture([
      [0, "rgba(84,74,128,0.5)"],
      [0.45, "rgba(28,30,54,0.3)"],
      [1, "rgba(5,6,10,0)"],
    ]);
    const bg = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: bgTex,
        transparent: true,
        depthWrite: false,
        depthTest: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    bg.scale.set(90, 90, 1);
    bg.position.z = -14;
    bg.renderOrder = -10;
    scene.add(bg);

    // ── build the web geometry: an indexed net of vertices ─────────────────────
    const WIDTH = 15;
    const HEIGHT = 9.4;
    const count = NX * NY;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    // precomputed per-vertex static fields
    const baseU = new Float32Array(count); // -0.5..0.5 across
    const baseV = new Float32Array(count); // -0.5..0.5 down
    const restX = new Float32Array(count);
    const restY = new Float32Array(count);
    const phase0 = new Float32Array(count); // stable per-vertex phase for tremble

    for (let j = 0; j < NY; j++) {
      for (let i = 0; i < NX; i++) {
        const idx = j * NX + i;
        const u = i / (NX - 1) - 0.5;
        const v = j / (NY - 1) - 0.5;
        baseU[idx] = u;
        baseV[idx] = v;
        // hanging catenary-ish sag: the net droops toward the middle-bottom
        const sag = -(1 - 4 * u * u) * 1.6 * (0.55 + 0.45 * (v + 0.5));
        const rx = u * WIDTH;
        const ry = v * HEIGHT + sag;
        restX[idx] = rx;
        restY[idx] = ry;
        phase0[idx] = (i * 12.9898 + j * 78.233) % (Math.PI * 2);
        positions[idx * 3] = rx;
        positions[idx * 3 + 1] = ry;
        positions[idx * 3 + 2] = 0;
      }
    }

    // index buffer: horizontal + vertical neighbour links → a net of segments
    const segs: number[] = [];
    for (let j = 0; j < NY; j++) {
      for (let i = 0; i < NX; i++) {
        const idx = j * NX + i;
        if (i < NX - 1) segs.push(idx, idx + 1);
        if (j < NY - 1) segs.push(idx, idx + NX);
      }
    }
    const geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geom.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geom.setIndex(segs);

    const netMat = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.62,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const net = new THREE.LineSegments(geom, netMat);
    scene.add(net);

    // glowing points at the vertices share the same position + color buffers
    const dotTex = makeDotTexture();
    const ptsMat = new THREE.PointsMaterial({
      size: 0.16,
      map: dotTex,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });
    const pts = new THREE.Points(geom, ptsMat);
    scene.add(pts);

    const webGroup = new THREE.Group();
    webGroup.add(net);
    webGroup.add(pts);
    scene.add(webGroup);

    // ── steering: pointer drag + wheel (desktop), device tilt (phone) ──────────
    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    const onDown = (e: PointerEvent) => {
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      dragAzRef.current += (e.clientX - lastX) * 0.006;
      dragElRef.current = Math.max(
        -1.1,
        Math.min(1.1, dragElRef.current + (e.clientY - lastY) * 0.005),
      );
      lastX = e.clientX;
      lastY = e.clientY;
    };
    const onUp = () => {
      dragging = false;
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      camRadiusRef.current = Math.max(
        9,
        Math.min(30, camRadiusRef.current + e.deltaY * 0.012),
      );
    };
    const onOrient = (e: DeviceOrientationEvent) => {
      if (e.gamma === null && e.beta === null) return;
      const gamma = e.gamma ?? 0;
      const beta = e.beta ?? 0;
      tiltAzVelRef.current = Math.max(-1, Math.min(1, gamma / 45));
      tiltElRef.current = Math.max(-1, Math.min(1, (beta - 45) / 60));
    };

    canvas.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("deviceorientation", onOrient);

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
    let tension = 0; // smoothed tonal-tension scalar
    let rms = 0; // smoothed loudness
    let autoAz = 0;
    let hudAccum = 0;
    let curChordLabel = "—";
    let curSrc: "harmony" | "spectral" = "spectral";
    const band = new Float32Array(NY); // per-row spectral energy
    const rowAmp = new Float32Array(NY); // smoothed per-row ripple amp

    // reusable scratch for active pitch-class collection
    const pcActive = new Uint8Array(12);

    let raf = 0;
    let last = performance.now();

    const frame = (t: number) => {
      raf = requestAnimationFrame(frame);
      const dtMs = Math.min(64, t - last);
      last = t;
      const dt = dtMs / 1000;
      const T = t / 1000;

      const eng = engineRef.current;

      // ── loudness (RMS) + spectrum from the master analyser ───────────────────
      let targetRms = 0;
      if (eng) {
        eng.master.analyser.getByteTimeDomainData(eng.time);
        let sq = 0;
        for (let n = 0; n < eng.time.length; n++) {
          const s = (eng.time[n] - 128) / 128;
          sq += s * s;
        }
        targetRms = Math.sqrt(sq / eng.time.length); // 0..~0.5
        eng.master.analyser.getByteFrequencyData(eng.freq);
        // fold the spectrum into NY rows (log-ish: low bins → bottom rows)
        const bins = eng.freq.length;
        for (let j = 0; j < NY; j++) {
          const lo = Math.floor((j / NY) * (j / NY) * bins);
          const hi = Math.max(lo + 1, Math.floor(((j + 1) / NY) * ((j + 1) / NY) * bins));
          let sum = 0;
          for (let b = lo; b < hi && b < bins; b++) sum += eng.freq[b];
          band[j] = sum / ((hi - lo) * 255);
        }
      }
      rms += (targetRms - rms) * 0.12;

      // ── tonal tension from the harmony sounding NOW ──────────────────────────
      let targetTension = -1;
      const analysis = analysisRef.current;
      if (eng && analysis && (analysis.chords.length || analysis.notes.length)) {
        const play = (eng.ctx.currentTime - eng.startTime) % eng.duration;
        pcActive.fill(0);
        let anyPc = 0;
        // notes actually held under the playhead (the honest sounding harmony)
        const notes = analysis.notes;
        if (notes.length) {
          // binary search: last note with onset <= play
          let lo = 0;
          let hi = notes.length - 1;
          let end = -1;
          while (lo <= hi) {
            const m = (lo + hi) >> 1;
            if (notes[m].time <= play) {
              end = m;
              lo = m + 1;
            } else {
              hi = m - 1;
            }
          }
          // walk backward a bounded window collecting notes still sounding
          for (let k = end; k >= 0 && k > end - 96; k--) {
            const nn = notes[k];
            if (nn.time < play - 6) break; // beyond any plausible sustain
            if (nn.time + nn.duration >= play - 0.06) {
              const pc = ((nn.midi % 12) + 12) % 12;
              if (!pcActive[pc]) {
                pcActive[pc] = 1;
                anyPc++;
              }
            }
          }
        }
        // current chord: label, root reinforcement, minor/dim bump
        let minorBump = 0;
        if (analysis.chords.length) {
          const chords = analysis.chords;
          let lo = 0;
          let hi = chords.length - 1;
          let idx = 0;
          while (lo <= hi) {
            const m = (lo + hi) >> 1;
            if (chords[m].time <= play) {
              idx = m;
              lo = m + 1;
            } else {
              hi = m - 1;
            }
          }
          const sym = chords[idx].chord;
          curChordLabel = sym;
          const root = chordRoot(sym);
          if (root !== null && !pcActive[root]) {
            pcActive[root] = 1;
            anyPc++;
          }
          if (chordIsMinor(sym)) minorBump = 0.12;
        }
        if (anyPc > 0) {
          const pcs: number[] = [];
          for (let pc = 0; pc < 12; pc++) if (pcActive[pc]) pcs.push(pc);
          targetTension = computeTonalTension(pcs, minorBump);
          curSrc = "harmony";
        }
      }
      if (targetTension < 0 && eng) {
        // fall back to spectral tension: spectral spread / high-frequency energy
        // stands in for harmonic tension when analysis is absent.
        const bins = eng.freq.length;
        let wsum = 0;
        let tot = 0;
        for (let b = 0; b < bins; b++) {
          wsum += b * eng.freq[b];
          tot += eng.freq[b];
        }
        const centroid = tot > 0 ? wsum / (tot * bins) : 0.3; // 0..1 brightness
        targetTension = Math.min(1, centroid * 1.5);
        curChordLabel = "listening…";
        curSrc = "spectral";
      }
      if (targetTension < 0) targetTension = 0;
      // smooth over ~0.3s so tension glides rather than snaps
      const tau = 0.3;
      const a = 1 - Math.exp(-dt / tau);
      tension += (targetTension - tension) * a;

      // ── colors from the smoothed tension ─────────────────────────────────────
      const [br, bg2, bb] = computeTensionColor(tension);
      // stretch/shear amplitudes scale with tension (the "force")
      const stretchX = tension * 4.2;
      const stretchY = tension * 1.7;
      const shearAmt = tension * 3.0;
      const twistAmt = tension * 0.9;
      const trembleAmt = tension * tension * 0.9;
      const sagTaut = 1 - 0.72 * tension; // tension pulls the sag out → taut
      const calmShimmer = (1 - 0.7 * tension) * (0.5 + 0.6 * rms);
      const breath = 1 + rms * 0.05;

      // per-row ripple amplitude eased toward spectral band energy
      for (let j = 0; j < NY; j++) {
        rowAmp[j] += (band[j] - rowAmp[j]) * 0.2;
      }

      for (let j = 0; j < NY; j++) {
        const rowRipple = rowAmp[j] * (1.2 + 2.2 * rms);
        for (let i = 0; i < NX; i++) {
          const idx = j * NX + i;
          const u = baseU[idx];
          const v = baseV[idx];
          let x = restX[idx];
          let y = restY[idx];
          let z = 0;

          // taut vs. sag: as tension rises, the droop is pulled flat
          y = v * HEIGHT + (y - v * HEIGHT) * sagTaut;

          // tension stretches the web outward from center along both axes
          x += u * stretchX;
          y += v * stretchY;

          // shear along the vertical axis (a lateral drag that skews the net)
          x += shearAmt * v;

          // calm standing shimmer (dominant when tension is low)
          z +=
            calmShimmer *
            (Math.sin(u * 6.0 + T * 0.7) + Math.sin(v * 5.2 - T * 0.55)) *
            0.9;

          // spectral ripple: individual rows of filaments flutter
          z += rowRipple * Math.sin(u * 9.0 + T * 2.3 + j * 0.5);

          // trembling under high tension (deterministic per-vertex phase)
          const tremble =
            trembleAmt * Math.sin(phase0[idx] * 30.0 + T * 22.0);
          z += tremble;

          // twist: rotate the (x,z) plane by an angle that grows with |v|,
          // scaled by tension — the taut sheet corkscrews
          const ang = twistAmt * v;
          const xt = x * Math.cos(ang) - z * Math.sin(ang);
          const zt = x * Math.sin(ang) + z * Math.cos(ang);
          x = xt;
          z = zt;

          positions[idx * 3] = x;
          positions[idx * 3 + 1] = y;
          positions[idx * 3 + 2] = z;

          // local strain: how far this vertex has been dragged from its rest +
          // how hard it is trembling → hotter, redder filaments where sheared
          const dx = x - restX[idx];
          const dy = y - restY[idx];
          const strain = Math.min(
            1,
            (Math.abs(dx) + Math.abs(dy) + Math.abs(z)) * 0.14,
          );
          const heat = Math.min(0.8, strain * tension);
          const bright = 0.55 + 0.55 * rms + Math.abs(z) * 0.18;
          // mix base tension color toward a hot red where strained
          const cr = (br + (1 - br) * heat) * bright;
          const cg = (bg2 + (0.12 - bg2) * heat) * bright;
          const cb = (bb + (0.12 - bb) * heat) * bright;
          colors[idx * 3] = cr;
          colors[idx * 3 + 1] = cg;
          colors[idx * 3 + 2] = cb;
        }
      }
      (geom.attributes.position as THREE.BufferAttribute).needsUpdate = true;
      (geom.attributes.color as THREE.BufferAttribute).needsUpdate = true;

      // RMS breathes the whole web; tension pulses the point glow
      webGroup.scale.setScalar(breath);
      ptsMat.size = 0.13 + rms * 0.22 + tension * 0.05;
      netMat.opacity = 0.5 + 0.25 * rms + 0.12 * tension;

      // ── camera ORBITS the web; drag/tilt steer, with a slow idle drift ───────
      autoAz += dt * (prefersReduced ? 0.015 : 0.05);
      tiltAzVelRef.current *= 0.94;
      dragAzRef.current += tiltAzVelRef.current * dt * 1.2;
      const az = autoAz + dragAzRef.current;
      const el = Math.max(
        -1.2,
        Math.min(1.2, dragElRef.current + tiltElRef.current * 0.6),
      );
      const camR = camRadiusRef.current;
      camera.position.set(
        Math.sin(az) * camR * Math.cos(el),
        Math.sin(el) * camR,
        Math.cos(az) * camR * Math.cos(el),
      );
      camera.lookAt(0, 0, 0);

      renderer.render(scene, camera);

      // throttle HUD updates
      hudAccum += dtMs;
      if (hudAccum > 200) {
        hudAccum = 0;
        const tv = Math.round(tension * 100) / 100;
        setHud((prev) =>
          prev.chord === curChordLabel &&
          prev.src === curSrc &&
          Math.abs(prev.tension - tv) < 0.02
            ? prev
            : { ...prev, chord: curChordLabel, tension: tv, src: curSrc },
        );
      }
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      canvas.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("wheel", onWheel);
      window.removeEventListener("deviceorientation", onOrient);
      geom.dispose();
      netMat.dispose();
      ptsMat.dispose();
      dotTex.dispose();
      bgTex.dispose();
      (bg.material as THREE.SpriteMaterial).dispose();
      renderer.dispose();
    };
  }, [phase]);

  const tensionPct = Math.round(hud.tension * 100);

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
              tonal tension as a physical force
            </p>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
              Tense Thread
            </h1>
            <p className="mt-3 text-base leading-relaxed text-muted-foreground">
              A hanging web of light you watch Karel&apos;s harmony breathe
              through. Consonant chords let it relax into a calm pearl shimmer;
              tense harmony stretches it taut, shears it, and reddens it.
            </p>

            {/* track selector */}
            <div className="mt-6 flex flex-col items-center gap-2">
              <label
                htmlFor="tt-track"
                className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground/70"
              >
                choose a take
              </label>
              <select
                id="tt-track"
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
              {phase === "loading" ? "Hanging the web…" : "Play the take"}
            </button>

            <p className="mt-6 font-mono text-[11px] leading-relaxed text-muted-foreground/70">
              headphones recommended · drag to orbit · tilt your phone
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
                  Your device could not open a 3D view, so the web is hidden — but
                  Karel&apos;s take is still playing. Try a WebGL-capable browser
                  to see the tension pull on the threads.
                </p>
              </div>
            </div>
          )}

          <div className="pointer-events-none absolute right-4 top-4 select-none text-right font-mono text-[11px] leading-relaxed text-muted-foreground">
            <div className="text-foreground">{hud.title || "Karel — piano"}</div>
            <div>chord · {hud.chord}</div>
            <div className={tensionPct > 72 ? "text-destructive" : undefined}>
              tension · {tensionPct}%
            </div>
            <div className="text-muted-foreground/70">
              {hud.src === "harmony" ? "circle-of-fifths spread" : "spectral (no analysis)"}
            </div>
          </div>

          {tiltNote && (
            <div className="pointer-events-none absolute bottom-24 left-1/2 -translate-x-1/2 text-center font-mono text-[11px] text-destructive">
              {tiltNote}
            </div>
          )}

          <div className="pointer-events-none absolute bottom-16 left-1/2 -translate-x-1/2 text-center font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70">
            drag to orbit · scroll to zoom · tilt to steer
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
                Tense Thread — design notes
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
                One question: <em>what if you could see and hear the tonal tension
                in Karel&apos;s piano as a physical force</em> — his consonant
                chords letting a hanging web of light relax into a calm standing
                shimmer, his tense harmony stretching it taut, shearing it, and
                reddening it?
              </p>
              <p>
                A suspended net of ~3,500 luminous vertices hangs in a dark space.
                Every frame we read the pitch-classes actually sounding under the
                playhead — the notes held right now, plus the current chord root —
                and embed each on the circle of fifths (angle ={" "}
                <span className="font-mono text-xs">(pc·7 mod 12)·30°</span>). We
                then measure the <em>circular variance</em> of that set: a tight
                cluster on the circle of fifths is consonant (low tension); a wide
                spread is dissonant (high tension). Minor and diminished chords add
                a small bump. The scalar is smoothed over ~0.3s so it glides.
              </p>
              <p>
                That tension is a <em>force</em>: it stretches the web outward,
                pulls its hanging sag flat, shears and twists the sheet, and sets
                it trembling — while the color travels pearl → violet → and, only
                at the extreme, the destructive red. RMS from the ear-safety master
                breathes the whole web; per-row spectral bands ripple individual
                filaments. With no analysis it degrades to a spectral-brightness
                proxy and still lives.
              </p>
              <p className="text-muted-foreground/70">
                The tension measure is a cheap, honest cousin of the Tonal Interval
                Space model in Herremans &amp; Chew,{" "}
                <em>&quot;A Computational Model of Tonal Tension&quot;</em>, and of
                the explicit tonal-tension conditioning in arXiv 2511.19342 (Nov
                2025). Audio is Karel&apos;s catalog only — a single buffer source,
                no synthesis, routed through the shared ear-safety master. Renderer
                is three.js; the tension/color math runs on the CPU per frame.
              </p>
            </div>
          </div>
        </div>
      )}

      <PrototypeNav slugs={["16960-tensethread"]} />
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

// ── a soft round dot sprite for the vertex glow points ────────────────────────
function makeDotTexture(): THREE.CanvasTexture {
  const size = 64;
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
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.4, "rgba(255,255,255,0.55)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(cv);
  tex.needsUpdate = true;
  return tex;
}
