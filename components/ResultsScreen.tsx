"use client";

import { useMemo, useState } from "react";
import TopBar from "@/components/TopBar";
import QuestionList from "@/components/QuestionList";
import AnswerSheetViewer, { type HighlightRegion } from "@/components/AnswerSheetViewer";
import type { ProcessResponse } from "@/types/processing";

interface ResultsScreenProps {
  data: ProcessResponse;
  onBack: () => void;
}

type MobileTab = "questions" | "answers";

export default function ResultsScreen({ data, onBack }: ResultsScreenProps) {
  const { mappedQuestions, unmatchedAnswers } = data.mapping;
  const pages = data.answerSheet.pages;

  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [activeTab, setActiveTab] = useState<MobileTab>("questions");

  const handleSelectQuestion = (index: number) => {
    const blocks = mappedQuestions[index]?.answerBlocks;
    if (!blocks || blocks.length === 0) return;
    setSelectedKey(`q-${index}`);
    setCurrentPage(blocks[0].pages[0]);
    setActiveTab("answers");
  };

  const handleSelectUnmatched = (index: number) => {
    const block = unmatchedAnswers[index];
    if (!block) return;
    setSelectedKey(`u-${index}`);
    setCurrentPage(block.pages[0]);
    setActiveTab("answers");
  };

  const handleJumpToPage = (page: number) => {
    setCurrentPage(page);
    setActiveTab("answers");
  };

  const highlightRegions: HighlightRegion[] = useMemo(() => {
    if (!selectedKey) return [];
    const [kind, indexText] = selectedKey.split("-");
    const index = Number(indexText);

    if (kind === "q") {
      const blocks = mappedQuestions[index]?.answerBlocks ?? [];
      return blocks.flatMap((block) =>
        block.pages.map((page, i) => ({ page, bbox: block.bboxes[i], color: "emerald" as const })),
      );
    }
    if (kind === "u") {
      const block = unmatchedAnswers[index];
      if (!block) return [];
      return block.pages.map((page, i) => ({ page, bbox: block.bboxes[i], color: "amber" as const }));
    }
    return [];
  }, [selectedKey, mappedQuestions, unmatchedAnswers]);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-neutral-50">
      <TopBar onBack={onBack} />

      <div className="flex gap-2 border-b border-neutral-200 bg-white px-4 py-3 lg:hidden">
        <button
          type="button"
          onClick={() => setActiveTab("questions")}
          className={`flex-1 rounded-full py-2 text-sm font-medium transition-colors ${
            activeTab === "questions" ? "bg-neutral-900 text-white" : "bg-neutral-100 text-neutral-500"
          }`}
        >
          Questions
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("answers")}
          className={`flex-1 rounded-full py-2 text-sm font-medium transition-colors ${
            activeTab === "answers" ? "bg-neutral-900 text-white" : "bg-neutral-100 text-neutral-500"
          }`}
        >
          Answer Sheet
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-hidden p-4 lg:flex-row lg:p-6">
        <div className={`min-h-0 flex-1 flex-col lg:flex lg:w-[45%] lg:flex-none ${activeTab === "questions" ? "flex" : "hidden"}`}>
          <QuestionList
            mappedQuestions={mappedQuestions}
            unmatchedAnswers={unmatchedAnswers}
            selectedKey={selectedKey}
            onSelectQuestion={handleSelectQuestion}
            onSelectUnmatched={handleSelectUnmatched}
            onJumpToPage={handleJumpToPage}
          />
        </div>

        <div className={`min-h-0 flex-1 flex-col lg:flex lg:w-[55%] lg:flex-none ${activeTab === "answers" ? "flex" : "hidden"}`}>
          <AnswerSheetViewer
            pages={pages}
            currentPage={currentPage}
            onPageChange={setCurrentPage}
            zoom={zoom}
            onZoomChange={setZoom}
            highlightRegions={highlightRegions}
          />
        </div>
      </div>
    </div>
  );
}
