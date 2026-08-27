"use client";

import { useRef, useState } from "react";
import { AlertTriangle, ArrowRight, Award, BookOpen, CheckCircle2, Loader2, RotateCcw, UserRound } from "lucide-react";
import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/TopBar";
import FileUploadBox from "@/components/FileUploadBox";
import type { UploadedFileMeta } from "@/types/upload";
import type { ProcessResponse, ProcessStreamEvent } from "@/types/processing";

type MappingStatus = "idle" | "processing" | "error";

interface UploadScreenProps {
  onProcessed: (data: ProcessResponse) => void;
}

/**
 * Reads /api/process's newline-delimited JSON event stream, calling `onProgress` as
 * "progress" events arrive and resolving with the payload once a "result" event arrives.
 */
async function readProcessStream(body: ReadableStream<Uint8Array>, onProgress: (message: string) => void): Promise<ProcessResponse> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result: ProcessResponse | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? ""; // last element may be an incomplete line — keep it for the next chunk

    for (const line of lines) {
      if (!line.trim()) continue;
      const event: ProcessStreamEvent = JSON.parse(line);

      if (event.type === "progress") {
        onProgress(event.message);
      } else if (event.type === "result") {
        result = event.data;
      } else {
        throw new Error(event.message);
      }
    }
  }

  if (!result) {
    throw new Error("The server closed the connection before finishing.");
  }
  return result;
}

