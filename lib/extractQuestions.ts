import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import type { PageImage } from "@/lib/fileToImages";

export interface ExtractedQuestion {
  questionNumber: string;
  subpart: string | null;
  text: string;
  page: number;
  /** [ymin, xmin, ymax, xmax], normalized 0-1000 (Gemini's native spatial format). */
  bbox: [number, number, number, number];
}

// gemini-3.7-flash is the newest model but was observed to be unreliable (503s, and one
// request that hung for ~23 minutes before failing) at the time this was written.
// gemini-3.6-flash responded quickly and successfully, and is also the model Google's own
// API points callers of retired models (2.0/2.5 Flash) toward — use it for now.
const MODEL = "gemini-3.6-flash";

// The model is only ever asked about a single page it was just handed, so it can't know
// (and shouldn't guess) which page number it's on — we already know that from the caller,
// so `page` is injected after validation rather than trusted from the model's output.
const RawQuestionSchema = z.object({
  questionNumber: z.string(),
  subpart: z
    .string()
    .nullable()
    .transform((value) => (value === "" ? null : value)),
  text: z.string(),
  bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]),
});
const RawQuestionArraySchema = z.array(RawQuestionSchema);
type RawQuestion = z.infer<typeof RawQuestionSchema>;

const BASE_PROMPT = `You are analyzing a single page from a scanned/photographed exam question paper.

Extract every distinct question on this page, in the exact order they appear from top to bottom.

Rules:
1. Preserve the EXACT original question number exactly as printed (e.g. "1", "11", "Q5", "iv") in "questionNumber". Do not renumber, reformat, or re-order it.
2. If a question has labelled sub-parts (e.g. "11(a)" and "11(b)", or "(i)" and "(ii)"), treat EACH sub-part as its own SEPARATE entry in the output array — never combine sub-parts into one entry. Put the shared main number in "questionNumber" (e.g. "11") and that entry's sub-part label in "subpart" (e.g. "(a)"). If a question has no sub-part, set "subpart" to null.
3. "text" must be the full question text exactly as printed on this page, including any sub-instructions, multi-line content, and any marks shown (e.g. "[5 marks]"). Do not summarize, paraphrase, or drop text.
4. "bbox" is required for every entry: the bounding box of that question's text block on the page, as [ymin, xmin, ymax, xmax], normalized to a 0-1000 scale where 0 is the top/left edge of the page and 1000 is the bottom/right edge.
5. If the page has no questions at all (e.g. a cover page, an instructions-only page, or a blank page), return an empty array: [].
6. If a question has no visible number or label, still extract it: set "questionNumber" to "unlabeled" and "subpart" to null.
7. If a question's text visibly continues from the previous page, or clearly continues onto the next page, extract only what is visible on THIS page as its own entry. Do not guess at or merge in content from other pages.

Output format:
Return ONLY a raw JSON array — no markdown code fences, no \`\`\`json, no explanation, and no other text before or after it. Each element must match exactly this shape:
{ "questionNumber": string, "subpart": string | null, "text": string, "bbox": [number, number, number, number] }

If there are no questions on this page, respond with exactly: []`;

const STRICT_RETRY_SUFFIX = `

Your previous response could not be parsed as valid JSON matching the required schema. Respond again with ONLY the raw JSON array — the very first character must be "[" and the very last must be "]" — and nothing else. Every object must include all four fields (questionNumber, subpart, text, bbox) with the correct types.`;

// Gemini's own API has been observed to occasionally hang for many minutes on a slow day
// instead of erroring — cap each call so one bad request can't stall the whole pipeline.
const REQUEST_TIMEOUT_MS = 60_000;

async function requestPageQuestions(
  ai: GoogleGenAI,
  imageBuffer: Buffer,
  strict: boolean,
): Promise<RawQuestion[]> {
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: [
      { text: strict ? BASE_PROMPT + STRICT_RETRY_SUFFIX : BASE_PROMPT },
      { inlineData: { mimeType: "image/png", data: imageBuffer.toString("base64") } },
    ],
    config: {
      responseMimeType: "application/json",
      temperature: 0,
      abortSignal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    },
  });

  const text = response.text;
  if (!text) {
    throw new Error("Gemini returned an empty response.");
  }

  const parsedJson = JSON.parse(text);
  return RawQuestionArraySchema.parse(parsedJson);
}

async function extractPageQuestions(ai: GoogleGenAI, page: PageImage): Promise<ExtractedQuestion[]> {
  let raw: RawQuestion[];
  try {
    raw = await requestPageQuestions(ai, page.imageBuffer, false);
  } catch {
    try {
      raw = await requestPageQuestions(ai, page.imageBuffer, true);
    } catch {
      throw new Error(
        `Failed to extract questions from page ${page.pageNumber}: Gemini's response could not be parsed as valid structured data, even after retrying.`,
      );
    }
  }

  return raw.map((question) => ({ ...question, page: page.pageNumber }));
}

/**
 * Sends each question-paper page image to Gemini and returns every question found,
 * merged into one list ordered by page and then by vertical position on the page.
 */
export async function extractQuestions(pages: PageImage[]): Promise<ExtractedQuestion[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }
  const ai = new GoogleGenAI({ apiKey });

  const perPageResults = await Promise.all(pages.map((page) => extractPageQuestions(ai, page)));

  return perPageResults.flat().sort((a, b) => {
    if (a.page !== b.page) return a.page - b.page;
    return a.bbox[0] - b.bbox[0];
  });
}
