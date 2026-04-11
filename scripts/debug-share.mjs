import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const token = "da1ff9bac6594c30";

// 1. Get the journey row
const { data: row, error } = await supabase
  .from("journeys")
  .select("*")
  .eq("share_token", token)
  .single();

if (error) { console.error("Journey lookup failed:", error); process.exit(1); }

console.log("Journey row:");
console.log("  name:", row.name);
console.log("  recording_id:", row.recording_id);
console.log("  theme:", JSON.stringify(row.theme));
console.log("  enableBassFlash from theme:", row.theme?.enableBassFlash);
console.log();

if (!row.recording_id) {
  console.log("NO RECORDING ID — bass flash impossible without audio events");
  process.exit(0);
}

// 2. Check analysis events
const { data: analysis, error: aErr } = await supabase
  .from("analyses")
  .select("events")
  .eq("recording_id", row.recording_id)
  .single();

console.log("Analysis:", aErr ? `ERROR: ${aErr.message}` : `${(analysis?.events ?? []).length} events`);
if (analysis?.events) {
  const bassHits = analysis.events.filter(e => e.type === "bass_hit");
  console.log("  bass_hit events:", bassHits.length);
}

// 3. Check cue markers
const { data: markers, error: mErr } = await supabase
  .from("markers")
  .select("time, label")
  .eq("recording_id", row.recording_id)
  .eq("type", "cue")
  .order("time");

console.log("Cue markers:", mErr ? `ERROR: ${mErr.message}` : `${(markers ?? []).length} markers`);
if (markers?.length > 0) {
  console.log("  first 3:", markers.slice(0, 3));
}

// 4. Check recording duration
const { data: rec, error: rErr } = await supabase
  .from("recordings")
  .select("id, title, duration, artist")
  .eq("id", row.recording_id)
  .single();

console.log("Recording:", rErr ? `ERROR: ${rErr.message}` : `"${rec.title}" duration=${rec.duration}s artist=${rec.artist}`);
