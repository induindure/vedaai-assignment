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
}

export interface ProcessErrorResponse {
  error: string;
}
