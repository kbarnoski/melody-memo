import { streamText } from "ai";
import { defaultModel } from "@/lib/ai/providers";
import { buildCompareSystemPrompt } from "@/lib/ai/build-system-prompt";

export async function POST(request: Request) {
  const { messages, analysisA, analysisB, titleA, titleB } = await request.json();

  const systemPrompt = buildCompareSystemPrompt(
    titleA,
    analysisA,
    titleB,
    analysisB
  );

  const result = streamText({
    model: defaultModel,
    system: systemPrompt,
    messages,
  });

  return result.toDataStreamResponse();
}
