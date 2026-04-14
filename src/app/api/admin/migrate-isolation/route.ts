/**
 * One-shot admin route to rebuild the Isolation journey on a different
 * library track and delete the old journey + the 08_Isolation recording.
 *
 * Karel hits this once while logged in (POST). Strategy: clone the journey
 * row with a new recording_id (rather than re-running the AI builder)
 * because the user explicitly said "I generally like what you did with the
 * current one" — so we want the same theme/phases/story_text, just a
 * different audio track.
 *
 * Steps:
 *   1. Authenticate; gate on admin email.
 *   2. Find this user's existing Isolation journey.
 *   3. Find this user's two Isolation recordings — the "08_" one (delete)
 *      and the other one (use).
 *   4. Clone the journey row with recording_id = otherRecording.id.
 *   5. Delete the old journey row.
 *   6. Delete the 08_ recording row + its storage file.
 *
 * After running, this route can be deleted. The whole file is one-shot.
 */

import { createClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Gate on admin email — this route does destructive operations
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail || user.email !== adminEmail) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  // 1. Find this user's existing Isolation journey (most recent)
  const { data: journeys, error: jErr } = await supabase
    .from("journeys")
    .select("*")
    .eq("user_id", user.id)
    .ilike("name", "%isolation%")
    .order("created_at", { ascending: false });

  if (jErr) return Response.json({ error: `Journey lookup: ${jErr.message}` }, { status: 500 });
  if (!journeys || journeys.length === 0) {
    return Response.json({ error: "No Isolation journey found" }, { status: 404 });
  }
  const oldJourney = journeys[0];

  // 2. Find this user's Isolation recordings — split into "08_" and other
  const { data: recordings, error: rErr } = await supabase
    .from("recordings")
    .select("id, title, file_name")
    .eq("user_id", user.id)
    .ilike("title", "%isolation%");

  if (rErr) return Response.json({ error: `Recordings lookup: ${rErr.message}` }, { status: 500 });
  if (!recordings || recordings.length < 2) {
    return Response.json({
      error: `Expected at least 2 Isolation recordings, found ${recordings?.length ?? 0}`,
      recordings,
    }, { status: 404 });
  }

  const eightIsolation = recordings.find((r) => /(^|[^0-9])08[_\s-]?isolation/i.test(r.title));
  const otherIsolation = recordings.find((r) => r.id !== eightIsolation?.id);

  if (!eightIsolation) {
    return Response.json({
      error: "Could not identify 08_Isolation recording",
      candidates: recordings.map((r) => r.title),
    }, { status: 404 });
  }
  if (!otherIsolation) {
    return Response.json({
      error: "Could not identify the other Isolation recording",
      candidates: recordings.map((r) => r.title),
    }, { status: 404 });
  }

  // 3. Clone the journey row with recording_id = otherRecording.id
  // Strip db-managed fields before insert.
  const cloneRow: Record<string, unknown> = { ...oldJourney };
  delete cloneRow.id;
  delete cloneRow.created_at;
  delete cloneRow.share_token;
  cloneRow.recording_id = otherIsolation.id;
  cloneRow.user_id = user.id; // belt-and-suspenders

  const { data: newJourney, error: cloneErr } = await supabase
    .from("journeys")
    .insert(cloneRow)
    .select()
    .single();

  if (cloneErr || !newJourney) {
    return Response.json({ error: `Clone failed: ${cloneErr?.message}` }, { status: 500 });
  }

  // 4. Delete the old journey row
  const { error: delJourneyErr } = await supabase
    .from("journeys")
    .delete()
    .eq("id", oldJourney.id)
    .eq("user_id", user.id);
  if (delJourneyErr) {
    return Response.json({
      error: `Old journey delete failed: ${delJourneyErr.message}`,
      newJourney,
    }, { status: 500 });
  }

  // 5. Delete the 08_Isolation recording's storage file first
  const { error: storageErr } = await supabase.storage
    .from("recordings")
    .remove([eightIsolation.file_name]);
  // Storage error is non-fatal — DB row is the source of truth for the app.
  // We log it but continue with the DB delete.

  // 6. Delete the 08_Isolation recording row
  const { error: delRecErr } = await supabase
    .from("recordings")
    .delete()
    .eq("id", eightIsolation.id)
    .eq("user_id", user.id);
  if (delRecErr) {
    return Response.json({
      error: `Recording delete failed: ${delRecErr.message}`,
      newJourney,
      storageError: storageErr?.message ?? null,
    }, { status: 500 });
  }

  return Response.json({
    success: true,
    actions: {
      cloned: { from: oldJourney.id, to: newJourney.id, withRecording: otherIsolation.id },
      deletedJourney: oldJourney.id,
      deletedRecording: eightIsolation.id,
      deletedFile: eightIsolation.file_name,
      storageError: storageErr?.message ?? null,
    },
    newJourney: {
      id: newJourney.id,
      name: newJourney.name,
      recording_id: newJourney.recording_id,
    },
    keptRecording: { id: otherIsolation.id, title: otherIsolation.title },
  });
}
