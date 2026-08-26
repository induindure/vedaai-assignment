export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

export const ACCEPTED_MIME_TYPES = ["application/pdf", "image/png", "image/jpeg"];

export const ACCEPTED_FILE_EXTENSIONS = ".pdf,.png,.jpg,.jpeg";

export function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(mb >= 10 ? 0 : 1).replace(/\.0$/, "")}MB`;
  }
  return `${Math.max(1, Math.round(bytes / 1024))}KB`;
}

export function isAcceptedFileType(file: File): boolean {
  return ACCEPTED_MIME_TYPES.includes(file.type);
}

export function validateFile(file: File): string | null {
  if (!isAcceptedFileType(file)) {
    return "Only PDF, PNG, or JPG files are supported.";
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return "File exceeds the 10MB limit.";
  }
  return null;
}

/** Returns undefined if the page count can't be determined (e.g. a malformed PDF). */
export async function getPdfPageCount(file: File): Promise<number | undefined> {
  try {
    const { PDFDocument } = await import("pdf-lib");
    const buffer = await file.arrayBuffer();
    const pdf = await PDFDocument.load(buffer, { ignoreEncryption: true });
    return pdf.getPageCount();
  } catch {
    return undefined;
  }
}
