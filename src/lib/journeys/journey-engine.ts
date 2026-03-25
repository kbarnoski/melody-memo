import type { Journey, JourneyPhase, JourneyPhaseId, JourneyFrame, AmbientLayers } from "./types";
import { getRealm } from "./realms";
import { regenerateJourneyShaders } from "./journeys";
import { createSeededRandom, seededShuffle } from "./seeded-random";
import {
  getPhaseBlend,
  getPhaseProgress,
  interpolateValue,
  interpolatePalette,
  mapAudioToDenoising,
  clamp,
} from "./phase-interpolation";

type PhaseChangeCallback = (
  phase: JourneyPhaseId,
  guidancePhrase: string | null
) => void;

interface AudioFeatures {
  bass: number;
  mid: number;
  treble: number;
  amplitude: number;
}

/** A scheduled dual-shader moment during the journey */
interface DualShaderMoment {
  startProgress: number;  // 0-1 progress when this moment begins
  endProgress: number;    // 0-1 progress when this moment ends
}

/** Pre-computed shader picks for a dual-shader moment */
interface DualShaderPick {
  dual: string;
  tertiary: string | null;
}

class JourneyEngine {
  private journey: Journey | null = null;
  private running = false;
  private currentPhaseId: JourneyPhaseId | null = null;
  private phaseChangeCallbacks: Set<PhaseChangeCallback> = new Set();
  private frameCallbacks: Set<(frame: JourneyFrame) => void> = new Set();
  private currentShaderIndex = 0;
  private currentShaderMode = "";
  private dualShaderMode: string | null = null;
  private tertiaryShaderMode: string | null = null;
  private dualShaderActive = false;
  private dualShaderMoments: DualShaderMoment[] = [];
  /** Pre-computed shader switch points per phase (progress fractions) */
  private shaderSwitchSchedule: Map<string, number[]> = new Map();
  /** Pre-computed dual-shader picks per moment index */
  private dualShaderPicks: Map<number, DualShaderPick> = new Map();
  /** Pre-computed guidance phrase index per phase */
  private guidancePhraseIndices: Map<string, number> = new Map();
  private audioFeatures: AudioFeatures = { bass: 0, mid: 0, treble: 0, amplitude: 0 };
  private currentPoetryLine = "";
  private currentStoryImagePrompt = "";
  /** Track recent AI prompt themes to enforce variety */
  private recentPromptThemes: string[] = [];
  private static readonly MAX_RECENT_THEMES = 5;
  /** Cached AI prompt — stable within a phase, only recomputed on phase change */
  private phaseAiPrompt = "";
  /** Random function for this playback session (Math.random or seeded) */
  private random: () => number = Math.random;

  /** Start a journey. Pass a seed for deterministic (shared) playback. */
  start(journey: Journey, options?: { seed?: number }): void {
    this.stop();

    const random = options?.seed != null
      ? createSeededRandom(options.seed)
      : Math.random;
    this.random = random;

    // Fresh shaders — seeded for shared, random for personal
    this.journey = regenerateJourneyShaders(journey, random);
    this.running = true;
    this.currentPhaseId = null;
    this.currentShaderIndex = 0;
    this.currentPoetryLine = "";
    this.currentStoryImagePrompt = "";
    this.recentPromptThemes = [];
    this.phaseAiPrompt = "";

    // Set initial shader from first phase
    if (this.journey.phases.length > 0) {
      const firstPhase = this.journey.phases[0];
      this.currentShaderMode = firstPhase.shaderModes[0] ?? "cosmos";
    }

    // Pre-compute all scheduling from the random function
    this.precomputeShaderSwitchSchedule(random);
    this.scheduleDualShaderMoments(random);
    this.precomputeDualShaderPicks(random);
    this.precomputeGuidancePhraseIndices(random);
  }

  /** Stop the current journey */
  stop(): void {
    this.journey = null;
    this.running = false;
    this.currentPhaseId = null;
    this.dualShaderMode = null;
    this.tertiaryShaderMode = null;
    this.dualShaderActive = false;
    this.dualShaderMoments = [];
    this.shaderSwitchSchedule.clear();
    this.dualShaderPicks.clear();
    this.guidancePhraseIndices.clear();
    this.currentPoetryLine = "";
    this.currentStoryImagePrompt = "";
    this.phaseAiPrompt = "";
    this.random = Math.random;
  }

  /** Update audio features from the visualizer's analyser */
  updateAudioFeatures(features: AudioFeatures): void {
    this.audioFeatures = features;
  }

  /** Set the current poetry line for text→image feedback */
  setCurrentPoetryLine(line: string): void {
    this.currentPoetryLine = line;
  }

