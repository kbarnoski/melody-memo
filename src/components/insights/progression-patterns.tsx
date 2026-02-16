"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface ProgressionPatternsProps {
  progressions: {
    progression: string[];
    count: number;
    recordings: string[];
  }[];
}

export function ProgressionPatterns({ progressions }: ProgressionPatternsProps) {
  if (progressions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recurring Progressions</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Analyze more recordings to discover recurring chord progressions
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Recurring Progressions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {progressions.slice(0, 10).map((p, i) => (
          <div key={i} className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="flex gap-1">
                {p.progression.map((chord, j) => (
                  <span key={j} className="flex items-center gap-1">
                    <Badge variant="outline">{chord}</Badge>
                    {j < p.progression.length - 1 && (
                      <span className="text-muted-foreground text-xs">→</span>
                    )}
                  </span>
                ))}
              </div>
              <Badge variant="secondary" className="ml-auto shrink-0">
                {p.recordings.length} recordings
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Found in: {p.recordings.join(", ")}
            </p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
