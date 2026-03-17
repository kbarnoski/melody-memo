"use client";

import { useState, useEffect, useMemo } from "react";
import { X, Shuffle, RotateCcw, Sparkles, Play } from "lucide-react";
import { REALMS } from "@/lib/journeys/realms";
import { JOURNEYS } from "@/lib/journeys/journeys";
import { PHASE_ORDER } from "@/lib/journeys/phase-interpolation";
import { getAiImageService } from "@/lib/journeys/ai-image-service";
import { useAudioStore } from "@/lib/audio/audio-store";
import { createClient } from "@/lib/supabase/client";
import type { Journey } from "@/lib/journeys/types";

const FEATURED_JOURNEY_ID = "first-snow";

// Journeys paired with specific tracks — always load from the beginning
const PAIRED_TRACKS: Record<string, string> = {
  "first-snow": "%snowflake%",
  "17th-st-descent": "%17th St 64%",
  "without-a-brightness": "%without%brightness%",
};

// Storage file search patterns — fallback when track isn't in recordings table
const PAIRED_STORAGE: Record<string, string> = {
  "17th-st-descent": "17th St 64",
  "without-a-brightness": "Without",
};

interface JourneySelectorProps {
  open: boolean;
  onClose: () => void;
}

export function JourneySelector({ open, onClose }: JourneySelectorProps) {
  const startJourney = useAudioStore((s) => s.startJourney);
  const stopJourney = useAudioStore((s) => s.stopJourney);
  const activeJourney = useAudioStore((s) => s.activeJourney);
  const play = useAudioStore((s) => s.play);
  const setAiImageEnabled = useAudioStore((s) => s.setAiImageEnabled);

  const [aiAvailable, setAiAvailable] = useState(false);

  // Check AI availability on open
  useEffect(() => {
    if (open) {
      getAiImageService()
        .checkAvailability()
        .then(setAiAvailable);
    }
  }, [open]);

  // Build flat journey list: featured first, then grouped by realm
  const { featured, groupedByRealm } = useMemo(() => {
    const feat = JOURNEYS.find((j) => j.id === FEATURED_JOURNEY_ID) ?? null;
    const rest = JOURNEYS.filter((j) => j.id !== FEATURED_JOURNEY_ID);

    // Group remaining by realm, preserving realm order
    const groups: { realm: typeof REALMS[number]; journeys: Journey[] }[] = [];
    for (const realm of REALMS) {
      const rj = rest.filter((j) => j.realmId === realm.id);
      if (rj.length > 0) {
        groups.push({ realm, journeys: rj });
      }
    }

    return { featured: feat, groupedByRealm: groups };
  }, []);

  if (!open) return null;

  const selectJourney = async (journey: Journey, withAi: boolean) => {
    setAiImageEnabled(withAi);

    const pairedSearch = PAIRED_TRACKS[journey.id];
    const currentTrack = useAudioStore.getState().currentTrack;

    // If this journey has a paired track, always load it from the beginning
    // (even if another track is currently playing)
    if (pairedSearch) {
      let trackLoaded = false;
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from("recordings")
          .select("id, title, audio_url")
          .ilike("title", pairedSearch)
          .limit(1);

        if (!error && data?.[0]) {
          const row = data[0];
          console.log("[journey] loading paired track:", row.title);
          play({ id: row.id, title: row.title, audioUrl: row.audio_url }, 0);
          trackLoaded = true;
          await new Promise((r) => setTimeout(r, 300));
        } else {
          // Fallback: track not in recordings table — try storage directly
          const storageSearch = PAIRED_STORAGE[journey.id];
          if (storageSearch) {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
              const { data: files } = await supabase.storage
                .from("recordings")
                .list(user.id, { search: storageSearch, limit: 1 });
              if (files?.[0]) {
                const filePath = `${user.id}/${files[0].name}`;
                const { data: signedData } = await supabase.storage
                  .from("recordings")
                  .createSignedUrl(filePath, 3600);
                if (signedData?.signedUrl) {
                  const title = files[0].name
                    .replace(/^\d+-/, "")
                    .replace(/\.[^.]+$/, "");
                  console.log("[journey] loading paired track from storage:", title);
                  play(
                    { id: `storage-${files[0].name}`, title, audioUrl: signedData.signedUrl },
                    0
                  );
                  trackLoaded = true;
                  await new Promise((r) => setTimeout(r, 300));
                }
              }
            }
          }
        }

        // If paired track not found anywhere, fall back to most recent recording
        if (!trackLoaded && !currentTrack) {
          const { data: fallback } = await supabase
            .from("recordings")
            .select("id, title, audio_url")
            .order("created_at", { ascending: false })
            .limit(1);
          if (fallback?.[0]) {
            const row = fallback[0];
            console.log("[journey] paired track not found, falling back to:", row.title);
            play({ id: row.id, title: row.title, audioUrl: row.audio_url });
            await new Promise((r) => setTimeout(r, 200));
          }
        }
      } catch (err) {
        console.warn("[journey] failed to load paired track:", err);
      }
    } else if (!currentTrack) {
      // No paired track and nothing playing — fall back to most recent recording
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from("recordings")
          .select("id, title, audio_url")
          .order("created_at", { ascending: false })
          .limit(1);

        if (!error && data?.[0]) {
          const row = data[0];
          console.log("[journey] auto-playing track:", row.title);
          play({ id: row.id, title: row.title, audioUrl: row.audio_url });
          await new Promise((r) => setTimeout(r, 200));
        } else {
          console.warn("[journey] no recordings found, starting journey without audio");
        }
      } catch (err) {
        console.warn("[journey] failed to load default track:", err);
      }
    }

    startJourney(journey.id);
    onClose();
  };

  const handleJourneyClick = (journey: Journey) => {
    // Auto-enable AI if available, no confirmation needed
    selectJourney(journey, journey.aiEnabled && aiAvailable);
  };

  const selectRandom = () => {
    const random = JOURNEYS[Math.floor(Math.random() * JOURNEYS.length)];
    selectJourney(random, random.aiEnabled && aiAvailable);
  };

  const clearJourney = () => {
    stopJourney();
  };

  const renderJourneyCard = (journey: Journey, realmAccent: string) => {
    const isActive = activeJourney?.id === journey.id;
    return (
      <div
        key={journey.id}
        className={`w-full text-left p-5 rounded-2xl transition-all duration-200 group cursor-pointer ${
          isActive ? "ring-1 ring-white/20" : "hover:bg-white/5"
        }`}
        style={{
          backgroundColor: isActive
            ? "rgba(255,255,255,0.08)"
            : "rgba(255,255,255,0.02)",
          border: "1px solid rgba(255,255,255,0.06)",
        }}
        onClick={() => handleJourneyClick(journey)}
      >
        <div className="flex items-start justify-between mb-2">
          <div>
            <h3
              className="text-white/90 text-lg leading-tight"
              style={{
                fontFamily: "var(--font-geist-sans)",
                fontWeight: 300,
              }}
            >
              {journey.name}
            </h3>
            <p
              className="text-white/30 mt-0.5"
              style={{
                fontSize: "0.75rem",
                fontFamily: "var(--font-geist-mono)",
              }}
            >
              {journey.subtitle}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {journey.id === FEATURED_JOURNEY_ID && (
              <div
                className="flex items-center gap-1 px-2 py-0.5 rounded-full"
                style={{
                  fontSize: "0.6rem",
                  fontFamily: "var(--font-geist-mono)",
                  backgroundColor: "rgba(144, 184, 224, 0.1)",
                  border: "1px solid rgba(144, 184, 224, 0.2)",
                  color: "rgba(144, 184, 224, 0.7)",
                }}
              >
                Featured
              </div>
            )}
            {journey.aiEnabled && aiAvailable && (
              <div
                className="flex items-center gap-1 px-2 py-0.5 rounded-full"
                style={{
                  fontSize: "0.6rem",
                  fontFamily: "var(--font-geist-mono)",
                  backgroundColor: "rgba(255, 255, 255, 0.05)",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  color: "rgba(255, 255, 255, 0.4)",
                }}
              >
                <Sparkles className="h-2.5 w-2.5" />
                AI
              </div>
            )}
          </div>
        </div>

        <p
          className="text-white/20 mb-3"
          style={{
            fontSize: "0.7rem",
            fontFamily: "var(--font-geist-mono)",
          }}
        >
          {journey.description}
        </p>

        {/* Phase arc + Start button */}
        <div className="flex items-center gap-3">
          <div className="flex gap-[2px] flex-1">
            {PHASE_ORDER.map((phaseId) => {
              const phase = journey.phases.find(
                (p) => p.id === phaseId
              );
              if (!phase) return null;
              const width = (phase.end - phase.start) * 100;
              return (
                <div
                  key={phaseId}
                  className="h-[3px] rounded-full"
                  style={{
                    width: `${width}%`,
                    backgroundColor: `${realmAccent}${
                      phaseId === "transcendence" ? "cc" : "40"
                    }`,
                  }}
                />
              );
            })}
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleJourneyClick(journey);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-all shrink-0"
            style={{
              fontSize: "0.7rem",
              fontFamily: "var(--font-geist-mono)",
              border: `1px solid ${realmAccent}30`,
              backgroundColor: `${realmAccent}08`,
            }}
          >
            <Play className="h-3 w-3" style={{ fill: "currentColor" }} />
            {isActive ? "Restart" : "Start"}
          </button>
        </div>
      </div>
    );
  };

  const winterRealm = REALMS.find((r) => r.id === "winter");
  const featuredAccent = winterRealm?.palette.accent ?? "#90b8e0";

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 transition-opacity duration-300"
        style={{
          backdropFilter: "blur(32px) saturate(1.2)",
          WebkitBackdropFilter: "blur(32px) saturate(1.2)",
          backgroundColor: "rgba(0, 0, 0, 0.7)",
        }}
        onClick={onClose}
      />

      {/* Content */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-8 pointer-events-none">
        <div
          className="pointer-events-auto w-full max-w-4xl max-h-[80vh] overflow-hidden flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2
                className="text-white/90 text-2xl tracking-tight"
                style={{ fontFamily: "var(--font-geist-sans)", fontWeight: 200 }}
              >
                Journeys
              </h2>
              <p
                className="text-white/30 mt-1"
                style={{ fontSize: "0.75rem", fontFamily: "var(--font-geist-mono)" }}
              >
                Immersive audio-visual experiences
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-white/30 hover:text-white/60 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Scrollable content — flat list */}
          <div className="flex-1 overflow-y-auto scrollbar-thin">
            {/* Featured journey pinned at top */}
            {featured && (
              <div className="mb-6">
                {renderJourneyCard(featured, featuredAccent)}
              </div>
            )}

            {/* Remaining journeys grouped by realm */}
            {groupedByRealm.map(({ realm, journeys }) => (
              <div key={realm.id} className="mb-6">
                {/* Realm section header */}
                <div className="flex items-center gap-2 mb-3">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{
                      backgroundColor: realm.palette.accent,
                      boxShadow: `0 0 8px ${realm.palette.glow}40`,
                    }}
                  />
                  <span
                    className="text-white/40"
                    style={{
                      fontSize: "0.7rem",
                      fontFamily: "var(--font-geist-mono)",
                      letterSpacing: "0.05em",
                      textTransform: "uppercase",
                    }}
                  >
                    {realm.name}
                  </span>
                </div>

                <div className="space-y-3">
                  {journeys.map((journey) =>
                    renderJourneyCard(journey, realm.palette.accent)
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Bottom actions */}
          <div className="flex items-center gap-3 pt-4 border-t border-white/5">
            <button
              onClick={selectRandom}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-white/40 hover:text-white/70 hover:bg-white/5 transition-all"
              style={{
                fontSize: "0.75rem",
                fontFamily: "var(--font-geist-mono)",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <Shuffle className="h-3.5 w-3.5" />
              Random Journey
            </button>
            {activeJourney && (
              <button
                onClick={clearJourney}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-white/40 hover:text-white/70 hover:bg-white/5 transition-all"
                style={{
                  fontSize: "0.75rem",
                  fontFamily: "var(--font-geist-mono)",
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Stop Journey
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
