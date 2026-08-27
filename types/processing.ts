import type { ExtractedQuestion } from "@/lib/extractQuestions";
import type { ExtractedAnswerBlock } from "@/lib/extractAnswers";

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
}

export interface ProcessErrorResponse {
  error: string;
}
