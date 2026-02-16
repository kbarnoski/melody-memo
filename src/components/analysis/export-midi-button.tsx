"use client";

import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import type { NoteEvent } from "@/lib/audio/types";

interface ExportMidiButtonProps {
  notes: NoteEvent[];
  filename?: string;
}

export function ExportMidiButton({ notes, filename = "transcription.mid" }: ExportMidiButtonProps) {
  async function handleExport() {
    const { downloadMidi } = await import("@/lib/audio/midi-utils");
    downloadMidi(notes, filename);
  }

  return (
    <Button variant="outline" size="sm" onClick={handleExport} disabled={notes.length === 0}>
      <Download className="mr-2 h-4 w-4" />
      Export MIDI
    </Button>
  );
}
