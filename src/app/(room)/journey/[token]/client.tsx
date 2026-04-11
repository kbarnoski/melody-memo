"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ShaderVisualizer, SHADERS, type VisualizerMode } from "@/components/audio/visualizer";
import { Visualizer3D, type Visualizer3DMode } from "@/components/audio/visualizer-3d";
import { JourneyCompositor } from "@/components/audio/journey-compositor";
import { JourneyPhaseIndicator } from "@/components/audio/journey-phase-indicator";
import { ShareSheet } from "@/components/ui/share-sheet";
import { getJourneyEngine } from "@/lib/journeys/journey-engine";
import { useAudioStore } from "@/lib/audio/audio-store";
import { getRealtimeImageService } from "@/lib/journeys/realtime-image-service";
import { createClient } from "@/lib/supabase/client";
import { MODES_3D, MODES_AI } from "@/lib/shaders";
import type { Journey, JourneyFrame, JourneyPhaseId } from "@/lib/journeys/types";
import { Pause, Play, Volume2, VolumeX, Share2, Maximize2, Minimize2, RotateCcw } from "lucide-react";

function formatTime(s: number): string {
  if (!s || isNaN(s)) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.round(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

// Ambient shaders used as backdrop underneath AI imagery modes (same as main app)
const AI_BACKDROP_SHADERS: VisualizerMode[] = [
  "fog", "nebula", "drift",
  "tide", "ember",
];

function getAiBackdropShader(aiMode: string): VisualizerMode {
  let hash = 0;
  for (let i = 0; i < aiMode.length; i++) hash = (hash * 31 + aiMode.charCodeAt(i)) | 0;
  return AI_BACKDROP_SHADERS[Math.abs(hash) % AI_BACKDROP_SHADERS.length];
}

// Throttle frame state updates — match main app (~30fps)
const FRAME_THROTTLE_MS = 33;

interface SharedJourneyClientProps {
  journey: Journey;
  audioUrl: string | null;
  shareToken: string;
  playbackSeed: string | null;
}

export function SharedJourneyClient({
  journey,
  audioUrl,
  shareToken,
  playbackSeed,
}: SharedJourneyClientProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const [dataArray, setDataArray] = useState<Uint8Array<ArrayBuffer> | null>(null);
  const [started, setStarted] = useState(false); // user must tap to start (browser auto-play policy)
  const [isPlaying, setIsPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [journeyFrame, setJourneyFrame] = useState<JourneyFrame | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [shareSheet, setShareSheet] = useState(false);
  const [ended, setEnded] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(true); // assume auth until checked
  const animRef = useRef<number>(0);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const endedRef = useRef(false);
  const resolvedAudioUrlRef = useRef<string | null>(null);

  // Check auth state — show signup CTA for unauthenticated viewers
  useEffect(() => {
    createClient().auth.getUser().then(({ data: { user } }) => {
      setIsAuthenticated(!!user);
    });
  }, []);

  // Load Cormorant Garamond for start screen + phase indicator
  useEffect(() => {
    const id = "journey-shared-font";
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400&display=swap";
    document.head.appendChild(link);
  }, []);

  // Time display — direct DOM updates, no re-renders
  const timeDisplayRef = useRef<HTMLSpanElement>(null);
  const timeDisplayMobileRef = useRef<HTMLSpanElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);

  // Frame throttle
  const lastFrameTimeRef = useRef(0);
  const frameRef = useRef<JourneyFrame | null>(null);

  // Phase changes via engine callback
  // Phase guidance is now handled internally by JourneyPhaseIndicator

  // ─── Shader crossfade state (matching VisualizerCore) ───
  const shaderMode = journeyFrame?.shaderMode ?? journey.phases[0]?.shaderModes[0] ?? "cosmos";
  const [renderMode, setRenderMode] = useState<VisualizerMode>(shaderMode as VisualizerMode);
  const [prevRenderMode, setPrevRenderMode] = useState<VisualizerMode | null>(null);
  const crossfadeRef = useRef<number>(0);
  const prevModeRef = useRef(shaderMode);
  const prevLayerRef = useRef<HTMLDivElement>(null);
  const nextLayerRef = useRef<HTMLDivElement>(null);

  // Crossfade animation when shader mode changes (~1.5s ease-in-out)
  useEffect(() => {
    if (shaderMode !== prevModeRef.current) {
      cancelAnimationFrame(crossfadeRef.current);

      setPrevRenderMode(prevModeRef.current as VisualizerMode);
      setRenderMode(shaderMode as VisualizerMode);
      prevModeRef.current = shaderMode;

      // Start crossfade on next frame (after React renders the new layers)
      crossfadeRef.current = requestAnimationFrame(() => {
        let prevStartOpacity = prevLayerRef.current
          ? parseFloat(prevLayerRef.current.style.opacity || "1")
          : 1;
        if (isNaN(prevStartOpacity)) prevStartOpacity = 1;
        if (prevLayerRef.current && prevStartOpacity <= 0.01) {
          prevLayerRef.current.style.opacity = "1";
        }
        if (nextLayerRef.current) nextLayerRef.current.style.opacity = "0";

        let progress = 0;
        const animate = () => {
          progress = Math.min(1, progress + 0.011);
          const eased = progress < 0.5
            ? 2 * progress * progress
            : 1 - Math.pow(-2 * progress + 2, 2) / 2;

          const outOpacity = Math.max(0, (prevStartOpacity <= 0.01 ? 1 : prevStartOpacity) * (1 - eased));
          if (prevLayerRef.current) prevLayerRef.current.style.opacity = String(outOpacity);
          if (nextLayerRef.current) nextLayerRef.current.style.opacity = String(eased);

          if (progress < 1) {
            crossfadeRef.current = requestAnimationFrame(animate);
          } else {
            setPrevRenderMode(null);
          }
        };
        crossfadeRef.current = requestAnimationFrame(animate);
      });

      return () => cancelAnimationFrame(crossfadeRef.current);
    }
  }, [shaderMode]);

  // ─── Dual shader layer (peak journey moments) ───
  const [dualShaderVisible, setDualShaderVisible] = useState<string | null>(null);
  const dualShaderRef = useRef<HTMLDivElement>(null);
  const dualFadeRef = useRef<number>(0);

  const dualShaderTarget = journeyFrame?.dualShaderMode && SHADERS[journeyFrame.dualShaderMode as VisualizerMode]
    ? journeyFrame.dualShaderMode : null;

  useEffect(() => {
    if (dualShaderTarget) {
      setDualShaderVisible(dualShaderTarget);
      cancelAnimationFrame(dualFadeRef.current);
      let progress = 0;
      const fadeIn = () => {
        progress = Math.min(1, progress + 0.006);
        const eased = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;
        if (dualShaderRef.current) dualShaderRef.current.style.opacity = String(eased * 0.75);
        if (progress < 1) dualFadeRef.current = requestAnimationFrame(fadeIn);
      };
      dualFadeRef.current = requestAnimationFrame(() => {
        if (dualShaderRef.current) dualShaderRef.current.style.opacity = "0";
        dualFadeRef.current = requestAnimationFrame(fadeIn);
      });
    } else {
      cancelAnimationFrame(dualFadeRef.current);
      if (!dualShaderRef.current) {
        setDualShaderVisible(null);
        return;
      }
      const startOpacity = parseFloat(dualShaderRef.current.style.opacity || "0");
      if (startOpacity <= 0.001) {
        setDualShaderVisible(null);
        return;
      }
      let progress = 0;
      const fadeOut = () => {
        progress = Math.min(1, progress + 0.005); // ~200 frames (~3.3s) — gentle exit
        const eased = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;
        if (dualShaderRef.current) dualShaderRef.current.style.opacity = String(startOpacity * (1 - eased));
        if (progress < 1) {
          dualFadeRef.current = requestAnimationFrame(fadeOut);
        } else {
          setDualShaderVisible(null);
        }
      };
      dualFadeRef.current = requestAnimationFrame(fadeOut);
    }
    return () => cancelAnimationFrame(dualFadeRef.current);
  }, [dualShaderTarget]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Tertiary shader layer ───
  const [tertiaryShaderVisible, setTertiaryShaderVisible] = useState<string | null>(null);
  const tertiaryShaderRef = useRef<HTMLDivElement>(null);
  const tertiaryFadeRef = useRef<number>(0);

  const tertiaryShaderTarget = journeyFrame?.tertiaryShaderMode && SHADERS[journeyFrame.tertiaryShaderMode as VisualizerMode]
    ? journeyFrame.tertiaryShaderMode : null;

  useEffect(() => {
    if (tertiaryShaderTarget) {
      setTertiaryShaderVisible(tertiaryShaderTarget);
      cancelAnimationFrame(tertiaryFadeRef.current);
      let progress = 0;
      const fadeIn = () => {
        progress = Math.min(1, progress + 0.005);
        const eased = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;
        if (tertiaryShaderRef.current) tertiaryShaderRef.current.style.opacity = String(eased * 0.60);
        if (progress < 1) tertiaryFadeRef.current = requestAnimationFrame(fadeIn);
      };
      tertiaryFadeRef.current = requestAnimationFrame(() => {
        if (tertiaryShaderRef.current) tertiaryShaderRef.current.style.opacity = "0";
        tertiaryFadeRef.current = requestAnimationFrame(fadeIn);
      });
    } else {
      cancelAnimationFrame(tertiaryFadeRef.current);
      if (!tertiaryShaderRef.current) {
        setTertiaryShaderVisible(null);
        return;
      }
      const startOpacity = parseFloat(tertiaryShaderRef.current.style.opacity || "0");
      if (startOpacity <= 0.001) {
        setTertiaryShaderVisible(null);
        return;
      }
      let progress = 0;
      const fadeOut = () => {
        progress = Math.min(1, progress + 0.004); // ~250 frames (~4s) — very gentle exit
        const eased = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;
        if (tertiaryShaderRef.current) tertiaryShaderRef.current.style.opacity = String(startOpacity * (1 - eased));
        if (progress < 1) {
          tertiaryFadeRef.current = requestAnimationFrame(fadeOut);
        } else {
          setTertiaryShaderVisible(null);
        }
      };
      tertiaryFadeRef.current = requestAnimationFrame(fadeOut);
    }
    return () => cancelAnimationFrame(tertiaryFadeRef.current);
  }, [tertiaryShaderTarget]); // eslint-disable-line react-hooks/exhaustive-deps

  const [isIOS, setIsIOS] = useState(false);
  useEffect(() => {
    setIsIOS(/iPad|iPhone|iPod/.test(navigator.userAgent));
  }, []);

  // Auto-hide controls
  const resetHideTimer = useCallback(() => {
    setControlsVisible(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setControlsVisible(false), 5000);
  }, []);

  useEffect(() => {
    const handleMove = () => resetHideTimer();
    const handleTouch = () => resetHideTimer();
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("touchstart", handleTouch);
    resetHideTimer();
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("touchstart", handleTouch);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [resetHideTimer]);

  // Pre-resolve audio URL so it's ready when user taps start
  useEffect(() => {
    if (!audioUrl) return;
    let cancelled = false;
    fetch(audioUrl)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) resolvedAudioUrlRef.current = data.url ?? audioUrl;
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [audioUrl]);

  // Initialize audio + analyser when user taps start
  useEffect(() => {
    if (!started) return;
    let cancelled = false;
    const ctx = new AudioContext();
    ctxRef.current = ctx;
    const node = ctx.createAnalyser();
    node.fftSize = 256;

    async function init() {
      // Resume context (required after user gesture on some browsers)
      if (ctx.state === "suspended") await ctx.resume();

      const url = resolvedAudioUrlRef.current;
      if (url) {
        try {
          const audio = new Audio(url);
          audio.crossOrigin = "anonymous";
          audioRef.current = audio;

          const source = ctx.createMediaElementSource(audio);
          source.connect(node);
          node.connect(ctx.destination);

          audio.addEventListener("playing", () => {
            endedRef.current = false;
            setEnded(false);
            setIsPlaying(true);
          });
          audio.addEventListener("pause", () => setIsPlaying(false));
          audio.addEventListener("ended", () => {
            endedRef.current = true;
            setEnded(true);
            audio.currentTime = 0;
            setIsPlaying(false);
          });

          // Play once ready
          audio.addEventListener("canplay", () => {
            if (cancelled) return;
            audio.play().catch(() => setIsPlaying(false));
          }, { once: true });
        } catch {
          node.connect(ctx.destination);
        }
      } else {
        node.connect(ctx.destination);
      }

      if (cancelled) return;
      analyserRef.current = node;
      dataArrayRef.current = new Uint8Array(node.frequencyBinCount) as Uint8Array<ArrayBuffer>;
      setAnalyser(node);
      setDataArray(new Uint8Array(node.frequencyBinCount) as Uint8Array<ArrayBuffer>);
    }

    init();

    return () => {
      cancelled = true;
      audioRef.current?.pause();
      ctx.close();
    };
  }, [started]);

  // Start journey engine only after user taps start
  useEffect(() => {
    if (!started) return;
    getRealtimeImageService().resetSession();
    const engine = getJourneyEngine();
    const seed = playbackSeed ? parseInt(playbackSeed, 10) : undefined;
    const duration = useAudioStore.getState().duration;
    engine.start(journey, {
      ...(seed != null && !isNaN(seed) ? { seed } : {}),
      trackDuration: duration > 0 ? duration : undefined,
    });

    return () => {
      engine.stop();
    };
  }, [started, journey, playbackSeed]);

  // Animation loop — throttled frame updates matching main app
  const startTimeRef = useRef(Date.now());
  const JOURNEY_DURATION_MS = 5 * 60 * 1000;

  useEffect(() => {
    if (!started) return;
    startTimeRef.current = Date.now();
    const engine = getJourneyEngine();

    function tick() {
      const audio = audioRef.current;
      let progress: number;
      let ct: number;
      let dur: number;

      if (audio && audio.duration > 0 && isFinite(audio.duration)) {
        ct = audio.currentTime;
        dur = audio.duration;
        progress = ct / dur;
      } else {
        const elapsed = (Date.now() - startTimeRef.current) / 1000;
        dur = JOURNEY_DURATION_MS / 1000;
        ct = elapsed;
        progress = Math.min(1, elapsed / dur);
      }

      // When song has ended, show 0:00 / duration and full progress, freeze frames
      if (endedRef.current) {
        const endText = `${formatTime(0)} / ${formatTime(dur)}`;
        if (timeDisplayRef.current) timeDisplayRef.current.textContent = endText;
        if (timeDisplayMobileRef.current) timeDisplayMobileRef.current.textContent = endText;
        if (progressBarRef.current) {
          progressBarRef.current.style.width = "100%";
        }
        animRef.current = requestAnimationFrame(tick);
        return;
      }

      // Update time display + progress bar via DOM (no React re-render)
      const timeText = `${formatTime(ct)} / ${formatTime(dur)}`;
      if (timeDisplayRef.current) timeDisplayRef.current.textContent = timeText;
      if (timeDisplayMobileRef.current) timeDisplayMobileRef.current.textContent = timeText;
      if (progressBarRef.current) {
        progressBarRef.current.style.width = `${progress * 100}%`;
      }

      // Throttled frame updates — only push to React at ~30fps
      const now = performance.now();
      const newFrame = engine.getFrame(progress);
      if (newFrame) {
        const prev = frameRef.current;
        const visuallyChanged = !prev
          || prev.shaderMode !== newFrame.shaderMode
          || prev.phase !== newFrame.phase
          || prev.aiPrompt !== newFrame.aiPrompt
          || prev.dualShaderMode !== newFrame.dualShaderMode
          || prev.tertiaryShaderMode !== newFrame.tertiaryShaderMode;

        frameRef.current = newFrame;

        if (visuallyChanged || now - lastFrameTimeRef.current >= FRAME_THROTTLE_MS) {
          lastFrameTimeRef.current = now;
          setJourneyFrame(newFrame);
        }
      }

      animRef.current = requestAnimationFrame(tick);
    }

    animRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animRef.current);
  }, [started]);

  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      await audio.play();
    } else {
      audio.pause();
    }
  };

  const toggleMute = () => {
    if (audioRef.current) {
      audioRef.current.muted = !muted;
      setMuted(!muted);
    }
  };

  const handleShare = () => {
    setShareSheet(true);
  };

  const toggleFullscreen = useCallback(() => {
    if (isIOS) {
      setIsFullscreen((v) => !v);
      return;
    }
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => setIsFullscreen(false));
    } else {
      document.documentElement.requestFullscreen().catch(() => {
        setIsFullscreen((v) => !v);
      });
    }
  }, [isIOS]);

  useEffect(() => {
    const handleChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handleChange);
    return () => document.removeEventListener("fullscreenchange", handleChange);
  }, []);

  const handleProgressClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio || !audio.duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    audio.currentTime = pct * audio.duration;
  }, []);

  const audioFeatures = { amplitude: 0, bass: 0 };

  if (analyserRef.current && dataArrayRef.current) {
    analyserRef.current.getByteFrequencyData(dataArrayRef.current);
    const arr = dataArrayRef.current;
    let sum = 0;
    let bassSum = 0;
    for (let i = 0; i < arr.length; i++) {
      sum += arr[i];
      if (i < arr.length / 4) bassSum += arr[i];
    }
    audioFeatures.amplitude = sum / (arr.length * 255);
    audioFeatures.bass = bassSum / ((arr.length / 4) * 255);
  }

  // ─── Shader layer renderer (matching VisualizerCore exactly) ───
  // Two-layer approach: outer for positioning, inner for crossfade opacity (animated via ref).
  // This prevents React style prop conflicts with rAF-driven opacity animation.
  const renderShaderLayer = (layerMode: VisualizerMode, zIndex: number, ref?: React.Ref<HTMLDivElement>, initialOpacity?: number) => {
    if (!analyser || !dataArray) return null;
    const layerIs3D = MODES_3D.has(layerMode);
    const layerIsAI = MODES_AI.has(layerMode);

    const outerStyle: React.CSSProperties = {
      position: "absolute",
      inset: 0,
      zIndex,
      pointerEvents: "none",
    };

    const innerStyle: React.CSSProperties = {
      position: "absolute",
      inset: 0,
      opacity: initialOpacity !== undefined ? initialOpacity : 1,
    };

    if (layerIsAI) {
      const backdropMode = getAiBackdropShader(layerMode);
      const backdropFrag = SHADERS[backdropMode];
      if (backdropFrag) {
        return (
          <div key={layerMode} style={{ ...outerStyle, opacity: 0.6 }}>
            <div ref={ref} style={innerStyle}>
              <ShaderVisualizer analyser={analyser} dataArray={dataArray} fragShader={backdropFrag} smoothMotion />
            </div>
          </div>
        );
      }
      return <div key={layerMode} style={{ ...outerStyle, backgroundColor: "#000" }}><div ref={ref} style={innerStyle} /></div>;
    }
    if (layerIs3D) {
      return (
        <div key={layerMode} style={outerStyle}>
          <div ref={ref} style={innerStyle}>
            <Visualizer3D analyser={analyser} dataArray={dataArray} mode={layerMode as Visualizer3DMode} />
          </div>
        </div>
      );
    }
    const frag = SHADERS[layerMode];
    if (!frag) return <div key={layerMode} style={{ ...outerStyle, backgroundColor: "#000" }}><div ref={ref} style={innerStyle} /></div>;
    return (
      <div key={layerMode} style={outerStyle}>
        <div ref={ref} style={innerStyle}>
          <ShaderVisualizer analyser={analyser} dataArray={dataArray} fragShader={frag} smoothMotion />
        </div>
      </div>
    );
  };

  const shareUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/journey/${shareToken}`;

  const handleReplay = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      endedRef.current = false;
      setEnded(false);
      audioRef.current.play();
    }
  };

  // ─── Start screen ───
  if (!started) {
    return (
      <div
        className="h-dvh w-screen overflow-hidden bg-black relative flex items-center justify-center"
        style={{ cursor: "pointer" }}
        onClick={() => setStarted(true)}
      >
        <style>{`@keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }`}</style>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "32px",
            animation: "fadeIn 1s ease-out both",
            textAlign: "center",
            padding: "0 24px",
          }}
        >
          <div>
            <div
              style={{
                fontSize: "0.6rem",
                fontFamily: "var(--font-geist-mono)",
                color: "rgba(255, 255, 255, 0.3)",
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                marginBottom: "14px",
              }}
            >
              Shared Journey
            </div>
            <div
              style={{
                fontSize: "clamp(1.8rem, 5vw, 2.8rem)",
                fontFamily: "'Cormorant Garamond', Georgia, serif",
                fontWeight: 300,
                letterSpacing: "0.04em",
                color: "rgba(255, 255, 255, 0.9)",
                lineHeight: 1.2,
              }}
            >
              {journey.name}
            </div>
            {journey.subtitle && (
              <div
                style={{
                  fontSize: "clamp(0.9rem, 2vw, 1.1rem)",
                  fontFamily: "'Cormorant Garamond', Georgia, serif",
                  fontWeight: 300,
                  fontStyle: "italic",
                  color: "rgba(255, 255, 255, 0.45)",
                  marginTop: "8px",
                }}
              >
                {journey.subtitle}
              </div>
            )}
          </div>

          <button
            onClick={(e) => { e.stopPropagation(); setStarted(true); }}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "64px",
              height: "64px",
              borderRadius: "50%",
              background: "rgba(255, 255, 255, 0.1)",
              border: "1px solid rgba(255, 255, 255, 0.2)",
              color: "rgba(255, 255, 255, 0.9)",
              cursor: "pointer",
              transition: "all 0.2s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(255, 255, 255, 0.15)";
              e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.3)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)";
              e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.2)";
            }}
          >
            <Play style={{ width: 24, height: 24, marginLeft: 3 }} fill="currentColor" />
          </button>

          <div
            style={{
              fontSize: "0.65rem",
              fontFamily: "var(--font-geist-mono)",
              color: "rgba(255, 255, 255, 0.2)",
            }}
          >
            Tap anywhere to begin
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-dvh w-screen overflow-hidden bg-black relative">
      {analyser && dataArray && (
        <JourneyCompositor
          frame={journeyFrame}
          audioAmplitude={audioFeatures.amplitude}
          audioBass={audioFeatures.bass}
          aiEnabled={journey.aiEnabled}
          aiGenerating={!ended}
          promptSeed={playbackSeed ? parseInt(playbackSeed, 10) : undefined}
          journeyId={journey.id}
        >
          {/* Previous shader (fading out during crossfade) */}
          {prevRenderMode && renderShaderLayer(prevRenderMode, 0, prevLayerRef)}

          {/* Current shader (fading in, or full opacity when no crossfade) */}
          {renderShaderLayer(renderMode, 1, prevRenderMode ? nextLayerRef : undefined, prevRenderMode ? 0 : undefined)}

          {/* Dual shader — second layer during peak journey moments */}
          {dualShaderVisible && SHADERS[dualShaderVisible as VisualizerMode] && (
            <div ref={dualShaderRef} style={{ position: "absolute", inset: 0, zIndex: 1, pointerEvents: "none", opacity: 0, mixBlendMode: "screen" }}>
              <ShaderVisualizer
                analyser={analyser}
                dataArray={dataArray}
                fragShader={SHADERS[dualShaderVisible as VisualizerMode]!}
                smoothMotion
              />
            </div>
          )}

          {/* Tertiary shader — third layer for rich multi-shader moments */}
          {tertiaryShaderVisible && SHADERS[tertiaryShaderVisible as VisualizerMode] && (
            <div ref={tertiaryShaderRef} style={{ position: "absolute", inset: 0, zIndex: 1, pointerEvents: "none", opacity: 0, mixBlendMode: "screen" }}>
              <ShaderVisualizer
                analyser={analyser}
                dataArray={dataArray}
                fragShader={SHADERS[tertiaryShaderVisible as VisualizerMode]!}
                smoothMotion
              />
            </div>
          )}
        </JourneyCompositor>
      )}

      {/* Phase indicator — same component as main app */}
      <JourneyPhaseIndicator
        journey={journey}
        currentPhase={journeyFrame?.phase as JourneyPhaseId ?? null}
      />

      {/* Bottom bar — solid black, matching main app journey mode */}
      <div
        className="absolute inset-x-0 bottom-0 transition-opacity duration-500 ease-out"
        style={{
          zIndex: 10,
          opacity: controlsVisible ? 1 : 0,
          pointerEvents: controlsVisible ? "auto" : "none",
        }}
      >
        {/* Subtle top separator */}
        <div
          className="h-px w-full"
          style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.08) 20%, rgba(255,255,255,0.08) 80%, transparent)" }}
        />

        {/* Desktop bar */}
        <div
          className="room-bar-desktop items-center px-4"
          style={{ background: "#000", height: "56px" }}
        >
          {/* LEFT: Listen on Resonance */}
          <div className="flex items-center gap-1.5">
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a
              href="/"
              className="text-white/25 hover:text-white/50 transition-colors"
              style={{ fontSize: "0.68rem", fontFamily: "var(--font-geist-mono)" }}
            >
              Listen on Resonance
            </a>
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* CENTER: Play/pause + journey name + mute + time */}
          <div className="flex items-center gap-2">
            {audioUrl && (
              <button
                onClick={togglePlay}
                className="flex items-center justify-center p-2 text-white/80 hover:text-white transition-colors duration-75"
              >
                {isPlaying ? (
                  <Pause className="h-4 w-4" fill="currentColor" />
                ) : (
                  <Play className="h-4 w-4" fill="currentColor" />
                )}
              </button>
            )}
            <span
              className="text-white/50 truncate"
              style={{
                fontSize: "0.8rem",
                fontFamily: "var(--font-geist-sans)",
                maxWidth: "200px",
              }}
            >
              {journey.name}
            </span>
            {audioUrl && (
              <button
                onClick={toggleMute}
                className="flex items-center justify-center p-1.5 text-white/35 hover:text-white/70 transition-colors duration-75"
              >
                {muted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
              </button>
            )}
            <span
              ref={timeDisplayRef}
              className="text-white/25"
              style={{ fontSize: "0.65rem", fontFamily: "var(--font-geist-mono)", fontVariantNumeric: "tabular-nums" }}
            >
              0:00 / 0:00
            </span>
          </div>

          {/* Spacer */}
          <div className="flex-[2]" />

          {/* RIGHT: Share + Fullscreen */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleShare}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-white/40 hover:text-white/80 hover:bg-white/10 transition-colors duration-75"
              style={{ border: "1px solid rgba(255,255,255,0.1)", fontSize: "0.72rem", fontFamily: "var(--font-geist-mono)" }}
              title="Share Journey"
            >
              <Share2 className="h-3.5 w-3.5" />
              Share
            </button>
            <button
              onClick={toggleFullscreen}
              className="flex items-center justify-center p-2.5 rounded-lg text-white/50 hover:text-white/80 hover:bg-white/10 transition-colors duration-75"
              style={{ border: "1px solid rgba(255,255,255,0.1)" }}
              title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
            >
              {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>

        {/* Mobile bar */}
        <div
          className="room-bar-mobile flex-col"
          style={{ background: "#000", paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
        >
          {/* Row 1: Listen on Resonance + actions */}
          <div className="flex items-center justify-between px-3" style={{ height: "32px" }}>
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a
              href="/"
              className="text-white/20 hover:text-white/40 transition-colors"
              style={{ fontSize: "0.62rem", fontFamily: "var(--font-geist-mono)" }}
            >
              Listen on Resonance
            </a>
            <div className="flex items-center gap-0.5">
              <button
                onClick={handleShare}
                className="min-w-[36px] min-h-[32px] flex items-center justify-center rounded-lg text-white/35 hover:text-white/65 transition-colors duration-75"
                title="Share"
              >
                <Share2 className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={toggleFullscreen}
                className="min-w-[36px] min-h-[32px] flex items-center justify-center rounded-lg text-white/35 hover:text-white/65 transition-colors duration-75"
                title="Fullscreen"
              >
                {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>

          {/* Row 2: Transport — play + name + mute + time */}
          <div className="flex items-center justify-center gap-2 px-3" style={{ height: "44px" }}>
            {audioUrl && (
              <button
                onClick={togglePlay}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center text-white/80 hover:text-white transition-colors duration-75"
              >
                {isPlaying ? (
                  <Pause className="h-4.5 w-4.5" fill="currentColor" />
                ) : (
                  <Play className="h-4.5 w-4.5" fill="currentColor" />
                )}
              </button>
            )}
            <span
              className="text-white/50 truncate"
              style={{
                fontSize: "0.75rem",
                fontFamily: "var(--font-geist-sans)",
                maxWidth: "140px",
              }}
            >
              {journey.name}
            </span>
            {audioUrl && (
              <button
                onClick={toggleMute}
                className="min-w-[36px] min-h-[36px] flex items-center justify-center text-white/35 hover:text-white/65 transition-colors duration-75"
              >
                {muted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
              </button>
            )}
            <span
              ref={timeDisplayMobileRef}
              className="text-white/25 flex-shrink-0"
              style={{ fontSize: "0.6rem", fontFamily: "var(--font-geist-mono)", fontVariantNumeric: "tabular-nums" }}
            >
              0:00 / 0:00
            </span>
          </div>
        </div>
      </div>

      {/* Progress bar — thin overlay at the very bottom of the bar */}
      <div
        className="absolute bottom-0 inset-x-0 cursor-pointer"
        style={{ zIndex: 11, height: "24px", display: "flex", alignItems: "flex-end" }}
        onClick={handleProgressClick}
      >
        <div className="w-full h-[2px] overflow-hidden">
          <div
            ref={progressBarRef}
            className="h-full"
            style={{
              width: "0%",
              background: "linear-gradient(90deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.5) 100%)",
            }}
          />
        </div>
      </div>

      {/* Share sheet */}
      <ShareSheet
        open={shareSheet}
        onClose={() => setShareSheet(false)}
        url={shareUrl}
        title={`${journey.name} — Resonance`}
        text={`Check out ${journey.name} on Resonance`}
      />

      {/* Journey complete overlay — replay for authenticated viewers */}
      {ended && isAuthenticated && (
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{
            zIndex: 30,
            animation: "fadeIn 0.8s ease-out both",
          }}
        >
          <style>{`@keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }`}</style>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "20px",
              padding: "40px 36px",
              borderRadius: "16px",
              background: "rgba(0, 0, 0, 0.45)",
              backdropFilter: "blur(24px) saturate(1.1)",
              border: "1px solid rgba(255, 255, 255, 0.06)",
              maxWidth: "340px",
              textAlign: "center",
            }}
          >
            <div>
              <div
                style={{
                  fontSize: "0.6rem",
                  fontFamily: "var(--font-geist-mono)",
                  color: "rgba(255, 255, 255, 0.35)",
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  marginBottom: "10px",
                }}
              >
                Journey Complete
              </div>
              <div
                style={{
                  fontSize: "1.35rem",
                  fontWeight: 300,
                  color: "rgba(255, 255, 255, 0.85)",
                  lineHeight: 1.3,
                }}
              >
                {journey.name}
              </div>
            </div>
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                onClick={handleReplay}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "8px 18px",
                  borderRadius: "8px",
                  background: "rgba(255, 255, 255, 0.9)",
                  border: "none",
                  color: "#000",
                  fontSize: "0.78rem",
                  fontWeight: 500,
                  cursor: "pointer",
                  transition: "background 0.15s ease",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255, 255, 255, 1)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255, 255, 255, 0.9)")}
              >
                <RotateCcw style={{ width: 13, height: 13 }} />
                Replay
              </button>
              <button
                onClick={handleShare}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "8px 18px",
                  borderRadius: "8px",
                  background: "transparent",
                  border: "1px solid rgba(255, 255, 255, 0.15)",
                  color: "rgba(255, 255, 255, 0.6)",
                  fontSize: "0.78rem",
                  fontWeight: 500,
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = "rgba(255, 255, 255, 0.9)";
                  e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.3)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = "rgba(255, 255, 255, 0.6)";
                  e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.15)";
                }}
              >
                <Share2 style={{ width: 13, height: 13 }} />
                Share
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Journey complete overlay — signup CTA for unauthenticated viewers */}
      {ended && !isAuthenticated && (
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{
            zIndex: 30,
            animation: "fadeIn 0.8s ease-out both",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "24px",
              padding: "48px 40px",
              borderRadius: "16px",
              background: "rgba(0, 0, 0, 0.45)",
              backdropFilter: "blur(24px) saturate(1.1)",
              border: "1px solid rgba(255, 255, 255, 0.06)",
              maxWidth: "380px",
              textAlign: "center",
            }}
          >
            <div>
              <div
                style={{
                  fontSize: "0.6rem",
                  fontFamily: "var(--font-geist-mono)",
                  color: "rgba(255, 255, 255, 0.35)",
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  marginBottom: "10px",
                }}
              >
                Journey Complete
              </div>
              <div
                style={{
                  fontSize: "1.35rem",
                  fontWeight: 300,
                  color: "rgba(255, 255, 255, 0.85)",
                  lineHeight: 1.3,
                }}
              >
                {journey.name}
              </div>
            </div>

            <div
              style={{
                fontSize: "0.85rem",
                color: "rgba(255, 255, 255, 0.5)",
                lineHeight: 1.6,
              }}
            >
              Create your own journeys with your music on Resonance.
            </div>

            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", justifyContent: "center" }}>
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
              <a
                href="/signup"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "10px 28px",
                  borderRadius: "8px",
                  background: "rgba(255, 255, 255, 0.9)",
                  color: "#000",
                  fontSize: "0.8rem",
                  fontWeight: 500,
                  textDecoration: "none",
                  transition: "background 0.15s ease",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255, 255, 255, 1)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255, 255, 255, 0.9)")}
              >
                Sign Up Free
              </a>
              <button
                onClick={handleReplay}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "10px 18px",
                  borderRadius: "8px",
                  background: "transparent",
                  border: "1px solid rgba(255, 255, 255, 0.15)",
                  color: "rgba(255, 255, 255, 0.5)",
                  fontSize: "0.78rem",
                  fontWeight: 500,
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = "rgba(255, 255, 255, 0.8)";
                  e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.25)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = "rgba(255, 255, 255, 0.5)";
                  e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.15)";
                }}
              >
                <RotateCcw style={{ width: 13, height: 13 }} />
                Replay
              </button>
              <button
                onClick={handleShare}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "10px 18px",
                  borderRadius: "8px",
                  background: "transparent",
                  border: "1px solid rgba(255, 255, 255, 0.15)",
                  color: "rgba(255, 255, 255, 0.5)",
                  fontSize: "0.78rem",
                  fontWeight: 500,
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = "rgba(255, 255, 255, 0.8)";
                  e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.25)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = "rgba(255, 255, 255, 0.5)";
                  e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.15)";
                }}
              >
                <Share2 style={{ width: 13, height: 13 }} />
                Share
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
