/**
 * Device performance tier detection.
 *
 * Three tiers — `high`, `medium`, `low` — drive the heavy render knobs
 * (AI image generation interval, dual-shader compositing, bloom intensity,
 * particle density, clone overlays). The goal: a brand-new M-series Mac
 * gets the full installation experience, an older Intel laptop or mobile
 * device gets a smoother mode automatically.
 *
 * Detection is cheap and runs once per session, then cached in localStorage.
 * Users can override via `setDeviceTierOverride()` from anywhere.
 */

export type DeviceTier = "high" | "medium" | "low";

const STORAGE_KEY = "resonance-device-tier";
const OVERRIDE_KEY = "resonance-device-tier-override";

let cachedTier: DeviceTier | null = null;

/**
 * Detect device tier from runtime signals. Heuristic:
 * - `low`  : mobile UA, OR navigator.deviceMemory <= 4, OR hardwareConcurrency <= 4
 * - `high` : >= 8 GB memory + >= 8 cores + not mobile
 * - `medium`: everything in between
 *
 * Apple Silicon Macs (M1+) report 8+ cores and 8+ GB and pass `high` cleanly.
 * Intel MacBook Air / older Macs typically land in `medium`.
 * Phones/tablets / very old laptops land in `low`.
 */
function detect(): DeviceTier {
  if (typeof navigator === "undefined") return "high"; // SSR fallback

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const nav = navigator as any;
  const ua = nav.userAgent ?? "";
  const isMobile = /iPhone|iPad|iPod|Android/i.test(ua);
  if (isMobile) return "low";

  const memory: number | undefined = typeof nav.deviceMemory === "number" ? nav.deviceMemory : undefined;
  const cores: number | undefined = typeof nav.hardwareConcurrency === "number" ? nav.hardwareConcurrency : undefined;

  // Most browsers cap deviceMemory at 8. M-series Macs report 8 even on 16/24 GB.
  // hardwareConcurrency on M1/M2/M3/M4 is typically 8/10/12.
  const enoughMemory = (memory ?? 8) >= 8;
  const enoughCores = (cores ?? 8) >= 8;

  if (!enoughMemory || !enoughCores) {
    if ((memory ?? 0) <= 4 || (cores ?? 0) <= 4) return "low";
    return "medium";
  }

  return "high";
}

/** Get the active tier (override > cached > fresh detect). */
export function getDeviceTier(): DeviceTier {
  if (typeof window === "undefined") return "high";

  // Manual override always wins
  try {
    const override = window.localStorage.getItem(OVERRIDE_KEY);
    if (override === "high" || override === "medium" || override === "low") {
      return override;
    }
  } catch { /* localStorage blocked */ }

  if (cachedTier) return cachedTier;

  // Cached auto-detected tier
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "high" || stored === "medium" || stored === "low") {
      cachedTier = stored;
      return stored;
    }
  } catch {}

  const detected = detect();
  cachedTier = detected;
  try { window.localStorage.setItem(STORAGE_KEY, detected); } catch {}
  return detected;
}

/** Manually override the auto-detected tier. Pass `null` to clear. */
export function setDeviceTierOverride(tier: DeviceTier | null): void {
  if (typeof window === "undefined") return;
  try {
    if (tier === null) {
      window.localStorage.removeItem(OVERRIDE_KEY);
    } else {
      window.localStorage.setItem(OVERRIDE_KEY, tier);
    }
  } catch {}
}

/** Re-run detection ignoring the cache. Useful after user changes hardware
 *  or for debugging. */
export function refreshDeviceTier(): DeviceTier {
  cachedTier = null;
  if (typeof window !== "undefined") {
    try { window.localStorage.removeItem(STORAGE_KEY); } catch {}
  }
  return getDeviceTier();
}

// ─── Tier multipliers / gates ───
//
// Convenience exports so the render pipeline doesn't have to know the tier
// shape — it just asks "how much bloom?" or "should I render dual shader?".

export interface TierProfile {
  /** Multiplier on AI image generation interval (8s base × this). */
  aiImageIntervalMultiplier: number;
  /** Whether to allow the dual-shader A/B layer at all. */
  enableDualShader: boolean;
  /** Multiplier on bloom intensity (0..1). */
  bloomScale: number;
  /** Multiplier on particle density. */
  particleScale: number;
  /** Multiplier on clone overlay density / spawn frequency. */
  cloneScale: number;
  /** Whether AI imagery is allowed at all. */
  enableAiImagery: boolean;
  /** Whether the bass-flash overlay is allowed (Ghost). */
  enableBassFlash: boolean;
}

const PROFILES: Record<DeviceTier, TierProfile> = {
  high: {
    aiImageIntervalMultiplier: 1.0,
    enableDualShader: true,
    bloomScale: 1.0,
    particleScale: 1.0,
    cloneScale: 1.0,
    enableAiImagery: true,
    enableBassFlash: true,
  },
  medium: {
    aiImageIntervalMultiplier: 1.6, // 8s -> ~13s between gens
    enableDualShader: true,
    bloomScale: 0.7,
    particleScale: 0.7,
    cloneScale: 0.6,
    enableAiImagery: true,
    enableBassFlash: true,
  },
  low: {
    aiImageIntervalMultiplier: 3.0, // ~24s between gens (or off)
    enableDualShader: false,
    bloomScale: 0.4,
    particleScale: 0.4,
    cloneScale: 0.3,
    enableAiImagery: true, // still on but slow
    enableBassFlash: false,
  },
};

export function getTierProfile(): TierProfile {
  return PROFILES[getDeviceTier()];
}
