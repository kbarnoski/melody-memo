"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { AiImageLayer } from "./ai-image-layer";
import { PostProcessingLayer } from "./post-processing-layer";
import type { JourneyFrame } from "@/lib/journeys/types";

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
  children: React.ReactNode;
}

/**
 * Composites shader, AI imagery, and post-processing.
 *
 * Intro: AI imagery appears full-screen first, then shaders fade in on top.
 * Outro: When song ends, AI imagery stays visible as shaders fade naturally.
 *
 * Z-index stack (all layers share the same stacking context):
 *   Shader canvas: default (from children) — fades in after first AI image
 *   AI images: z-index 2, pointer-events none
 *   Post-processing: z-index 3, pointer-events none
 *   Control bar: z-index 10 (set inside VisualizerCore)
 *   Mode palette: z-index 30-40 (set inside VisualizerCore)
 *   Poetry: z-index 5, pointer-events none
 *
 * Controls stay interactive because they have higher z-index than AI/post layers.
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
  children,
}: JourneyCompositorProps) {
  const effectivePrompt = frame?.aiPrompt ?? aiPrompt ?? "";
  const effectiveDenoising = frame?.denoisingStrength ?? 0.5;
  const effectiveTargetFps = frame?.targetFps ?? 2;
  const effectiveShaderOpacity = frame?.shaderOpacity ?? 1.0;
  const showAi = aiEnabled && !!effectivePrompt;

  // Intro gating: shaders start hidden, fade in after first AI image arrives.
  // This creates a clean intro where the user sees imagery first, then the
  // shader blends in on top — never bare shaders without imagery.
  const [aiReady, setAiReady] = useState(false);
  const shaderOpacityRef = useRef(0);
  const shaderFadeRef = useRef<number>(0);
  const shaderDivRef = useRef<HTMLDivElement>(null);

  const handleFirstImage = useCallback(() => {
    setAiReady(true);
  }, []);

  // Reset when AI is disabled (journey ends)
  useEffect(() => {
    if (!aiEnabled) {
      setAiReady(false);
      shaderOpacityRef.current = 0;
    }
  }, [aiEnabled]);

  // Animate shader fade-in after first AI image.
  // Caps at effectiveShaderOpacity so shaders never fully cover AI imagery.
  useEffect(() => {
    if (!aiReady || !showAi) return;
    cancelAnimationFrame(shaderFadeRef.current);

    const target = effectiveShaderOpacity;
    const fadeIn = () => {
      // Fade in over ~3s, capped at the journey's shaderOpacity
      shaderOpacityRef.current = Math.min(target, shaderOpacityRef.current + 0.006);
      if (shaderDivRef.current) {
        shaderDivRef.current.style.opacity = String(shaderOpacityRef.current);
      }
      if (shaderOpacityRef.current < target) {
        shaderFadeRef.current = requestAnimationFrame(fadeIn);
      }
    };
    shaderFadeRef.current = requestAnimationFrame(fadeIn);

    return () => cancelAnimationFrame(shaderFadeRef.current);
  }, [aiReady, showAi, effectiveShaderOpacity]);

  if (!showAi && !frame) {
    return <>{children}</>;
  }

  return (
    <div className="absolute inset-0">
      {/* Shader + controls + poetry — fades in after first AI image for intro effect */}
      {showAi ? (
        <div
          ref={shaderDivRef}
          style={{ opacity: shaderOpacityRef.current }}
        >
          {children}
        </div>
      ) : (
        children
      )}

      {/* AI imagery — z-2, above shader but below controls (z-10+) */}
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
        />
      )}

      {/* Post-processing — z-3, above AI but below controls */}
      {frame && (
        <PostProcessingLayer
          chromaticAberration={frame.chromaticAberration}
          vignette={frame.vignette}
          bloomIntensity={frame.bloomIntensity}
          audioAmplitude={audioAmplitude}
          filmGrain={frame.filmGrain}
          particleDensity={frame.particleDensity}
          halation={frame.halation}
          palette={frame.palette}
        />
      )}
    </div>
  );
}
