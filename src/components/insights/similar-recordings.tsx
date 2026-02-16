"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface SimilarRecordingsProps {
  pairs: {
    pair: [string, string];
    similarity: number;
    reasons: string[];
  }[];
}

export function SimilarRecordings({ pairs }: SimilarRecordingsProps) {
  if (pairs.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Similar Recordings</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Analyze more recordings to discover similarities
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Similar Recordings</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {pairs.map((pair, i) => (
          <div key={i} className="rounded-lg border p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-medium">
                <span className="truncate">{pair.pair[0]}</span>
                <span className="text-muted-foreground">&amp;</span>
                <span className="truncate">{pair.pair[1]}</span>
              </div>
              <Badge variant="secondary">{pair.similarity}% match</Badge>
            </div>
            <div className="flex flex-wrap gap-1">
              {pair.reasons.map((reason, j) => (
                <span key={j} className="text-xs text-muted-foreground">
                  {reason}{j < pair.reasons.length - 1 ? " · " : ""}
                </span>
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
