"use client";

import { useState, useCallback, useEffect, useSyncExternalStore } from "react";
import { useAudioStore } from "@/lib/audio/audio-store";
import { getJourneyEngine } from "@/lib/journeys/journey-engine";
import type { Snapshot } from "@/lib/journeys/adaptive-engine";

const STORAGE_KEY = "resonance-journey-feedback";

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

function appendEntry(entry: Snapshot) {
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
function buildSnapshot(type: Snapshot["type"], fpsRef: { current: number | null }): Snapshot {
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

// ── Component ──

interface JourneyFeedbackProps {
  visible: boolean;
}

export function JourneyFeedback({ visible }: JourneyFeedbackProps) {
  const [flash, setFlash] = useState<"dislike" | "love" | null>(null);
  const [hoveredBtn, setHoveredBtn] = useState<"dislike" | "love" | null>(null);

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

  const recordFeedback = useCallback((type: "dislike" | "love") => {
    const entry = buildSnapshot(type, _sharedFps);
    appendEntry(entry);
    setFlash(type);
    setTimeout(() => setFlash(null), 600);
  }, []);

  if (!visible) return null;

  const now = performance.now();
  const dislikeActive = flash === "dislike";
  const dislikeHover = hoveredBtn === "dislike" && !dislikeActive;
  const loveActive = flash === "love";
  const loveHover = hoveredBtn === "love" && !loveActive;

  // Filter log to entries within last 12s
  const recentLog = eventLog.filter((e) => now - e.ts < 12000);

  return (
    <div
      className="absolute top-5 left-1/2 -translate-x-1/2 flex flex-col items-center"
      style={{ zIndex: 60, pointerEvents: "auto" }}
    >
      {/* Buttons row */}
      <div className="flex items-center gap-2">
        {/* Thumbs down */}
        <button
          onClick={() => recordFeedback("dislike")}
          onMouseEnter={() => setHoveredBtn("dislike")}
          onMouseLeave={() => setHoveredBtn(null)}
          className="flex items-center justify-center rounded-full"
          style={{
            width: 36,
            height: 36,
            background: dislikeActive
              ? "rgba(239, 68, 68, 0.4)"
              : dislikeHover
                ? "rgba(255, 255, 255, 0.12)"
                : "rgba(0, 0, 0, 0.3)",
            border: `1px solid ${
              dislikeActive
                ? "rgba(239, 68, 68, 0.5)"
                : dislikeHover
                  ? "rgba(255, 255, 255, 0.25)"
                  : "rgba(255, 255, 255, 0.12)"
            }`,
            backdropFilter: "blur(8px)",
            transform: dislikeActive ? "scale(1.15)" : "scale(1)",
            transition: "all 150ms ease",
            cursor: "pointer",
          }}
          title="Dislike this moment"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke={dislikeActive ? "rgba(239, 68, 68, 0.9)" : dislikeHover ? "rgba(255, 255, 255, 0.8)" : "rgba(255, 255, 255, 0.5)"}
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            style={{ transition: "stroke 150ms ease" }}>
            <path d="M17 14V2" />
            <path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22a3.13 3.13 0 0 1-3-3.88Z" />
          </svg>
        </button>

        {/* Heart */}
        <button
          onClick={() => recordFeedback("love")}
          onMouseEnter={() => setHoveredBtn("love")}
          onMouseLeave={() => setHoveredBtn(null)}
          className="flex items-center justify-center rounded-full"
          style={{
            width: 36,
            height: 36,
            background: loveActive
              ? "rgba(236, 72, 153, 0.4)"
              : loveHover
                ? "rgba(255, 255, 255, 0.12)"
                : "rgba(0, 0, 0, 0.3)",
            border: `1px solid ${
              loveActive
                ? "rgba(236, 72, 153, 0.5)"
                : loveHover
                  ? "rgba(255, 255, 255, 0.25)"
                  : "rgba(255, 255, 255, 0.12)"
            }`,
            backdropFilter: "blur(8px)",
            transform: loveActive ? "scale(1.15)" : "scale(1)",
            transition: "all 150ms ease",
            cursor: "pointer",
          }}
          title="Love this moment"
        >
          <svg width="14" height="14" viewBox="0 0 24 24"
            fill={loveActive ? "rgba(236, 72, 153, 0.8)" : loveHover ? "rgba(255, 255, 255, 0.15)" : "none"}
            stroke={loveActive ? "rgba(236, 72, 153, 0.9)" : loveHover ? "rgba(255, 255, 255, 0.8)" : "rgba(255, 255, 255, 0.5)"}
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            style={{ transition: "all 150ms ease" }}>
            <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
          </svg>
        </button>

        {/* Issue counter */}
        <span
          style={{
            fontFamily: "var(--font-geist-mono)",
            fontSize: "0.85rem",
            fontWeight: 600,
            color: issueCount > 0 ? "rgba(239, 68, 68, 0.85)" : "rgba(255, 255, 255, 0.3)",
            letterSpacing: "0.02em",
            minWidth: "20px",
            textAlign: "center",
            transition: "color 300ms ease",
            textShadow: issueCount > 0 ? "0 1px 6px rgba(239, 68, 68, 0.3)" : "none",
          }}
          title={`${issueCount} performance issue${issueCount !== 1 ? "s" : ""} detected`}
        >
          {issueCount}
        </span>
      </div>

      {/* Live event log — shows what caused each issue */}
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
