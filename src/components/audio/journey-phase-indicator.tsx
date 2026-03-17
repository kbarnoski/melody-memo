"use client";

import { useState, useEffect, useRef } from "react";
import type { JourneyPhaseId, Journey } from "@/lib/journeys/types";

interface JourneyPhaseIndicatorProps {
  journey: Journey;
  currentPhase: JourneyPhaseId | null;
  guidancePhrase?: string | null;
  guidancePhaseId?: string | null;
}

const PHASE_LABELS: Record<JourneyPhaseId, string> = {
  threshold: "Threshold",
  expansion: "Expansion",
  transcendence: "Transcendence",
  illumination: "Illumination",
  return: "Return",
  integration: "Integration",
};

/**
 * Centered guidance phrase overlay during journeys.
 * On phase transition: fades in a guidance phrase, holds 5s, fades out over 2s.
 * Phase name shown as small monospace label above the phrase.
 */
export function JourneyPhaseIndicator({
  journey,
  currentPhase,
  guidancePhrase,
  guidancePhaseId,
}: JourneyPhaseIndicatorProps) {
  const [visible, setVisible] = useState(false);
  const [displayPhrase, setDisplayPhrase] = useState<string | null>(null);
  const [displayPhaseId, setDisplayPhaseId] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fontLoadedRef = useRef(false);

  // Load Cormorant Garamond via Google Fonts
  useEffect(() => {
    if (fontLoadedRef.current) return;
    fontLoadedRef.current = true;
    const id = "journey-guidance-font";
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400&display=swap";
    document.head.appendChild(link);
  }, []);

  // Show guidance phrase on change
  useEffect(() => {
    if (!guidancePhrase || !guidancePhaseId) return;

    setDisplayPhrase(guidancePhrase);
    setDisplayPhaseId(guidancePhaseId);
    setVisible(true);

    // Clear any existing timer
    if (timerRef.current) clearTimeout(timerRef.current);

    // Hide after 5s (CSS handles the 2s fade-out)
    timerRef.current = setTimeout(() => {
      setVisible(false);
    }, 5000);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [guidancePhrase, guidancePhaseId]);

  // Get the realm's accent color from current phase palette
  const currentPhaseData = currentPhase
    ? journey.phases.find((p) => p.id === currentPhase)
    : journey.phases[0];
  const accent = currentPhaseData?.palette.accent ?? "#fff";

  return (
    <div
      className="absolute inset-0 z-30 pointer-events-none flex items-center justify-center"
    >
      <div
        className="flex flex-col items-center gap-3 max-w-[80vw] text-center"
        style={{
          opacity: visible ? 1 : 0,
          transition: visible
            ? "opacity 1.5s cubic-bezier(0.23, 1, 0.32, 1)"
            : "opacity 2s cubic-bezier(0.23, 1, 0.32, 1)",
        }}
      >
        {/* Phase label */}
        {displayPhaseId && (
          <span
            style={{
              fontSize: "0.6rem",
              fontFamily: "var(--font-geist-mono)",
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: "rgba(255, 255, 255, 0.35)",
            }}
          >
            {PHASE_LABELS[displayPhaseId as JourneyPhaseId] ?? displayPhaseId}
          </span>
        )}

        {/* Guidance phrase */}
        {displayPhrase && (
          <p
            style={{
              fontFamily: "'Cormorant Garamond', Georgia, serif",
              fontWeight: 300,
              fontSize: "clamp(1.8rem, 4vw, 3.2rem)",
              lineHeight: 1.2,
              letterSpacing: "-0.01em",
              color: "rgba(255, 255, 255, 0.8)",
              textShadow: `0 0 40px ${accent}40, 0 0 80px ${accent}20`,
            }}
          >
            {displayPhrase}
          </p>
        )}
      </div>
    </div>
  );
}
