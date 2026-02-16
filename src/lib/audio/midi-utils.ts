import { Midi } from "@tonejs/midi";
import type { NoteEvent } from "./types";

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

export function midiToNoteName(midi: number): string {
  const octave = Math.floor(midi / 12) - 1;
  return `${NOTE_NAMES[midi % 12]}${octave}`;
}

export function noteNameToMidi(name: string): number {
  const match = name.match(/^([A-G]#?)(-?\d+)$/);
  if (!match) return 60;
  const [, note, octave] = match;
  const noteIndex = NOTE_NAMES.indexOf(note);
  return (parseInt(octave) + 1) * 12 + noteIndex;
}

export function createMidiFile(notes: NoteEvent[], name: string = "Transcription"): Uint8Array {
  const midi = new Midi();
  const track = midi.addTrack();
  track.name = name;

  for (const note of notes) {
    track.addNote({
      midi: note.midi,
      time: note.time,
      duration: note.duration,
      velocity: note.velocity / 127,
    });
  }

  return midi.toArray();
}

export function downloadMidi(notes: NoteEvent[], filename: string = "transcription.mid") {
  const midiData = createMidiFile(notes, filename.replace(".mid", ""));
  const blob = new Blob([midiData.buffer as ArrayBuffer], { type: "audio/midi" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
