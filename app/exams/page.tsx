"use client";

import { useState } from "react";
import UploadScreen from "@/components/UploadScreen";
import ResultsScreen from "@/components/ResultsScreen";
import { useAppShell } from "@/lib/app-shell-context";
import type { ProcessResponse } from "@/types/processing";

/**
 * The upload -> results flow. There's no persistent storage yet, so the API response is
 * just kept in memory here — swapping straight to ResultsScreen rather than a separate
 * route avoids needing to pass a multi-megabyte payload (base64 page images) through a URL.
 */
function ExamsFlow() {
  const [result, setResult] = useState<ProcessResponse | null>(null);

  if (result) {
    return <ResultsScreen data={result} onBack={() => setResult(null)} />;
  }

  return <UploadScreen onProcessed={setResult} />;
}

export default function ExamsPage() {
  // Keyed by the shared sidebar's reset signal (see AppShellContext) so clicking "Exams" in
  // the sidebar while already on this page — which doesn't itself change the URL — still
  // remounts the flow and starts over, the same as navigating here fresh would.
  const { resetSignal } = useAppShell();
  return <ExamsFlow key={resetSignal} />;
}
