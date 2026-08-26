export interface ImageDimensions {
  width: number;
  height: number;
}

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function getPngDimensions(buffer: Buffer): ImageDimensions | null {
  if (buffer.length < 24 || !buffer.subarray(0, 8).equals(PNG_SIGNATURE)) return null;
  if (buffer.toString("ascii", 12, 16) !== "IHDR") return null;
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  return width && height ? { width, height } : null;
}

/** Scans JPEG markers for the SOF segment that carries the frame dimensions. */
function getJpegDimensions(buffer: Buffer): ImageDimensions | null {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return null;

  let offset = 2;
  while (offset + 4 <= buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = buffer[offset + 1];
    offset += 2;

    // Standalone markers carry no length field.
    if (marker === 0xd8 || marker === 0xd9 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      continue;
    }

    if (offset + 2 > buffer.length) break;
    const segmentLength = buffer.readUInt16BE(offset);

    const isStartOfFrame = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isStartOfFrame) {
      if (offset + 7 > buffer.length) break;
      const height = buffer.readUInt16BE(offset + 3);
      const width = buffer.readUInt16BE(offset + 5);
      return width && height ? { width, height } : null;
    }

    // Malformed segment length would loop forever; bail instead.
    if (segmentLength < 2) break;
    offset += segmentLength;
  }
  return null;
}

/**
 * Reads pixel dimensions directly from PNG/JPEG bytes. Deliberately hand-rolled
 * instead of a general-purpose image-parsing library: those tend to support many
 * formats we never accept (ICNS, JXL, HEIF, ...), some of which have had DoS
 * advisories in their parsers. Supporting only the two formats we validate on
 * upload keeps the attack surface limited to code we can reason about.
 */
export function getImageDimensions(buffer: Buffer, mimeType: string): ImageDimensions {
  const dimensions =
    mimeType === "image/png"
      ? getPngDimensions(buffer)
      : mimeType === "image/jpeg"
        ? getJpegDimensions(buffer)
        : null;

  if (!dimensions) {
    throw new Error("Could not read image dimensions — the file may be corrupted or is not a valid image.");
  }
  return dimensions;
}
