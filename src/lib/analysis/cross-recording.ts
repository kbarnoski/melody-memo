interface RecordingAnalysis {
  id: string;
  title: string;
  key_signature: string | null;
  tempo: number | null;
  chords: { chord: string; time: number; duration: number }[];
}

export function findCommonProgressions(
  analyses: RecordingAnalysis[],
  minLength: number = 3
): { progression: string[]; count: number; recordings: string[] }[] {
  const progressionMap = new Map<string, { count: number; recordings: Set<string> }>();

  for (const analysis of analyses) {
    const chordSequence = analysis.chords.map((c) => c.chord);

    // Extract subsequences of length minLength to minLength+3
    for (let len = minLength; len <= Math.min(minLength + 3, chordSequence.length); len++) {
      for (let i = 0; i <= chordSequence.length - len; i++) {
        const subsequence = chordSequence.slice(i, i + len);
        const key = subsequence.join(" → ");
        const existing = progressionMap.get(key) || { count: 0, recordings: new Set<string>() };
        existing.count++;
        existing.recordings.add(analysis.title);
        progressionMap.set(key, existing);
      }
    }
  }

  return [...progressionMap.entries()]
    .filter(([, v]) => v.recordings.size >= 2)
    .map(([key, v]) => ({
      progression: key.split(" → "),
      count: v.count,
      recordings: [...v.recordings],
    }))
    .sort((a, b) => b.recordings.length - a.recordings.length || b.count - a.count)
    .slice(0, 20);
}

export function findSimilarRecordings(
  analyses: RecordingAnalysis[]
): { pair: [string, string]; similarity: number; reasons: string[] }[] {
  const similarities: { pair: [string, string]; similarity: number; reasons: string[] }[] = [];

  for (let i = 0; i < analyses.length; i++) {
    for (let j = i + 1; j < analyses.length; j++) {
      const a = analyses[i];
      const b = analyses[j];
      let score = 0;
      const reasons: string[] = [];

      // Same key
      if (a.key_signature && a.key_signature === b.key_signature) {
        score += 30;
        reasons.push(`Same key: ${a.key_signature}`);
      }

      // Similar tempo
      if (a.tempo && b.tempo) {
        const tempoDiff = Math.abs(a.tempo - b.tempo);
        if (tempoDiff < 10) {
          score += 20;
          reasons.push(`Similar tempo (~${Math.round((a.tempo + b.tempo) / 2)} BPM)`);
        }
      }

      // Shared chords
      const chordsA = new Set(a.chords.map((c) => c.chord));
      const chordsB = new Set(b.chords.map((c) => c.chord));
      const shared = [...chordsA].filter((c) => chordsB.has(c));
      const union = new Set([...chordsA, ...chordsB]);
      const overlap = union.size > 0 ? shared.length / union.size : 0;

      if (overlap > 0.5) {
        score += Math.round(overlap * 50);
        reasons.push(`${shared.length} shared chords (${Math.round(overlap * 100)}% overlap)`);
      }

      if (score >= 30 && reasons.length > 0) {
        similarities.push({
          pair: [a.title, b.title],
          similarity: score,
          reasons,
        });
      }
    }
  }

  return similarities.sort((a, b) => b.similarity - a.similarity).slice(0, 15);
}

export function getKeyDistribution(
  analyses: RecordingAnalysis[]
): { key: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const a of analyses) {
    if (a.key_signature) {
      counts.set(a.key_signature, (counts.get(a.key_signature) || 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count);
}

export function getHarmonicTendencies(
  analyses: RecordingAnalysis[]
): { tendencies: string[]; dominantStyle: string } {
  const allChordNames: string[] = [];
  for (const a of analyses) {
    for (const c of a.chords) {
      allChordNames.push(c.chord);
    }
  }

  if (allChordNames.length === 0) {
    return { tendencies: [], dominantStyle: "Not enough data" };
  }

  const tendencies: string[] = [];
  const total = allChordNames.length;

  // Count chord types
  const seventh = allChordNames.filter((c) =>
    /7|maj7|m7|dim7|m7b5|9|11|13/.test(c)
  ).length;
  const minor = allChordNames.filter((c) =>
    /^[A-G][#b]?m(?!aj)/.test(c)
  ).length;
  const sus = allChordNames.filter((c) => /sus/.test(c)).length;
  const dim = allChordNames.filter((c) => /dim|°/.test(c)).length;
  const aug = allChordNames.filter((c) => /aug|\+/.test(c)).length;

  if (seventh / total > 0.3) tendencies.push("Jazz-influenced harmony");
  if (minor / total > 0.5) tendencies.push("Drawn to minor tonalities");
  if (sus / total > 0.1) tendencies.push("Uses suspended chords for color");
  if (dim / total > 0.05) tendencies.push("Employs diminished passing chords");
  if (aug / total > 0.05) tendencies.push("Uses augmented chords for tension");

  if (seventh / total <= 0.1 && sus / total <= 0.05) {
    tendencies.push("Diatonic/straightforward harmony");
  }

  // Determine dominant style
  let dominantStyle = "Mixed";
  if (seventh / total > 0.4) dominantStyle = "Jazz / Neo-Soul";
  else if (minor / total > 0.6) dominantStyle = "Minor-key driven";
  else if (seventh / total <= 0.1) dominantStyle = "Pop / Folk / Classical";
  else dominantStyle = "Contemporary blend";

  return { tendencies, dominantStyle };
}

export function getChordFrequency(
  analyses: RecordingAnalysis[]
): { chord: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const a of analyses) {
    for (const c of a.chords) {
      counts.set(c.chord, (counts.get(c.chord) || 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([chord, count]) => ({ chord, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);
}
