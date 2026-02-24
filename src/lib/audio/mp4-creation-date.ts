/**
 * Parse the creation date from an MP4/M4A file's `mvhd` atom.
 * The timestamp is stored as seconds since 1904-01-01T00:00:00Z.
 * Handles files where `moov` is at the end (common for iPhone recordings).
 * Handles 64-bit extended atom sizes (size field = 1).
 * Returns null if the file isn't MP4 or the atom can't be found.
 */
export async function getMp4CreationDate(file: File): Promise<Date | null> {
  try {
    // Step 1: Scan top-level atoms to find where `moov` lives.
    let offset = 0;
    let moovOffset = -1;
    let moovSize = 0;
    let moovHeaderSize = 8;

    while (offset + 8 <= file.size) {
      const headerBuf = await file.slice(offset, offset + 16).arrayBuffer();
      const hv = new DataView(headerBuf);
      let size = hv.getUint32(0);
      const type = String.fromCharCode(
        hv.getUint8(4), hv.getUint8(5), hv.getUint8(6), hv.getUint8(7)
      );

      let hdrSize = 8;

      // 64-bit extended size: size field = 1 means real size is in next 8 bytes
      if (size === 1 && headerBuf.byteLength >= 16) {
        const hi = hv.getUint32(8);
        const lo = hv.getUint32(12);
        size = hi * 4294967296 + lo;
        hdrSize = 16;
      }

      if (size < 8) break;

      if (type === "moov") {
        moovOffset = offset;
        moovSize = size;
        moovHeaderSize = hdrSize;
        break;
      }

      offset += size;
    }

    if (moovOffset < 0) return null;

    // Step 2: Read just the moov atom (only need first ~256 bytes for mvhd)
    const readSize = Math.min(moovSize, 512);
    const moovBuf = await file.slice(moovOffset, moovOffset + readSize).arrayBuffer();
    const view = new DataView(moovBuf);

    // MP4 epoch: 1904-01-01T00:00:00Z
    const MP4_EPOCH_OFFSET = 2082844800;

    // Search inside moov for mvhd (starts after moov header)
    let inner = moovHeaderSize;
    while (inner + 8 <= view.byteLength) {
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
  } catch {
    return null;
  }
}
