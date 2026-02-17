import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { RecordingDetail } from "@/components/recordings/recording-detail";
import { Badge } from "@/components/ui/badge";
import { Clock, Calendar } from "lucide-react";

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default async function RecordingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: recording } = await supabase
    .from("recordings")
    .select("*")
    .eq("id", id)
    .single();

  if (!recording) notFound();

  // Use proxy API route — it detects ALAC and transcodes to AAC for Chrome
  const audioUrl = `/api/audio/${id}`;

  const { data: analysis } = await supabase
    .from("analyses")
    .select("*")
    .eq("recording_id", id)
    .single();

  const { data: messages } = await supabase
    .from("chat_messages")
    .select("*")
    .eq("recording_id", id)
    .order("created_at", { ascending: true });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{recording.title}</h1>
        {recording.description && (
          <p className="mt-1 text-sm text-muted-foreground">{recording.description}</p>
        )}
        <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5" />
            {recording.recorded_at
              ? `Recorded ${new Date(recording.recorded_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`
              : new Date(recording.created_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
            }
          </span>
          {recording.duration && (
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {formatDuration(recording.duration)}
            </span>
          )}
          {analysis && analysis.status === "completed" && (
            <Badge variant="secondary">Analyzed</Badge>
          )}
        </div>
      </div>

      <RecordingDetail
        recording={{ ...recording, audio_url: audioUrl, description: recording.description ?? null, file_name: recording.file_name, share_token: recording.share_token ?? null }}
        analysis={analysis}
        initialMessages={messages ?? []}
      />
    </div>
  );
}
