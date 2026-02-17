import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAnonClient } from "@supabase/supabase-js";
import { execFile } from "child_process";
import { writeFile, readFile, unlink, mkdtemp, access } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";

// Resolve ffmpeg binary path at startup
function resolveFfmpegPath(): string {
  if (process.env.FFMPEG_PATH) return process.env.FFMPEG_PATH;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const p = require("ffmpeg-static");
    if (p) return p;
  } catch { /* ignore */ }
  return "ffmpeg";
}

const ffmpegPath = resolveFfmpegPath();

function isALAC(bytes: Uint8Array): boolean {
  // Search first 500KB for 'alac' codec atom
  const searchLen = Math.min(bytes.length, 500000);
  for (let i = 0; i < searchLen - 3; i++) {
    if (
      bytes[i] === 0x61 &&     // a
      bytes[i + 1] === 0x6c && // l
      bytes[i + 2] === 0x61 && // a
      bytes[i + 3] === 0x63    // c
    ) {
      return true;
    }
  }
  return false;
}

async function transcodeToAAC(inputBuffer: ArrayBuffer): Promise<Buffer> {
  const dir = await mkdtemp(join(tmpdir(), "audio-"));
  const inputPath = join(dir, "input.m4a");
  const outputPath = join(dir, "output.m4a");

  try {
    await writeFile(inputPath, Buffer.from(inputBuffer));

    // Verify ffmpeg exists
    await access(ffmpegPath).catch(() => {
      throw new Error(`ffmpeg not found at: ${ffmpegPath}`);
    });

    await new Promise<void>((resolve, reject) => {
      execFile(
        ffmpegPath,
        [
          "-i", inputPath,
          "-c:a", "aac",        // transcode to AAC
          "-b:a", "192k",       // good quality
          "-movflags", "+faststart", // web-friendly: moov atom at start
          "-y",                 // overwrite output
          outputPath,
        ],
        { timeout: 60000 },
        (error, _stdout, stderr) => {
          if (error) {
            console.error("[TRANSCODE] ffmpeg error:", error.message);
            console.error("[TRANSCODE] stderr:", stderr);
            reject(error);
          } else {
            resolve();
          }
        }
      );
    });

    return await readFile(outputPath);
  } finally {
    await unlink(inputPath).catch(() => {});
    await unlink(outputPath).catch(() => {});
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Try authenticated client first, fall back to anon for shared recordings
  let supabase = await createClient();
  // eslint-disable-next-line prefer-const
  let { data: recording, error } = await supabase
    .from("recordings")
    .select("file_name")
    .eq("id", id)
    .single();

  if (error || !recording) {
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
    recording = sharedRec;
    supabase = anonClient;
  }

  const { data: fileData, error: downloadError } = await supabase.storage
    .from("recordings")
    .download(recording.file_name);

  if (downloadError || !fileData) {
    return NextResponse.json(
      { error: `Download failed: ${downloadError?.message}` },
      { status: 500 }
    );
  }

  let arrayBuffer = await fileData.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);

  // Check if file is ALAC (Apple Lossless) — Chrome can't play ALAC
  if (isALAC(bytes)) {
    try {
      const transcodedBuffer = await transcodeToAAC(arrayBuffer);
      arrayBuffer = transcodedBuffer.buffer.slice(
        transcodedBuffer.byteOffset,
        transcodedBuffer.byteOffset + transcodedBuffer.byteLength
      ) as ArrayBuffer;
    } catch (err) {
      console.error("[AUDIO] Transcoding failed:", err);
      return NextResponse.json(
        { error: "Audio transcoding failed. Please try again." },
        { status: 500 }
      );
    }
  }

  const contentType = "audio/mp4";

  // Support range requests for proper audio streaming
  const range = request.headers.get("range");
  if (range) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : arrayBuffer.byteLength - 1;
    const chunk = arrayBuffer.slice(start, end + 1);

    return new NextResponse(chunk, {
      status: 206,
      headers: {
        "Content-Type": contentType,
        "Content-Range": `bytes ${start}-${end}/${arrayBuffer.byteLength}`,
        "Content-Length": String(chunk.byteLength),
        "Accept-Ranges": "bytes",
        "Cache-Control": "public, max-age=3600",
      },
    });
  }

  return new NextResponse(arrayBuffer, {
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(arrayBuffer.byteLength),
      "Accept-Ranges": "bytes",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
