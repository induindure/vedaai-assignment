"use client";

import { useState } from "react";
import { ChevronsDownUp, ChevronsUpDown, Info } from "lucide-react";
import QuestionCard from "@/components/QuestionCard";
import UnmatchedAnswersList from "@/components/UnmatchedAnswersList";
import GradingSummary from "@/components/GradingSummary";
import DownloadReportButton from "@/components/DownloadReportButton";
import type { AnswerBlock } from "@/lib/mapAnswers";
import type { GradedMappedQuestion } from "@/types/processing";

interface QuestionListProps {
  mappedQuestions: GradedMappedQuestion[];
  unmatchedAnswers: AnswerBlock[];
  /** True when the answer sheet yielded zero handwritten blocks at all (e.g. a blank page). */
  noAnswersDetected: boolean;
  selectedKey: string | null;
  onSelectQuestion: (index: number) => void;
  onSelectUnmatched: (index: number) => void;
  onJumpToPage: (page: number) => void;
}

export default function QuestionList({
  mappedQuestions,
  unmatchedAnswers,
  noAnswersDetected,
  selectedKey,
  onSelectQuestion,
  onSelectUnmatched,
  onJumpToPage,
}: QuestionListProps) {
  const [expandedIndices, setExpandedIndices] = useState<Set<number>>(new Set());

  const eligibleIndices = mappedQuestions
    .map((mapped, index) => (mapped.answerBlocks ? index : null))
    .filter((index): index is number => index !== null);
  const allExpanded = eligibleIndices.length > 0 && eligibleIndices.every((index) => expandedIndices.has(index));

  const toggleExpandAll = () => {
    setExpandedIndices(allExpanded ? new Set() : new Set(eligibleIndices));
  };

  // Clicking a card toggles its own expanded state (collapsed -> expanded -> collapsed on
  // repeated clicks), independent of selection: it's still selected/highlighted on the right
  // panel every time regardless of whether this click expanded or collapsed it. Bulk
  // expand/collapse is handled separately by the "Expand All"/"Collapse All" toggle above.
  const handleSelect = (index: number) => {
    setExpandedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
    onSelectQuestion(index);
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-neutral-100 px-1 pb-4">
        <h2 className="text-sm font-semibold text-neutral-800">
          Extracted Questions <span className="font-normal text-neutral-400">(from question paper)</span>
        </h2>
        <div className="flex shrink-0 items-center gap-2">
          <DownloadReportButton mapping={{ mappedQuestions, unmatchedAnswers }} />
          <button
            type="button"
            onClick={toggleExpandAll}
            disabled={eligibleIndices.length === 0}
            className="flex shrink-0 items-center gap-1.5 rounded-full border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-600 transition-colors hover:bg-neutral-50 disabled:opacity-40"
          >
            {allExpanded ? <ChevronsDownUp size={13} /> : <ChevronsUpDown size={13} />}
            {allExpanded ? "Collapse All" : "Expand All"}
          </button>
        </div>
      </div>

      <div className="mt-4 flex-1 overflow-y-auto pr-1">
        <GradingSummary mappedQuestions={mappedQuestions} />

        <div className="space-y-2.5">
          {mappedQuestions.length === 0 && (
            <p className="py-8 text-center text-sm text-neutral-400">No questions were found in the question paper.</p>
          )}

          {noAnswersDetected && mappedQuestions.length > 0 && (
            <div className="flex items-start gap-2 rounded-2xl border border-blue-200 bg-blue-50 px-3.5 py-3 text-xs text-blue-700">
              <Info size={15} className="mt-0.5 shrink-0" />
              <span>No answers were detected on the uploaded sheet — every question below is marked unanswered.</span>
            </div>
          )}

          {mappedQuestions.map((mapped, index) => (
            <QuestionCard
              key={index}
              mapped={mapped}
              index={index}
              isSelected={selectedKey === `q-${index}`}
              isExpanded={expandedIndices.has(index)}
              onSelect={handleSelect}
              onJumpToPage={onJumpToPage}
            />
          ))}

          {unmatchedAnswers.length > 0 && (
            <UnmatchedAnswersList unmatchedAnswers={unmatchedAnswers} selectedKey={selectedKey} onSelect={onSelectUnmatched} />
          )}
        </div>
      </div>
    </div>
  );
}
