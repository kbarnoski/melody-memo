import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAnonClient } from "@supabase/supabase-js";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Try authenticated client first, fall back to anon for shared recordings
  let supabase = await createClient();
  let { data: recording, error } = await supabase
    .from("recordings")
    .select("file_name")
    .eq("id", id)
    .single();

  if (error || !recording) {
    const anonClient = createAnonClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { data: sharedRec } = await anonClient
      .from("recordings")
      .select("file_name")
      .eq("id", id)
      .not("share_token", "is", null)
      .single();

    if (!sharedRec) {
      return NextResponse.json({ error: "Recording not found" }, { status: 404 });
    }
    recording = sharedRec;
    supabase = anonClient;
  }

  // Create a signed URL and redirect — avoids downloading through the serverless function
  const { data: signedData, error: signError } = await supabase.storage
    .from("recordings")
    .createSignedUrl(recording.file_name, 3600); // 1 hour

  if (signError || !signedData?.signedUrl) {
    return NextResponse.json(
      { error: `Failed to create signed URL: ${signError?.message}` },
      { status: 500 }
    );
  }

  // Redirect to signed Supabase Storage URL
  // This lets the browser stream directly from Supabase CDN with range request support
  return NextResponse.redirect(signedData.signedUrl);
}
