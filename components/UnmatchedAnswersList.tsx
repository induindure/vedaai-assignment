"use client";

import type { AnswerBlock } from "@/lib/mapAnswers";

interface UnmatchedAnswersListProps {
  unmatchedAnswers: AnswerBlock[];
  selectedKey: string | null;
  onSelect: (index: number) => void;
}

export default function UnmatchedAnswersList({ unmatchedAnswers, selectedKey, onSelect }: UnmatchedAnswersListProps) {
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-3.5">
      <p className="mb-2.5 text-xs font-semibold text-amber-700">
        Unmatched Answers <span className="font-normal text-amber-600/70">({unmatchedAnswers.length})</span>
      </p>
      <div className="space-y-2">
        {unmatchedAnswers.map((block, index) => {
          const key = `u-${index}`;
          const isSelected = selectedKey === key;
          return (
            <button
              key={index}
              type="button"
              onClick={() => onSelect(index)}
              className={`block w-full rounded-xl border px-3 py-2 text-left text-xs leading-relaxed transition-colors ${
                isSelected ? "border-amber-400 bg-amber-100 text-amber-900" : "border-amber-200/70 bg-white text-neutral-600 hover:bg-amber-50"
              }`}
            >
              {block.detectedLabel && <span className="mr-1.5 font-semibold text-amber-700">{block.detectedLabel}:</span>}
              {block.text}
            </button>
          );
        })}
      </div>
    </div>
  );
}
