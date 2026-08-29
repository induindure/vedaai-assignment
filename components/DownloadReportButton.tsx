"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import type { GradedMappingResult } from "@/types/processing";

interface DownloadReportButtonProps {
  mapping: GradedMappingResult;
}

type DownloadState = "idle" | "loading" | "error";

/** Reads the server-chosen filename out of Content-Disposition; falls back if it's ever missing. */
function filenameFromResponse(response: Response): string {
  const disposition = response.headers.get("Content-Disposition");
  const match = disposition?.match(/filename="([^"]+)"/);
  return match?.[1] ?? "answer-sheet-report.pdf";
}

export default function DownloadReportButton({ mapping }: DownloadReportButtonProps) {
  const [state, setState] = useState<DownloadState>("idle");

  const handleDownload = async () => {
    setState("loading");
    try {
      const response = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mappedQuestions: mapping.mappedQuestions, unmatchedAnswers: mapping.unmatchedAnswers }),
      });
      if (!response.ok) throw new Error(`Report request failed with status ${response.status}`);

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filenameFromResponse(response);
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setState("idle");
    } catch (error) {
      console.error("Failed to download report:", error);
      setState("error");
    }
  };

  return (
    <button
      type="button"
      onClick={handleDownload}
      disabled={state === "loading"}
      className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-60 ${
        state === "error"
          ? "border-red-200 bg-red-50 text-red-600 hover:bg-red-100"
          : "border-neutral-200 text-neutral-600 hover:bg-neutral-50"
      }`}
    >
      {state === "loading" ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
      {state === "loading" ? "Generating…" : state === "error" ? "Try Again" : "Download Report"}
    </button>
  );
}
