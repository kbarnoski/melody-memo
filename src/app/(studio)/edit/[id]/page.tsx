import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Journey } from "@/lib/journeys/types";
import { EditJourneyClient } from "./edit-client";

export const dynamic = "force-dynamic";

export default async function EditJourneyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?redirectTo=/edit/${id}`);

  const { data: row, error } = await supabase
    .from("journeys")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error || !row) notFound();

  // Map DB row → Journey shape the form expects.
  const r = row as Record<string, unknown>;
  const initialJourney: Journey & { id: string } = {
    id: r.id as string,
    name: (r.name as string) ?? "Untitled",
    subtitle: (r.subtitle as string) ?? "",
    description: (r.description as string) ?? "",
    realmId: (r.realm_id as string) ?? "custom",
    aiEnabled: r.ai_enabled !== false,
    phases: (r.phases as Journey["phases"]) ?? [],
    storyText: (r.story_text as string) ?? null,
    recordingId: (r.recording_id as string) ?? null,
    userId: r.user_id as string,
    audioReactive: !!r.audio_reactive,
    creatorName: (r.creator_name as string) ?? null,
    photographyCredit: (r.photography_credit as string) ?? null,
    dedication: (r.dedication as string) ?? null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...(r.theme ? { theme: r.theme as any } : {}),
    ...(Array.isArray(r.local_image_urls) && (r.local_image_urls as unknown[]).length > 0
      ? { localImageUrls: r.local_image_urls as string[] }
      : {}),
  };

  return <EditJourneyClient initialJourney={initialJourney} />;
}
