import { createClient } from "@/lib/supabase/server";

/**
 * Public read of built_in_enrichments — any authenticated user gets the
 * per-journey phase sequences so built-in journeys play with the same
 * rich multi-layer imagery Ghost has. Written exclusively by the admin
 * bulk-backfill endpoint.
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { data, error } = await supabase
    .from("built_in_enrichments")
    .select("journey_id, phases, updated_at");
  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
  return Response.json({ enrichments: data ?? [] });
}
