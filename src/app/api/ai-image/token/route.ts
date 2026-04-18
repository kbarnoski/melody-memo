/**
 * Proxy endpoint for client-side fal.ai access.
 *
 * GET returns { token } so the fal SDK can open a realtime WebSocket
 * (which requires client-side credentials). Gated to authenticated
 * users only — previously the token was world-readable.
 *
 * POST forwards standard HTTP calls with the key attached server-side
 * (fal SDK `proxyUrl` mode).
 */

import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!process.env.FAL_KEY) {
    return Response.json({ error: "Missing FAL_KEY" }, { status: 501 });
  }
  return Response.json({ token: process.env.FAL_KEY });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!process.env.FAL_KEY) {
    return Response.json({ error: "Missing FAL_KEY" }, { status: 501 });
  }

  try {
    const targetUrl = request.headers.get("x-fal-target-url");

    if (!targetUrl) {
      return Response.json({ error: "Missing x-fal-target-url" }, { status: 400 });
    }

    // Read the request body
    const body = await request.text();

    // Forward to fal.ai with our API key
    const res = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": request.headers.get("content-type") || "application/json",
        Authorization: `Key ${process.env.FAL_KEY}`,
      },
      body,
    });

    const contentType = res.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      const data = await res.json();
      return Response.json(data, { status: res.status });
    }

    // Non-JSON response (e.g., binary data)
    const blob = await res.blob();
    return new Response(blob, {
      status: res.status,
      headers: { "Content-Type": contentType },
    });
  } catch (error) {
    console.error("[AI Proxy] Error:", error);
    return Response.json({ error: "Proxy request failed" }, { status: 500 });
  }
}
