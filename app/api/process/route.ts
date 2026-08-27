import { NextRequest, NextResponse } from "next/server";
import { fileToImages, type PageImage } from "@/lib/fileToImages";
import { extractQuestions } from "@/lib/extractQuestions";
import { extractAnswers } from "@/lib/extractAnswers";
import { mapAnswers } from "@/lib/mapAnswers";
import { gradeAnswers } from "@/lib/gradeAnswer";
import type { GradedMappedQuestion, PageImageData, ProcessedFile, ProcessResponse, ProcessStreamEvent } from "@/types/processing";

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

function toProcessedFile(pages: PageImage[]): ProcessedFile {
  const pageData: PageImageData[] = pages.map((page) => ({
    pageNumber: page.pageNumber,
    width: page.width,
    height: page.height,
    mimeType: page.mimeType,
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

  // From here on, work happens inside a streamed response rather than a single JSON body, so
  // the frontend can show progress text as each stage completes. This still keeps the two
  // documents' rasterize→extract pipelines fully concurrent (see processDocument below) —
  // the alternative of splitting this into several back-to-back requests for progress
  // reporting would force those pipelines to run sequentially instead, working against the
  // parallelism this same change is meant to add.
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: ProcessStreamEvent) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      };

      try {
        send({ type: "progress", message: "Converting pages..." });

        // Fires once, the first time either document finishes rasterizing and is about to
        // start extraction — whichever gets there first, since the two pipelines run
        // independently and can finish their own rasterization at different times.
        let announcedExtracting = false;
        const announceExtractingOnce = () => {
          if (announcedExtracting) return;
          announcedExtracting = true;
          send({ type: "progress", message: "Extracting questions and answers..." });
        };

        async function processDocument<T>(file: File, extract: (pages: PageImage[]) => Promise<T>) {
          const pages = await rasterizeUpload(file);
          announceExtractingOnce();
          const extracted = await extract(pages);
          return { pages, extracted };
        }

        const [questionPaperResult, answerSheetResult] = await Promise.all([
          processDocument(questionPaperEntry, extractQuestions),
          processDocument(answerSheetEntry, extractAnswers),
        ]);

        send({ type: "progress", message: "Mapping answers to questions..." });

        const mapping = await mapAnswers(questionPaperResult.extracted, answerSheetResult.extracted);

        send({ type: "progress", message: "Grading answers..." });

        // Grading is a bonus layer on top of an already-valuable mapping result. Unlike the
        // extraction/mapping stages above, a total grading failure (Gemini unavailable across
        // every configured key) doesn't fail the whole request — it'd be a shame to lose the
        // correctly-matched Q&A pairs over the one enhancement that isn't essential. Every
        // question just comes back with `grading: null`, which the frontend renders as
        // "ungraded" rather than a score.
        let gradedMappedQuestions: GradedMappedQuestion[];
        try {
          const gradings = await gradeAnswers(mapping.mappedQuestions);
          gradedMappedQuestions = mapping.mappedQuestions.map((mapped, index) => ({ ...mapped, grading: gradings[index] }));
        } catch (error) {
          console.error("Grading failed; returning the mapping result ungraded.", error);
          gradedMappedQuestions = mapping.mappedQuestions.map((mapped) => ({ ...mapped, grading: null }));
        }

        const result: ProcessResponse = {
          questionPaper: toProcessedFile(questionPaperResult.pages),
          answerSheet: toProcessedFile(answerSheetResult.pages),
          questions: questionPaperResult.extracted,
          answers: answerSheetResult.extracted,
          mapping: { mappedQuestions: gradedMappedQuestions, unmatchedAnswers: mapping.unmatchedAnswers },
        };

        send({ type: "result", data: result });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to process the uploaded files.";
        send({ type: "error", message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache",
    },
  });
}
