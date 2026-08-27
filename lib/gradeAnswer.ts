import { z } from "zod";
import type { AnswerBlock, MappedQuestion } from "@/lib/mapAnswers";
import type { ExtractedQuestion } from "@/lib/extractQuestions";
import { generateJsonArrayFromText } from "@/lib/gemini";

export interface Grading {
  score: number;
  maxScore: number;
  verdict: "correct" | "partial" | "incorrect" | "unanswered";
  /** Always null for "unanswered" — there's no answer to comment on. */
  feedback: string | null;
}

// Fallback when a maxScore genuinely can't be determined (used directly for unanswered
// questions, and mirrored in the prompt as Gemini's own fallback for answered ones).
const DEFAULT_MAX_SCORE = 5;

const UNGRADED_FALLBACK_FEEDBACK = "This answer could not be automatically graded.";

/**
 * Best-effort read of a mark value already printed on the question (e.g. "[5 marks]",
 * "(10 points)"). Our extraction prompt asks Gemini to preserve such annotations verbatim in
 * the question text, so when present this is strictly more reliable than any complexity
 * heuristic — it's the real number, not a guess. Used directly for unanswered questions
 * (no Gemini call needed to grade nothing); answered questions ask Gemini to do the same
 * reading itself as part of grading (see buildGradePrompt), since it's already looking at
 * the full question there and can fall back to a complexity-based estimate in the same pass
 * when no explicit marks are printed.
 */
function parsePrintedMaxScore(questionText: string): number | null {
  const match = questionText.match(/(\d+)\s*(?:marks?|points?|pts?)\b/i);
  return match ? Number(match[1]) : null;
}

const RawGradingSchema = z
  .object({
    questionId: z.string(),
    score: z.number(),
    maxScore: z.number().positive(),
    verdict: z.enum(["correct", "partial", "incorrect"]),
    feedback: z.string(),
  })
  .refine((result) => result.score >= 0 && result.score <= result.maxScore, {
    message: "score must be between 0 and maxScore",
  });
const RawGradingArraySchema = z.array(RawGradingSchema);

const STRICT_RETRY_SUFFIX = `

Your previous response could not be parsed as valid JSON matching the required schema. Respond again with ONLY the raw JSON array — the very first character must be "[" and the very last must be "]" — and nothing else. Every object must include all five fields (questionId, score, maxScore, verdict, feedback) with the correct types, and score must be between 0 and maxScore.`;

interface GradeEntry {
  id: string;
  questionText: string;
  answerText: string;
}

function buildGradePrompt(strict: boolean, entries: GradeEntry[]): string {
  const list = entries.map(({ id, questionText, answerText }) => `${id}\nQuestion: ${questionText}\nStudent's answer: ${answerText}`).join("\n\n");

  const base = `You are grading a student's exam answers. For each question below, evaluate how well the student's answer addresses it.

${list}

For each question, determine:
- "maxScore": the maximum marks available for that question. If the question text includes an explicit marks value (e.g. "[5 marks]", "worth 10 marks", "(2 points)"), use exactly that number. Otherwise, infer a reasonable value from the question's apparent complexity: short factual/definition/recall questions are typically worth around 2, longer explanation/calculation/diagram questions around 5. If you genuinely can't tell, default to 5.
- "score": a number from 0 up to that question's maxScore, reflecting how correct and complete the answer is.
- "verdict": "correct" if the answer is essentially fully correct, "partial" if it's on the right track but incomplete or has errors, "incorrect" if it's wrong or doesn't address the question.
- "feedback": exactly 1-2 sentences of constructive feedback, written directly to the student (e.g. "You correctly identified..." rather than "The student..."). Be specific to what they actually wrote — reference their actual answer, don't give generic advice that could apply to any answer.

Output format:
Return ONLY a raw JSON array — no markdown code fences, no \`\`\`json, no explanation, and no other text before or after it. Include exactly one entry per question id listed above, in any order, each matching exactly this shape:
{ "questionId": string, "score": number, "maxScore": number, "verdict": "correct" | "partial" | "incorrect", "feedback": string }`;

  return strict ? base + STRICT_RETRY_SUFFIX : base;
}

interface GradableQuestion {
  index: number;
  question: ExtractedQuestion;
  answerBlocks: AnswerBlock[];
}

/**
 * Grades every answered (or out-of-order — still answered) question in one batched Gemini
 * call, combining each question's matched answer block(s) into a single answer text — one
 * call for the whole paper rather than one per question, the same batching principle used
 * for extraction and content-matching elsewhere in this app.
 *
 * Unanswered questions never reach Gemini — there's nothing to grade — and are graded
 * locally as { score: 0, verdict: "unanswered", feedback: null }, with maxScore read
 * straight off the question text so the grading summary's "total possible marks" stays
 * accurate even for questions the student skipped entirely.
 *
 * Returns one Grading per input MappedQuestion, in the same order. Throws (rather than
 * degrading gracefully) if the batched call fails outright — same policy as
 * extractQuestions/extractAnswers, since unlike the content-matching pass in mapAnswers.ts
 * there's no honest "ungraded" value within the required verdict shape to fall back to. The
 * caller (the API route) is the one that decides whether a grading failure should still let
 * the rest of the response (which is valuable on its own) through.
 */
export async function gradeAnswers(mappedQuestions: MappedQuestion[]): Promise<Grading[]> {
  const gradable: GradableQuestion[] = [];
  mappedQuestions.forEach((mapped, index) => {
    if (mapped.status !== "unanswered" && mapped.answerBlocks) {
      gradable.push({ index, question: mapped.question, answerBlocks: mapped.answerBlocks });
    }
  });

  const results: Grading[] = mappedQuestions.map((mapped, index) => {
    const gradableEntry = gradable.find((g) => g.index === index);
    if (!gradableEntry) {
      return { score: 0, maxScore: parsePrintedMaxScore(mapped.question.text) ?? DEFAULT_MAX_SCORE, verdict: "unanswered", feedback: null };
    }
    // Placeholder for a gradable question, overwritten below once Gemini responds. Left in
    // place only if the model omits this id from its response despite instructions to
    // include every one (rare — the strict-retry in generateJsonArrayFromText already
    // covers most malformed-response cases). "incorrect"/0 is a deliberately conservative
    // fallback rather than mislabeling a genuinely-answered question as "unanswered".
    return { score: 0, maxScore: DEFAULT_MAX_SCORE, verdict: "incorrect", feedback: UNGRADED_FALLBACK_FEEDBACK };
  });

  if (gradable.length === 0) {
    return results;
  }

  const entries: GradeEntry[] = gradable.map(({ index, question, answerBlocks }) => ({
    id: `Q_${index}`,
    questionText: question.text,
    answerText: answerBlocks.map((block) => block.text).join("\n"),
  }));
  const validIds = new Set(entries.map((entry) => entry.id));
  const indexById = new Map(entries.map((entry, i) => [entry.id, gradable[i].index]));

  const schema = RawGradingArraySchema.refine((items) => items.every((item) => validIds.has(item.questionId)), {
    message: "response referenced a questionId outside the provided set",
  });

  const gradings = await generateJsonArrayFromText({
    buildPrompt: (strict) => buildGradePrompt(strict, entries),
    schema,
    errorContext: "Failed to grade answers",
  });

  for (const grading of gradings) {
    const index = indexById.get(grading.questionId);
    if (index === undefined) continue;
    results[index] = {
      score: grading.score,
      maxScore: grading.maxScore,
      verdict: grading.verdict,
      feedback: grading.feedback,
    };
  }

  return results;
}
