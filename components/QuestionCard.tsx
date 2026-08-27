"use client";

import { ChevronDown, Flag, Sparkles } from "lucide-react";
import type { MatchStatus } from "@/lib/mapAnswers";
import type { Grading } from "@/lib/gradeAnswer";
import type { GradedMappedQuestion } from "@/types/processing";

interface QuestionCardProps {
  mapped: GradedMappedQuestion;
  index: number;
  isSelected: boolean;
  isExpanded: boolean;
  onSelect: (index: number) => void;
  onJumpToPage: (page: number) => void;
}

const VERDICT_BADGE_CLASSES: Record<Grading["verdict"], string> = {
  correct: "bg-emerald-100 text-emerald-700",
  partial: "bg-amber-100 text-amber-700",
  incorrect: "bg-red-100 text-red-700",
  unanswered: "bg-neutral-100 text-neutral-400",
};

function ScoreBadge({ grading }: { grading: Grading | null }) {
  if (!grading) {
    return <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-semibold text-neutral-400">Ungraded</span>;
  }
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${VERDICT_BADGE_CLASSES[grading.verdict]}`}>
      {grading.score}/{grading.maxScore}
    </span>
  );
}

function OutOfOrderFlag({ status }: { status: MatchStatus }) {
  if (status !== "out-of-order") return null;
  return (
    <span
      title="This answer appears out of order on the answer sheet"
      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600"
    >
      <Flag size={11} strokeWidth={2.5} />
    </span>
  );
}

export default function QuestionCard({ mapped, index, isSelected, isExpanded, onSelect, onJumpToPage }: QuestionCardProps) {
  const { question, answerBlocks, status, matchConfidence, grading } = mapped;
  const label = question.subpart ? `${question.questionNumber}${question.subpart}` : question.questionNumber;
  const isInteractive = status !== "unanswered" && !!answerBlocks;

  const distinctPages = answerBlocks
    ? Array.from(new Set(answerBlocks.flatMap((block) => block.pages))).sort((a, b) => a - b)
    : [];

  return (
    <div
      className={`rounded-2xl border transition-colors ${
        isSelected ? "border-emerald-300 bg-emerald-50/60" : "border-neutral-200 bg-white"
      }`}
    >
      <button
        type="button"
        onClick={() => isInteractive && onSelect(index)}
        disabled={!isInteractive}
        className={`flex w-full items-start gap-3 rounded-2xl p-3.5 text-left ${
          isInteractive ? "cursor-pointer hover:bg-neutral-50" : "cursor-default"
        }`}
      >
        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
            status === "unanswered" ? "bg-neutral-200 text-neutral-500" : "bg-neutral-900 text-white"
          }`}
        >
          {label}
        </span>

        <span className="min-w-0 flex-1 pt-0.5">
          <span className={`block text-sm leading-snug text-neutral-700 ${isExpanded ? "" : "line-clamp-2"}`}>
            {question.text}
          </span>
        </span>

        <span className="mt-1 flex shrink-0 items-center gap-1.5">
          <OutOfOrderFlag status={status} />
          <ScoreBadge grading={grading} />
          {isInteractive && (
            <ChevronDown size={14} className={`text-neutral-400 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
          )}
        </span>
      </button>

      {isExpanded && answerBlocks && (
        <div className="space-y-2 border-t border-neutral-100 px-3.5 pb-3.5 pt-3">
          {matchConfidence && (
            <p className="text-[11px] font-medium uppercase tracking-wide text-neutral-400">
              {matchConfidence === "direct" ? "Matched by label" : "Matched by content (AI)"}
            </p>
          )}

          {answerBlocks.map((block, blockIndex) => (
            <p key={blockIndex} className="rounded-xl bg-neutral-50 px-3 py-2 text-xs leading-relaxed text-neutral-600">
              {block.text}
            </p>
          ))}

          {grading?.feedback && (
            <div className="rounded-xl bg-violet-50 px-3 py-2.5">
              <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-violet-500">
                <Sparkles size={11} />
                AI Feedback
              </p>
              <p className="text-xs leading-relaxed text-violet-900">{grading.feedback}</p>
            </div>
          )}

          {distinctPages.length > 1 && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[11px] text-neutral-400">Spans pages:</span>
              {distinctPages.map((page) => (
                <button
                  key={page}
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onJumpToPage(page);
                  }}
                  className="rounded-full border border-neutral-200 px-2 py-0.5 text-[11px] font-medium text-neutral-600 transition-colors hover:bg-neutral-100"
                >
                  Page {page}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
