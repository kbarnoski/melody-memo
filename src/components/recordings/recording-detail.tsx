"use client";

import { useState } from "react";
import { WaveformPlayer } from "@/components/audio/waveform-player";
import { AnalyzeButton } from "@/components/analysis/analyze-button";
import { AnalysisDisplay } from "@/components/analysis/analysis-display";
import { ChordTimeline } from "@/components/analysis/chord-timeline";
import { PianoRoll } from "@/components/analysis/piano-roll";
import { ExportMidiButton } from "@/components/analysis/export-midi-button";
import { ChatPanel } from "@/components/chat/chat-panel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface RecordingDetailProps {
  recording: {
    id: string;
    title: string;
    audio_url: string;
    duration: number | null;
    created_at: string;
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  analysis: any | null;
  initialMessages: {
    id: string;
    role: string;
    content: string;
    created_at: string;
  }[];
}

export function RecordingDetail({
  recording,
  analysis: initialAnalysis,
  initialMessages,
}: RecordingDetailProps) {
  const [analysis, setAnalysis] = useState(initialAnalysis);
  const [currentTime, setCurrentTime] = useState(0);

  return (
    <>
      <WaveformPlayer
        audioUrl={recording.audio_url}
        onTimeUpdate={setCurrentTime}
      />

      <AnalyzeButton
        recordingId={recording.id}
        audioUrl={recording.audio_url}
        onComplete={setAnalysis}
        hasExisting={analysis?.status === "completed"}
      />

      <Tabs defaultValue={analysis?.status === "completed" ? "analysis" : "chat"}>
        <TabsList>
          <TabsTrigger value="analysis" disabled={analysis?.status !== "completed"}>
            Analysis
          </TabsTrigger>
          <TabsTrigger value="chat" disabled={analysis?.status !== "completed"}>
            Chat
          </TabsTrigger>
        </TabsList>

        <TabsContent value="analysis" className="space-y-6">
          {analysis && analysis.status === "completed" && (
            <>
              <AnalysisDisplay analysis={analysis} />
              <ExportMidiButton
                notes={analysis.notes ?? []}
                filename={`${recording.title}.mid`}
              />
              <ChordTimeline
                chords={analysis.chords ?? []}
                currentTime={currentTime}
                duration={recording.duration ?? 0}
              />
              <PianoRoll
                notes={analysis.notes ?? []}
                currentTime={currentTime}
                duration={recording.duration ?? 0}
              />
            </>
          )}
        </TabsContent>

        <TabsContent value="chat">
          {analysis && analysis.status === "completed" && (
            <ChatPanel
              recordingId={recording.id}
              analysis={analysis}
              initialMessages={initialMessages}
            />
          )}
        </TabsContent>
      </Tabs>
    </>
  );
}
