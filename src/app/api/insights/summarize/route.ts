import { generateObject } from "ai";
import { defaultModel } from "@/lib/ai/providers";
import { z } from "zod";

const insightsSummarySchema = z.object({
  overview: z.string().describe("2-3 sentence overview of the library — total recordings, predominant keys/styles, overall musical tendencies"),
  clusters: z.array(z.object({
    name: z.string().describe("A descriptive name for this group, e.g. 'Jazz Ballads' or 'Uptempo Funk Ideas'"),
    recordingTitles: z.array(z.string()).describe("Titles of recordings in this cluster"),
    description: z.string().describe("What these recordings have in common musically"),
  })).describe("Groups of musically similar recordings"),
  standouts: z.array(z.object({
    title: z.string().describe("Recording title"),
    reason: z.string().describe("Why this recording stands out from the rest"),
  })).describe("Recordings that are harmonically or rhythmically unique compared to the rest"),
  suggestions: z.array(z.string()).describe("3-5 actionable development suggestions referencing specific recordings"),
});

export async function POST(request: Request) {
  try {
    const { analyses } = await request.json();

    if (!analyses || !Array.isArray(analyses) || analyses.length === 0) {
      return Response.json({ error: "No analyses provided" }, { status: 400 });
    }

    const recordingSummaries = analyses.map((a: {
      title: string;
      key_signature: string | null;
      tempo: number | null;
      chords: { chord: string }[];
    }) => {
      const uniqueChords = [...new Set(a.chords.map((c) => c.chord))];
      return `- "${a.title}" — Key: ${a.key_signature ?? "?"}, Tempo: ${a.tempo ? `~${a.tempo} BPM` : "?"}, Chords: ${uniqueChords.slice(0, 10).join(", ")}`;
    }).join("\n");

    const prompt = `Analyze this library of ${analyses.length} piano voice memo recordings and generate insights.

## Recordings
${recordingSummaries}

Group similar recordings into clusters based on shared musical characteristics (key, chord vocabulary, tempo, style). Identify any standout recordings that are harmonically unique. Suggest how specific recordings could be developed or combined into full pieces.`;

    const { object: summary } = await generateObject({
      model: defaultModel,
      schema: insightsSummarySchema,
      prompt,
    });

    return Response.json({ summary });
  } catch (error) {
    console.error("Insights summarize error:", error);
    return Response.json(
      { error: "Failed to generate insights summary" },
      { status: 500 }
    );
  }
}
