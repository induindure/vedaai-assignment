export type FileKind = "pdf" | "image";

export interface UploadedFileMeta {
  file: File;
  name: string;
  sizeLabel: string;
  kind: FileKind;
  /** Only populated for PDFs where page-count extraction succeeded. */
  pageCount?: number;
}

export type UploadSlot = "questionPaper" | "answerSheet";
