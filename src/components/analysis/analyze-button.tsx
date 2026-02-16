"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Wand2, Loader2, RefreshCw } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

interface AnalyzeButtonProps {
  recordingId: string;
  audioUrl: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onComplete: (analysis: any) => void;
  hasExisting?: boolean;
}

export function AnalyzeButton({ recordingId, audioUrl, onComplete, hasExisting }: AnalyzeButtonProps) {
  const [analyzing, setAnalyzing] = useState(false);
  const [stage, setStage] = useState("");
  const [progress, setProgress] = useState(0);

  async function handleAnalyze() {
    setAnalyzing(true);
    setStage("Starting analysis...");
    setProgress(0);

    try {
      const { transcribeAudio } = await import("@/lib/audio/transcribe");
      const { analyzeNotes } = await import("@/lib/audio/analyze");

      const notes = await transcribeAudio(audioUrl, (stageMsg, prog) => {
        setStage(stageMsg);
        setProgress(prog);
      });

      setStage("Analyzing music theory...");
      setProgress(90);

      const result = analyzeNotes(notes);

      setStage("Saving results...");
      setProgress(95);

      const supabase = createClient();
      const { data, error } = await supabase
        .from("analyses")
        .upsert({
          recording_id: recordingId,
          status: result.status,
          key_signature: result.key_signature,
          tempo: result.tempo,
          time_signature: result.time_signature,
          chords: result.chords,
          notes: result.notes,
          midi_data: result.midi_data,
        }, { onConflict: "recording_id" })
        .select()
        .single();

      if (error) throw error;

      setProgress(100);
      toast.success("Analysis complete!");
      onComplete(data);
    } catch (err) {
      console.error("Analysis failed:", err);
      toast.error("Analysis failed. Please try again.");
    } finally {
      setAnalyzing(false);
    }
  }

  if (analyzing) {
    return (
      <Card>
        <CardContent className="py-6">
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <div className="flex-1">
              <p className="text-sm font-medium">{stage}</p>
              <div className="mt-2 h-2 w-full rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
            <span className="text-sm text-muted-foreground">{Math.round(progress)}%</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (hasExisting) {
    return (
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={handleAnalyze}>
          <RefreshCw className="mr-2 h-3.5 w-3.5" />
          Re-analyze
        </Button>
      </div>
    );
  }

  return (
    <Card>
      <CardContent className="flex items-center justify-between py-6">
        <div>
          <p className="font-medium">Ready to analyze</p>
          <p className="text-sm text-muted-foreground">
            AI will transcribe notes and detect chords, key, and tempo
          </p>
        </div>
        <Button onClick={handleAnalyze}>
          <Wand2 className="mr-2 h-4 w-4" />
          Analyze
        </Button>
      </CardContent>
    </Card>
  );
}
