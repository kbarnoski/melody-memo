"use client";

import { LibrarySummaryPanel } from "@/components/insights/library-summary";
import { KeyDistribution } from "@/components/insights/key-distribution";
import { ChordFrequency } from "@/components/insights/chord-frequency";
import { ProgressionPatterns } from "@/components/insights/progression-patterns";
import { SimilarRecordings } from "@/components/insights/similar-recordings";
import { InsightsChat } from "@/components/insights/insights-chat";
import {
  getKeyDistribution,
  getChordFrequency,
  findCommonProgressions,
  findSimilarRecordings,
} from "@/lib/analysis/cross-recording";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface AnalysisData {
  id: string;
  title: string;
  key_signature: string | null;
  tempo: number | null;
  chords: { chord: string; time: number; duration: number }[];
}

export function InsightsDashboard({ analyses }: { analyses: AnalysisData[] }) {
  const keyDist = getKeyDistribution(analyses);
  const chordFreq = getChordFrequency(analyses);
  const progressions = findCommonProgressions(analyses);
  const similar = findSimilarRecordings(analyses);

  return (
    <Tabs defaultValue="overview">
      <TabsList>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="statistics">Statistics</TabsTrigger>
        <TabsTrigger value="chat">AI Chat</TabsTrigger>
      </TabsList>

      <TabsContent value="overview" className="space-y-6">
        <LibrarySummaryPanel analyses={analyses} />
      </TabsContent>

      <TabsContent value="statistics" className="space-y-6">
        <div className="grid gap-6 md:grid-cols-2">
          <KeyDistribution data={keyDist} />
          <ChordFrequency data={chordFreq} />
        </div>
        <ProgressionPatterns progressions={progressions} />
        <SimilarRecordings pairs={similar} />
      </TabsContent>

      <TabsContent value="chat">
        <InsightsChat analyses={analyses} />
      </TabsContent>
    </Tabs>
  );
}
