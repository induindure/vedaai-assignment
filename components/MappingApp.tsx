"use client";

import { useState } from "react";
import UploadScreen from "@/components/UploadScreen";
import ResultsScreen from "@/components/ResultsScreen";
import type { ProcessResponse } from "@/types/processing";

/**
 * Top-level screen switcher. There's no persistent storage yet, so the API response is
 * just kept in memory here — swapping straight to ResultsScreen rather than a separate
 * route avoids needing to pass a multi-megabyte payload (base64 page images) through a URL.
 */
export default function MappingApp() {
  const [result, setResult] = useState<ProcessResponse | null>(null);

  if (result) {
    return <ResultsScreen data={result} onBack={() => setResult(null)} />;
  }

  return <UploadScreen onProcessed={setResult} />;
}
