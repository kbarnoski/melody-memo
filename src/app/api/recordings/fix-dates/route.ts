import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const MP4_EPOCH_OFFSET = 2082844800;

function getCreationDate(buf: ArrayBuffer): Date | null {
  const view = new DataView(buf);

  // Scan top-level atoms to find moov
  let offset = 0;
  while (offset + 8 <= view.byteLength) {
    let size = view.getUint32(offset);
    const type = String.fromCharCode(
      view.getUint8(offset + 4), view.getUint8(offset + 5),
      view.getUint8(offset + 6), view.getUint8(offset + 7)
    );

    // Handle 64-bit extended size (size field = 1)
    let headerSize = 8;
    if (size === 1 && offset + 16 <= view.byteLength) {
      const hi = view.getUint32(offset + 8);
      const lo = view.getUint32(offset + 12);
      size = hi * 4294967296 + lo;
      headerSize = 16;
    }

    if (size < 8) break;

    if (type === "moov") {
      const end = Math.min(offset + size, view.byteLength);
      let inner = offset + headerSize;
      while (inner + 20 <= end) {
        const atomSize = view.getUint32(inner);
        const atomType = String.fromCharCode(
          view.getUint8(inner + 4), view.getUint8(inner + 5),
          view.getUint8(inner + 6), view.getUint8(inner + 7)
        );
        if (atomSize < 8) break;

        if (atomType === "mvhd") {
          const version = view.getUint8(inner + 8);
          const creationTime = version === 0
            ? view.getUint32(inner + 12)
            : view.getUint32(inner + 16);
          if (creationTime <= 0) return null;
          const unixSeconds = creationTime - MP4_EPOCH_OFFSET;
          if (unixSeconds < 0 || unixSeconds > 4102444800) return null;
          return new Date(unixSeconds * 1000);
        }
        inner += atomSize;
      }
      return null;
    }

    offset += size;
  }
  return null;
}

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: recordings, error } = await supabase
    .from("recordings")
    .select("id, file_name, recorded_at")
    .eq("user_id", user.id);

  if (error || !recordings) {
    return NextResponse.json({ error: "Failed to fetch recordings" }, { status: 500 });
  }

  const results = [];

  for (const rec of recordings) {
    const { data: fileData, error: dlError } = await supabase.storage
      .from("recordings")
      .download(rec.file_name);

    if (dlError || !fileData) {
      results.push({ id: rec.id, file: rec.file_name, oldDate: rec.recorded_at, newDate: null, error: dlError?.message });
      continue;
    }

    const buf = await fileData.arrayBuffer();
    const creationDate = getCreationDate(buf);

    if (creationDate) {
      const newDate = creationDate.toISOString();
      await supabase
        .from("recordings")
        .update({ recorded_at: newDate })
        .eq("id", rec.id);
      results.push({ id: rec.id, file: rec.file_name, oldDate: rec.recorded_at, newDate });
    } else {
      results.push({ id: rec.id, file: rec.file_name, oldDate: rec.recorded_at, newDate: null });
    }
  }

  return NextResponse.json({
    updated: results.filter((r) => r.newDate).length,
    total: recordings.length,
    results,
  });
}
