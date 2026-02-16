import { streamText } from "ai";
import { defaultModel } from "@/lib/ai/providers";
import { buildRecordingSystemPrompt } from "@/lib/ai/build-system-prompt";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const { messages, recordingId, analysis } = await request.json();

    if (!messages || !Array.isArray(messages)) {
      return new Response("Invalid messages format", { status: 400 });
    }

    const systemPrompt = buildRecordingSystemPrompt(analysis);

    const result = streamText({
      model: defaultModel,
      system: systemPrompt,
      messages: messages.map((m: { role: string; content: string }) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    });

    // Fire-and-forget: save user message without blocking the stream
    const lastUserMessage = messages[messages.length - 1];
    if (lastUserMessage?.role === "user") {
      createClient().then(async (supabase) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase.from("chat_messages").insert({
            recording_id: recordingId,
            user_id: user.id,
            role: "user",
            content: lastUserMessage.content,
          });
        }
      }).catch(() => {});
    }

    return result.toDataStreamResponse();
  } catch (error) {
    console.error("Chat API error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to process chat request" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
