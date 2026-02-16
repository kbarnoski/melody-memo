interface Analysis {
  key_signature: string | null;
  key_confidence?: number;
  tempo: number | null;
  time_signature: string | null;
  chords: { chord: string; time: number; duration: number }[];
  notes: { midi: number; time: number; duration: number; velocity: number }[];
  melody?: { midi: number; time: number; duration: number; velocity: number }[];
  bass_line?: { midi: number; time: number; duration: number; velocity: number }[];
  harmonic_rhythm?: string;
  progressions?: string[];
}

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

function midiToNote(midi: number): string {
  return `${NOTE_NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`;
}

export function buildRecordingSystemPrompt(analysis: Analysis): string {
  if (!analysis) {
    return "You are a music theory expert. The recording has not been analyzed yet. Let the user know they need to run the analysis first.";
  }

  // Top chords by frequency
  const chordCounts = new Map<string, number>();
  for (const c of analysis.chords) {
    chordCounts.set(c.chord, (chordCounts.get(c.chord) || 0) + 1);
  }
  const sortedChords = [...chordCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15);

  // Chord progression (limited to first 30 to avoid token waste)
  const chordProgression = analysis.chords
    .slice(0, 30)
    .map((c) => c.chord)
    .join(" | ");
  const progressionSuffix = analysis.chords.length > 30
    ? ` ... (${analysis.chords.length - 30} more chord changes)`
    : "";

  // Note range
  const midiValues = analysis.notes.map((n) => n.midi);
  const minNote = midiValues.length > 0 ? midiToNote(Math.min(...midiValues)) : "N/A";
  const maxNote = midiValues.length > 0 ? midiToNote(Math.max(...midiValues)) : "N/A";

  // Melody summary
  const melodySummary = analysis.melody && analysis.melody.length > 0
    ? analysis.melody.slice(0, 20).map((n) => midiToNote(n.midi)).join(" ")
    : "Not extracted";

  // Bass line summary
  const bassSummary = analysis.bass_line && analysis.bass_line.length > 0
    ? analysis.bass_line.slice(0, 15).map((n) => NOTE_NAMES[n.midi % 12]).join(" ")
    : "Not extracted";

  // Key confidence context
  const confidence = analysis.key_confidence ?? 0;
  const keyConfidenceNote = confidence < 0.7
    ? " (low confidence — the actual key might differ)"
    : confidence < 0.85
    ? " (moderate confidence)"
    : " (high confidence)";

  // Recurring progressions
  const progressionsStr = analysis.progressions && analysis.progressions.length > 0
    ? analysis.progressions.join("\n")
    : "None detected (recording may be too short or harmonically free)";

  return `You are an expert music theorist, composition coach, and creative collaborator. The user recorded a piano voice memo that was analyzed by AI audio transcription (Basic Pitch).

## Analysis Results

**Key:** ${analysis.key_signature ?? "Unknown"}${analysis.key_signature ? keyConfidenceNote : ""}
**Tempo:** ${analysis.tempo ? `~${analysis.tempo} BPM` : "Unknown (rubato/free time likely)"}
**Time Signature:** ${analysis.time_signature ?? "Unknown"}
**Harmonic Rhythm:** ${analysis.harmonic_rhythm ?? "Unknown"}
**Total Notes:** ${analysis.notes.length}
**Range:** ${minNote} to ${maxNote}

**Top Chords (by frequency):**
${sortedChords.map(([chord, count]) => `- ${chord} (×${count})`).join("\n")}

**Chord Progression:**
${chordProgression}${progressionSuffix}

**Recurring Progressions:**
${progressionsStr}

**Melody (opening notes):** ${melodySummary}
**Bass Movement:** ${bassSummary}

## Your Approach

You are talking to a pianist who recorded this as a creative sketch. Respond as a knowledgeable collaborator:

1. **Be specific** — reference the actual chords, progressions, and patterns detected. Don't give generic advice.
2. **Analyze the harmony** — identify the chord function (tonic, dominant, subdominant), common progressions (ii-V-I, I-vi-IV-V), modal borrowing, secondary dominants, etc.
3. **Comment on voice leading** — note any interesting bass movement or melodic contour.
4. **Suggest development** — how to extend this into a full piece: B sections, bridges, modulations, reharmonization, chord substitutions (tritone subs, modal interchange).
5. **Identify style/genre** — what does the harmonic language suggest (jazz, pop, classical, neo-soul, impressionist, etc.)?
6. **Be honest about limitations** — AI transcription isn't perfect. If something looks odd (e.g., rapid chord changes, unusual voicings), flag it as a possible transcription artifact.
7. **Use proper terminology** but explain it naturally — roman numeral analysis, jazz chord symbols, functional harmony, etc.
8. **Keep it conversational** and encouraging. This is brainstorming, not a lecture.`;
}

export function buildInsightsSystemPrompt(
  analyses: { recording_title: string; key_signature: string | null; tempo: number | null; chords: { chord: string }[] }[]
): string {
  const keyDistribution = new Map<string, number>();
  const allChords = new Map<string, number>();

  for (const a of analyses) {
    if (a.key_signature) {
      keyDistribution.set(a.key_signature, (keyDistribution.get(a.key_signature) || 0) + 1);
    }
    for (const c of a.chords) {
      allChords.set(c.chord, (allChords.get(c.chord) || 0) + 1);
    }
  }

  const topKeys = [...keyDistribution.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  const topChords = [...allChords.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20);

  return `You are a music theory expert and composition coach analyzing a library of ${analyses.length} piano voice memos recorded over several years.

**Key Distribution:**
${topKeys.map(([key, count]) => `- ${key}: ${count} recordings`).join("\n")}

**Most Used Chords:**
${topChords.map(([chord, count]) => `- ${chord}: ×${count}`).join("\n")}

**Recordings:**
${analyses.map((a) => `- "${a.recording_title}" — ${a.key_signature ?? "?"}, ${a.tempo ? `~${a.tempo} BPM` : "?"}, Chords: ${[...new Set(a.chords.map((c) => c.chord))].slice(0, 8).join(", ")}`).join("\n")}

Help the user discover patterns, identify recurring progressions, suggest which recordings to develop into full songs, and offer big-picture compositional advice based on their tendencies. Be specific — reference actual recordings and chords.`;
}