  /** Get the current poetry line */
  getCurrentPoetryLine(): string {
    return this.currentPoetryLine;
  }

  /** Set the current story image prompt for story→image feedback */
  setCurrentStoryImagePrompt(prompt: string): void {
    this.currentStoryImagePrompt = prompt;
  }

  /** Get the current story image prompt */
  getCurrentStoryImagePrompt(): string {
    return this.currentStoryImagePrompt;
  }

  /** Compute the current frame state given song progress (0-1) */
  getFrame(progress: number): JourneyFrame | null {
    if (!this.journey || !this.running) return null;

    const { phases } = this.journey;
    if (phases.length === 0) return null;

    const clamped = clamp(progress, 0, 1);
    const { phaseIndex, nextPhaseIndex, blend } = getPhaseBlend(clamped, phases);
    const currentPhase = phases[phaseIndex];
    const phaseProgress = getPhaseProgress(clamped, currentPhase);

    // Detect phase change
    if (currentPhase.id !== this.currentPhaseId) {
      const prevPhase = this.currentPhaseId;
      this.currentPhaseId = currentPhase.id;

      // Fire phase change callbacks
      if (prevPhase !== null) {
        const guidanceIdx = this.guidancePhraseIndices.get(currentPhase.id) ?? 0;
        const guidance =
          currentPhase.guidancePhrases.length > 0
            ? currentPhase.guidancePhrases[guidanceIdx % currentPhase.guidancePhrases.length]
            : null;

        for (const cb of this.phaseChangeCallbacks) {
          cb(currentPhase.id, guidance);
        }
      }

      // Build and cache AI prompt for this phase.
      // IMPORTANT: This is computed ONCE per phase, not per frame.
      // AiImageLayer debounces on prompt changes, so an unstable prompt
      // (e.g. using Date.now() or live audio levels) prevents generation entirely.
      this.phaseAiPrompt = this.buildPhaseAiPrompt(currentPhase, phaseIndex);
    }

    // Determine current shader from pre-computed schedule (progress-based, not timer-based)
    const switchPoints = this.shaderSwitchSchedule.get(currentPhase.id) ?? [];
    const switchesPassed = switchPoints.filter((p) => clamped >= p).length;
    // Cap index to list length — never wrap around so no shader repeats within a phase
    this.currentShaderIndex = Math.min(switchesPassed, Math.max(0, currentPhase.shaderModes.length - 1));
    this.currentShaderMode = currentPhase.shaderModes[this.currentShaderIndex] ?? "cosmos";

    const aiPrompt = this.phaseAiPrompt;

    // Interpolate numeric values during crossfade
    const iv = (getter: (p: JourneyPhase) => number) =>
      interpolateValue(phases, phaseIndex, nextPhaseIndex, blend, getter);

    // Interpolate palette
    const palette =
      nextPhaseIndex !== null && blend > 0
        ? interpolatePalette(
            currentPhase.palette,
            phases[nextPhaseIndex].palette,
            blend
          )
        : currentPhase.palette;

    // Interpolate ambient layers
    const ambientLayers: AmbientLayers = {
      wind: iv((p) => p.ambientLayers.wind),
      rain: iv((p) => p.ambientLayers.rain),
      drone: iv((p) => p.ambientLayers.drone),
      chime: iv((p) => p.ambientLayers.chime),
      fire: iv((p) => p.ambientLayers.fire),
    };

    // Dual-shader logic: check if we're inside a scheduled dual-shader moment
    let momentIdx = -1;
    for (let i = 0; i < this.dualShaderMoments.length; i++) {
      const m = this.dualShaderMoments[i];
      if (clamped >= m.startProgress && clamped <= m.endProgress) {
        momentIdx = i;
        break;
      }
    }
    const inDualMoment = momentIdx >= 0;

    if (inDualMoment && currentPhase.shaderModes.length >= 2) {
      if (!this.dualShaderActive) {
        // Use pre-computed picks for this moment
        const pick = this.dualShaderPicks.get(momentIdx);
        if (pick) {
          this.dualShaderMode = pick.dual;
          this.tertiaryShaderMode = pick.tertiary;
          this.dualShaderActive = true;
        }
      }
    } else if (this.dualShaderActive) {
      this.dualShaderMode = null;
      this.tertiaryShaderMode = null;
      this.dualShaderActive = false;
    }

    const frame: JourneyFrame = {
      phase: currentPhase.id,
      progress: clamped,
      phaseProgress,
      shaderMode: this.currentShaderMode,
      shaderOpacity: iv((p) => p.shaderOpacity),
      aiPrompt,
      denoisingStrength: mapAudioToDenoising(
        this.audioFeatures.bass,
        currentPhase.denoisingRange
      ),
      targetFps: iv((p) => p.targetFps),
      bloomIntensity: iv((p) => p.bloomIntensity),
      chromaticAberration: iv((p) => p.chromaticAberration),
      colorTemperature: iv((p) => p.colorTemperature),
      vignette: iv((p) => p.vignette),
      intensityMultiplier: iv((p) => p.intensityMultiplier),
      voice: currentPhase.voice,
      poetryMood: currentPhase.poetryMood,
      poetryIntervalSeconds: iv((p) => p.poetryIntervalSeconds),
      palette,
      ambientLayers,
      filmGrain: iv((p) => p.filmGrain),
      particleDensity: iv((p) => p.particleDensity),
      halation: iv((p) => p.halation),
      dualShaderMode: this.dualShaderMode ?? undefined,
      tertiaryShaderMode: this.tertiaryShaderMode ?? undefined,
    };

    // Notify frame subscribers
    for (const cb of this.frameCallbacks) {
      cb(frame);
    }

    return frame;
  }

