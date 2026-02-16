"use client";

import { createClient } from "@/lib/supabase/client";

export async function autoAnalyzeRecording(recordingId: string, audioUrl: string) {
  try {
    const { transcribeAudio } = await import("./transcribe");
    const { analyzeNotes } = await import("./analyze");

    const notes = await transcribeAudio(audioUrl);
    const result = analyzeNotes(notes);

    const supabase = createClient();
    await supabase.from("analyses").upsert(
      {
        recording_id: recordingId,
        status: result.status,
        key_signature: result.key_signature,
        tempo: result.tempo,
        time_signature: result.time_signature,
        chords: result.chords,
        notes: result.notes,
        midi_data: result.midi_data,
      },
      { onConflict: "recording_id" }
    );

    return result;
  } catch (error) {
    console.error(`Auto-analysis failed for ${recordingId}:`, error);
    return null;
  }
}
