import type { ExtractedQuestion } from "@/lib/extractQuestions";
import type { ExtractedAnswerBlock } from "@/lib/extractAnswers";
import type { AnswerBlock, MappedQuestion } from "@/lib/mapAnswers";
import type { Grading } from "@/lib/gradeAnswer";

export interface PageImageData {
  pageNumber: number;
  width: number;
  height: number;
  /** MIME type of imageBase64 — "image/jpeg" for rasterized PDF pages, or the original upload's type for direct image uploads. */
  mimeType: "image/png" | "image/jpeg";
  imageBase64: string;
}

export interface ProcessedFile {
  pageCount: number;
  pages: PageImageData[];
}

/**
 * A mapped question enriched with its grading. `grading` is null only if grading failed
 * outright for the whole paper (Gemini unavailable) — the API route degrades gracefully by
 * still returning the (already valuable) mapping result rather than failing the request.
 */
export interface GradedMappedQuestion extends MappedQuestion {
  grading: Grading | null;
}

export interface GradedMappingResult {
  mappedQuestions: GradedMappedQuestion[];
  unmatchedAnswers: AnswerBlock[];
}

export interface ProcessResponse {
  questionPaper: ProcessedFile;
  answerSheet: ProcessedFile;
  questions: ExtractedQuestion[];
  answers: ExtractedAnswerBlock[];
  mapping: GradedMappingResult;
}

export interface ProcessErrorResponse {
  error: string;
}

/**
 * /api/process streams newline-delimited JSON events of this shape instead of a single JSON
 * body, so the frontend can show real progress text as each stage completes without the
 * server having to give up on running the two documents' pipelines concurrently (splitting
 * this into several back-to-back requests would force them to run sequentially instead).
 */
export type ProcessStreamEvent =
  | { type: "progress"; message: string }
  | { type: "result"; data: ProcessResponse }
  | { type: "error"; message: string };