  /** Subscribe to phase changes */
  onPhaseChange(callback: PhaseChangeCallback): () => void {
    this.phaseChangeCallbacks.add(callback);
    return () => {
      this.phaseChangeCallbacks.delete(callback);
    };
  }

  /** Subscribe to frame updates */
  onFrame(callback: (frame: JourneyFrame) => void): () => void {
    this.frameCallbacks.add(callback);
    return () => {
      this.frameCallbacks.delete(callback);
    };
  }

  /** Is a journey currently active? */
  isActive(): boolean {
    return this.running && this.journey !== null;
  }

  /** Get the active journey */
  getJourney(): Journey | null {
    return this.journey;
  }

  /** Get current phase ID */
  getCurrentPhase(): JourneyPhaseId | null {
    return this.currentPhaseId;
  }

  /** Get the current shader mode (after regeneration) */
  getCurrentShaderMode(): string {
    return this.currentShaderMode || "cosmos";
  }

  /** Build a stable AI prompt for a phase (called once per phase change) */
  private buildPhaseAiPrompt(phase: JourneyPhase, phaseIndex: number): string {
    if (!this.journey) return phase.aiPrompt;

    const realm = getRealm(this.journey.realmId);
    let prompt = phase.aiPrompt;

    if (realm) {
      const vocab = realm.visualVocabulary;
      // Use the session random function for deterministic vocab selection
      const vocabSeed = Math.floor(this.random() * 10000);
      const envIdx = (phaseIndex * 3 + vocabSeed) % vocab.environments.length;
      const texIdx = (phaseIndex * 7 + vocabSeed) % vocab.textures.length;
      const entIdx = (phaseIndex * 5 + vocabSeed) % vocab.entities.length;
      const atmIdx = (phaseIndex * 11 + vocabSeed) % vocab.atmospheres.length;

      // Rotate vocabulary variant per phase for variety
      const vocabVariant = vocabSeed % 3;
      if (vocabVariant === 0) {
        prompt = `${prompt}, ${vocab.environments[envIdx]}, ${vocab.textures[texIdx]}`;
      } else if (vocabVariant === 1) {
        prompt = `${prompt}, ${vocab.entities[entIdx]}, ${vocab.atmospheres[atmIdx]}`;
      } else {
        prompt = `${prompt}, ${vocab.environments[envIdx]}, ${vocab.entities[entIdx]}`;
      }

      // Anti-repetition: tell the model to avoid recent themes
      if (this.recentPromptThemes.length > 0) {
        const avoidList = this.recentPromptThemes.slice(-3).join("; ");
        prompt += `, completely different composition from: ${avoidList}`;
      }

      // Track this theme (use first 50 chars as fingerprint)
      const theme = prompt.slice(0, 50);
      this.recentPromptThemes.push(theme);
      if (this.recentPromptThemes.length > JourneyEngine.MAX_RECENT_THEMES) {
        this.recentPromptThemes.shift();
      }
    }

    // Apply audio-reactive modifiers based on current audio state at phase change
    const mods = phase.aiPromptModifiers;
    if (this.audioFeatures.bass > 0.6 && mods.highBass) {
      prompt += `, ${mods.highBass}`;
    }
    if (this.audioFeatures.treble > 0.5 && mods.highTreble) {
      prompt += `, ${mods.highTreble}`;
    }
    if (this.audioFeatures.amplitude > 0.7 && mods.highAmplitude) {
      prompt += `, ${mods.highAmplitude}`;
    }
    if (this.audioFeatures.amplitude < 0.15 && mods.lowAmplitude) {
      prompt += `, ${mods.lowAmplitude}`;
    }

    // Text→image feedback
    if (this.currentStoryImagePrompt) {
      prompt += `, ${this.currentStoryImagePrompt}`;
    } else if (this.currentPoetryLine) {
      prompt += `, inspired by the phrase: '${this.currentPoetryLine}'`;
    }

    return prompt;
  }

