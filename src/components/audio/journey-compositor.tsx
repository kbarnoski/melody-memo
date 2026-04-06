"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { AiImageLayer } from "./ai-image-layer";
import { PostProcessingLayer } from "./post-processing-layer";
import type { JourneyFrame } from "@/lib/journeys/types";
import { getEffectScale, getBloomScale } from "@/lib/journeys/adaptive-engine";

interface JourneyCompositorProps {
  frame: JourneyFrame | null;
  audioAmplitude: number;
  audioBass: number;
  aiEnabled: boolean;
  /** AI prompt override (for non-journey AI usage) */
  aiPrompt?: string;
  /** When true, AI images are the sole visual (no shader underneath) */
  aiOnly?: boolean;
  /** When false, stop generating new AI images (existing stay visible) */
  aiGenerating?: boolean;
  /** Optional seed for deterministic AI prompt variation (shared playback) */
  promptSeed?: number;
  /** Stable journey identifier — only purge AI images when this changes */
  journeyId?: string;
  children: React.ReactNode;
}

/**
 * Composites shader, AI imagery, and post-processing.
 *
 * Intro: AI imagery appears full-screen first, then shaders fade in on top.
 * Outro: When song ends, AI imagery stays visible as shaders fade naturally.
 *
 * Z-index stack (all layers share the same stacking context):
 *   Shader canvas: default (from children) — fades in via --shader-opacity
 *   AI images: z-index 2, pointer-events none
 *   Post-processing: z-index 3, pointer-events none
 *   Control bar: z-index 10 (set inside VisualizerCore)
 *   Mode palette: z-index 30-40 (set inside VisualizerCore)
 *   Poetry: z-index 5, pointer-events none
 *
 * Shader opacity is controlled via the --shader-opacity CSS custom property
 * instead of wrapping children in an opacity div. This avoids creating a
 * stacking context that would trap the bottom bar below the AI layer.
 * VisualizerCore's shader layers consume var(--shader-opacity, 1).
 */
