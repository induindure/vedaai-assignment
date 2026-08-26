"use client";

import { useId, useRef, useState, type ChangeEvent, type DragEvent, type KeyboardEvent } from "react";
import { ArrowUp, Image as ImageIcon, Loader2, X } from "lucide-react";
import { ACCEPTED_FILE_EXTENSIONS, formatFileSize, getPdfPageCount, validateFile } from "@/lib/file-utils";
import type { UploadedFileMeta } from "@/types/upload";

interface FileUploadBoxProps {
  subject: string;
  value: UploadedFileMeta | null;
  onFileAccepted: (meta: UploadedFileMeta) => void;
  onRemove: () => void;
}

export default function FileUploadBox({ subject, value, onFileAccepted, onRemove }: FileUploadBoxProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const processFile = async (file: File) => {
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setIsProcessing(true);
    const isPdf = file.type === "application/pdf";
    const pageCount = isPdf ? await getPdfPageCount(file) : undefined;
    setIsProcessing(false);
    onFileAccepted({
      file,
      name: file.name,
      sizeLabel: formatFileSize(file.size),
      kind: isPdf ? "pdf" : "image",
      pageCount,
    });
  };

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) void processFile(file);
  };

  const openPicker = () => {
    if (!value && !isProcessing) inputRef.current?.click();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openPicker();
    }
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!value) setIsDragActive(true);
  };

  const handleDragLeave = () => setIsDragActive(false);

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragActive(false);
    if (value) return;
    const file = event.dataTransfer.files?.[0];
    if (file) void processFile(file);
  };

  const handleRemove = () => {
    setError(null);
    onRemove();
  };

  return (
    <div className="w-full">
      <div
        role={value ? undefined : "button"}
        tabIndex={value ? undefined : 0}
        onClick={value ? undefined : openPicker}
        onKeyDown={value ? undefined : handleKeyDown}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative flex min-h-[220px] flex-col items-center justify-center gap-3 rounded-2xl border-2 px-6 py-8 text-center transition-colors sm:min-h-[240px] ${
          value
            ? "border-solid border-neutral-200 bg-white"
            : isDragActive
              ? "cursor-pointer border-dashed border-orange-300 bg-orange-50/60"
              : "cursor-pointer border-dashed border-neutral-200 bg-white hover:border-neutral-300"
        }`}
      >
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept={ACCEPTED_FILE_EXTENSIONS}
          className="hidden"
          onChange={handleInputChange}
        />

        {value ? (
          <>
            <button
              type="button"
              onClick={handleRemove}
              aria-label={`Remove ${value.name}`}
              className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-neutral-100 text-neutral-500 transition-colors hover:bg-neutral-200 hover:text-neutral-700"
            >
              <X size={14} />
            </button>

            {value.kind === "pdf" ? (
              <span className="flex h-11 w-14 items-center justify-center rounded-lg bg-red-50 text-[11px] font-bold tracking-wide text-red-500">
                PDF
              </span>
            ) : (
              <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-blue-50 text-blue-500">
                <ImageIcon size={20} />
              </span>
            )}

            <p className="max-w-[85%] truncate text-sm font-semibold text-neutral-800">{value.name}</p>
            <p className="text-xs text-neutral-400">
              {value.sizeLabel}
              {value.kind === "pdf" && value.pageCount
                ? ` • ${value.pageCount} ${value.pageCount === 1 ? "Page" : "Pages"}`
                : ""}
            </p>
          </>
        ) : isProcessing ? (
          <>
            <Loader2 size={22} className="animate-spin text-neutral-400" />
            <p className="text-sm font-medium text-neutral-500">Reading file…</p>
          </>
        ) : (
          <>
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-neutral-900 text-white">
              <ArrowUp size={18} />
            </span>
            <p className="text-sm font-medium text-neutral-700">
              Upload <span className="text-orange-500">{subject}</span>
            </p>
            <p className="text-xs text-neutral-400">Max 10MB</p>
          </>
        )}
      </div>
      {error && <p className="mt-2 text-center text-xs text-red-500 sm:text-left">{error}</p>}
    </div>
  );
}
