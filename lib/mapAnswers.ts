import { z } from "zod";
import type { ExtractedQuestion } from "@/lib/extractQuestions";
import type { ExtractedAnswerBlock } from "@/lib/extractAnswers";
import { generateJsonArrayFromText } from "@/lib/gemini";

/** An answer block after continuation-merging: one or more raw blocks glued into one answer. */
export interface AnswerBlock {
  detectedLabel: string | null;
  text: string;
  pages: number[];
  bboxes: [number, number, number, number][];
}

export type MatchStatus = "answered" | "unanswered" | "out-of-order";
export type MatchConfidence = "direct" | "ai-inferred" | null;

export interface MappedQuestion {
  question: ExtractedQuestion;
  answerBlocks: AnswerBlock[] | null;
  status: MatchStatus;
  matchConfidence: MatchConfidence;
}

export interface MappingResult {
  mappedQuestions: MappedQuestion[];
  unmatchedAnswers: AnswerBlock[];
}

// ---------------------------------------------------------------------------
// Continuation merging
// ---------------------------------------------------------------------------

/**
 * Merges answer blocks flagged `continuesFromPreviousPage` into the block immediately
 * before them (in the already-page/position-sorted order extractAnswers returns), so a
 * single answer that spans a page break becomes one AnswerBlock instead of two unrelated
 * ones. The lead block's label wins for the merged block — a continuation block is defined
 * by having no label of its own (per the extraction prompt), so there's nothing to compare.
 */
function mergeContinuations(blocks: ExtractedAnswerBlock[]): AnswerBlock[] {
  const merged: AnswerBlock[] = [];

  for (const block of blocks) {
    const previous = merged[merged.length - 1];
    if (block.continuesFromPreviousPage && previous) {
      previous.text += `\n${block.text}`;
      previous.pages.push(block.page);
      previous.bboxes.push(block.bbox);
      continue;
    }
    merged.push({
      detectedLabel: block.detectedLabel,
      text: block.text,
      pages: [block.page],
      bboxes: [block.bbox],
    });
  }

  return merged;
}

// ---------------------------------------------------------------------------
// Pass 1 — direct label matching
// ---------------------------------------------------------------------------

interface NormalizedIdentity {
  number: string;
  subpart: string | null;
}

/**
 * Normalizes a question/answer label down to a bare {number, subpart} pair so that
 * "Q11a", "11 (a)", "11a)", and "Q. 11 a" all compare equal. Handles the "Q"/"Ans"/"Answer"
 * prefixes students actually write (e.g. "Q3 ans", "Ans 4") in addition to the plain
 * "<number><subpart>" case.
 */
function normalizeLabel(raw: string): NormalizedIdentity | null {
  let cleaned = raw.trim().toLowerCase();
  if (!cleaned) return null;

  // Strip a leading "q"/"ans"/"answer" token (with an optional period/space), repeatedly —
  // covers combinations like "Ans. Q4" as well as the common single-prefix case.
  let previous: string;
  do {
    previous = cleaned;
    cleaned = cleaned.replace(/^(q|ans(?:wer)?)\.?\s*/, "");
  } while (cleaned !== previous);

  // Strip a trailing "ans"/"answer" token too — students write "Q3 ans" as often as "Ans Q3".
  cleaned = cleaned.replace(/\s*(ans(?:wer)?)\.?$/, "");

  // Collapse whitespace and bracket/punctuation noise: "11 (a)" / "11a)" / "(11a)" all converge.
  cleaned = cleaned.replace(/[\s().,:\-]/g, "");
  if (!cleaned) return null;

  const match = cleaned.match(/^(\d+)([a-z]*)$/);
  if (!match) {
    // No clean leading number (e.g. a roman-numeral main number like "iv") — use the whole
    // cleaned token as-is so it can still compare equal to an identically-cleaned question number.
    return { number: cleaned, subpart: null };
  }
  const [, number, subpart] = match;
  return { number, subpart: subpart || null };
}

function normalizeQuestionIdentity(question: ExtractedQuestion): NormalizedIdentity {
  const number = question.questionNumber.trim().toLowerCase().replace(/^q\.?\s*/, "").replace(/[\s().,:\-]/g, "");
  const subpartCleaned = question.subpart?.trim().toLowerCase().replace(/[\s().,:\-]/g, "") ?? "";
  return { number, subpart: subpartCleaned || null };
}

function identityKey(identity: NormalizedIdentity): string {
  return `${identity.number}|${identity.subpart ?? ""}`;
}

