import { GoogleGenAI, type Part } from "@google/genai";
import type { ZodType } from "zod";
import type { PageImage } from "@/lib/fileToImages";

// gemini-3.7-flash is the newest model but was observed to be unreliable (503s, and one
// request that hung for ~23 minutes before failing) at the time this was written.
// gemini-3.6-flash responded quickly and successfully, and is also the model Google's own
// API points callers of retired models (2.0/2.5 Flash) toward — use it for now.
const GEMINI_MODEL = "gemini-3.6-flash";

// One request can cover every page of a document instead of just one page, so the timeout
// scales with page count (more images, more expected output) rather than using a fixed budget.
const BASE_TIMEOUT_MS = 60_000;
const PER_PAGE_TIMEOUT_MS = 15_000;
const MAX_TIMEOUT_MS = 240_000;

let cachedClient: GoogleGenAI | null = null;

export function getGeminiClient(): GoogleGenAI {
  if (cachedClient) return cachedClient;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }
  cachedClient = new GoogleGenAI({ apiKey });
  return cachedClient;
}

/**
 * Thrown when the API call itself fails (network error, rate limit, 5xx, timeout) — as
 * opposed to the call succeeding but returning a response that doesn't parse. Retrying with
 * a "stricter" prompt only makes sense for the latter, so callers need to tell them apart.
 */
class GeminiRequestError extends Error {}

/**
 * Core call-with-retry logic shared by every JSON-array extraction in this app: send
 * `buildContents(strict)`, validate the response against `schema`, and retry once with a
 * stricter prompt if the response came back but didn't parse/validate. A failure of the
 * request itself (rate limit, 5xx, timeout, network) is not retried here — a
 * differently-worded prompt can't fix a quota error — and is instead surfaced immediately
 * with its real cause rather than a misleading "invalid JSON" message.
 */
async function callGeminiForJsonArray<T>(params: {
  ai: GoogleGenAI;
  buildContents: (strict: boolean) => Part[];
  schema: ZodType<T[]>;
  errorContext: string;
  timeoutMs: number;
}): Promise<T[]> {
  const { ai, buildContents, schema, errorContext, timeoutMs } = params;

  const attempt = async (strict: boolean): Promise<T[]> => {
    let response;
    try {
      response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: buildContents(strict),
        config: {
          responseMimeType: "application/json",
          temperature: 0,
          abortSignal: AbortSignal.timeout(timeoutMs),
        },
      });
    } catch (error) {
      throw new GeminiRequestError(error instanceof Error ? error.message : String(error));
    }

    const text = response.text;
    if (!text) {
      throw new Error("Gemini returned an empty response.");
    }
    return schema.parse(JSON.parse(text));
  };

  try {
    return await attempt(false);
  } catch (error) {
    if (error instanceof GeminiRequestError) {
      throw new Error(`${errorContext}: the request to Gemini failed — ${error.message}`);
    }
    try {
      return await attempt(true);
    } catch (retryError) {
      if (retryError instanceof GeminiRequestError) {
        throw new Error(`${errorContext}: the request to Gemini failed — ${retryError.message}`);
      }
      throw new Error(`${errorContext}: Gemini's response could not be parsed as valid structured data, even after retrying.`);
    }
  }
}

// Interleaving a "Page N:" text label before each image (rather than sending images alone)
// is the standard way to let the model reliably refer to/distinguish specific images in a
// multi-image request — positional order alone is more prone to off-by-one attribution.
function buildPageParts(pages: PageImage[]): Part[] {
  const parts: Part[] = [];
  for (const page of pages) {
    parts.push({ text: `Page ${page.pageNumber}:` });
    parts.push({ inlineData: { mimeType: "image/png", data: page.imageBuffer.toString("base64") } });
  }
  return parts;
}

/**
 * Sends every page image of a document to Gemini in a single request — one call per
 * document instead of one per page — asking for a combined JSON array covering all pages.
 */
export async function generateJsonArrayForDocument<T>(params: {
  ai: GoogleGenAI;
  pages: PageImage[];
  buildPrompt: (strict: boolean, pageNumbers: number[]) => string;
  schema: ZodType<T[]>;
  errorContext: string;
}): Promise<T[]> {
  const { ai, pages, buildPrompt, schema, errorContext } = params;
  if (pages.length === 0) return [];

  const pageNumbers = pages.map((page) => page.pageNumber);
  const timeoutMs = Math.min(MAX_TIMEOUT_MS, BASE_TIMEOUT_MS + pageNumbers.length * PER_PAGE_TIMEOUT_MS);

  return callGeminiForJsonArray({
    ai,
    buildContents: (strict) => [{ text: buildPrompt(strict, pageNumbers) }, ...buildPageParts(pages)],
    schema,
    errorContext,
    timeoutMs,
  });
}

/** Sends a single text-only prompt to Gemini (no images) asking for a JSON array. */
export async function generateJsonArrayFromText<T>(params: {
  ai: GoogleGenAI;
  buildPrompt: (strict: boolean) => string;
  schema: ZodType<T[]>;
  errorContext: string;
}): Promise<T[]> {
  const { ai, buildPrompt, schema, errorContext } = params;

  return callGeminiForJsonArray({
    ai,
    buildContents: (strict) => [{ text: buildPrompt(strict) }],
    schema,
    errorContext,
    timeoutMs: BASE_TIMEOUT_MS,
  });
}
