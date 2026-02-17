import { createClient } from "@/lib/supabase/server";
import { InsightsDashboard } from "@/components/insights/insights-dashboard";
import { BarChart3, Upload } from "lucide-react";
import Link from "next/link";

export default async function InsightsPage() {
  const supabase = await createClient();

  const { data: recordings, error } = await supabase
    .from("recordings")
    .select(
      "id, title, duration, created_at, analyses(key_signature, tempo, time_signature, chords)"
    );

  if (error) {
    console.error("Insights query error:", error);
  }

  const allRecordings = recordings ?? [];
  const totalRecordings = allRecordings.length;

  const analysesData = allRecordings
    .filter((r) => {
      if (!r.analyses) return false;
      if (Array.isArray(r.analyses)) return r.analyses.length > 0;
      return true; // single object means analysis exists
    })
    .map((r) => {
      const analysis = Array.isArray(r.analyses) ? r.analyses[0] : r.analyses;
      const a = analysis as {
        key_signature: string | null;
        tempo: number | null;
        time_signature: string | null;
        chords: { chord: string; time: number; duration: number }[];
      };
      return {
        id: r.id,
        title: r.title,
        duration: r.duration as number | null,
        created_at: r.created_at as string,
        key_signature: a.key_signature,
        tempo: a.tempo,
        time_signature: a.time_signature,
        chords: a.chords ?? [],
      };
    });

  if (totalRecordings === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Insights</h1>
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16">
          <Upload className="mb-4 h-10 w-10 text-muted-foreground" />
          <p className="mb-2 text-lg font-medium">No recordings yet</p>
          <p className="mb-4 text-sm text-muted-foreground">
            Upload recordings to get started
          </p>
          <Link
            href="/recording"
            className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Record or Upload
          </Link>
        </div>
      </div>
    );
  }

  if (analysesData.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Insights</h1>
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16">
          <BarChart3 className="mb-4 h-10 w-10 text-muted-foreground" />
          <p className="mb-2 text-lg font-medium">No analyzed recordings yet</p>
          <p className="mb-4 text-sm text-muted-foreground">
            Analyze a recording to unlock insights
          </p>
          <Link
            href="/library"
            className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Go to Library
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Insights</h1>
        <p className="text-muted-foreground">
          Patterns across {analysesData.length} analyzed recording{analysesData.length !== 1 ? "s" : ""}
        </p>
      </div>

      <InsightsDashboard
        analyses={analysesData}
        totalRecordings={totalRecordings}
      />
    </div>
  );
}
