"use client";

import { useEffect, useRef, useMemo } from "react";
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
  /** Opt-in: enable bass-hit white flash + pre-activation glow (Ghost only) */
  enableBassFlash?: boolean;
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
  enableBassFlash = false,
  children,
}: JourneyCompositorProps) {
  const effectivePrompt = frame?.aiPrompt ?? aiPrompt ?? "";
  const effectiveDenoising = frame?.denoisingStrength ?? 0.5;
  const effectiveTargetFps = frame?.targetFps ?? 2;
  const showAi = aiEnabled && !!effectivePrompt;

  // Detect light-background phases from prompt — scale down GPU-expensive effects
  // Binary detection (target), but we smooth the actual multiplier to prevent flash
  const isLightPhaseTarget = useMemo(
    () => /WHITE BACKGROUND|PALE BACKGROUND|LIGHT BACKGROUND/i.test(effectivePrompt),
    [effectivePrompt]
  );

  // Smooth light-phase multiplier: 1.0 = normal dark, 0.0 = full light-bg reduction.
  // Ref-only — no React state. The compositor already re-renders at ~30fps from frame
  // updates, so the ref value is sampled naturally without extra re-renders.
  const lightScaleRef = useRef(isLightPhaseTarget ? 0 : 1);
  const lightScaleRafRef = useRef<number>(0);

  useEffect(() => {
    const target = isLightPhaseTarget ? 0 : 1;
    if (Math.abs(lightScaleRef.current - target) < 0.01) {
      lightScaleRef.current = target;
      return;
    }
    cancelAnimationFrame(lightScaleRafRef.current);
    const rate = 0.008; // ~125 frames ≈ 2s at 60fps
    const animate = () => {
      const cur = lightScaleRef.current;
      const diff = target - cur;
      lightScaleRef.current = Math.abs(diff) < 0.01 ? target : cur + Math.sign(diff) * rate;
      if (lightScaleRef.current !== target) {
        lightScaleRafRef.current = requestAnimationFrame(animate);
      }
    };
    lightScaleRafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(lightScaleRafRef.current);
  }, [isLightPhaseTarget]);

  // Read ref value during render — sampled at ~30fps from journey frame updates
  const lightScale = lightScaleRef.current;

  const effectiveShaderOpacity = frame?.shaderOpacity ?? 1.0;
  const isMobile = useMemo(
    () => typeof navigator !== "undefined" && /iPhone|iPad|Android/i.test(navigator.userAgent),
    []
  );

  // Adaptive scaling — learned from user feedback patterns
  const adaptiveConditions = {
    hasDualShader: !!frame?.dualShaderMode,
    isLightBg: lightScale < 0.5,
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

  // Bass hit counter — alternates angel design between the two flash points
  const bassHitCountRef = useRef(0);
  const inBassHitRef = useRef(false);
  if (enableBassFlash && impulse > 0.5 && evtType === "bass_hit" && !inBassHitRef.current) {
    bassHitCountRef.current += 1;
    inBassHitRef.current = true;
  }
  if (impulse <= 0.1 || evtType !== "bass_hit") {
    inBassHitRef.current = false;
  }

  const eventReaction = useMemo(() => {
    if (impulse === 0 || !evtType) {
      return { bloom: 0, chromatic: 0, vignetteOpen: 0, halation: 0 };
    }
    switch (evtType) {
      case "bass_hit":
        // MASSIVE subsonic reverberation — only on journeys with enableBassFlash
        if (!enableBassFlash) return { bloom: 0, chromatic: 0, vignetteOpen: 0, halation: 0 };
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
  }, [impulse, evtType, enableBassFlash]);

  // ─── Shader opacity ───
  // Tracks effectiveShaderOpacity via CSS custom property.
  // On journey start (first frame after null), ramps from 1.0 to target over ~1.5s
  // to prevent a brightness flash from additive layers arriving asynchronously.
  const shaderOpacityRef = useRef(effectiveShaderOpacity);
  const rootRef = useRef<HTMLDivElement>(null);
  const introRampRafRef = useRef<number>(0);
  const wasDefaultOpacityRef = useRef(true); // true when no journey frame

  useEffect(() => {
    const prev = shaderOpacityRef.current;
    shaderOpacityRef.current = effectiveShaderOpacity;

    // Detect journey start: opacity drops from 1.0 (no frame) to journey value
    const isJourneyStart = wasDefaultOpacityRef.current && effectiveShaderOpacity < 1.0;
    wasDefaultOpacityRef.current = effectiveShaderOpacity >= 1.0;

    if (isJourneyStart && rootRef.current) {
      // Ramp from current (1.0) to target over ~1.5s using exponential ease
      cancelAnimationFrame(introRampRafRef.current);
      let current = prev;
      const ramp = () => {
        const target = shaderOpacityRef.current;
        current += (target - current) * 0.04;
        if (Math.abs(current - target) < 0.005) {
          current = target;
          introRampRafRef.current = 0;
        }
        rootRef.current?.style.setProperty("--shader-opacity", String(current));
        if (current !== target) {
          introRampRafRef.current = requestAnimationFrame(ramp);
        }
      };
      introRampRafRef.current = requestAnimationFrame(ramp);
      return () => {
        cancelAnimationFrame(introRampRafRef.current);
        introRampRafRef.current = 0;
      };
    }

    // Normal update — set directly (skip if intro ramp is active)
    if (!introRampRafRef.current && rootRef.current) {
      rootRef.current.style.setProperty("--shader-opacity", String(effectiveShaderOpacity));
    }
  }, [effectiveShaderOpacity]);

  // Pre-activation + bass hit shader boost (Ghost-only, gated by enableBassFlash).
  // Approach ramp: shaders get brighter ~1.5s before the hit.
  // On hit: spike to max then settle back fast.
  useEffect(() => {
    if (!rootRef.current || !enableBassFlash) return;
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
  }, [approach, impulse, evtType, enableBassFlash]);

  return (
    <div
      ref={rootRef}
      className="absolute inset-0"
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
          promptSeed={promptSeed}
          journeyId={journeyId}
        />
      )}

      {/* Pre-activation glow — bloom buildup before bass hit (Ghost only) */}
      {enableBassFlash && approach > 0.1 && (
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

      {/* Bass hit full-screen flash — Ghost only, gated by enableBassFlash */}
      {enableBassFlash && impulse > 0 && evtType === "bass_hit" && (
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
          {/* Dark particle angel — dissolve filter breaks shape into spiraling particles */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              zIndex: 5,
              pointerEvents: "none",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              opacity: Math.min(1, impulse * impulse * 0.92),
              filter: `blur(${(1 - impulse) * 1.5}px)`,
            }}
          >
            <svg
              viewBox="0 0 1000 1000"
              style={{ width: "72vmin", height: "92vmin", maxWidth: "100%", maxHeight: "100%" }}
            >
              <defs>
                <filter id="angel-particles-0" x="-5%" y="-5%" width="110%" height="110%">
                  <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="4" seed="42" result="noise" />
                  <feColorMatrix in="noise" type="luminanceToAlpha" result="noiseMask" />
                  <feComponentTransfer in="noiseMask" result="particles">
                    <feFuncA type="table" tableValues="0 0 0.3 0.85 1 1 0.6 0 0.9 1 0.5" />
                  </feComponentTransfer>
                  <feComposite in="SourceGraphic" in2="particles" operator="in" />
                </filter>
                <filter id="angel-particles-1" x="-5%" y="-5%" width="110%" height="110%">
                  <feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="5" seed="137" result="noise" />
                  <feColorMatrix in="noise" type="luminanceToAlpha" result="noiseMask" />
                  <feComponentTransfer in="noiseMask" result="particles">
                    <feFuncA type="table" tableValues="0 0.2 0 0.9 1 0.5 0 1 0.7 0.3 1" />
                  </feComponentTransfer>
                  <feComposite in="SourceGraphic" in2="particles" operator="in" />
                </filter>
              </defs>
              {bassHitCountRef.current % 2 === 1 ? (
                <g filter="url(#angel-particles-0)">
                  {/* Angel 1: upright, wings spread wide, hair spiraling right */}
                  <path d="M500,55 C535,53 558,78 558,110 C558,138 542,155 525,162 C545,188 570,228 588,265 C608,302 612,325 602,345 C590,368 560,380 535,388 C528,392 530,408 538,432 C548,462 555,498 552,530 C542,590 500,710 455,840 C442,878 450,905 480,905 L520,905 C550,905 558,878 545,840 C500,710 458,590 448,530 C445,498 452,462 462,432 C470,408 472,392 465,388 C440,380 410,368 398,345 C388,325 392,302 412,265 C430,228 455,188 475,162 C458,155 442,138 442,110 C442,78 465,53 500,55 Z" fill="rgba(5,0,12,0.95)" />
                  <path d="M405,260 C342,225 188,148 78,108 C28,90 8,112 28,148 C52,192 182,268 348,318 C392,332 410,312 408,288 Z" fill="rgba(5,0,12,0.95)" />
                  <path d="M595,260 C658,225 812,148 922,108 C972,90 992,112 972,148 C948,192 818,268 652,318 C608,332 590,312 592,288 Z" fill="rgba(5,0,12,0.95)" />
                  <path d="M515,62 C558,30 638,2 712,2 C772,0 798,25 780,55 C758,88 688,115 615,122" stroke="rgba(5,0,12,0.9)" strokeWidth="12" strokeLinecap="round" fill="none" />
                  <path d="M485,62 C442,30 362,2 288,2 C228,0 202,25 220,55 C242,88 312,115 385,122" stroke="rgba(5,0,12,0.85)" strokeWidth="10" strokeLinecap="round" fill="none" />
                  <path d="M522,68 C572,42 658,15 738,10 C808,6 838,28 822,58 C802,90 735,118 660,128" stroke="rgba(5,0,12,0.75)" strokeWidth="8" strokeLinecap="round" fill="none" />
                </g>
              ) : (
                <g filter="url(#angel-particles-1)">
                  {/* Angel 2: dynamic tilt, left wing higher, hair spiraling left */}
                  <path d="M480,65 C515,60 540,85 540,115 C540,142 525,158 508,165 C525,190 548,228 565,262 C582,295 585,318 578,338 C568,360 542,375 520,382 C512,386 515,402 522,425 C532,455 540,492 538,525 C530,585 492,700 452,828 C440,868 448,898 475,898 L525,898 C552,898 560,868 548,828 C508,700 470,585 462,525 C460,492 468,455 478,425 C485,402 488,386 480,382 C458,375 432,360 422,338 C415,318 418,295 435,262 C452,228 475,190 492,165 C475,158 460,142 460,115 C460,85 485,60 480,65 Z" fill="rgba(5,0,12,0.95)" />
                  <path d="M425,252 C358,215 192,132 75,88 C22,68 2,92 25,130 C52,175 192,258 365,312 C412,328 430,305 428,280 Z" fill="rgba(5,0,12,0.95)" />
                  <path d="M578,268 C638,238 798,168 912,135 C965,120 985,142 968,178 C945,220 815,288 645,332 C598,345 580,325 580,300 Z" fill="rgba(5,0,12,0.95)" />
                  <path d="M468,72 C422,38 338,8 262,5 C200,2 175,28 195,58 C218,92 292,118 368,128" stroke="rgba(5,0,12,0.9)" strokeWidth="12" strokeLinecap="round" fill="none" />
                  <path d="M502,68 C545,35 628,5 705,2 C765,0 792,25 775,55 C755,88 685,115 612,125" stroke="rgba(5,0,12,0.85)" strokeWidth="10" strokeLinecap="round" fill="none" />
                  <path d="M458,78 C405,48 318,18 240,12 C175,8 148,32 168,62 C190,95 262,122 340,132" stroke="rgba(5,0,12,0.75)" strokeWidth="8" strokeLinecap="round" fill="none" />
                </g>
              )}
            </svg>
          </div>
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

      {/* Post-processing — adaptive scaling from feedback + smooth light-phase reduction + typed event reactions */}
      {/* lightScale: 1.0 = dark bg (full effects), 0.0 = light bg (reduced).
          lerp(reducedValue, fullValue, lightScale) for each property. */}
      {frame && (
        <PostProcessingLayer
          chromaticAberration={frame.chromaticAberration * adaptiveScale + eventReaction.chromatic}
          vignette={(frame.vignette * (0.3 + 0.7 * lightScale)) * adaptiveScale * Math.max(0, 1 - eventReaction.vignetteOpen)}
          bloomIntensity={Math.min(1.5, (frame.bloomIntensity * (0.2 + 0.8 * lightScale)) * adaptiveScale * adaptiveBloom + eventReaction.bloom * 0.3 + approach * approach * 0.4)}
          audioAmplitude={audioAmplitude}
          filmGrain={0}
          particleDensity={(frame.particleDensity * (0.3 + 0.7 * lightScale)) * adaptiveScale}
          halation={Math.min(0.8, (frame.halation * lightScale) * adaptiveScale + eventReaction.halation)}
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
