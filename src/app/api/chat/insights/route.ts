import { streamText } from "ai";
import { defaultModel } from "@/lib/ai/providers";
import { buildInsightsSystemPrompt } from "@/lib/ai/build-system-prompt";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

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
