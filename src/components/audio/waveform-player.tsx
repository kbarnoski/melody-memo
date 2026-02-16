"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import WaveSurfer from "wavesurfer.js";
import { Button } from "@/components/ui/button";
import { Play, Pause, SkipBack, SkipForward, AlertCircle } from "lucide-react";

interface WaveformPlayerProps {
  audioUrl: string;
  onTimeUpdate?: (currentTime: number) => void;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function WaveformPlayer({ audioUrl, onTimeUpdate }: WaveformPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  useEffect(() => {
    return () => {
      wavesurferRef.current?.destroy();
    };
  }, []);

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

  return (
    <div className="space-y-3">
      <div
        ref={initWaveSurfer}
        className="rounded-lg border bg-card p-3"
      />
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
        </div>
        <span className="text-sm text-muted-foreground tabular-nums">
          {formatTime(duration)}
        </span>
      </div>
    </div>
  );
}