// ---------------------------------------------------------------------------
// Pass 2 — AI-assisted content matching
// ---------------------------------------------------------------------------

const MatchArraySchema = z.array(
  z.object({
    answerId: z.string(),
    questionId: z.string().nullable(),
  }),
);

const STRICT_RETRY_SUFFIX = `

Your previous response could not be parsed as valid JSON matching the required schema. Respond again with ONLY the raw JSON array — the very first character must be "[" and the very last must be "]" — and nothing else. Every object must include both fields (answerId, questionId) with the correct types, and there must be exactly one entry per answer id listed above.`;

function buildMatchPrompt(
  strict: boolean,
  questionEntries: { id: string; question: ExtractedQuestion }[],
  answerEntries: { id: string; block: AnswerBlock }[],
): string {
  const questionList = questionEntries
    .map(({ id, question }) => {
      const label = question.subpart ? `${question.questionNumber}(${question.subpart})` : question.questionNumber;
      return `${id} [Question ${label}]: ${question.text}`;
    })
    .join("\n\n");

  const answerList = answerEntries.map(({ id, block }) => `${id}: ${block.text}`).join("\n\n");

  const base = `You are matching a student's answers to the exam questions they most likely respond to, using CONTENT alone. These particular answers had no usable question number/label written next to them (or the label didn't match any real question), so this has to be inferred from subject matter.

QUESTIONS:
${questionList}

ANSWERS TO MATCH:
${answerList}

For each answer id, decide which question id it most likely responds to, based on topic and content overlap. Use a reasonably high confidence bar: only match an answer to a question if the content clearly relates to it. If an answer doesn't clearly correspond to any of the listed questions — e.g. it's a side note, an unrelated remark, a revision reminder, or just too vague/short to tell — set "questionId" to null rather than guessing. Do not force a match just to avoid leaving something unmatched.

Output format:
Return ONLY a raw JSON array — no markdown code fences, no \`\`\`json, no explanation, and no other text before or after it. Include exactly one entry per answer id listed above, in any order, each matching exactly this shape:
{ "answerId": string, "questionId": string | null }`;

  return strict ? base + STRICT_RETRY_SUFFIX : base;
}

/**
 * Resolves answer blocks that Pass 1 couldn't match by label, using a single batched
 * text-only Gemini call covering every unresolved answer and every question at once
 * (rather than one call per answer) so this stays cheap regardless of paper size.
 */
async function matchByContent(
  questions: ExtractedQuestion[],
  unresolved: AnswerBlock[],
): Promise<Map<AnswerBlock, ExtractedQuestion | null>> {
  const result = new Map<AnswerBlock, ExtractedQuestion | null>();
  if (unresolved.length === 0 || questions.length === 0) {
    for (const block of unresolved) result.set(block, null);
    return result;
  }

  const questionEntries = questions.map((question, index) => ({ id: `Q_${index}`, question }));
  const answerEntries = unresolved.map((block, index) => ({ id: `A_${index}`, block }));
  const questionById = new Map(questionEntries.map((entry) => [entry.id, entry.question]));
  const blockById = new Map(answerEntries.map((entry) => [entry.id, entry.block]));

  const schema = MatchArraySchema.refine(
    (matches) => matches.every((m) => blockById.has(m.answerId) && (m.questionId === null || questionById.has(m.questionId))),
    { message: "response referenced an answerId/questionId outside the provided set" },
  );

  let matches: z.infer<typeof MatchArraySchema>;
  try {
    matches = await generateJsonArrayFromText({
      buildPrompt: (strict) => buildMatchPrompt(strict, questionEntries, answerEntries),
      schema,
      errorContext: "Failed to content-match unlabeled answers",
    });
  } catch {
    // Content-based matching is a best-effort enhancement on top of Pass 1's deterministic
    // label matches. If Gemini is unavailable (quota/5xx/timeout) or never produces a valid
    // response even after retrying, degrade gracefully — leave these as unmatched rather than
    // failing the whole mapping (and discarding Pass 1's already-good results) over it.
    for (const block of unresolved) result.set(block, null);
    return result;
  }

  const matchedAnswerIds = new Set<string>();
  for (const match of matches) {
    const block = blockById.get(match.answerId);
    if (!block) continue;
    matchedAnswerIds.add(match.answerId);
    const question = match.questionId ? (questionById.get(match.questionId) ?? null) : null;
    result.set(block, question);
  }
  // Be defensive about the model skipping an id despite instructions to cover all of them.
  for (const { id, block } of answerEntries) {
    if (!matchedAnswerIds.has(id)) result.set(block, null);
  }

  return result;
}

