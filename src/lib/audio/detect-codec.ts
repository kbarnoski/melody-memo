/**
 * Detect the audio codec from an MP4/M4A file by scanning for codec atoms.
 * Reads only the first 500KB of the file — enough to find the codec box.
 * Returns "alac", "aac", "mp3", or null if unknown.
 */
export async function detectAudioCodec(file: File): Promise<string | null> {
  try {
    const readSize = Math.min(file.size, 500000);
    const buffer = await file.slice(0, readSize).arrayBuffer();
    const bytes = new Uint8Array(buffer);

    // Scan for known codec FourCC codes in the MP4 container
    // "alac" = 0x616c6163, "mp4a" (AAC) = 0x6d703461
    for (let i = 0; i < bytes.length - 3; i++) {
      if (
        bytes[i] === 0x61 && bytes[i + 1] === 0x6c &&
        bytes[i + 2] === 0x61 && bytes[i + 3] === 0x63
      ) {
        return "alac";
      }
    }

    // If it's an M4A/MP4 but not ALAC, it's likely AAC
    const ext = file.name.toLowerCase();
    if (ext.endsWith(".m4a") || ext.endsWith(".mp4") || ext.endsWith(".aac")) {
      return "aac";
    }
    if (ext.endsWith(".mp3")) {
      return "mp3";
    }
    if (ext.endsWith(".wav")) {
      return "wav";
    }

    return null;
  } catch {
    return null;
  }
}
