import type { GradedMappedQuestion } from "@/types/processing";

interface GradingSummaryProps {
  mappedQuestions: GradedMappedQuestion[];
}

function BreakdownItem({ colorClassName, count, label }: { colorClassName: string; count: number; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${colorClassName}`} />
      {count} {label}
    </span>
  );
}

export default function GradingSummary({ mappedQuestions }: GradingSummaryProps) {
  const gradings = mappedQuestions.map((mapped) => mapped.grading).filter((grading) => grading !== null);

  // Either every question got graded or (on a total grading failure) none did — see route.ts.
  if (gradings.length === 0) return null;

  const totalScore = gradings.reduce((sum, grading) => sum + grading.score, 0);
  const totalMaxScore = gradings.reduce((sum, grading) => sum + grading.maxScore, 0);

  const counts = { correct: 0, partial: 0, incorrect: 0, unanswered: 0 };
  for (const grading of gradings) counts[grading.verdict]++;

  return (
    <div className="mb-4 rounded-2xl border border-neutral-200 bg-white p-4">
      <p className="text-xs font-medium text-neutral-400">Total Score</p>
      <p className="mt-0.5 text-2xl font-bold text-neutral-900">
        {totalScore}
        <span className="text-base font-medium text-neutral-400">/{totalMaxScore}</span>
      </p>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-neutral-500">
        <BreakdownItem colorClassName="bg-emerald-500" count={counts.correct} label="correct" />
        <BreakdownItem colorClassName="bg-amber-500" count={counts.partial} label="partial" />
        <BreakdownItem colorClassName="bg-red-500" count={counts.incorrect} label="incorrect" />
        <BreakdownItem colorClassName="bg-neutral-300" count={counts.unanswered} label="unanswered" />
      </div>
    </div>
  );
}
