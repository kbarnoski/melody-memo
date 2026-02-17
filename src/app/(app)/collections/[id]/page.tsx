import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CollectionDetail } from "@/components/collections/collection-detail";

export default async function CollectionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: collection } = await supabase
    .from("collections")
    .select("*")
    .eq("id", id)
    .single();

  if (!collection) notFound();

  // Get recordings in this collection
  const { data: items } = await supabase
    .from("collection_recordings")
    .select("position, recording:recordings(id, title, duration, created_at)")
    .eq("collection_id", id)
    .order("position");

  const recordings = (items ?? [])
    .map((item) => ({
      position: item.position,
      ...(item.recording as unknown as { id: string; title: string; duration: number | null; created_at: string }),
    }))
    .filter((r) => r.id);

  // Get ALL user recordings to power the "add recording" picker
  const { data: allRecordings } = await supabase
    .from("recordings")
    .select("id, title, duration, created_at")
    .order("created_at", { ascending: false });

  const collectionRecordingIds = new Set(recordings.map((r) => r.id));
  const availableRecordings = (allRecordings ?? []).filter(
    (r) => !collectionRecordingIds.has(r.id)
  );

  return (
    <div className="space-y-6">
      <CollectionDetail
        collectionId={id}
        initialName={collection.name}
        initialDescription={collection.description ?? ""}
        initialRecordings={recordings}
        availableRecordings={availableRecordings}
      />
    </div>
  );
}
