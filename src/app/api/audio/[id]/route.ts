import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAnonClient } from "@supabase/supabase-js";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Try authenticated client first
  const supabase = await createClient();
  const { data: recording } = await supabase
    .from("recordings")
    .select("file_name")
    .eq("id", id)
    .single();

  if (recording) {
    const { data: signedData } = await supabase.storage
      .from("recordings")
      .createSignedUrl(recording.file_name, 3600);

    if (signedData?.signedUrl) {
      return NextResponse.redirect(signedData.signedUrl);
    }
  }

  // Fallback: use anon client for publicly shared recordings
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

  const { data: signedData, error: signError } = await anonClient.storage
    .from("recordings")
    .createSignedUrl(sharedRec.file_name, 3600);

  if (signError || !signedData?.signedUrl) {
    return NextResponse.json(
      { error: `Failed to create signed URL: ${signError?.message}` },
      { status: 500 }
    );
  }

  return NextResponse.redirect(signedData.signedUrl);
}
