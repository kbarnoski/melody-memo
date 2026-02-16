import { streamText } from "ai";
import { defaultModel } from "@/lib/ai/providers";
import { buildInsightsSystemPrompt } from "@/lib/ai/build-system-prompt";

export async function POST(request: Request) {
  const { messages, analyses } = await request.json();

  const systemPrompt = buildInsightsSystemPrompt(
    analyses.map((a: { title: string; key_signature: string | null; tempo: number | null; chords: { chord: string }[] }) => ({
      recording_title: a.title,
      key_signature: a.key_signature,
      tempo: a.tempo,
      chords: a.chords,
    }))
  );

  const result = streamText({
    model: defaultModel,
    system: systemPrompt,
    messages,
  });

  return result.toDataStreamResponse();
}
