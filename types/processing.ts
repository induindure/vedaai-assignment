import type { ExtractedQuestion } from "@/lib/extractQuestions";
import type { ExtractedAnswerBlock } from "@/lib/extractAnswers";
import type { MappingResult } from "@/lib/mapAnswers";

export interface PageImageData {
  pageNumber: number;
  width: number;
  height: number;
  /** MIME type of imageBase64 — always "image/png" for rasterized PDF pages. */
  mimeType: "image/png" | "image/jpeg";
  imageBase64: string;
}

export interface ProcessedFile {
  pageCount: number;
  pages: PageImageData[];
}

export interface ProcessResponse {
  questionPaper: ProcessedFile;
  answerSheet: ProcessedFile;
  questions: ExtractedQuestion[];
  answers: ExtractedAnswerBlock[];
  mapping: MappingResult;
}

export interface ProcessErrorResponse {
  error: string;
}
