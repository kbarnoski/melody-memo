"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Music, Gauge, Clock, TrendingUp, Repeat, Guitar } from "lucide-react";

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
  };
}

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

function midiToNote(midi: number): string {
  return `${NOTE_NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`;
}

export function AnalysisDisplay({ analysis }: AnalysisDisplayProps) {
  const uniqueChords = [...new Set(analysis.chords.map((c) => c.chord))];

  // Chord frequency for display
  const chordCounts = new Map<string, number>();
  for (const c of analysis.chords) {
    chordCounts.set(c.chord, (chordCounts.get(c.chord) || 0) + 1);
  }
  const sortedChords = [...chordCounts.entries()]
    .sort((a, b) => b[1] - a[1]);

  // Note range
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