export function JourneyCompositor({
  frame,
  audioAmplitude,
  audioBass,
  aiEnabled,
  aiPrompt,
  aiOnly = false,
  aiGenerating = true,
  promptSeed,
  journeyId,
  children,
}: JourneyCompositorProps) {
  const effectivePrompt = frame?.aiPrompt ?? aiPrompt ?? "";
  const effectiveDenoising = frame?.denoisingStrength ?? 0.5;
  const effectiveTargetFps = frame?.targetFps ?? 2;
  const effectiveShaderOpacity = frame?.shaderOpacity ?? 1.0;
  const showAi = aiEnabled && !!effectivePrompt;

  // Detect light-background phases from prompt — scale down GPU-expensive effects
  // Memoize to avoid regex on every render
  const isLightPhase = useMemo(
    () => /WHITE BACKGROUND|PALE BACKGROUND|LIGHT BACKGROUND/i.test(effectivePrompt),
    [effectivePrompt]
  );
  const isMobile = useMemo(
    () => typeof navigator !== "undefined" && /iPhone|iPad|Android/i.test(navigator.userAgent),
    []
  );

  // Adaptive scaling — learned from user feedback patterns
  const adaptiveConditions = {
    hasDualShader: !!frame?.dualShaderMode,
    isLightBg: isLightPhase,
    isMobile,
    bloom: frame?.bloomIntensity ?? 0,
    shader: frame?.shaderMode,
    dualShader: frame?.dualShaderMode,
  };
  const adaptiveScale = getEffectScale(adaptiveConditions);
  const adaptiveBloom = getBloomScale(adaptiveConditions);

  // Per-type event impulse reactions
  const impulse = frame?.eventImpulse ?? 0;
  const evtType = frame?.eventType ?? null;
  // Pre-activation ramp — builds ~1.5s before bass hit (0→1)
  const approach = frame?.eventApproach ?? 0;

  const eventReaction = useMemo(() => {
    if (impulse === 0 || !evtType) {
      return { bloom: 0, chromatic: 0, vignetteOpen: 0, halation: 0 };
    }
    switch (evtType) {
      case "bass_hit":
        // MASSIVE subsonic reverberation — unmissable visual shockwave
        return { bloom: impulse * 4.0, chromatic: impulse * 0.60, vignetteOpen: impulse * 0.80, halation: impulse * 0.50 };
      case "texture_change":
        return { bloom: impulse * 0.20, chromatic: 0, vignetteOpen: 0, halation: impulse * 0.15 };
      case "climax":
        return { bloom: impulse * 1.00, chromatic: impulse * 0.25, vignetteOpen: impulse * 0.50, halation: impulse * 0.20 };
      case "drop":
        return { bloom: impulse * -0.50, chromatic: impulse * 0.10, vignetteOpen: impulse * -0.30, halation: 0 };
      case "silence":
        return { bloom: impulse * -0.80, chromatic: 0, vignetteOpen: impulse * -0.60, halation: 0 };
      case "new_idea":
        return { bloom: impulse * 0.40, chromatic: impulse * 0.10, vignetteOpen: impulse * 0.20, halation: 0 };
      default:
        return { bloom: impulse * 0.60, chromatic: impulse * 0.15, vignetteOpen: impulse * -0.30, halation: 0 };
    }
  }, [impulse, evtType]);

  // Intro gating: shaders start hidden, fade in after first AI image arrives.
  // This creates a clean intro where the user sees imagery first, then the
  // shader blends in on top — never bare shaders without imagery.
  const [aiReady, setAiReady] = useState(false);
  const shaderOpacityRef = useRef(0);
  const shaderFadeRef = useRef<number>(0);
  const rootRef = useRef<HTMLDivElement>(null);

  const handleFirstImage = useCallback(() => {
    setAiReady(true);
  }, []);

  // Reset when AI is disabled (journey ends)
  useEffect(() => {
    if (!aiEnabled) {
      setAiReady(false);
      shaderOpacityRef.current = 0;
      if (rootRef.current) {
        rootRef.current.style.setProperty("--shader-opacity", "1");
      }
    }
  }, [aiEnabled]);

  // Animate shader fade-in after first AI image.
  // Sets --shader-opacity CSS variable so shader layers fade without
  // creating a stacking context that would trap the bottom bar.
  useEffect(() => {
    if (!aiReady || !showAi) return;
    cancelAnimationFrame(shaderFadeRef.current);

    const target = effectiveShaderOpacity;
    const fadeIn = () => {
      // Fade in over ~3s, capped at the journey's shaderOpacity
      shaderOpacityRef.current = Math.min(target, shaderOpacityRef.current + 0.006);
      if (rootRef.current) {
        rootRef.current.style.setProperty("--shader-opacity", String(shaderOpacityRef.current));
      }
      if (shaderOpacityRef.current < target) {
        shaderFadeRef.current = requestAnimationFrame(fadeIn);
      }
    };
    shaderFadeRef.current = requestAnimationFrame(fadeIn);

    return () => cancelAnimationFrame(shaderFadeRef.current);
  }, [aiReady, showAi, effectiveShaderOpacity]);

  // Pre-activation + bass hit shader boost.
  // Approach ramp: shaders get brighter ~1.5s before the hit.
  // On hit: spike to max then settle back fast.
  useEffect(() => {
    if (!rootRef.current) return;
    if (approach > 0 && impulse <= 0) {
      // Building up — ramp shader opacity toward 1.0
      const ramped = Math.min(1.0, shaderOpacityRef.current + approach * approach * 0.6);
      rootRef.current.style.setProperty("--shader-opacity", String(ramped));
      return;
    }
    if (impulse > 0 && evtType === "bass_hit") {
      // Hit! Spike to max so shaders flash with the white overlay
      rootRef.current.style.setProperty("--shader-opacity", "1");
      const timer = setTimeout(() => {
        if (rootRef.current) {
          rootRef.current.style.setProperty("--shader-opacity", String(shaderOpacityRef.current));
        }
      }, 150);
      return () => clearTimeout(timer);
    }
    // Neither approaching nor firing — restore normal
    if (approach <= 0 && impulse <= 0 && rootRef.current) {
      rootRef.current.style.setProperty("--shader-opacity", String(shaderOpacityRef.current));
    }
  }, [approach, impulse, evtType]);

  if (!showAi && !frame) {
    return <>{children}</>;
  }

  return (
    <div
      ref={rootRef}
      className="absolute inset-0"
      style={showAi ? { "--shader-opacity": "0" } as React.CSSProperties : undefined}
    >
      {/* AI imagery — z-2, above shader but below controls */}
      {showAi && (
        <AiImageLayer
          prompt={effectivePrompt}
          denoisingStrength={effectiveDenoising}
          targetFps={effectiveTargetFps}
          audioAmplitude={audioAmplitude}
          audioBass={audioBass}
          enabled={true}
          aiOnly={aiOnly}
          generating={aiGenerating}
          shaderOpacity={effectiveShaderOpacity}
          onFirstImage={handleFirstImage}
          promptSeed={promptSeed}
          journeyId={journeyId}
        />
      )}

      {/* Pre-activation glow — bloom buildup before bass hit */}
      {approach > 0.1 && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 3,
            pointerEvents: "none",
            background: `radial-gradient(ellipse at center, rgba(200,220,255,${approach * approach * 0.25}) 0%, transparent 60%)`,
            mixBlendMode: "screen",
          }}
        />
      )}

      {/* Bass hit full-screen flash — fast bright flash then settles quickly */}
      {impulse > 0 && evtType === "bass_hit" && (
        <>
          {/* Full-screen white flash — impulse⁴ decays FAST (bright→gone in <0.5s) */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              zIndex: 4,
              pointerEvents: "none",
              backgroundColor: `rgba(255, 255, 255, ${Math.min(1, impulse * impulse * impulse * impulse * 0.95)})`,
            }}
          />
          {/* Subsonic shockwave ring expanding outward beneath the flash */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              zIndex: 3,
              pointerEvents: "none",
              background: `radial-gradient(ellipse at center, transparent ${(1 - impulse) * 30}%, rgba(200,220,255,${impulse * impulse * 0.35}) ${(1 - impulse) * 50 + 20}%, transparent ${(1 - impulse) * 70 + 30}%)`,
              transform: `scale(${1 + (1 - impulse) * 0.5})`,
              mixBlendMode: "screen",
            }}
          />
        </>
      )}

      {/* Post-processing — adaptive scaling from feedback + light-phase reduction + typed event reactions */}
      {frame && (
        <PostProcessingLayer
          chromaticAberration={frame.chromaticAberration * adaptiveScale + eventReaction.chromatic}
          vignette={(isLightPhase ? frame.vignette * 0.3 : frame.vignette) * adaptiveScale * Math.max(0, 1 - eventReaction.vignetteOpen)}
          bloomIntensity={Math.min(1.5, (isLightPhase ? frame.bloomIntensity * 0.2 : frame.bloomIntensity) * adaptiveScale * adaptiveBloom + eventReaction.bloom * 0.3 + approach * approach * 0.4)}
          audioAmplitude={audioAmplitude}
          filmGrain={0}
          particleDensity={(isLightPhase ? frame.particleDensity * 0.3 : frame.particleDensity) * adaptiveScale}
          halation={Math.min(0.8, (isLightPhase ? 0 : frame.halation) * adaptiveScale + eventReaction.halation)}
          palette={frame.palette}
        />
      )}

      {/* Children rendered directly — no opacity wrapper.
          Shader layers in VisualizerCore read var(--shader-opacity, 1).
          Bottom bar (z-10) stays at full opacity in the normal stacking context. */}
      {children}
    </div>
  );
}
