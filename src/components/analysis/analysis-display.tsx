"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Music, Gauge, Clock, TrendingUp, Repeat, Guitar,
  BookOpen, Lightbulb, ListMusic, ChevronDown, ChevronUp,
} from "lucide-react";

interface Summary {
  overview: string;
  key_center: string;
  sections: { label: string; description: string }[];
  chord_vocabulary: string[];
  harmonic_highlights: string;
  rhythm_and_feel: string;
  relearning_tips: string;
}

interface AnalysisDisplayProps {
  analysis: {
    key_signature: string | null;
    key_confidence?: number;
    tempo: number | null;
    time_signature: string | null;
    chords: { chord: string; time: number; duration: number }[];
    harmonic_rhythm?: string;
    progressions?: string[];
    melody?: { midi: number; time: number; duration: number; velocity: number }[];
    bass_line?: { midi: number; time: number; duration: number; velocity: number }[];
    notes: { midi: number; time: number; duration: number; velocity: number }[];
    summary?: Summary | null;
  };
}

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

function midiToNote(midi: number): string {
  return `${NOTE_NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`;
}

function TeachingSummary({ summary }: { summary: Summary }) {
  return (
    <div className="space-y-4">
      {/* Overview Card */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <BookOpen className="h-4 w-4" />
            Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed">{summary.overview}</p>
          <p className="mt-2 text-sm">
            <span className="font-medium">Key Center:</span>{" "}
            <span className="text-muted-foreground">{summary.key_center}</span>
          </p>
          {summary.rhythm_and_feel && (
            <p className="mt-1 text-sm">
              <span className="font-medium">Feel:</span>{" "}
              <span className="text-muted-foreground">{summary.rhythm_and_feel}</span>
            </p>
          )}
        </CardContent>
      </Card>

      {/* Sections Timeline */}
      {summary.sections.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <ListMusic className="h-4 w-4" />
              Sections
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative space-y-4">
              {summary.sections.map((section, i) => (
                <div key={i} className="relative pl-6">
                  <div className="absolute left-0 top-1 h-3 w-3 rounded-full bg-primary" />
                  {i < summary.sections.length - 1 && (
                    <div className="absolute left-[5px] top-4 bottom-0 w-0.5 bg-border" />
                  )}
                  <p className="text-sm font-medium">{section.label}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground leading-relaxed">
                    {section.description}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Chord Vocabulary */}
      {summary.chord_vocabulary.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Guitar className="h-4 w-4" />
              Chord Vocabulary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {summary.chord_vocabulary.map((chord) => (
                <Badge key={chord} variant="outline" className="text-sm">
                  {chord}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Harmonic Highlights */}
      {summary.harmonic_highlights && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Music className="h-4 w-4" />
              Harmonic Highlights
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {summary.harmonic_highlights}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Relearning Tips */}
      {summary.relearning_tips && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-primary">
              <Lightbulb className="h-4 w-4" />
              Tips for Relearning
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed">
              {summary.relearning_tips}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function RawAnalysisDetails({ analysis }: AnalysisDisplayProps) {
  const uniqueChords = [...new Set(analysis.chords.map((c) => c.chord))];

  const chordCounts = new Map<string, number>();
  for (const c of analysis.chords) {
    chordCounts.set(c.chord, (chordCounts.get(c.chord) || 0) + 1);
  }
  const sortedChords = [...chordCounts.entries()]
    .sort((a, b) => b[1] - a[1]);

  const midiValues = analysis.notes.map((n) => n.midi);
  const minNote = midiValues.length > 0 ? midiToNote(Math.min(...midiValues)) : "N/A";
  const maxNote = midiValues.length > 0 ? midiToNote(Math.max(...midiValues)) : "N/A";

  const confidence = analysis.key_confidence ?? 0;
  const confidenceLabel = confidence > 0.85 ? "high" : confidence > 0.7 ? "moderate" : "low";

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Music className="h-4 w-4" />
              Key
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {analysis.key_signature ?? "Unknown"}
            </p>
            {analysis.key_confidence !== undefined && (
              <p className="text-xs text-muted-foreground mt-1">
                Confidence: {confidenceLabel} ({Math.round(confidence * 100)}%)
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Gauge className="h-4 w-4" />
              Tempo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {analysis.tempo ? `~${analysis.tempo} BPM` : "Unknown"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Clock className="h-4 w-4" />
              Time Signature
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {analysis.time_signature ?? "Unknown"}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Guitar className="h-4 w-4" />
              Chords ({uniqueChords.length} unique)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {sortedChords.map(([chord, count]) => (
                <Badge key={chord} variant="outline" className="text-sm">
                  {chord}
                  {count > 1 && (
                    <span className="ml-1 text-xs text-muted-foreground">x{count}</span>
                  )}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <TrendingUp className="h-4 w-4" />
              Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Notes detected</span>
              <span className="font-medium">{analysis.notes.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Range</span>
              <span className="font-medium">{minNote} — {maxNote}</span>
            </div>
            {analysis.harmonic_rhythm && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Harmonic rhythm</span>
                <span className="font-medium">{analysis.harmonic_rhythm}</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {analysis.progressions && analysis.progressions.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Repeat className="h-4 w-4" />
              Recurring Progressions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {analysis.progressions.map((prog, i) => (
                <p key={i} className="text-sm font-mono">
                  {prog}
                </p>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export function AnalysisDisplay({ analysis }: AnalysisDisplayProps) {
  const [showRawData, setShowRawData] = useState(false);
  const hasSummary = analysis.summary && typeof analysis.summary === "object";

  if (!hasSummary) {
    return <RawAnalysisDetails analysis={analysis} />;
  }

  return (
    <div className="space-y-4">
      <TeachingSummary summary={analysis.summary!} />

      <Button
        variant="ghost"
        className="w-full text-muted-foreground"
        onClick={() => setShowRawData(!showRawData)}
      >
        {showRawData ? (
          <>
            <ChevronUp className="mr-2 h-4 w-4" />
            Hide Raw Analysis Data
          </>
        ) : (
          <>
            <ChevronDown className="mr-2 h-4 w-4" />
            Show Raw Analysis Data
          </>
        )}
      </Button>

      {showRawData && <RawAnalysisDetails analysis={analysis} />}
    </div>
  );
}
