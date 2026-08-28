import { z } from "zod";
import type { PageImage } from "@/lib/fileToImages";
import { BboxSchema, generateJsonArrayForDocument } from "@/lib/gemini";

export interface ExtractedQuestion {
  questionNumber: string;
  subpart: string | null;
  text: string;
  page: number;
  /** [ymin, xmin, ymax, xmax], normalized 0-1000 relative to its own page (Gemini's native spatial format). */
  bbox: [number, number, number, number];
}

// The model sees every page in one request now, so it reports its own "page" per question —
// validated against the actual set of page numbers we sent, so a hallucinated page number
// fails schema validation (triggering the strict-prompt retry) instead of silently passing.
function buildQuestionArraySchema(validPageNumbers: Set<number>) {
  return z.array(
    z.object({
      questionNumber: z.string(),
      subpart: z
        .string()
        .nullable()
        .transform((value) => (value === "" ? null : value)),
      text: z.string(),
      page: z.number().int().refine((page) => validPageNumbers.has(page), {
        message: "page is not one of the page numbers provided in this request",
      }),
      bbox: BboxSchema,
    }),
  );
}

const STRICT_RETRY_SUFFIX = `

Your previous response could not be parsed as valid JSON matching the required schema. Respond again with ONLY the raw JSON array — the very first character must be "[" and the very last must be "]" — and nothing else. Every object must include all five fields (questionNumber, subpart, text, page, bbox) with the correct types.`;

function buildPrompt(strict: boolean, pageNumbers: number[]): string {
  const base = `You are analyzing a complete exam question paper, provided as one image per page. Each image is immediately preceded by a text label "Page N:" giving its page number. The pages provided, in order, are: ${pageNumbers.join(", ")}.

Extract every distinct question across ALL of these pages together, as one combined list, in the exact order they appear: first by page number, then top-to-bottom within each page.

Rules:
1. Preserve the EXACT original question number exactly as printed (e.g. "1", "11", "Q5", "iv") in "questionNumber". Do not renumber, reformat, or re-order it — keep it exactly as printed on its own page, even if numbering looks unusual or restarts across pages.
2. If a question has labelled sub-parts (e.g. "11(a)" and "11(b)", or "(i)" and "(ii)"), treat EACH sub-part as its own SEPARATE entry — never combine sub-parts into one entry. Put the shared main number in "questionNumber" and that entry's sub-part label in "subpart" (e.g. "(a)"). If a question has no sub-part, set "subpart" to null.
3. "text" must be the full question text exactly as printed on its page, including any sub-instructions, multi-line content, and any marks shown (e.g. "[5 marks]"). Do not summarize, paraphrase, or drop text.
4. "page" must be the exact page number from the "Page N:" label immediately before the image the question appears on — not a position index, and not guessed.
5. "bbox" is required for every entry: the bounding box of that question's text block on ITS OWN page's image, as [ymin, xmin, ymax, xmax], normalized to a 0-1000 scale where 0 is the top/left edge of that single page and 1000 is its bottom/right edge. Every page's coordinates are independent of every other page — never combine or offset bboxes across pages.
6. If a given page has no questions at all (e.g. a cover page, an instructions-only page, or a blank page), it simply contributes no entries — do not error, and keep processing the rest of the pages normally.
7. If a question has no visible number or label, still extract it: set "questionNumber" to "unlabeled" and "subpart" to null.
8. If a question's text visibly continues from one page onto the next, extract only what is visible on each respective page as its own separate entry with that page's own correct "page" number. Do not guess at or merge content across pages into a single entry.

Output format:
Return ONLY a single raw JSON array covering ALL pages combined — no markdown code fences, no \`\`\`json, no explanation, and no other text before or after it. Each element must match exactly this shape:
{ "questionNumber": string, "subpart": string | null, "text": string, "page": number, "bbox": [number, number, number, number] }

If there are no questions anywhere in this document, respond with exactly: []`;

  return strict ? base + STRICT_RETRY_SUFFIX : base;
}

/**
 * Sends all question-paper page images to Gemini in a single request and returns every
 * question found, merged into one list ordered by page and then by vertical position.
 */
export async function extractQuestions(pages: PageImage[]): Promise<ExtractedQuestion[]> {
  if (pages.length === 0) return [];

  const validPageNumbers = new Set(pages.map((page) => page.pageNumber));

  const questions = await generateJsonArrayForDocument({
    pages,
    buildPrompt,
    schema: buildQuestionArraySchema(validPageNumbers),
    errorContext: "Failed to extract questions",
  });

  return questions.sort((a, b) => (a.page !== b.page ? a.page - b.page : a.bbox[0] - b.bbox[0]));
}
