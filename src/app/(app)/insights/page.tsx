import { createClient } from "@/lib/supabase/server";
import { InsightsDashboard } from "@/components/insights/insights-dashboard";
import { BarChart3 } from "lucide-react";

export default async function InsightsPage() {
  const supabase = await createClient();

  const { data: recordings } = await supabase
    .from("recordings")
    .select("id, title, analyses(key_signature, tempo, chords)");

  const analysesData = (recordings ?? [])
    .filter((r) => r.analyses && (r.analyses as unknown[]).length > 0)
    .map((r) => {
      const analysis = Array.isArray(r.analyses) ? r.analyses[0] : r.analyses;
      return {
        id: r.id,
        title: r.title,
        key_signature: (analysis as { key_signature: string | null }).key_signature,
        tempo: (analysis as { tempo: number | null }).tempo,
        chords: ((analysis as { chords: { chord: string; time: number; duration: number }[] }).chords) ?? [],
      };
    });

  if (analysesData.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Insights</h1>
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16">
          <BarChart3 className="mb-4 h-10 w-10 text-muted-foreground" />
          <p className="mb-2 text-lg font-medium">No analyzed recordings yet</p>
          <p className="text-sm text-muted-foreground">
            Upload and analyze recordings to see patterns across your library
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Insights</h1>
        <p className="text-muted-foreground">
          Patterns across {analysesData.length} analyzed recordings
        </p>
      </div>

      <InsightsDashboard analyses={analysesData} />
    </div>
  );
}
