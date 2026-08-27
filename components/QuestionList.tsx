"use client";

import { useState } from "react";
import { ChevronsDownUp, ChevronsUpDown } from "lucide-react";
import QuestionCard from "@/components/QuestionCard";
import UnmatchedAnswersList from "@/components/UnmatchedAnswersList";
import type { AnswerBlock, MappedQuestion } from "@/lib/mapAnswers";

interface QuestionListProps {
  mappedQuestions: MappedQuestion[];
  unmatchedAnswers: AnswerBlock[];
  selectedKey: string | null;
  onSelectQuestion: (index: number) => void;
  onSelectUnmatched: (index: number) => void;
  onJumpToPage: (page: number) => void;
}

export default function QuestionList({
  mappedQuestions,
  unmatchedAnswers,
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

  // Selecting a card always expands it (never collapses on click) — clicking should reveal
  // the mapping detail and drive the right panel, not require a second click to see anything.
  // Bulk collapse is handled solely by the "Collapse All" toggle above.
  const handleSelect = (index: number) => {
    setExpandedIndices((prev) => new Set(prev).add(index));
    onSelectQuestion(index);
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between gap-3 border-b border-neutral-100 px-1 pb-4">
        <h2 className="text-sm font-semibold text-neutral-800">
          Extracted Questions <span className="font-normal text-neutral-400">(from question paper)</span>
        </h2>
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

      <div className="mt-4 flex-1 space-y-2.5 overflow-y-auto pr-1">
        {mappedQuestions.length === 0 && (
          <p className="py-8 text-center text-sm text-neutral-400">No questions were found in the question paper.</p>
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
  );
}
