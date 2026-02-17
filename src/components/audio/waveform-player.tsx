"use client";

import { useRef, useState, useCallback, useEffect, useImperativeHandle, forwardRef } from "react";
import { usePathname } from "next/navigation";
import WaveSurfer from "wavesurfer.js";
import { Button } from "@/components/ui/button";
import { Play, Pause, SkipBack, SkipForward, AlertCircle, Flag, Sparkles } from "lucide-react";

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
  onTimeUpdate?: (currentTime: number) => void;
  markers?: MarkerDot[];
  onVisualizerOpen?: () => void;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export const WaveformPlayer = forwardRef<WaveformPlayerHandle, WaveformPlayerProps>(
  function WaveformPlayer({ audioUrl, onTimeUpdate, markers = [], onVisualizerOpen }, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    const wavesurferRef = useRef<WaveSurfer | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [isReady, setIsReady] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useImperativeHandle(ref, () => ({
      seekTo(time: number) {
        if (wavesurferRef.current && duration > 0) {
          wavesurferRef.current.seekTo(Math.max(0, Math.min(time / duration, 1)));
        }
      },
      getAudioElement() {
        return audioRef.current;
      },
    }));

    const initWaveSurfer = useCallback(
      (node: HTMLDivElement | null) => {
        if (!node) return;
        containerRef.current = node;

        if (wavesurferRef.current) {
          wavesurferRef.current.destroy();
        }

        // Use an HTML5 audio element for decoding —
        // this supports more codecs than Web Audio API's decodeAudioData()
        const audio = new Audio();
        audio.src = audioUrl;
        audioRef.current = audio;

        const ws = WaveSurfer.create({
          container: node,
          waveColor: "hsl(var(--muted-foreground) / 0.3)",
          progressColor: "hsl(var(--primary))",
          cursorColor: "hsl(var(--primary))",
          barWidth: 2,
          barGap: 1,
          barRadius: 2,
          height: 80,
          media: audio,
        });

        ws.on("ready", () => {
          setDuration(ws.getDuration());
          setIsReady(true);
          setError(null);
        });

        ws.on("audioprocess", () => {
          const time = ws.getCurrentTime();
          setCurrentTime(time);
          onTimeUpdate?.(time);
        });

        ws.on("seeking", () => {
          const time = ws.getCurrentTime();
          setCurrentTime(time);
          onTimeUpdate?.(time);
        });

        ws.on("play", () => setIsPlaying(true));
        ws.on("pause", () => setIsPlaying(false));
        ws.on("finish", () => setIsPlaying(false));

        ws.on("error", (err: unknown) => {
          const errObj = err as Record<string, unknown> | string | Error;
          let message: string;
          if (typeof errObj === "string") {
            message = errObj;
          } else if (errObj instanceof Error) {
            message = errObj.message;
          } else if (errObj && typeof errObj === "object" && "message" in errObj) {
            message = String(errObj.message);
          } else {
            message = "Unable to load audio file.";
          }
          console.error("WaveSurfer error:", message, err);
          setError(message);
        });

        wavesurferRef.current = ws;
      },
      [audioUrl, onTimeUpdate]
    );

    // Stop audio on component unmount
    useEffect(() => {
      return () => {
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.src = "";
          audioRef.current = null;
        }
        wavesurferRef.current?.destroy();
      };
    }, []);

    // Stop audio on route change (Next.js soft navigation)
    const pathname = usePathname();
    useEffect(() => {
      return () => {
        if (audioRef.current) {
          audioRef.current.pause();
        }
      };
    }, [pathname]);

    function togglePlay() {
      wavesurferRef.current?.playPause();
    }

    function skip(seconds: number) {
      if (wavesurferRef.current) {
        const newTime = Math.max(
          0,
          Math.min(wavesurferRef.current.getCurrentTime() + seconds, duration)
        );
        wavesurferRef.current.seekTo(newTime / duration);
      }
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
          {/* Marker indicators overlay */}
          {isReady && duration > 0 && markers.length > 0 && (
            <div className="absolute inset-x-3 top-0 h-full pointer-events-none">
              {markers.map((marker, i) => {
                const pct = (marker.time / duration) * 100;
                return (
                  <button
                    key={i}
                    className="absolute top-0 pointer-events-auto group"
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
              disabled={!isReady}
            >
              {isPlaying ? (
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
