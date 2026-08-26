import { NextRequest, NextResponse } from "next/server";
import { fileToImages, type PageImage } from "@/lib/fileToImages";
import { extractQuestions } from "@/lib/extractQuestions";
import type { PageImageData, ProcessedFile, ProcessResponse } from "@/types/processing";

// @napi-rs/canvas (used for PDF rasterization) relies on native bindings, so this
// route must run on the Node.js runtime rather than the Edge runtime.
export const runtime = "nodejs";

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const ACCEPTED_MIME_TYPES = new Set(["application/pdf", "image/png", "image/jpeg"]);

function validateUpload(entry: FormDataEntryValue | null, label: string): string | null {
  if (!entry || typeof entry === "string") return `${label} is required.`;
  if (!ACCEPTED_MIME_TYPES.has(entry.type)) return `${label} must be a PDF, PNG, or JPG file.`;
  if (entry.size > MAX_FILE_SIZE_BYTES) return `${label} exceeds the 10MB limit.`;
  return null;
}

async function rasterizeUpload(file: File): Promise<PageImage[]> {
  const buffer = Buffer.from(await file.arrayBuffer());
  return fileToImages(buffer, file.type);
}

function toProcessedFile(pages: PageImage[], sourceMimeType: string): ProcessedFile {
  const outputMimeType = sourceMimeType === "application/pdf" ? "image/png" : (sourceMimeType as "image/png" | "image/jpeg");

  const pageData: PageImageData[] = pages.map((page) => ({
    pageNumber: page.pageNumber,
    width: page.width,
    height: page.height,
    mimeType: outputMimeType,
    imageBase64: page.imageBuffer.toString("base64"),
  }));

  return { pageCount: pageData.length, pages: pageData };
}

export async function POST(request: NextRequest) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Could not read the uploaded form data." }, { status: 400 });
  }

  const questionPaperEntry = formData.get("questionPaper");
  const answerSheetEntry = formData.get("answerSheet");

  const validationErrors = [
    validateUpload(questionPaperEntry, "Question paper"),
    validateUpload(answerSheetEntry, "Answer sheet"),
  ].filter((message): message is string => message !== null);

  if (validationErrors.length > 0 || !(questionPaperEntry instanceof File) || !(answerSheetEntry instanceof File)) {
    return NextResponse.json({ error: validationErrors.join(" ") }, { status: 400 });
  }

  try {
    const [questionPaperPages, answerSheetPages] = await Promise.all([
      rasterizeUpload(questionPaperEntry),
      rasterizeUpload(answerSheetEntry),
    ]);

    const questions = await extractQuestions(questionPaperPages);

    const response: ProcessResponse = {
      questionPaper: toProcessedFile(questionPaperPages, questionPaperEntry.type),
      answerSheet: toProcessedFile(answerSheetPages, answerSheetEntry.type),
      questions,
    };
    return NextResponse.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to process the uploaded files.";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