export default function UploadScreen({ onProcessed }: UploadScreenProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [questionPaper, setQuestionPaper] = useState<UploadedFileMeta | null>(null);
  const [answerSheet, setAnswerSheet] = useState<UploadedFileMeta | null>(null);
  const [mappingStatus, setMappingStatus] = useState<MappingStatus>("idle");
  const [mappingMessage, setMappingMessage] = useState<string | null>(null);
  // Belt-and-suspenders against a double-click firing two requests: the disabled button
  // already covers the common case, but its DOM update lands a tick after the state update
  // that triggers it, so a fast enough second click could squeeze through. A ref updates
  // immediately (no render/batching delay), so it can't race the same way.
  const isSubmittingRef = useRef(false);

  const bothUploaded = !!questionPaper && !!answerSheet;
  const canStartMapping = bothUploaded && mappingStatus !== "processing";

  const resetMappingStatus = () => {
    setMappingStatus("idle");
    setMappingMessage(null);
  };

  const handleStartMapping = async () => {
    if (!questionPaper || !answerSheet || isSubmittingRef.current) return;
    isSubmittingRef.current = true;

    setMappingStatus("processing");
    setMappingMessage("Converting pages...");

    try {
      const formData = new FormData();
      formData.append("questionPaper", questionPaper.file);
      formData.append("answerSheet", answerSheet.file);

      const response = await fetch("/api/process", { method: "POST", body: formData });

      if (!response.ok) {
        // Only the synchronous validation path (bad file type, missing file, etc.) responds
        // this way — once streaming has started the response is always 200, with success/
        // failure communicated through the stream's own "result"/"error" events instead.
        const body = await response.json().catch(() => null);
        throw new Error(body?.error ?? "Failed to process the uploaded files.");
      }
      if (!response.body) {
        throw new Error("The server did not return a response body.");
      }

      const data = await readProcessStream(response.body, setMappingMessage);

      console.log("Processing complete:", data);
      // mappingStatus stays "processing" here on purpose — the parent immediately swaps this
      // screen out for ResultsScreen, so there's no "done" state of this screen to render.
      onProcessed(data);
    } catch (error) {
      console.error("Processing failed:", error);
      setMappingStatus("error");
      setMappingMessage(error instanceof Error ? error.message : "Something went wrong while processing the files.");
    } finally {
      isSubmittingRef.current = false;
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex min-h-screen flex-col lg:pl-[220px]">
        <TopBar onMenuClick={() => setSidebarOpen(true)} />

        <main className="flex flex-1 justify-center px-4 py-10 sm:px-8 sm:py-14">
          {mappingStatus === "processing" ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
              <Loader2 size={36} className="animate-spin text-neutral-400" />
              <div>
                <p className="text-base font-semibold text-neutral-800">{mappingMessage ?? "Processing…"}</p>
                <p className="mt-1 max-w-xs text-sm text-neutral-500">This can take a minute.</p>
              </div>
            </div>
          ) : mappingStatus === "error" ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-500">
                <AlertTriangle size={26} />
              </span>
              <div>
                <p className="text-base font-semibold text-neutral-800">Something went wrong</p>
                <p className="mt-1 max-w-sm text-sm text-neutral-500">{mappingMessage}</p>
              </div>
              <div className="mt-1 flex items-center gap-4">
                <button
                  type="button"
                  onClick={handleStartMapping}
                  className="flex items-center gap-2 rounded-full bg-neutral-900 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-neutral-800"
                >
                  <RotateCcw size={15} />
                  Try Again
                </button>
                <button
                  type="button"
                  onClick={resetMappingStatus}
                  className="text-sm font-medium text-neutral-500 transition-colors hover:text-neutral-700 hover:underline"
                >
                  Change files
                </button>
              </div>
            </div>
          ) : (
            <div className="w-full max-w-[950px]">
              <h1 className="text-center text-2xl font-bold leading-snug text-neutral-900 sm:text-3xl">
                Upload{" "}
                <span className="inline-block rounded-2xl bg-[#FBEAD3] px-3 py-1 text-[#D9782F]">
                  Question Paper &amp; Answer Sheets
                </span>
              </h1>
              <p className="mt-3 text-center text-sm text-neutral-500">Upload both files to get started</p>

              <div className="relative mx-auto my-8 flex h-36 w-36 items-center justify-center sm:h-44 sm:w-44">
                <div className="absolute inset-0 rounded-full bg-gradient-to-br from-orange-200 via-orange-100 to-transparent blur-2xl" />
                <div className="relative flex h-28 w-28 items-center justify-center rounded-full bg-white shadow-sm ring-4 ring-white sm:h-32 sm:w-32">
                  <UserRound className="h-14 w-14 text-orange-400 sm:h-16 sm:w-16" strokeWidth={1.5} />
                </div>

                <span className="absolute -top-1 left-1 flex h-8 w-8 items-center justify-center rounded-full bg-white text-orange-500 shadow ring-1 ring-neutral-100">
                  <BookOpen size={14} />
                </span>
                <span className="absolute top-3 -right-2 flex h-8 w-8 items-center justify-center rounded-full bg-white text-emerald-500 shadow ring-1 ring-neutral-100">
                  <CheckCircle2 size={14} />
                </span>
                <span className="absolute bottom-0 -left-3 flex h-7 w-7 items-center justify-center rounded-full bg-white text-amber-500 shadow ring-1 ring-neutral-100">
                  <Award size={13} />
                </span>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FileUploadBox
                  subject="Question Paper"
                  value={questionPaper}
                  onFileAccepted={(meta) => {
                    setQuestionPaper(meta);
                    resetMappingStatus();
                  }}
                  onRemove={() => {
                    setQuestionPaper(null);
                    resetMappingStatus();
                  }}
                />
                <FileUploadBox
                  subject="Answer Sheet"
                  value={answerSheet}
                  onFileAccepted={(meta) => {
                    setAnswerSheet(meta);
                    resetMappingStatus();
                  }}
                  onRemove={() => {
                    setAnswerSheet(null);
                    resetMappingStatus();
                  }}
                />
              </div>

              <div className="mt-8 flex flex-col items-center">
                <button
                  type="button"
                  disabled={!canStartMapping}
                  onClick={handleStartMapping}
                  className={`flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold transition-colors ${
                    canStartMapping
                      ? "cursor-pointer bg-neutral-900 text-white hover:bg-neutral-800"
                      : "cursor-not-allowed bg-neutral-100 text-neutral-400"
                  }`}
                >
                  Start Mapping
                  <ArrowRight size={16} />
                </button>
                {/* mappingMessage is only ever non-null while "processing" or "error", both of
                    which render their own dedicated view above instead of this form. */}
                <p className="mt-3 max-w-sm text-center text-xs text-neutral-400">
                  Once both files are uploaded, you&apos;ll able to map answers with questions
                </p>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
