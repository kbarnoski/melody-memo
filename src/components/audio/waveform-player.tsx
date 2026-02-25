"use client";

import { useRef, useState, useCallback, useEffect, useImperativeHandle, forwardRef, startTransition } from "react";
import { usePathname } from "next/navigation";
import WaveSurfer from "wavesurfer.js";
import { Button } from "@/components/ui/button";
import { Play, Pause, SkipBack, SkipForward, AlertCircle, Flag, Sparkles, Loader2 } from "lucide-react";
import { useThemeColors } from "@/lib/use-theme-colors";

export interface WaveformPlayerHandle {
  seekTo: (time: number) => void;
  getAudioElement: () => HTMLAudioElement | null;
}

interface MarkerDot {
  time: number;
  label: string;
}

interface WaveformPlayerProps {
  audioUrl: string;
  recordingId?: string;
  peaks?: number[][] | null;
  duration?: number | null;
  onTimeUpdate?: (currentTime: number) => void;
  markers?: MarkerDot[];
  onVisualizerOpen?: () => void;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function isChromium(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /Chrome|Chromium|Edg\//.test(ua);
}

// --- Cached URL helpers with 50-minute TTL ---

interface CachedUrlEntry {
  url: string;
  timestamp: number;
}

const URL_CACHE_TTL_MS = 50 * 60 * 1000; // 50 minutes

function getCachedUrl(recordingId: string): string | null {
  try {
    const raw = sessionStorage.getItem(`audio-url-${recordingId}`);
    if (!raw) return null;
    const entry: CachedUrlEntry = JSON.parse(raw);
    if (Date.now() - entry.timestamp > URL_CACHE_TTL_MS) {
      sessionStorage.removeItem(`audio-url-${recordingId}`);
      return null;
    }
    return entry.url;
  } catch {
    return null;
  }
}

function setCachedUrl(recordingId: string, url: string): void {
  try {
    const entry: CachedUrlEntry = { url, timestamp: Date.now() };
    sessionStorage.setItem(`audio-url-${recordingId}`, JSON.stringify(entry));
  } catch {
    // sessionStorage may be full or unavailable
  }
}

// --- Standalone URL resolution (not a hook) ---

async function resolveAudioUrlImpl(
  audioUrl: string,
  recordingId?: string,
): Promise<string> {
  // Check cache first
  if (recordingId) {
    const cached = getCachedUrl(recordingId);
    if (cached) return cached;
  }

  if (!audioUrl.startsWith("/api/")) return audioUrl;

  try {
    const res = await fetch(audioUrl);
    const data = await res.json();

    if (data.url) {
      if (data.hasAac || (data.codec && data.codec !== "alac")) {
        if (recordingId) setCachedUrl(recordingId, data.url);
        return data.url;
      }
      if (data.codec === "alac" && isChromium()) {
        return audioUrl + "?transcode=1";
      }
      // Unknown codec — test playability
      const testAudio = new Audio();
      try {
        const canPlay = await new Promise<boolean>((resolve) => {
          testAudio.preload = "metadata";
          testAudio.onloadedmetadata = () => resolve(true);
          testAudio.onerror = () => resolve(false);
          testAudio.src = data.url;
          setTimeout(() => resolve(false), 5000);
        });
        if (canPlay) {
          if (recordingId) setCachedUrl(recordingId, data.url);
          return data.url;
        }
      } finally {
        testAudio.removeAttribute("src");
        testAudio.load();
      }
    }
  } catch {
    // fall through to transcode
  }

  return audioUrl + "?transcode=1";
}

export const WaveformPlayer = forwardRef<WaveformPlayerHandle, WaveformPlayerProps>(
  function WaveformPlayer({ audioUrl, recordingId, peaks, duration: propDuration, onTimeUpdate, markers = [], onVisualizerOpen }, ref) {
    const themeColors = useThemeColors();
    const hasPeaks = !!(peaks && peaks.length > 0 && propDuration);

    // --- State (6 variables) ---
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(propDuration ?? 0);
    const [isReady, setIsReady] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isLoadingAudio, setIsLoadingAudio] = useState(false);

    // --- Refs ---
    const containerRef = useRef<HTMLDivElement>(null);
    const wavesurferRef = useRef<WaveSurfer | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const resolvedUrlRef = useRef<string | null>(null);
    const urlResolvePromiseRef = useRef<Promise<string> | null>(null);
    const peaksSavedRef = useRef(false);
    const cancelledRef = useRef(false);
    const onTimeUpdateRef = useRef(onTimeUpdate);
    const lastTimeUpdateRef = useRef(0);

    // Keep onTimeUpdate ref current
    useEffect(() => {
      onTimeUpdateRef.current = onTimeUpdate;
    }, [onTimeUpdate]);

    // --- Imperative handle ---
    useImperativeHandle(ref, () => ({
      seekTo(time: number) {
        const d = wavesurferRef.current?.getDuration() ?? duration;
        if (wavesurferRef.current && d > 0) {
          wavesurferRef.current.seekTo(Math.max(0, Math.min(time / d, 1)));
        }
      },
      getAudioElement() {
        return audioRef.current;
      },
    }));

    // --- Save peaks to server ---
    const savePeaks = useCallback((ws: WaveSurfer) => {
      if (peaksSavedRef.current || !recordingId || !audioUrl.startsWith("/api/")) return;
      peaksSavedRef.current = true;

      try {
        const exported = ws.exportPeaks({ maxLength: 1000, precision: 3 });
        if (exported && exported.length > 0) {
          const wsDuration = ws.getDuration();
          fetch(`/api/audio/${recordingId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              waveform_peaks: exported,
              ...(wsDuration && !propDuration ? { duration: wsDuration } : {}),
            }),
          }).catch((err) => console.error("[PEAKS] Failed to save:", err));
        }
      } catch (err) {
        console.error("[PEAKS] Failed to export:", err);
      }
    }, [recordingId, audioUrl, propDuration]);

    // --- Callback ref: creates WaveSurfer once ---
    const initWaveSurfer = useCallback(
      (node: HTMLDivElement | null) => {
        if (!node) return;
        containerRef.current = node;

        // Teardown previous instance if callback ref re-fires (React strict mode)
        if (wavesurferRef.current) {
          wavesurferRef.current.destroy();
          wavesurferRef.current = null;
        }

        // Create a persistent Audio element with no src
        const audio = new Audio();
        audio.crossOrigin = "anonymous";
        audio.preload = "none";
        audioRef.current = audio;

        const ws = WaveSurfer.create({
          container: node,
          waveColor: "rgba(150,150,150,0.22)",
          progressColor: "#6366f1",
          cursorColor: "#6366f1",
          barWidth: 2,
          barGap: 1,
          barRadius: 2,
          height: 80,
          media: audio,
          ...(hasPeaks
            ? { peaks: peaks as Array<number[]>, duration: propDuration! }
            : {}),
        });

        ws.on("ready", () => {
          if (cancelledRef.current) return;
          setDuration(ws.getDuration());
          setIsReady(true);
          setError(null);

          // Save peaks after first audio decode (non-peaks path)
          if (!hasPeaks) {
            savePeaks(ws);
          }
        });

        // For peaks mode, waveform renders synchronously — "ready" fires immediately
        // but we also set state explicitly in case it already fired
        if (hasPeaks) {
          setDuration(propDuration!);
          setIsReady(true);
          setError(null);
        }

        ws.on("audioprocess", () => {
          const now = performance.now();
          if (now - lastTimeUpdateRef.current < 100) return; // ~10fps throttle
          lastTimeUpdateRef.current = now;
          const time = ws.getCurrentTime();
          // Low-priority update — won't block navigation transitions
          startTransition(() => {
            setCurrentTime(time);
            onTimeUpdateRef.current?.(time);
          });
        });

        ws.on("seeking", () => {
          const time = ws.getCurrentTime();
          setCurrentTime(time);
          onTimeUpdateRef.current?.(time);
        });

        ws.on("play", () => setIsPlaying(true));
        ws.on("pause", () => setIsPlaying(false));
        ws.on("finish", () => setIsPlaying(false));

        ws.on("error", (err: unknown) => {
          if (err instanceof DOMException && err.name === "AbortError") return;
          if (typeof err === "string" && err.includes("aborted")) return;

          let message: string;
          if (typeof err === "string") {
            message = err;
          } else if (err instanceof Error) {
            message = err.message;
          } else if (err && typeof err === "object" && "message" in err) {
            message = String((err as Record<string, unknown>).message);
          } else {
            message = "Unable to load audio file.";
          }
          console.error("WaveSurfer error:", message, err);
          setError(message);
        });

        wavesurferRef.current = ws;
      },
      // Stable deps only — resolvedUrl is NOT here
      [hasPeaks, peaks, propDuration, savePeaks]
    );

    // --- URL resolution effect (runs once on mount) ---
    useEffect(() => {
      cancelledRef.current = false;

      const promise = resolveAudioUrlImpl(audioUrl, recordingId);
      urlResolvePromiseRef.current = promise;

      promise.then((url) => {
        if (cancelledRef.current) return;
        resolvedUrlRef.current = url;

        const audio = audioRef.current;
        if (!audio) return;

        if (hasPeaks) {
          // Peaks path: just set the src so playback is ready. No re-render needed.
          audio.src = url;
        } else {
          // No-peaks path: load audio so WaveSurfer can decode and render waveform
          audio.src = url;
          wavesurferRef.current?.load(url);
        }
      });

      return () => {
        cancelledRef.current = true;
      };
    }, [audioUrl, recordingId, hasPeaks]);

    // --- Update waveform colors when theme changes ---
    useEffect(() => {
      if (wavesurferRef.current) {
        const isDark = document.documentElement.classList.contains("dark");
        wavesurferRef.current.setOptions({
          waveColor: isDark ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.2)",
          progressColor: "#6366f1",
          cursorColor: "#6366f1",
        });
      }
    }, [themeColors]);

    // --- Cleanup on unmount ---
    useEffect(() => {
      return () => {
        cancelledRef.current = true;
        // Destroy WaveSurfer first to remove all event listeners
        try { wavesurferRef.current?.destroy(); } catch { /* ignore */ }
        wavesurferRef.current = null;
        // Then clean up the audio element
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.removeAttribute("src");
          audioRef.current.load();
          audioRef.current = null;
        }
      };
    }, []);

    // --- Stop audio on route change (Next.js soft navigation) ---
    const pathname = usePathname();
    useEffect(() => {
      return () => {
        audioRef.current?.pause();
      };
    }, [pathname]);

    // --- togglePlay: no destroying, no recreating ---
    async function togglePlay() {
      const ws = wavesurferRef.current;
      if (!ws) return;

      // If URL is already resolved, just play/pause
      if (resolvedUrlRef.current) {
        ws.playPause();
        return;
      }

      // URL still resolving — show spinner, await, then play
      setIsLoadingAudio(true);
      try {
        let promise = urlResolvePromiseRef.current;
        if (!promise) {
          // Edge case: resolve fresh
          promise = resolveAudioUrlImpl(audioUrl, recordingId);
          urlResolvePromiseRef.current = promise;
        }
        const url = await promise;
        if (cancelledRef.current) return;
        resolvedUrlRef.current = url;

        const audio = audioRef.current;
        if (audio && !audio.src) {
          audio.src = url;
        }

        ws.playPause();
      } finally {
        setIsLoadingAudio(false);
      }
    }

    function skip(seconds: number) {
      const ws = wavesurferRef.current;
      if (!ws) return;
      const d = ws.getDuration();
      if (d <= 0) return;
      const newTime = Math.max(0, Math.min(ws.getCurrentTime() + seconds, d));
      ws.seekTo(newTime / d);
    }

    function handleMarkerClick(time: number) {
      if (wavesurferRef.current && duration > 0) {
        wavesurferRef.current.seekTo(time / duration);
      }
    }

    return (
      <div className="space-y-3">
        <div className="relative">
          <div
            ref={initWaveSurfer}
            className="rounded-lg border bg-card p-3"
          />
          {/* Loading skeleton */}
          {!isReady && !error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center rounded-lg border bg-card p-3">
              <div className="absolute inset-0 flex items-end gap-[3px] p-3 opacity-30">
                {[30,42,55,38,60,48,35,52,65,40,28,50,62,45,33,55,68,43,30,48,58,36,25,45,60,50,38,55,70,42,28,52,63,47,35,57,44,30,50,62,40,27,48,58,37,53,42,32].map((h, i) => (
                  <div
                    key={i}
                    className="flex-1 rounded-full bg-muted-foreground/10 animate-pulse"
                    style={{ height: `${h}%` }}
                  />
                ))}
              </div>
              <p className="relative z-10 text-xs text-muted-foreground animate-pulse">Loading waveform...</p>
            </div>
          )}
          {/* Marker indicators overlay */}
          {isReady && duration > 0 && markers.length > 0 && (
            <div className="absolute inset-x-3 top-0 h-full pointer-events-none">
              {markers.map((marker, i) => {
                const pct = (marker.time / duration) * 100;
                return (
                  <button
                    key={i}
                    className="absolute top-0 pointer-events-auto group p-2 -m-2"
                    style={{ left: `${pct}%` }}
                    onClick={() => handleMarkerClick(marker.time)}
                    title={`${formatTime(marker.time)}: ${marker.label}`}
                  >
                    <Flag className="h-3.5 w-3.5 text-primary -translate-x-1/2" />
                    <div className="absolute left-1/2 -translate-x-1/2 top-4 bg-popover border rounded px-2 py-1 text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity shadow-md z-10">
                      {marker.label}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
        {error && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <p>{error || "Unable to load waveform"}</p>
            </div>
            <p className="text-xs text-muted-foreground">Fallback player:</p>
            <audio controls src={audioUrl} className="w-full" preload="metadata">
              Your browser does not support the audio element.
            </audio>
          </div>
        )}
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground tabular-nums">
            {formatTime(currentTime)}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => skip(-10)}
              disabled={!isReady}
            >
              <SkipBack className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              onClick={togglePlay}
              disabled={!isReady || isLoadingAudio}
            >
              {isLoadingAudio ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : isPlaying ? (
                <Pause className="h-4 w-4" />
              ) : (
                <Play className="h-4 w-4" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => skip(10)}
              disabled={!isReady}
            >
              <SkipForward className="h-4 w-4" />
            </Button>
            {onVisualizerOpen && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onVisualizerOpen}
                disabled={!isReady}
                title="Open Visualizer"
              >
                <Sparkles className="h-4 w-4" />
              </Button>
            )}
          </div>
          <span className="text-sm text-muted-foreground tabular-nums">
            {formatTime(duration)}
          </span>
        </div>
      </div>
    );
  }
);
