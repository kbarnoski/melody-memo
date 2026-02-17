import { createClient } from "@/lib/supabase/server";
import { LibraryClient } from "@/components/recordings/library-client";

export default async function LibraryPage() {
  const supabase = await createClient();

  const { data: recordings } = await supabase
    .from("recordings")
    .select(
      "id, title, duration, created_at, recorded_at, file_name, description, analyses(id, key_signature, tempo), recording_tags(tag_id, tags(id, name))"
    )
    .order("created_at", { ascending: false });

  const { data: tags } = await supabase
    .from("tags")
    .select("id, name")
    .order("name", { ascending: true });

  const normalized = (recordings ?? []).map((rec) => ({
    id: rec.id,
    title: rec.title,
    duration: rec.duration,
    createdAt: rec.created_at,
    recordedAt: rec.recorded_at,
    fileName: rec.file_name,
    description: rec.description,
    hasAnalysis: Array.isArray(rec.analyses) && rec.analyses.length > 0,
    keySignature:
      Array.isArray(rec.analyses) && rec.analyses.length > 0
        ? (rec.analyses[0] as { key_signature?: string | null }).key_signature ?? null
        : null,
    tempo:
      Array.isArray(rec.analyses) && rec.analyses.length > 0
        ? (rec.analyses[0] as { tempo?: number | null }).tempo ?? null
        : null,
    tags: Array.isArray(rec.recording_tags)
      ? rec.recording_tags
          .map((rt: Record<string, unknown>) => rt.tags as { id: string; name: string } | null)
          .filter(Boolean) as { id: string; name: string }[]
      : [],
  }));

  return (
    <LibraryClient
      recordings={normalized}
      allTags={tags ?? []}
    />
  );
}
