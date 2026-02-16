import { createClient } from "@/lib/supabase/server";
import { RecordingCard } from "@/components/recordings/recording-card";
import { Library } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function LibraryPage() {
  const supabase = await createClient();

  const { data: recordings } = await supabase
    .from("recordings")
    .select("id, title, duration, created_at, analyses(id)")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Library</h1>
          <p className="text-muted-foreground">
            {recordings?.length ?? 0} recording{recordings?.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Link href="/upload">
          <Button>Upload</Button>
        </Link>
      </div>

      {recordings && recordings.length > 0 ? (
        <div className="grid gap-3">
          {recordings.map((rec) => (
            <RecordingCard
              key={rec.id}
              id={rec.id}
              title={rec.title}
              duration={rec.duration}
              createdAt={rec.created_at}
              hasAnalysis={Array.isArray(rec.analyses) && rec.analyses.length > 0}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16">
          <Library className="mb-4 h-10 w-10 text-muted-foreground" />
          <p className="mb-2 text-lg font-medium">No recordings yet</p>
          <p className="mb-4 text-sm text-muted-foreground">
            Upload your voice memos to get started
          </p>
          <Link href="/upload">
            <Button>Upload Recordings</Button>
          </Link>
        </div>
      )}
    </div>
  );
}
