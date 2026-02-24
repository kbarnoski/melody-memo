import type { NoteEvent } from "./types";

export async function transcribeAudio(
  audioUrl: string,
  onProgress?: (stage: string, progress: number) => void
): Promise<NoteEvent[]> {
  onProgress?.("Loading audio...", 10);

  // Resolve signed URL if needed (the audio API now returns JSON with a URL)
  let finalUrl = audioUrl;
  if (audioUrl.startsWith("/api/")) {
    const res = await fetch(audioUrl);
    const data = await res.json();
    if (data.url) {
      finalUrl = data.url;
    } else {
      // Fall back to transcoded version
      finalUrl = audioUrl + "?transcode=1";
    }
  }

  const response = await fetch(finalUrl);
  const arrayBuffer = await response.arrayBuffer();

  onProgress?.("Decoding audio...", 20);

  const audioContext = new AudioContext({ sampleRate: 22050 });
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

  // Get mono audio data
  const audioData = audioBuffer.getChannelData(0);

  onProgress?.("Loading AI model...", 30);

  // Dynamic import to avoid loading TensorFlow.js on other pages
  const { BasicPitch, addPitchBendsToNoteEvents, noteFramesToTime, outputToNotesPoly } =
    await import("@spotify/basic-pitch");

  const basicPitch = new BasicPitch("/model/model.json");

  onProgress?.("Transcribing notes...", 50);

  let frames: number[][] = [];
  let onsets: number[][] = [];
  let contours: number[][] = [];

  await basicPitch.evaluateModel(
    audioData,
    (f: number[][], o: number[][], c: number[][]) => {
      frames = [...frames, ...f];
      onsets = [...onsets, ...o];
      contours = [...contours, ...c];
    },
    (progress: number) => {
      onProgress?.("Transcribing notes...", 50 + progress * 30);
    }
  );

  onProgress?.("Extracting notes...", 85);

  const notes = noteFramesToTime(
    addPitchBendsToNoteEvents(
      contours,
      outputToNotesPoly(frames, onsets, 0.25, 0.25, 5)
    )
  );

  await audioContext.close();

  onProgress?.("Processing complete", 100);

  return notes.map((note) => ({
    midi: note.pitchMidi,
    time: note.startTimeSeconds,
    duration: note.durationSeconds,
    velocity: Math.round(note.amplitude * 127),
  }));
}
