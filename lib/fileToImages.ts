import path from "node:path";
import { pdf as renderPdf } from "pdf-to-img";
import { getImageDimensions } from "@/lib/image-dimensions";

export interface PageImage {
  pageNumber: number;
  imageBuffer: Buffer;
  width: number;
  height: number;
  mimeType: "image/png" | "image/jpeg";
}

const PDF_MIME_TYPE = "application/pdf";
const SUPPORTED_IMAGE_MIME_TYPES = new Set(["image/png", "image/jpeg"]);

// scale is a multiplier on the PDF's own 72-points-per-inch unit, so scale 2 renders at
// 144 DPI — already within the ~150-200 DPI range generally considered sufficient for
// OCR/handwriting recognition, not the "300 DPI" print-quality resolution that would be
// worth cutting down. Left as-is; JPEG output (below) is the actual payload-size lever here.
const PDF_RENDER_SCALE = 2;

// pdf-to-img can encode either PNG or JPEG but doesn't expose a quality knob for JPEG (it
// calls @napi-rs/canvas's encoder with no quality argument, i.e. its default). Rendered pages
// are flat vector text/line-art rather than photographic content, so PNG's lossless
// compression is already fairly competitive here — real-world scanned/photographed answer
// sheets (noise, paper texture, uneven lighting) are exactly the content JPEG was built to
// compress well, and is where this format switch pays off most. Empirically verified this
// default quality holds up for extraction accuracy (see the task that introduced this).
const PDF_RENDER_FORMAT = "jpg";
const PDF_RENDER_MIME_TYPE = "image/jpeg";

// pdf-to-img derives these paths itself via `require.resolve("pdfjs-dist/package.json")` run
// through `node:path/posix`, which silently produces a wrong (relative) path on Windows and
// breaks embedded-standard-font glyph lookup. `import.meta.url` + `createRequire` would be the
// usual fix, but Next's bundler statically rewrites `import.meta.url` in server route modules,
// so we derive the path from `process.cwd()` (the project root Next runs from) instead — plain
// runtime APIs the bundler leaves untouched — and pass it through `docInitParams`, which
// overrides pdf-to-img's own (broken) defaults.
function pdfjsAssetDir(subfolder: "standard_fonts" | "cmaps"): string {
  return `${path.join(process.cwd(), "node_modules", "pdfjs-dist", subfolder).replaceAll("\\", "/")}/`;
}
const standardFontDataUrl = pdfjsAssetDir("standard_fonts");
const cMapUrl = pdfjsAssetDir("cmaps");

/**
 * Converts an uploaded file into one image-per-page, ready to hand to a vision model.
 * PDFs are rasterized page by page; PNG/JPEG images pass through as a single "page".
 */
export async function fileToImages(buffer: Buffer, mimeType: string): Promise<PageImage[]> {
  if (mimeType === PDF_MIME_TYPE) {
    return pdfToImages(buffer);
  }
  if (SUPPORTED_IMAGE_MIME_TYPES.has(mimeType)) {
    return imageToImages(buffer, mimeType);
  }
  throw new Error(`Unsupported file type "${mimeType}". Only PDF, PNG, and JPEG files are supported.`);
}

async function pdfToImages(buffer: Buffer): Promise<PageImage[]> {
  let doc: Awaited<ReturnType<typeof renderPdf>>;
  try {
    doc = await renderPdf(buffer, {
      scale: PDF_RENDER_SCALE,
      format: PDF_RENDER_FORMAT,
      docInitParams: { standardFontDataUrl, cMapUrl, cMapPacked: true },
    });
  } catch {
    throw new Error("Could not read the PDF file — it may be corrupted, password-protected, or not a valid PDF.");
  }

  try {
    if (doc.length === 0) {
      throw new Error("The PDF has no pages.");
    }

    const pages: PageImage[] = [];
    let pageNumber = 1;
    for await (const imageBuffer of doc) {
      const { width, height } = getImageDimensions(imageBuffer, PDF_RENDER_MIME_TYPE);
      pages.push({ pageNumber, imageBuffer, width, height, mimeType: PDF_RENDER_MIME_TYPE });
      pageNumber++;
    }
    return pages;
  } catch (error) {
    if (error instanceof Error) throw error;
    throw new Error("Failed to render one or more pages of the PDF.");
  } finally {
    await doc.destroy();
  }
}

function imageToImages(buffer: Buffer, mimeType: string): PageImage[] {
  try {
    const { width, height } = getImageDimensions(buffer, mimeType);
    // Safe: the caller already checked mimeType against SUPPORTED_IMAGE_MIME_TYPES.
    return [{ pageNumber: 1, imageBuffer: buffer, width, height, mimeType: mimeType as "image/png" | "image/jpeg" }];
  } catch {
    throw new Error("Could not read the image file — it may be corrupted or is not a valid PNG/JPEG.");
  }
}
