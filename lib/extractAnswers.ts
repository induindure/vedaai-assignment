import { z } from "zod";
import type { PageImage } from "@/lib/fileToImages";
import { generateJsonArrayForDocument } from "@/lib/gemini";

export interface ExtractedAnswerBlock {
  detectedLabel: string | null;
  text: string;
  page: number;
  /** [ymin, xmin, ymax, xmax], normalized 0-1000 relative to its own page (Gemini's native spatial format). */
  bbox: [number, number, number, number];
  continuesFromPreviousPage: boolean;
}

// The model sees every page in one request now, so it reports its own "page" per block —
// validated against the actual set of page numbers we sent, so a hallucinated page number
// fails schema validation (triggering the strict-prompt retry) instead of silently passing.
function buildAnswerBlockArraySchema(validPageNumbers: Set<number>) {
  return z.array(
    z.object({
      detectedLabel: z
        .string()
        .nullable()
        .transform((value) => (value === "" ? null : value)),
      text: z.string(),
      page: z.number().int().refine((page) => validPageNumbers.has(page), {
        message: "page is not one of the page numbers provided in this request",
      }),
      bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]),
      continuesFromPreviousPage: z.boolean(),
    }),
  );
}

const STRICT_RETRY_SUFFIX = `

Your previous response could not be parsed as valid JSON matching the required schema. Respond again with ONLY the raw JSON array — the very first character must be "[" and the very last must be "]" — and nothing else. Every object must include all five fields (detectedLabel, text, page, bbox, continuesFromPreviousPage) with the correct types.`;

function buildPrompt(strict: boolean, pageNumbers: number[]): string {
  const base = `You are analyzing a complete HANDWRITTEN exam answer sheet, provided as one image per page. Each image is immediately preceded by a text label "Page N:" giving its page number. The pages provided, in order, are: ${pageNumbers.join(", ")}.

Detect every distinct block of writing the student put across ALL of these pages together, as one combined list, in the exact order they appear: first by page number, then top-to-bottom within each page. A "block" is a visually and logically distinct chunk of handwriting — usually everything written in response to one question or sub-part, but it can also be anything else written on a page: side notes, revision reminders, crossed-out attempts, doodled annotations, or a rough working area. Do NOT judge whether something is a "real" or "correct" answer, and do NOT discard anything — extract every distinct block of writing exactly as it appears. That judgment happens in a later step, not here.

Rules:
1. For each block, look for a question label/number the student wrote near or before it (e.g. "Q1", "1)", "11 a", "Ans 4", "11(b)"). Handwriting may be messy, abbreviated, cramped, or inconsistent — do your best to read it, and return it as close to verbatim as you can in "detectedLabel". If you genuinely cannot find any label at all for a block, set "detectedLabel" to null. Do not invent a label that isn't actually visible.
2. "text" must be your best-effort transcription of the handwritten content of that block, as accurately as possible. Preserve it even if it is very short — a single word, number, or symbol is still its own block and must not be skipped.
3. "page" must be the exact page number from the "Page N:" label immediately before the image the block appears on — not a position index, and not guessed.
4. Set "continuesFromPreviousPage" to true if this block looks like a continuation of writing that started on the page immediately before it in this document — for example it starts mid-sentence or mid-word, has no label of its own, or otherwise clearly just picks up where the previous page's content left off. Since you can see the previous page's image directly, use it to make this judgment accurately. Otherwise set it to false. A block on the very first page provided is always false.
5. "bbox" is required for every block: the bounding box of that block's handwriting on ITS OWN page's image, as [ymin, xmin, ymax, xmax], normalized to a 0-1000 scale where 0 is the top/left edge of that single page and 1000 is its bottom/right edge. Every page's coordinates are independent of every other page — never combine or offset bboxes across pages.
6. If a given page has no visible writing at all (blank page, or only pre-printed template text with nothing filled in by hand), it simply contributes no entries — do not error, and keep processing the rest of the pages normally.

Output format:
Return ONLY a single raw JSON array covering ALL pages combined — no markdown code fences, no \`\`\`json, no explanation, and no other text before or after it. Each element must match exactly this shape:
{ "detectedLabel": string | null, "text": string, "page": number, "bbox": [number, number, number, number], "continuesFromPreviousPage": boolean }

If there is no writing anywhere in this document, respond with exactly: []`;

  return strict ? base + STRICT_RETRY_SUFFIX : base;
}

/**
 * Sends all answer-sheet page images to Gemini in a single request and returns every
 * handwritten block found, merged into one list ordered by page and then by vertical position.
 */
export async function extractAnswers(pages: PageImage[]): Promise<ExtractedAnswerBlock[]> {
  if (pages.length === 0) return [];

  const validPageNumbers = new Set(pages.map((page) => page.pageNumber));

  const answers = await generateJsonArrayForDocument({
    pages,
    buildPrompt,
    schema: buildAnswerBlockArraySchema(validPageNumbers),
    errorContext: "Failed to extract answers",
  });

  return answers.sort((a, b) => (a.page !== b.page ? a.page - b.page : a.bbox[0] - b.bbox[0]));
}
