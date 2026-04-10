import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Temporary route — nudge Ghost cue markers. Delete after use.
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated — log in first" }, { status: 401 });
  }

  // Read current values first
  const { data: current } = await supabase
    .from("markers")
    .select("id, time, label")
    .eq("recording_id", "549fc519-f7fc-4c38-a771-adaad2edbc81")
    .eq("type", "cue")
    .order("time");

  if (!current || current.length < 2) {
    return NextResponse.json({ error: "Could not find markers", current });
  }

  const marker1 = current.find((m) => m.id === "c125ddba-bc15-4424-bb8c-8e0fd2e5eaa1");
  const marker2 = current.find((m) => m.id === "090d864e-dd91-4455-8e35-3ccffb75d590");

  if (!marker1 || !marker2) {
    return NextResponse.json({ error: "Marker IDs not found", current });
  }

  const newTime1 = marker1.time + 0.03;
  const newTime2 = marker2.time + 0.04;

  const updates = [
    { id: marker1.id, time: newTime1, label: `bass hit 1: ${marker1.time} → ${newTime1}` },
    { id: marker2.id, time: newTime2, label: `bass hit 2: ${marker2.time} → ${newTime2}` },
  ];

  const results = [];
  for (const { id, time, label } of updates) {
    const { error } = await supabase.from("markers").update({ time }).eq("id", id);
    results.push({ label, error: error?.message ?? "OK" });
  }

  // Verify
  const { data: verified } = await supabase
    .from("markers")
    .select("id, time, label")
    .eq("recording_id", "549fc519-f7fc-4c38-a771-adaad2edbc81")
    .eq("type", "cue")
    .order("time");

  return NextResponse.json({ results, verified });
}
