"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileAudio, Clock } from "lucide-react";

interface RecordingCardProps {
  id: string;
  title: string;
  duration: number | null;
  createdAt: string;
  hasAnalysis?: boolean;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function RecordingCard({
  id,
  title,
  duration,
  createdAt,
  hasAnalysis,
}: RecordingCardProps) {
  return (
    <Link href={`/recording/${id}`}>
      <Card className="transition-colors hover:bg-accent/50 cursor-pointer">
        <CardContent className="flex items-center gap-4 py-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <FileAudio className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="truncate font-medium">{title}</p>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span>{formatDate(createdAt)}</span>
              {duration && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatDuration(duration)}
                </span>
              )}
            </div>
          </div>
          {hasAnalysis && (
            <Badge variant="secondary" className="shrink-0">
              Analyzed
            </Badge>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
