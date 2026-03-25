/**
 * Deterministic PRNG utilities for reproducible journey playback.
 *
 * Same seed = identical shader sequence, switch timing, dual-shader moments.
 * Personal playback uses Math.random (no seed); shared playback uses a stored seed.
 */

/** Mulberry32 — fast, high-quality 32-bit PRNG. Returns values in [0, 1). */
export function createSeededRandom(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Generate a crypto-safe seed suitable for Mulberry32. */
export function generateSeed(): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0];
}

/** Fisher-Yates shuffle driven by the given random function. Returns a new array. */
export function seededShuffle<T>(arr: T[], random: () => number): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
