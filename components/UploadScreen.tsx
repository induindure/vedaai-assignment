"use client";

import { useState } from "react";
import { ArrowRight, Award, BookOpen, CheckCircle2, Loader2, UserRound } from "lucide-react";
import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/TopBar";
import FileUploadBox from "@/components/FileUploadBox";
import type { UploadedFileMeta } from "@/types/upload";
import type { ProcessErrorResponse, ProcessResponse } from "@/types/processing";

type MappingStatus = "idle" | "processing" | "done" | "error";

export default function UploadScreen() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [questionPaper, setQuestionPaper] = useState<UploadedFileMeta | null>(null);
  const [answerSheet, setAnswerSheet] = useState<UploadedFileMeta | null>(null);
  const [mappingStatus, setMappingStatus] = useState<MappingStatus>("idle");
  const [mappingMessage, setMappingMessage] = useState<string | null>(null);

  const bothUploaded = !!questionPaper && !!answerSheet;
  const canStartMapping = bothUploaded && mappingStatus !== "processing";

  const resetMappingStatus = () => {
    setMappingStatus("idle");
    setMappingMessage(null);
  };

  const handleStartMapping = async () => {
    if (!questionPaper || !answerSheet) return;

    setMappingStatus("processing");
    setMappingMessage(null);

    try {
      const formData = new FormData();
      formData.append("questionPaper", questionPaper.file);
      formData.append("answerSheet", answerSheet.file);

      const response = await fetch("/api/process", { method: "POST", body: formData });
      const data: ProcessResponse | ProcessErrorResponse = await response.json();

      if (!response.ok || "error" in data) {
        const errorMessage = "error" in data ? data.error : "Failed to process the uploaded files.";
        throw new Error(errorMessage);
      }

      console.log("Processing complete:", data);
      console.log("Extracted questions:", data.questions);
      console.log("Extracted answers:", data.answers);
      setMappingStatus("done");
      setMappingMessage("Processing complete, check console.");
    } catch (error) {
      console.error("Processing failed:", error);
      setMappingStatus("error");
      setMappingMessage(error instanceof Error ? error.message : "Something went wrong while processing the files.");
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex min-h-screen flex-col lg:pl-[220px]">
        <TopBar onMenuClick={() => setSidebarOpen(true)} />

        <main className="flex flex-1 justify-center px-4 py-10 sm:px-8 sm:py-14">
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
                {mappingStatus === "processing" ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Processing…
                  </>
                ) : (
                  <>
                    Start Mapping
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
              <p
                className={`mt-3 max-w-sm text-center text-xs ${
                  mappingStatus === "error"
                    ? "text-red-500"
                    : mappingStatus === "done"
                      ? "text-emerald-600"
                      : "text-neutral-400"
                }`}
              >
                {mappingMessage ?? "Once both files are uploaded, you'll able to map answers with questions"}
              </p>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
