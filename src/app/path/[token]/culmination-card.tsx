"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Lock } from "lucide-react";
import { usePathProgressStore } from "@/lib/journeys/path-progress-store";

interface CulminationCardProps {
  journeyIds: string[];
  culmination: {
    name: string;
    subtitle: string | null;
    description: string | null;
    share_token: string | null;
  };
  /** Path's own share token — so the culmination journey link can
   *  carry pathToken and expose the Close/Back-to-path nav. */
  pathShareToken: string;
  accent: string;
  glow: string;
}

export function CulminationCard({ journeyIds, culmination, pathShareToken, accent, glow }: CulminationCardProps) {
  // Hydration guard — the store reads from localStorage on client only. Render
  // the locked state on the server + first client render, then reconcile.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const completedIds = usePathProgressStore((s) => s.completedJourneyIds);

  const completedCount = mounted
    ? journeyIds.filter((id) => completedIds.includes(id)).length
    : 0;
  const total = journeyIds.length;
  const unlocked = mounted && completedCount === total;

  return (
    <div className="mt-10">
      <div className="flex items-center gap-4 mb-5">
        <div className="flex-1 h-px" style={{ backgroundColor: "rgba(255,255,255,0.08)" }} />
        <span
          style={{
            fontSize: "0.62rem",
            fontFamily: "var(--font-geist-mono)",
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: accent,
          }}
        >
          Culmination
        </span>
        <div className="flex-1 h-px" style={{ backgroundColor: "rgba(255,255,255,0.08)" }} />
      </div>

      {unlocked && culmination.share_token ? (
        <Link
          href={`/journey/${culmination.share_token}?pathToken=${pathShareToken}`}
          className="group block rounded-xl px-5 py-5 transition-all hover:bg-white/[0.05]"
          style={{
            border: `1px solid ${accent}40`,
            backgroundColor: "rgba(255,255,255,0.02)",
            boxShadow: `0 0 32px ${glow}12`,
          }}
        >
          <div
            style={{
              fontFamily: "'Cormorant Garamond', Georgia, serif",
              fontStyle: "italic",
              fontSize: "1.5rem",
              lineHeight: 1.25,
              background: `linear-gradient(180deg, #fff 0%, ${glow} 100%)`,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            {culmination.name}
          </div>
          {culmination.subtitle && (
            <div
              className="mt-1"
              style={{
                fontFamily: "var(--font-geist-mono)",
                fontSize: "0.7rem",
                color: "rgba(255,255,255,0.45)",
                letterSpacing: "0.04em",
              }}
            >
              {culmination.subtitle}
            </div>
          )}
          {culmination.description && (
            <p
              className="mt-2"
              style={{
                fontFamily: "var(--font-geist-sans)",
                fontSize: "0.82rem",
                color: "rgba(255,255,255,0.6)",
                lineHeight: 1.6,
              }}
            >
              {culmination.description}
            </p>
          )}
          <div
            className="mt-3 transition-opacity opacity-60 group-hover:opacity-100"
            style={{
              fontFamily: "var(--font-geist-mono)",
              fontSize: "0.62rem",
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: accent,
            }}
          >
            Play →  (a random track from the album)
          </div>
        </Link>
      ) : (
        // Locked teaser — shows the title (so the user sees what's coming) but
        // blurs/dims the details and displays the X of N progress.
        <div
          className="block rounded-xl px-5 py-5 relative overflow-hidden"
          style={{
            border: `1px solid rgba(255,255,255,0.08)`,
            backgroundColor: "rgba(255,255,255,0.01)",
          }}
        >
          <div className="flex items-center gap-3 mb-3">
            <Lock className="h-3.5 w-3.5 text-white/35" />
            <span
              style={{
                fontSize: "0.62rem",
                fontFamily: "var(--font-geist-mono)",
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: "rgba(255,255,255,0.4)",
              }}
            >
              Locked
            </span>
          </div>
          <div
            style={{
              fontFamily: "'Cormorant Garamond', Georgia, serif",
              fontStyle: "italic",
              fontSize: "1.5rem",
              lineHeight: 1.25,
              color: "rgba(255,255,255,0.55)",
              filter: "blur(0.4px)",
            }}
          >
            {culmination.name}
          </div>
          {culmination.subtitle && (
            <div
              className="mt-1"
              style={{
                fontFamily: "var(--font-geist-mono)",
                fontSize: "0.7rem",
                color: "rgba(255,255,255,0.3)",
                letterSpacing: "0.04em",
              }}
            >
              {culmination.subtitle}
            </div>
          )}

          {/* Progress row — stepper dots + "X of 13" */}
          <div className="mt-5">
            <div
              style={{
                fontSize: "0.68rem",
                fontFamily: "var(--font-geist-mono)",
                color: "rgba(255,255,255,0.55)",
                letterSpacing: "0.04em",
                marginBottom: "10px",
              }}
            >
              {completedCount} of {total} journeys complete — finish the album to unlock
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {journeyIds.map((id, i) => {
                const done = completedIds.includes(id);
                return (
                  <div
                    key={id}
                    title={`Step ${i + 1}`}
                    style={{
                      width: "10px",
                      height: "10px",
                      borderRadius: "50%",
                      backgroundColor: done ? accent : "rgba(255,255,255,0.1)",
                      boxShadow: done ? `0 0 6px ${glow}55` : "none",
                      transition: "all 0.3s ease",
                    }}
                  />
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
