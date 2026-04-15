import { createClient } from "@/lib/supabase/server";
import { createClient as createAnonClient } from "@supabase/supabase-js";
import { VisualizerClient } from "@/components/audio/visualizer-client";

export default async function VisualizerPage({
  searchParams,
}: {
  searchParams: Promise<{
    recording?: string;
    live?: string;
    journey?: string;
    autoplay?: string;
    customJourneyId?: string;
    pathToken?: string;
  }>;
}) {
  const params = await searchParams;
  const recordingId = params.recording;
  const liveMode = params.live === "true";
  const journey = params.journey;
  const autoplay = params.autoplay !== "0";

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const isAdmin = !!user && !!user.email && user.email.toLowerCase().trim() === (process.env.ADMIN_EMAIL ?? "").toLowerCase().trim();

  let recording: { id: string; title?: string; audio_url: string; artist?: string } | null = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let analysis: any | null = null;
  let cueMarkers: { time: number; label: string }[] = [];

  // Path + custom journey hydration. When a user clicks a track from
  // /path/[token], we land here with customJourneyId + pathToken query
  // params. Fetch both so VisualizerClient can start the journey with the
  // path context already attached (for a native Continue Path end overlay).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let initialCustomJourney: any = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let initialPath: any = null;
  if (params.customJourneyId && user) {
    const { data: jRow } = await supabase
      .from("journeys")
      .select("*")
      .eq("id", params.customJourneyId)
      .eq("user_id", user.id)
      .single();
    if (jRow) {
      initialCustomJourney = jRow;
      // Also pre-load the recording so audio is ready on mount
      if (jRow.recording_id) {
        const [recResult, analysisResult, cueResult] = await Promise.all([
          supabase.from("recordings").select("id, title, audio_url, artist").eq("id", jRow.recording_id).single(),
          supabase.from("analyses").select("*").eq("recording_id", jRow.recording_id).single(),
          supabase.from("markers").select("time, label").eq("recording_id", jRow.recording_id).eq("type", "cue").order("time"),
        ]);
        if (recResult.data) {
          recording = {
            id: recResult.data.id,
            title: recResult.data.title,
            audio_url: `/api/audio/${recResult.data.id}`,
            artist: recResult.data.artist ?? undefined,
          };
        }
        analysis = analysisResult.data;
        cueMarkers = (cueResult.data ?? []) as { time: number; label: string }[];
      }
    }
    if (params.pathToken) {
      // Use anon client so public share_token rows are readable even if RLS
      // on journey_paths is restrictive for non-owners.
      const anon = createAnonClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
      const { data: pRow } = await anon
        .from("journey_paths")
        .select("*")
        .eq("share_token", params.pathToken)
        .single();
      if (pRow) initialPath = pRow;
    }
  } else if (recordingId) {
    const [recResult, analysisResult, cueResult] = await Promise.all([
      supabase.from("recordings").select("id, title, audio_url, artist").eq("id", recordingId).single(),
      supabase.from("analyses").select("*").eq("recording_id", recordingId).single(),
      supabase.from("markers").select("time, label").eq("recording_id", recordingId).eq("type", "cue").order("time"),
    ]);

    if (recResult.data) {
      recording = {
        id: recResult.data.id,
        title: recResult.data.title,
        audio_url: `/api/audio/${recResult.data.id}`,
        artist: recResult.data.artist ?? undefined,
      };
    }
    analysis = analysisResult.data;
    cueMarkers = (cueResult.data ?? []) as { time: number; label: string }[];
  }

  return (
    <VisualizerClient
      recording={recording}
      analysis={analysis}
      initialLive={liveMode}
      initialJourney={journey}
      autoplay={autoplay}
      isAdmin={isAdmin}
      userId={user?.id}
      cueMarkers={cueMarkers}
      initialCustomJourney={initialCustomJourney}
      initialPath={initialPath}
    />
  );
}
