"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sparkles, RefreshCw, Layers, Star, Lightbulb,
  ChevronDown, ChevronUp,
} from "lucide-react";

interface LibrarySummary {
  overview: string;
  clusters: {
    name: string;
    recordingTitles: string[];
    description: string;
  }[];
  standouts: {
    title: string;
    reason: string;
  }[];
  suggestions: string[];
}

interface LibrarySummaryProps {
  analyses: {
    title: string;
    key_signature: string | null;
    tempo: number | null;
    chords: { chord: string }[];
  }[];
}

const CACHE_KEY = "resonance-library-summary";
const CACHE_DURATION = 1000 * 60 * 60; // 1 hour

export function LibrarySummaryPanel({ analyses }: LibrarySummaryProps) {
  const [summary, setSummary] = useState<LibrarySummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedClusters, setExpandedClusters] = useState<Set<number>>(new Set());

  useEffect(() => {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      try {
        const { data, timestamp, count } = JSON.parse(cached);
        if (Date.now() - timestamp < CACHE_DURATION && count === analyses.length) {
          setSummary(data);
          return;
        }
      } catch {}
    }
    generateSummary();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function generateSummary() {
    setLoading(true);
    try {
      const res = await fetch("/api/insights/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ analyses }),
      });
      if (!res.ok) throw new Error("Failed to generate");
      const { summary: data } = await res.json();
      setSummary(data);
      localStorage.setItem(CACHE_KEY, JSON.stringify({
        data,
        timestamp: Date.now(),
        count: analyses.length,
      }));
    } catch (err) {
      console.error("Failed to generate library summary:", err);
    } finally {
      setLoading(false);
    }
  }

  function toggleCluster(index: number) {
    setExpandedClusters((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center gap-3 py-12">
          <div className="flex items-end gap-0.5 h-5">
            <div className="w-1 bg-primary rounded-full" style={{ animation: "waveform-bar 0.8s ease-in-out infinite", height: "100%" }} />
            <div className="w-1 bg-primary rounded-full" style={{ animation: "waveform-bar 0.8s ease-in-out 0.2s infinite", height: "100%" }} />
            <div className="w-1 bg-primary rounded-full" style={{ animation: "waveform-bar 0.8s ease-in-out 0.4s infinite", height: "100%" }} />
          </div>
          <p className="text-sm text-muted-foreground">Analyzing your library...</p>
        </CardContent>
      </Card>
    );
  }

  if (!summary) return null;

  return (
    <div className="space-y-4">
      {/* AI Overview */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Sparkles className="h-4 w-4" />
              AI Library Analysis
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={generateSummary}
              disabled={loading}
              className="text-xs"
            >
              <RefreshCw className="mr-1 h-3 w-3" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed">{summary.overview}</p>
        </CardContent>
      </Card>

      {/* Clusters */}
      {summary.clusters.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Layers className="h-4 w-4" />
              Musical Clusters
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {summary.clusters.map((cluster, i) => (
              <div key={i} className="rounded-lg border p-3">
                <button
                  onClick={() => toggleCluster(i)}
                  className="flex w-full items-center justify-between text-left"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{cluster.name}</span>
                    <Badge variant="secondary" className="text-xs">
                      {cluster.recordingTitles.length} recordings
                    </Badge>
                  </div>
                  {expandedClusters.has(i) ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>
                {expandedClusters.has(i) && (
                  <div className="mt-2 space-y-2">
                    <p className="text-sm text-muted-foreground">{cluster.description}</p>
                    <div className="flex flex-wrap gap-1">
                      {cluster.recordingTitles.map((title) => (
                        <Badge key={title} variant="outline" className="text-xs">
                          {title}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Standouts */}
      {summary.standouts.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Star className="h-4 w-4" />
              Standout Pieces
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {summary.standouts.map((s, i) => (
              <div key={i} className="flex gap-3">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                  {i + 1}
                </div>
                <div>
                  <p className="text-sm font-medium">{s.title}</p>
                  <p className="text-sm text-muted-foreground">{s.reason}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Suggestions */}
      {summary.suggestions.length > 0 && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-primary">
              <Lightbulb className="h-4 w-4" />
              Development Suggestions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {summary.suggestions.map((suggestion, i) => (
                <li key={i} className="flex gap-2 text-sm">
                  <span className="shrink-0 text-primary font-medium">{i + 1}.</span>
                  <span>{suggestion}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
