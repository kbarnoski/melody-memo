"use client";

import { useState, useCallback, useEffect, useSyncExternalStore } from "react";
import { useAudioStore } from "@/lib/audio/audio-store";
import { getJourneyEngine } from "@/lib/journeys/journey-engine";
import { MODE_META } from "@/lib/shaders";
import type { Snapshot } from "@/lib/journeys/adaptive-engine";

const STORAGE_KEY = "resonance-journey-feedback";
const BLOCKED_SHADERS_KEY = "resonance-blocked-shaders";
const LOVED_SHADERS_KEY = "resonance-loved-shaders";
const DELETED_SHADERS_KEY = "resonance-deleted-shaders";
const SHADER_STATS_KEY = "resonance-shader-stats";

/** Get the set of user-blocked shader modes (runtime exclusion) */
export function getBlockedShaders(): Set<string> {
  try {
    const raw = localStorage.getItem(BLOCKED_SHADERS_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch { return new Set(); }
}

/** Block a shader — persists to localStorage for runtime exclusion */
export function blockShader(mode: string): void {
  const blocked = getBlockedShaders();
  blocked.add(mode);
  try {
    localStorage.setItem(BLOCKED_SHADERS_KEY, JSON.stringify([...blocked]));
  } catch { /* full */ }
  incrementShaderStat(mode, "blockedCount");
}

/** Love a shader — persists for future reference */
function loveShader(mode: string): void {
  try {
    const raw = localStorage.getItem(LOVED_SHADERS_KEY);
    const loved: string[] = raw ? JSON.parse(raw) : [];
    if (!loved.includes(mode)) {
      loved.push(mode);
      localStorage.setItem(LOVED_SHADERS_KEY, JSON.stringify(loved));
    }
  } catch { /* full */ }
  incrementShaderStat(mode, "lovedCount");
}

/** Unblock a shader — remove from blocked set */
export function unblockShader(mode: string): void {
  const blocked = getBlockedShaders();
  blocked.delete(mode);
  try {
    localStorage.setItem(BLOCKED_SHADERS_KEY, JSON.stringify([...blocked]));
  } catch { /* full */ }
}

/** Get the set of loved shader modes */
export function getLovedShaders(): string[] {
  try {
    const raw = localStorage.getItem(LOVED_SHADERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

/** Get the set of deleted shader modes */
export function getDeletedShaders(): Set<string> {
  try {
    const raw = localStorage.getItem(DELETED_SHADERS_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch { return new Set(); }
}

/** Delete a shader permanently — stronger than block */
export function deleteShader(mode: string): void {
  const deleted = getDeletedShaders();
  deleted.add(mode);
  try {
    localStorage.setItem(DELETED_SHADERS_KEY, JSON.stringify([...deleted]));
  } catch { /* full */ }
  // Also remove from blocked if present (deleted supersedes blocked)
  unblockShader(mode);
}

/** Restore a deleted shader — remove from deleted set */
export function undeleteShader(mode: string): void {
  const deleted = getDeletedShaders();
  deleted.delete(mode);
  try {
    localStorage.setItem(DELETED_SHADERS_KEY, JSON.stringify([...deleted]));
  } catch { /* full */ }
}

/** Shader usage stats shape */
export interface ShaderStats {
  [mode: string]: {
    usageCount: number;
    dualCount: number;
    lovedCount: number;
    blockedCount: number;
    lastUsed: string;
  };
}

/** Read shader stats from localStorage */
export function getShaderStats(): ShaderStats {
  try {
    const raw = localStorage.getItem(SHADER_STATS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

/** Increment a stat field for a shader */
function incrementShaderStat(mode: string, field: "usageCount" | "dualCount" | "lovedCount" | "blockedCount"): void {
  const stats = getShaderStats();
  if (!stats[mode]) stats[mode] = { usageCount: 0, dualCount: 0, lovedCount: 0, blockedCount: 0, lastUsed: "" };
  stats[mode][field]++;
  stats[mode].lastUsed = new Date().toISOString();
  try {
    localStorage.setItem(SHADER_STATS_KEY, JSON.stringify(stats));
  } catch { /* full */ }
}

/** Batch-update usage stats from journey phase data */
export function updateShaderUsageFromJourney(phases: { shader: string; dualShader?: string | null }[]): void {
  const stats = getShaderStats();
  const now = new Date().toISOString();
  for (const phase of phases) {
    if (phase.shader) {
      if (!stats[phase.shader]) stats[phase.shader] = { usageCount: 0, dualCount: 0, lovedCount: 0, blockedCount: 0, lastUsed: "" };
      stats[phase.shader].usageCount++;
      stats[phase.shader].lastUsed = now;
    }
    if (phase.dualShader) {
      if (!stats[phase.dualShader]) stats[phase.dualShader] = { usageCount: 0, dualCount: 0, lovedCount: 0, blockedCount: 0, lastUsed: "" };
      stats[phase.dualShader].dualCount++;
      stats[phase.dualShader].lastUsed = now;
    }
  }
  try {
    localStorage.setItem(SHADER_STATS_KEY, JSON.stringify(stats));
  } catch { /* full */ }
}

/** Get the display label for a shader mode */
export function getShaderLabel(mode: string): string {
  const meta = MODE_META.find((m) => m.mode === mode);
  return meta?.label ?? mode;
}

// ── Buffered storage writes ──
// All persistence is deferred — zero I/O during playback.
let _pendingEntries: Snapshot[] = [];
let _flushTimer: ReturnType<typeof setTimeout> | null = null;
const FLUSH_INTERVAL = 30_000; // 30 seconds

function flushEntries() {
  if (_pendingEntries.length === 0) return;
  const batch = _pendingEntries;
  _pendingEntries = [];

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const entries: Snapshot[] = raw ? JSON.parse(raw) : [];
    entries.push(...batch);
    const trimmed = entries.length > 500 ? entries.slice(-500) : entries;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch { /* full */ }

  fetch("/api/journey-feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(batch),
  }).catch(() => {});
}

function scheduleFlush() {
  if (_flushTimer) return;
  _flushTimer = setTimeout(() => {
    _flushTimer = null;
    flushEntries();
  }, FLUSH_INTERVAL);
}

export function appendEntry(entry: Snapshot) {
  _pendingEntries.push(entry);
  scheduleFlush();
}

/** Flush any buffered entries immediately (call on journey end) */
export function flushFeedbackEntries() {
  if (_flushTimer) {
    clearTimeout(_flushTimer);
    _flushTimer = null;
  }
  flushEntries();
}

// ── Performance issue counter + live log (module-level, React subscription) ──

interface PerfEvent {
  id: number;
  label: string;       // e.g. "low fps: nebula + drift @ 14fps"
  ts: number;          // performance.now()
}

let _issueCount = 0;
let _eventLog: PerfEvent[] = [];
let _eventIdCounter = 0;
const _listeners = new Set<() => void>();

function notifyListeners() {
  for (const cb of _listeners) cb();
}

function subscribeIssues(cb: () => void) {
  _listeners.add(cb);
  return () => _listeners.delete(cb);
}

// Snapshot for useSyncExternalStore — changes when count or log changes
let _snapshot = { count: 0, log: [] as PerfEvent[] };
function getIssueSnapshot() { return _snapshot; }
function updateSnapshot() {
  _snapshot = { count: _issueCount, log: _eventLog.slice(-4) };
  notifyListeners();
}

export function resetPerfMonitor() {
  _issueCount = 0;
  _eventLog = [];
  updateSnapshot();
}

function addPerfEvent(label: string) {
  _issueCount++;
  _eventLog.push({ id: ++_eventIdCounter, label, ts: performance.now() });
  if (_eventLog.length > 20) _eventLog = _eventLog.slice(-20);
  updateSnapshot();
}

// ── Shared FPS tracker (single rAF loop) ──
const _sharedFps: { current: number | null } = { current: null };
let _fpsFrameTimes: number[] = [];
let _fpsRafId = 0;
let _fpsRefCount = 0;

function startFpsTracker() {
  if (_fpsRefCount++ > 0) return;
  const tick = () => {
    const now = performance.now();
    _fpsFrameTimes.push(now);
    while (_fpsFrameTimes.length > 30) _fpsFrameTimes.shift();
    if (_fpsFrameTimes.length > 1) {
      const elapsed = _fpsFrameTimes[_fpsFrameTimes.length - 1] - _fpsFrameTimes[0];
      _sharedFps.current = Math.round(((_fpsFrameTimes.length - 1) / elapsed) * 1000);
    }
    _fpsRafId = requestAnimationFrame(tick);
  };
  _fpsRafId = requestAnimationFrame(tick);
}

function stopFpsTracker() {
  if (--_fpsRefCount <= 0) {
    _fpsRefCount = 0;
    cancelAnimationFrame(_fpsRafId);
    _fpsFrameTimes = [];
    _sharedFps.current = null;
  }
}

export function getSharedFpsRef() { return _sharedFps; }
export { startFpsTracker, stopFpsTracker };

// ── FPS-based performance monitor ──
// Replaces the broken opacity-based glitch detector. Polls FPS every 500ms.
// When FPS drops below threshold for 2+ consecutive polls, logs a real
// performance issue with the active shader names.
const FPS_THRESHOLD = 18;
const FPS_POLL_MS = 500;
let _perfIntervalId: ReturnType<typeof setInterval> | null = null;
let _perfLowCount = 0;
let _perfLastLogTime = 0;
let _perfRefCount = 0;

export function startPerfMonitor() {
  if (_perfRefCount++ > 0) return;
  _perfLowCount = 0;
  _perfIntervalId = setInterval(() => {
    const fps = _sharedFps.current;
    if (fps === null) return;

    if (fps < FPS_THRESHOLD) {
      _perfLowCount++;
      if (_perfLowCount >= 2) {
        const now = performance.now();
        // Throttle: max 1 logged event per 5 seconds
        if (now - _perfLastLogTime > 5000) {
          _perfLastLogTime = now;

          // Get current shader context from store (cheap read, no I/O)
          const state = useAudioStore.getState();
          const shader = state.vizMode || "unknown";
          const journey = state.activeJourney;
          let dual: string | null = null;
          if (journey && state.duration > 0) {
            try {
              const engine = getJourneyEngine();
              const frame = engine.getFrame(state.currentTime / state.duration);
              if (frame?.dualShaderMode) dual = frame.dualShaderMode;
            } catch {}
          }

          const label = dual
            ? `${shader} + ${dual} @ ${fps}fps`
            : `${shader} @ ${fps}fps`;

          addPerfEvent(label);

          // Buffer a snapshot for the adaptive engine (flushed at journey end)
          const entry = buildSnapshot("glitch", _sharedFps);
          entry.shader = shader;
          entry.dualShader = dual;
          entry.aiPromptSnippet = `low-fps: ${label}`;
          appendEntry(entry);
        }
      }
    } else {
      _perfLowCount = 0;
    }
  }, FPS_POLL_MS);
}

export function stopPerfMonitor() {
  if (--_perfRefCount <= 0) {
    _perfRefCount = 0;
    if (_perfIntervalId) clearInterval(_perfIntervalId);
    _perfIntervalId = null;
    _perfLowCount = 0;
  }
}

/** Build a full context snapshot of the current moment */
export function buildSnapshot(type: Snapshot["type"], fpsRef: { current: number | null }): Snapshot {
  const state = useAudioStore.getState();
  const journey = state.activeJourney;

  const entry: Snapshot = {
    type,
    ts: new Date().toISOString(),
    journeyId: journey?.id ?? null,
    journeyName: journey?.name ?? null,
    realmId: journey?.realmId ?? null,
    currentTime: Math.round(state.currentTime * 10) / 10,
    duration: Math.round(state.duration * 10) / 10,
    progress: 0,
    phase: null,
    phaseLabel: null,
    phaseProgress: 0,
    shader: state.vizMode,
    dualShader: null,
    shaderOpacity: 1,
    aiPromptSnippet: null,
    isLightBg: false,
    bloom: 0,
    halation: 0,
    vignette: 0,
    particleDensity: 0,
    chromaticAberration: 0,
    fps: fpsRef.current,
    ua: typeof navigator !== "undefined" ? navigator.userAgent : "",
    mobile: typeof navigator !== "undefined" && /iPhone|iPad|Android/i.test(navigator.userAgent),
  };

  if (journey && state.duration > 0) {
    const progress = state.currentTime / state.duration;
    entry.progress = Math.round(progress * 1000) / 1000;

    try {
      const engine = getJourneyEngine();
      const frame = engine.getFrame(progress);
      if (frame) {
        entry.shader = frame.shaderMode;
        entry.phase = frame.phase;
        entry.dualShader = frame.dualShaderMode ?? null;
        entry.shaderOpacity = frame.shaderOpacity;
        entry.bloom = frame.bloomIntensity;
        entry.halation = frame.halation;
        entry.vignette = frame.vignette;
        entry.particleDensity = frame.particleDensity;
        entry.chromaticAberration = frame.chromaticAberration;
        entry.aiPromptSnippet = frame.aiPrompt.slice(0, 120);
        entry.isLightBg = /WHITE BACKGROUND|PALE BACKGROUND/i.test(frame.aiPrompt);
      }
    } catch { /* engine not running */ }

    if (entry.phase && journey.phaseLabels) {
      entry.phaseLabel = journey.phaseLabels[entry.phase as keyof typeof journey.phaseLabels] ?? entry.phase;
    }

    for (const p of journey.phases) {
      if (progress >= p.start && progress < p.end) {
        entry.phaseProgress = Math.round(((progress - p.start) / (p.end - p.start)) * 100) / 100;
        break;
      }
    }
  }

  return entry;
}

// ── Inline icons (SVG paths) ──

function ThumbDownIcon({ size = 16, color = "rgba(255,255,255,0.5)" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      style={{ transition: "stroke 150ms ease" }}>
      <path d="M17 14V2" />
      <path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22a3.13 3.13 0 0 1-3-3.88Z" />
    </svg>
  );
}

function ThumbUpIcon({ size = 16, color = "rgba(255,255,255,0.5)" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      style={{ transition: "stroke 150ms ease", transform: "scaleY(-1)" }}>
      <path d="M17 14V2" />
      <path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22a3.13 3.13 0 0 1-3-3.88Z" />
    </svg>
  );
}

// ── Reusable inline rating row ──

function RatingRow({
  label,
  onDown,
  onUp,
  flashState,
}: {
  label: string;
  onDown: () => void;
  onUp: () => void;
  flashState: "down" | "up" | null;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 32 }}>
      {/* Thumbs down */}
      <button
        onClick={onDown}
        style={{
          width: 28, height: 28,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: flashState === "down" ? "rgba(239, 68, 68, 0.35)" : "rgba(255,255,255,0.06)",
          border: `1px solid ${flashState === "down" ? "rgba(239, 68, 68, 0.5)" : "rgba(255,255,255,0.10)"}`,
          borderRadius: 6, cursor: "pointer", padding: 0,
          transform: flashState === "down" ? "scale(1.12)" : "scale(1)",
          transition: "all 150ms ease",
        }}
        title={`Dislike: ${label}`}
      >
        <ThumbDownIcon size={13} color={flashState === "down" ? "rgba(239,68,68,0.9)" : "rgba(255,255,255,0.45)"} />
      </button>

      {/* Label */}
      <span
        style={{
          fontFamily: "var(--font-geist-mono)",
          fontSize: "0.72rem",
          fontWeight: 500,
          color: "rgba(255, 255, 255, 0.55)",
          letterSpacing: "0.03em",
          textTransform: "uppercase",
          whiteSpace: "nowrap",
          flex: 1,
          minWidth: 0,
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {label}
      </span>

      {/* Thumbs up */}
      <button
        onClick={onUp}
        style={{
          width: 28, height: 28,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: flashState === "up" ? "rgba(74, 222, 128, 0.35)" : "rgba(255,255,255,0.06)",
          border: `1px solid ${flashState === "up" ? "rgba(74, 222, 128, 0.5)" : "rgba(255,255,255,0.10)"}`,
          borderRadius: 6, cursor: "pointer", padding: 0,
          transform: flashState === "up" ? "scale(1.12)" : "scale(1)",
          transition: "all 150ms ease",
        }}
        title={`Love: ${label}`}
      >
        <ThumbUpIcon size={13} color={flashState === "up" ? "rgba(74,222,128,0.9)" : "rgba(255,255,255,0.45)"} />
      </button>
    </div>
  );
}

// ── Helpers ──

/** Extract a short readable snippet from the AI prompt (first meaningful clause) */
function getImageryLabel(prompt: string | undefined): string {
  if (!prompt) return "...";
  // Strip the trailing "no text no signatures..." boilerplate
  const clean = prompt.replace(/,?\s*no text no signatures.*$/i, "").trim();
  // Take first ~60 chars at a word boundary
  if (clean.length <= 60) return clean;
  const cut = clean.slice(0, 60);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 30 ? cut.slice(0, lastSpace) : cut) + "...";
}

// ── Component ──

interface JourneyFeedbackProps {
  visible: boolean;
  shaderMode?: string;
  dualShaderMode?: string;
  tertiaryShaderMode?: string;
  aiPrompt?: string;
  isolatePrimary?: boolean;
  hideImagery?: boolean;
}

export function JourneyFeedback({ visible, shaderMode, dualShaderMode, tertiaryShaderMode, aiPrompt, isolatePrimary, hideImagery }: JourneyFeedbackProps) {
  // Flash states: keyed by category+mode
  const [flashes, setFlashes] = useState<Record<string, "down" | "up" | null>>({});
  const [blockedToast, setBlockedToast] = useState<string | null>(null);

  const { count: issueCount, log: eventLog } = useSyncExternalStore(
    subscribeIssues, getIssueSnapshot, getIssueSnapshot,
  );

  // Start shared FPS tracker + perf monitor
  useEffect(() => {
    startFpsTracker();
    startPerfMonitor();
    return () => {
      stopPerfMonitor();
      stopFpsTracker();
    };
  }, []);

  // Auto-expire old log entries (fade after 10s)
  const [, setTick] = useState(0);
  useEffect(() => {
    if (eventLog.length === 0) return;
    const id = setInterval(() => setTick((t) => t + 1), 2000);
    return () => clearInterval(id);
  }, [eventLog.length]);

  const flash = useCallback((key: string, dir: "down" | "up") => {
    setFlashes((prev) => ({ ...prev, [key]: dir }));
    setTimeout(() => setFlashes((prev) => ({ ...prev, [key]: null })), 600);
  }, []);

  const recordMoment = useCallback((type: "dislike" | "love") => {
    const entry = buildSnapshot(type, _sharedFps);
    appendEntry(entry);
    flash("moment", type === "love" ? "up" : "down");
  }, [flash]);

  const rateShader = useCallback((mode: string, action: "dislike" | "love") => {
    const entry = buildSnapshot(action, _sharedFps);
    entry.aiPromptSnippet = `shader-${action}: ${mode}`;
    appendEntry(entry);

    if (action === "love") {
      loveShader(mode);
    }
    flash(`shader-${mode}`, action === "love" ? "up" : "down");
  }, [flash]);

  const handleBlockShader = useCallback((mode: string) => {
    blockShader(mode);
    const entry = buildSnapshot("dislike", _sharedFps);
    entry.aiPromptSnippet = `shader-block: ${mode}`;
    appendEntry(entry);
    setBlockedToast(`${getShaderLabel(mode)} blocked`);
    setTimeout(() => setBlockedToast(null), 2000);
  }, []);

  const handleDeleteShader = useCallback((mode: string) => {
    deleteShader(mode);
    setBlockedToast(`${getShaderLabel(mode)} deleted`);
    setTimeout(() => setBlockedToast(null), 2000);
  }, []);

  const rateImagery = useCallback((action: "dislike" | "love") => {
    const entry = buildSnapshot(action, _sharedFps);
    entry.aiPromptSnippet = `imagery-${action}: ${(aiPrompt ?? "").slice(0, 120)}`;
    appendEntry(entry);
    flash("imagery", action === "love" ? "up" : "down");
  }, [flash, aiPrompt]);

  if (!visible) return null;

  const now = performance.now();
  const recentLog = eventLog.filter((e) => now - e.ts < 12000);

  // Collect active shaders with role labels (deduplicated)
  const activeShaders: { mode: string; role: string }[] = [];
  if (shaderMode) activeShaders.push({ mode: shaderMode, role: "Primary" });
  if (dualShaderMode && dualShaderMode !== shaderMode) activeShaders.push({ mode: dualShaderMode, role: "Blend" });
  if (tertiaryShaderMode && tertiaryShaderMode !== shaderMode && tertiaryShaderMode !== dualShaderMode) activeShaders.push({ mode: tertiaryShaderMode, role: "Tertiary" });

  return (
    <div
      className="absolute top-4 right-4"
      style={{ zIndex: 60, pointerEvents: "auto" }}
    >
      {/* Dark panel */}
      <div
        style={{
          background: "rgba(0, 0, 0, 0.70)",
          backdropFilter: "blur(20px) saturate(1.1)",
          WebkitBackdropFilter: "blur(20px) saturate(1.1)",
          borderRadius: 14,
          border: "1px solid rgba(255, 255, 255, 0.08)",
          padding: "14px 18px",
          display: "flex",
          flexDirection: "column",
          gap: 6,
          minWidth: 260,
          maxWidth: 340,
        }}
      >
        {/* ── Section: Moment ── */}
        <SectionLabel text="moment" issueCount={issueCount} />
        <RatingRow
          label="Overall vibe"
          onDown={() => recordMoment("dislike")}
          onUp={() => recordMoment("love")}
          flashState={flashes["moment"] ?? null}
        />

        {/* ── Section: Shaders ── */}
        {activeShaders.length > 0 && (
          <>
            <Divider />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <SectionLabel text="shaders" />
              {isolatePrimary && (
                <span style={{
                  fontFamily: "var(--font-geist-mono)",
                  fontSize: "0.55rem",
                  fontWeight: 600,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: "rgba(251, 191, 36, 0.85)",
                }}>
                  solo
                </span>
              )}
            </div>
            {activeShaders.map(({ mode, role }) => (
              <div key={mode} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <RatingRow
                  label={`${role}: ${getShaderLabel(mode)}`}
                  onDown={() => rateShader(mode, "dislike")}
                  onUp={() => rateShader(mode, "love")}
                  flashState={flashes[`shader-${mode}`] ?? null}
                />
                <div style={{ display: "flex", gap: 4, paddingLeft: 36 }}>
                  <MiniAction label="block" color="rgba(239, 68, 68, 0.7)" onClick={() => handleBlockShader(mode)} />
                </div>
              </div>
            ))}
          </>
        )}

        {/* ── Section: Imagery ── */}
        {aiPrompt && (
          <>
            <Divider />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <SectionLabel text="imagery" />
              {hideImagery && (
                <span style={{
                  fontFamily: "var(--font-geist-mono)",
                  fontSize: "0.55rem",
                  fontWeight: 600,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: "rgba(251, 191, 36, 0.85)",
                }}>
                  hidden
                </span>
              )}
            </div>
            <RatingRow
              label={getImageryLabel(aiPrompt)}
              onDown={() => rateImagery("dislike")}
              onUp={() => rateImagery("love")}
              flashState={flashes["imagery"] ?? null}
            />
          </>
        )}

        {/* Blocked toast */}
        {blockedToast && (
          <div
            style={{
              fontFamily: "var(--font-geist-mono)",
              fontSize: "0.65rem",
              fontWeight: 500,
              color: "rgba(239, 68, 68, 0.85)",
              letterSpacing: "0.03em",
              textAlign: "center",
              paddingTop: 2,
            }}
          >
            {blockedToast} blocked
          </div>
        )}
      </div>

      {/* Live perf event log — below the panel */}
      {recentLog.length > 0 && (
        <div
          style={{
            marginTop: 6,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 2,
            pointerEvents: "none",
          }}
        >
          {recentLog.map((evt) => {
            const age = now - evt.ts;
            const opacity = age > 8000 ? Math.max(0, 1 - (age - 8000) / 4000) : 1;
            return (
              <span
                key={evt.id}
                style={{
                  fontFamily: "var(--font-geist-mono)",
                  fontSize: "0.65rem",
                  fontWeight: 500,
                  color: `rgba(239, 68, 68, ${0.7 * opacity})`,
                  letterSpacing: "0.03em",
                  textShadow: `0 1px 4px rgba(0, 0, 0, ${0.8 * opacity})`,
                  whiteSpace: "nowrap",
                  transition: "opacity 300ms ease",
                }}
              >
                {evt.label}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Small sub-components ──

function SectionLabel({ text, issueCount }: { text: string; issueCount?: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span
        style={{
          fontFamily: "var(--font-geist-mono)",
          fontSize: "0.6rem",
          fontWeight: 600,
          color: "rgba(255, 255, 255, 0.30)",
          letterSpacing: "0.12em",
          textTransform: "uppercase",
        }}
      >
        {text}
      </span>
      {issueCount != null && issueCount > 0 && (
        <span
          style={{
            fontFamily: "var(--font-geist-mono)",
            fontSize: "0.6rem",
            fontWeight: 600,
            color: "rgba(239, 68, 68, 0.85)",
            letterSpacing: "0.02em",
          }}
          title={`${issueCount} performance issue${issueCount !== 1 ? "s" : ""}`}
        >
          {issueCount}
        </span>
      )}
    </div>
  );
}

function MiniAction({ label, color, onClick }: { label: string; color: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        fontFamily: "var(--font-geist-mono)",
        fontSize: "0.55rem",
        fontWeight: 600,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        color,
        background: "none",
        border: "none",
        cursor: "pointer",
        padding: "1px 0",
        opacity: 0.7,
        transition: "opacity 150ms ease",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.opacity = "1"; }}
      onMouseLeave={(e) => { e.currentTarget.style.opacity = "0.7"; }}
    >
      {label}
    </button>
  );
}

function Divider() {
  return <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "2px 0" }} />;
}