// ---------------------------------------------------------------------------
// Out-of-order detection
// ---------------------------------------------------------------------------

interface Position {
  page: number;
  y: number;
}

function comparePositions(a: Position, b: Position): number {
  return a.page !== b.page ? a.page - b.page : a.y - b.y;
}

/** A block's position in answer-sheet reading order is where its first (earliest) piece sits. */
function blockPosition(block: AnswerBlock): Position {
  return { page: block.pages[0], y: block.bboxes[0][0] };
}

function earliestPosition(blocks: AnswerBlock[]): Position {
  return blocks.map(blockPosition).reduce((earliest, position) => (comparePositions(position, earliest) < 0 ? position : earliest));
}

/**
 * Flags questions whose answer appears earlier in the answer sheet than an already-in-order
 * preceding question's answer does — e.g. if Q3's answer sits after Q4's answer in the sheet,
 * Q4 (not Q3) gets flagged, since Q4 is the one that broke the expected increasing sequence.
 *
 * Convention chosen (of the two the spec allows): flag the LATER question in question-paper
 * order, not the earlier one. This mirrors how a human grader would actually read the answer
 * sheet top-to-bottom — they'd cruise along in order through Q3, then hit an answer to Q4
 * "too early" and flag *that* as the surprise, rather than retroactively blaming Q3 for
 * something that, at the time, was perfectly in order. It also makes the algorithm a single
 * forward pass with one running "last in-order position" baseline, rather than needing to
 * look ahead or revise earlier decisions.
 *
 * Unanswered questions are skipped entirely — they don't participate in the sequence (there's
 * nothing to compare), and don't reset the running baseline either.
 */
function flagOutOfOrder(mappedQuestions: MappedQuestion[]): void {
  let lastInOrderPosition: Position | null = null;

  for (const mapped of mappedQuestions) {
    if (mapped.status === "unanswered" || !mapped.answerBlocks) continue;

    const position = earliestPosition(mapped.answerBlocks);
    if (lastInOrderPosition === null || comparePositions(position, lastInOrderPosition) >= 0) {
      lastInOrderPosition = position;
    } else {
      mapped.status = "out-of-order";
      // Keep comparing subsequent questions against the last question that WAS in order,
      // so one out-of-order answer doesn't cause a cascade of false positives after it.
    }
  }
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export async function mapAnswers(questions: ExtractedQuestion[], answers: ExtractedAnswerBlock[]): Promise<MappingResult> {
  const mergedBlocks = mergeContinuations(answers);

  // One accumulator per question, indexed the same as `questions`.
  const accumulators = questions.map(() => ({ blocks: [] as AnswerBlock[], confidence: null as MatchConfidence }));

  const questionIndexByIdentity = new Map<string, number>();
  questions.forEach((question, index) => {
    const key = identityKey(normalizeQuestionIdentity(question));
    if (!questionIndexByIdentity.has(key)) questionIndexByIdentity.set(key, index);
  });

  const unresolved: AnswerBlock[] = [];

  for (const block of mergedBlocks) {
    const normalized = block.detectedLabel ? normalizeLabel(block.detectedLabel) : null;
    const questionIndex = normalized ? questionIndexByIdentity.get(identityKey(normalized)) : undefined;

    if (questionIndex !== undefined) {
      accumulators[questionIndex].blocks.push(block);
      accumulators[questionIndex].confidence = "direct";
    } else {
      unresolved.push(block);
    }
  }

  const contentMatches = await matchByContent(questions, unresolved);
  const unmatchedAnswers: AnswerBlock[] = [];

  for (const block of unresolved) {
    const question = contentMatches.get(block) ?? null;
    if (!question) {
      unmatchedAnswers.push(block);
      continue;
    }
    const index = questions.indexOf(question);
    accumulators[index].blocks.push(block);
    // Direct matches (Pass 1) always outrank an AI-inferred one for the same question.
    if (accumulators[index].confidence !== "direct") accumulators[index].confidence = "ai-inferred";
  }

  const mappedQuestions: MappedQuestion[] = questions.map((question, index) => {
    const { blocks, confidence } = accumulators[index];
    if (blocks.length === 0) {
      return { question, answerBlocks: null, status: "unanswered", matchConfidence: null };
    }
    return { question, answerBlocks: blocks, status: "answered", matchConfidence: confidence };
  });

  flagOutOfOrder(mappedQuestions);

  return { mappedQuestions, unmatchedAnswers };
}
