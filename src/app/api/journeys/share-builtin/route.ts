import { createClient } from "@/lib/supabase/server";
import { randomUUID, randomInt } from "crypto";
import { getJourney } from "@/lib/journeys/journeys";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { journeyId } = await request.json();
    if (!journeyId) {
      return Response.json({ error: "Missing journeyId" }, { status: 400 });
    }

    // Look up built-in journey definition
    const journey = getJourney(journeyId);
    if (!journey) {
      return Response.json({ error: "Journey not found" }, { status: 404 });
    }

    const token = randomUUID().replace(/-/g, "").slice(0, 16);
    const seed = String(randomInt(0, 4294967296));

    // Insert a snapshot of the built-in journey into the journeys table
    const { error } = await supabase.from("journeys").insert({
      user_id: user.id,
      name: journey.name,
      subtitle: journey.subtitle,
      description: journey.description,
      realm_id: journey.realmId,
      phases: journey.phases,
      share_token: token,
      playback_seed: seed,
    });

    if (error) {
      console.error("Share built-in error:", error);
      return Response.json({ error: "Failed to share journey" }, { status: 500 });
    }

    return Response.json({ token });
  } catch (error) {
    console.error("Share built-in error:", error);
    return Response.json({ error: "Failed to share journey" }, { status: 500 });
  }
}
