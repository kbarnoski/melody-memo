/**
 * Audio Engine Singleton
 *
 * A module-level singleton that creates the AudioContext, HTMLAudioElement,
 * and Web Audio node graph exactly once. Survives across route changes because
 * it lives outside the React component tree.
 *
 * Audio graph:  source -> analyser -> gain -> destination
 *
 * CRITICAL: createMediaElementSource() can only be called ONCE per HTMLAudioElement.
 * The singleton pattern enforces this constraint.
 */

import { NativeAnalyserNode } from "./native-analyser";

/** Union type: either browser AnalyserNode or native NativeAnalyserNode */
export type AnalyserLike = AnalyserNode | NativeAnalyserNode;

let audioContext: AudioContext | null = null;
let audioElement: HTMLAudioElement | null = null;
let sourceNode: MediaElementAudioSourceNode | null = null;
let analyserNode: AnalyserNode | null = null;
let gainNode: GainNode | null = null;
let ambientOsc: OscillatorNode | null = null;
let ambientGain: GainNode | null = null;

export interface AudioEngine {
  audioContext: AudioContext;
  audioElement: HTMLAudioElement;
  sourceNode: MediaElementAudioSourceNode;
  analyserNode: AnalyserNode;
  gainNode: GainNode;
}

export function getAudioEngine(): AudioEngine {
  if (typeof window === "undefined") {
    throw new Error("AudioEngine can only be used in the browser");
  }

  if (!audioContext) {
    audioContext = new AudioContext();
  }

  if (!audioElement) {
    audioElement = new Audio();
    audioElement.crossOrigin = "anonymous";
    audioElement.preload = "auto";
  }

  if (!sourceNode) {
    sourceNode = audioContext.createMediaElementSource(audioElement);

    analyserNode = audioContext.createAnalyser();
    analyserNode.fftSize = 256;
    analyserNode.smoothingTimeConstant = 0.8;

    gainNode = audioContext.createGain();

    sourceNode.connect(analyserNode);
    analyserNode.connect(gainNode);
    gainNode.connect(audioContext.destination);
  }

  return {
    audioContext: audioContext!,
    audioElement: audioElement!,
    sourceNode: sourceNode!,
    analyserNode: analyserNode!,
    gainNode: gainNode!,
  };
}

export function getAnalyserNode(): AnalyserNode | null {
  return analyserNode;
}

export function getDataArray(): Uint8Array | null {
  if (!analyserNode) return null;
  return new Uint8Array(analyserNode.frequencyBinCount);
}

/** Resume AudioContext after user gesture (browser autoplay policy) */
export async function ensureResumed(): Promise<void> {
  if (audioContext && audioContext.state === "suspended") {
    await audioContext.resume();
  }
}

// iOS Safari: HTMLAudioElement.play() only works if first called inside a
// user gesture. After that one priming call the element is "unlocked" for
// the rest of the session — subsequent src changes and play() calls work
// even from async callbacks. Without this, journey taps that await Supabase
// before calling play() silently fail on mobile (gesture context lost).
// Must be called synchronously from the tap handler, before any await.
let audioElementUnlocked = false;
export function primeAudioElement(): void {
  if (audioElementUnlocked) return;
  const engine = getAudioEngine();
  const el = engine.audioElement;
  // Tiny silent WAV — plays instantly, no network.
  if (!el.src) {
    el.src =
      "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAVFYAAKhWAAACABAAZGF0YQAAAAA=";
  }
  const p = el.play();
  if (p && typeof p.catch === "function") p.catch(() => {});
  audioElementUnlocked = true;
}

/**
 * Start a silent ambient oscillator connected to the analyser.
 * Used when no track is playing so shaders still receive data.
 */
export function startAmbient(): void {
  if (ambientOsc || !audioContext || !analyserNode) return;

  ambientOsc = audioContext.createOscillator();
  ambientGain = audioContext.createGain();
  ambientGain.gain.value = 0; // silent
  ambientOsc.connect(ambientGain);
  ambientGain.connect(analyserNode);
  ambientOsc.start();
}

export function stopAmbient(): void {
  if (ambientOsc) {
    try { ambientOsc.stop(); } catch {}
    ambientOsc = null;
  }
  if (ambientGain) {
    try { ambientGain.disconnect(); } catch {}
    ambientGain = null;
  }
}

// ─── Native analyser singleton (desktop mode) ───

let nativeAnalyser: NativeAnalyserNode | null = null;

export function initNativeAnalyser(): NativeAnalyserNode {
  if (!nativeAnalyser) {
    nativeAnalyser = new NativeAnalyserNode();
  }
  return nativeAnalyser;
}

export function getNativeAnalyser(): NativeAnalyserNode | null {
  return nativeAnalyser;
}