  /**
   * Pre-compute shader switch points for each phase as progress fractions.
   * Uses 15-20s intervals converted to progress (assuming ~300s track).
   * Strict limit: every shader lasts at least 15s, never more than 20s.
   * The exact points are deterministic given the same random function.
   */
  private precomputeShaderSwitchSchedule(random: () => number): void {
    this.shaderSwitchSchedule.clear();
    if (!this.journey) return;

    for (const phase of this.journey.phases) {
      if (phase.shaderModes.length <= 1) {
        this.shaderSwitchSchedule.set(phase.id, []);
        continue;
      }

      const phaseLength = phase.end - phase.start;
      const points: number[] = [];
      let cursor = phase.start;

      // Generate switch points within this phase's progress range
      while (cursor < phase.end) {
        // 15-20s intervals expressed as progress fraction (~300s assumed track)
        const intervalProgress = (15 + random() * 5) / 300;
        cursor += intervalProgress;
        if (cursor < phase.end) {
          points.push(cursor);
        }
      }

      this.shaderSwitchSchedule.set(phase.id, points);
    }
  }

  /**
   * Schedule dense dual-shader moments across the journey.
   * Goal: ~60-70% of the journey has overlapping shaders for visual richness.
   * Each moment lasts 24-42 seconds (expressed as progress fraction).
   */
  private scheduleDualShaderMoments(random: () => number): void {
    this.dualShaderMoments = [];

    // Moment duration: 0.08-0.14 of progress (~24-42s for a 5min track)
    const momentDuration = () => 0.08 + random() * 0.06;

    // 16 anchors every ~6% — dense coverage across the journey
    const anchors = [
      0.03, 0.09, 0.15, 0.21, 0.27, 0.33, 0.39, 0.45,
      0.51, 0.57, 0.63, 0.69, 0.75, 0.81, 0.87, 0.93,
    ];
    for (const anchor of anchors) {
      const jitter = (random() - 0.5) * 0.04;
      const start = Math.max(0.02, Math.min(0.95, anchor + jitter));
      const duration = momentDuration();
      const end = Math.min(0.98, start + duration);

      // Only reject if moments would directly overlap (no buffer)
      const overlaps = this.dualShaderMoments.some(
        (m) => start < m.endProgress && end > m.startProgress
      );
      if (!overlaps) {
        this.dualShaderMoments.push({ startProgress: start, endProgress: end });
      }
    }
  }

  /**
   * Pre-compute which shaders to use for each dual-shader moment.
   * For each moment, finds which phase it falls in, shuffles that phase's pool
   * with the seeded random, and stores the picks.
   */
  private precomputeDualShaderPicks(random: () => number): void {
    this.dualShaderPicks.clear();
    if (!this.journey) return;

    const { phases } = this.journey;

    for (let i = 0; i < this.dualShaderMoments.length; i++) {
      const moment = this.dualShaderMoments[i];
      const midPoint = (moment.startProgress + moment.endProgress) / 2;

      // Find which phase this moment falls in
      const phase = phases.find((p) => midPoint >= p.start && midPoint <= p.end);
      if (!phase || phase.shaderModes.length < 2) continue;

      // Shuffle the phase's shader pool and pick 2 different ones
      const shuffled = seededShuffle(phase.shaderModes, random);
      this.dualShaderPicks.set(i, {
        dual: shuffled[0],
        tertiary: shuffled.length > 2 ? shuffled[1] : null,
      });
    }
  }

  /** Pre-compute which guidance phrase index to use for each phase */
  private precomputeGuidancePhraseIndices(random: () => number): void {
    this.guidancePhraseIndices.clear();
    if (!this.journey) return;

    for (const phase of this.journey.phases) {
      if (phase.guidancePhrases.length > 0) {
        const idx = Math.floor(random() * phase.guidancePhrases.length);
        this.guidancePhraseIndices.set(phase.id, idx);
      }
    }
  }
}

// Singleton instance
let instance: JourneyEngine | null = null;

export function getJourneyEngine(): JourneyEngine {
  if (!instance) {
    instance = new JourneyEngine();
  }
  return instance;
}
