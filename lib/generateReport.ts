import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage, type RGB } from "pdf-lib";
import { z } from "zod";

// pdf-lib is pure JS (no native bindings), unlike @napi-rs/canvas — which is exactly the kind
// of dependency this app already hit deployment trouble with once (see fileToImages.ts). It's
// also already a dependency here (lib/file-utils.ts uses it for page counts), so this adds no
// new native-binary risk to a serverless/Vercel deploy. The tradeoff is that pdf-lib has no
// layout engine of its own — everything below (word-wrap, pagination, spacing) is hand-rolled.

const BboxSchema = z.tuple([z.number(), z.number(), z.number(), z.number()]);

const QuestionSchema = z.object({
  questionNumber: z.string(),
  subpart: z.string().nullable(),
  text: z.string(),
  page: z.number(),
  bbox: BboxSchema,
});

const AnswerBlockSchema = z.object({
  detectedLabel: z.string().nullable(),
  text: z.string(),
  pages: z.array(z.number()),
  bboxes: z.array(BboxSchema),
});

const GradingSchema = z.object({
  score: z.number(),
  maxScore: z.number(),
  verdict: z.enum(["correct", "partial", "incorrect", "unanswered"]),
  feedback: z.string().nullable(),
});

const MappedQuestionSchema = z.object({
  question: QuestionSchema,
  answerBlocks: z.array(AnswerBlockSchema).nullable(),
  status: z.enum(["answered", "unanswered", "out-of-order"]),
  matchConfidence: z.enum(["direct", "ai-inferred"]).nullable(),
  grading: GradingSchema.nullable(),
});

/**
 * Validated shape of a report request. Mirrors GradedMappingResult (types/processing.ts) plus
 * an optional student name — kept as its own schema (rather than importing those types
 * directly) so this module can validate an arbitrary request body at the API boundary, not
 * just trust the shape of whatever the frontend happens to send.
 */
export const ReportRequestSchema = z.object({
  studentName: z
    .string()
    .trim()
    .max(200)
    .nullable()
    .optional()
    .transform((value) => (value ? value : null)),
  mappedQuestions: z.array(MappedQuestionSchema),
  unmatchedAnswers: z.array(AnswerBlockSchema),
});

export type ReportInput = z.infer<typeof ReportRequestSchema>;
type ReportMappedQuestion = z.infer<typeof MappedQuestionSchema>;
type ReportAnswerBlock = z.infer<typeof AnswerBlockSchema>;

// ---------------------------------------------------------------------------
// Layout constants
// ---------------------------------------------------------------------------

const PAGE_WIDTH = 595.28; // A4 at 72pt/inch
const PAGE_HEIGHT = 841.89;
const MARGIN = 50;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

const INK = rgb(0.13, 0.13, 0.15);
const MUTED = rgb(0.45, 0.45, 0.48);
const FAINT = rgb(0.6, 0.6, 0.62);
const DIVIDER = rgb(0.85, 0.85, 0.86);
const CARD_BG = rgb(0.98, 0.98, 0.98);

const VERDICT_COLOR: Record<string, RGB> = {
  correct: rgb(0.06, 0.6, 0.44),
  partial: rgb(0.83, 0.6, 0.05),
  incorrect: rgb(0.87, 0.25, 0.25),
  unanswered: rgb(0.55, 0.55, 0.57),
};

const STATUS_LABEL: Record<ReportMappedQuestion["status"], string> = {
  answered: "Answered",
  unanswered: "Unanswered",
  "out-of-order": "Out of order",
};

// ---------------------------------------------------------------------------
// Word-wrap + pagination helpers
// ---------------------------------------------------------------------------

/** Greedy word-wrap against a font's actual measured width, honoring existing newlines. */
function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const lines: string[] = [];

  for (const paragraph of text.split(/\r?\n/)) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push("");
      continue;
    }

    let current = "";
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth || !current) {
        current = candidate;
      } else {
        lines.push(current);
        current = word;
      }
    }
    if (current) lines.push(current);
  }

  return lines;
}

function truncate(text: string, maxLen: number): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > maxLen ? `${flat.slice(0, maxLen - 1).trimEnd()}…` : flat;
}

/**
 * Tracks a cursor down a PDFDocument, adding new pages as content overflows. Everything else
 * in this file is built on top of these few primitives rather than pdf-lib directly.
 */
class ReportWriter {
  private constructor(
    public doc: PDFDocument,
    private page: PDFPage,
    private y: number,
    public regular: PDFFont,
    public bold: PDFFont,
    public italic: PDFFont,
  ) {}

  static async create(): Promise<ReportWriter> {
    const doc = await PDFDocument.create();
    doc.setTitle("Answer Sheet Evaluation Report");
    doc.setProducer("VedaAI");
    const regular = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);
    const italic = await doc.embedFont(StandardFonts.HelveticaOblique);
    const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    return new ReportWriter(doc, page, PAGE_HEIGHT - MARGIN, regular, bold, italic);
  }

  private addPage() {
    this.page = this.doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    this.y = PAGE_HEIGHT - MARGIN;
  }

  /** Ensures at least `height` of vertical room remains on the current page, starting a new one otherwise. */
  ensureSpace(height: number) {
    if (this.y - height < MARGIN) this.addPage();
  }

  spacer(height: number) {
    this.y -= height;
  }

  line(
    text: string,
    opts: { font?: PDFFont; size?: number; color?: RGB; x?: number; gapAfter?: number } = {},
  ) {
    const { font = this.regular, size = 11, color = INK, x = MARGIN, gapAfter = 6 } = opts;
    this.ensureSpace(size + gapAfter);
    this.page.drawText(text, { x, y: this.y - size, size, font, color });
    this.y -= size + gapAfter;
  }

  /** Draws right-aligned text on the same baseline as whatever was just drawn by `line()`. */
  lineRightAligned(text: string, opts: { font?: PDFFont; size?: number; color?: RGB; baselineY: number }) {
    const { font = this.regular, size = 11, color = INK, baselineY } = opts;
    const width = font.widthOfTextAtSize(text, size);
    this.page.drawText(text, { x: PAGE_WIDTH - MARGIN - width, y: baselineY, size, font, color });
  }

  wrapped(
    text: string,
    opts: { font?: PDFFont; size?: number; color?: RGB; x?: number; maxWidth?: number; lineGap?: number; gapAfter?: number } = {},
  ) {
    const { font = this.regular, size = 10, color = MUTED, x = MARGIN, maxWidth = CONTENT_WIDTH, lineGap = 3, gapAfter = 6 } = opts;
    const lines = wrapText(text, font, size, maxWidth);
    for (const wrappedLine of lines) {
      this.ensureSpace(size + lineGap);
      this.page.drawText(wrappedLine, { x, y: this.y - size, size, font, color });
      this.y -= size + lineGap;
    }
    this.y -= gapAfter;
  }

  divider() {
    this.ensureSpace(14);
    this.page.drawLine({ start: { x: MARGIN, y: this.y }, end: { x: PAGE_WIDTH - MARGIN, y: this.y }, thickness: 0.75, color: DIVIDER });
    this.y -= 16;
  }

  /** A light rounded card background behind whatever gets drawn next, `height` tall. */
  cardBackground(height: number) {
    this.ensureSpace(height);
    this.page.drawRectangle({
      x: MARGIN - 10,
      y: this.y - height + 8,
      width: CONTENT_WIDTH + 20,
      height,
      color: CARD_BG,
      borderColor: DIVIDER,
      borderWidth: 0.75,
    });
  }

  currentY(): number {
    return this.y;
  }
}

// ---------------------------------------------------------------------------
// Section builders
// ---------------------------------------------------------------------------

// Matches QuestionCard.tsx's convention: `subpart` already carries its own parens (e.g.
// "(a)"), per the extraction prompt in lib/extractQuestions.ts — wrapping it again here
// would double them up into "11((a))". No "Q" prefix either, for the same reason: the app's
// own question list never adds one, it just shows "1", "11(a)", etc.
function questionLabel(question: ReportMappedQuestion["question"]): string {
  return `${question.questionNumber}${question.subpart ?? ""}`;
}

function drawHeader(w: ReportWriter, studentName: string | null) {
  const title = studentName ? `${studentName} — Answer Sheet Evaluation` : "Answer Sheet Evaluation Report";
  w.line(title, { font: w.bold, size: 20, gapAfter: 4 });

  const generatedOn = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  w.line(`Generated on ${generatedOn}`, { font: w.regular, size: 10, color: FAINT, gapAfter: 14 });

  w.divider();
}

function drawSummary(w: ReportWriter, mappedQuestions: ReportMappedQuestion[]) {
  const gradings = mappedQuestions.map((m) => m.grading).filter((g): g is NonNullable<typeof g> => g !== null);

  w.line("Overall Summary", { font: w.bold, size: 14, gapAfter: 10 });

  if (gradings.length === 0) {
    w.wrapped("Grading was not available for this submission — showing the extracted questions and answers without scores or feedback.", {
      font: w.italic,
      size: 10,
      color: MUTED,
      gapAfter: 14,
    });
    w.divider();
    return;
  }

  const totalScore = gradings.reduce((sum, g) => sum + g.score, 0);
  const totalMax = gradings.reduce((sum, g) => sum + g.maxScore, 0);
  const counts = { correct: 0, partial: 0, incorrect: 0, unanswered: 0 };
  for (const g of gradings) counts[g.verdict]++;

  w.line(`Score: ${totalScore} / ${totalMax}`, { font: w.bold, size: 16, gapAfter: 10 });
  w.line(
    `${counts.correct} correct  ·  ${counts.partial} partial  ·  ${counts.incorrect} incorrect  ·  ${counts.unanswered} unanswered`,
    { font: w.regular, size: 10.5, color: MUTED, gapAfter: 14 },
  );

  if (mappedQuestions.length > gradings.length) {
    w.wrapped(
      `Note: ${mappedQuestions.length - gradings.length} of ${mappedQuestions.length} question(s) could not be graded and are excluded from the score above.`,
      { font: w.italic, size: 9.5, color: FAINT, gapAfter: 10 },
    );
  }

  w.divider();
}

function drawQuestionEntry(w: ReportWriter, mapped: ReportMappedQuestion) {
  const label = `Question ${questionLabel(mapped.question)}`;
  const statusText = STATUS_LABEL[mapped.status];
  const scoreText = mapped.grading ? `${mapped.grading.score}/${mapped.grading.maxScore}` : null;

  // Reserve enough room that the number/status/score header line never gets split from the
  // question text directly under it (ensureSpace on the header alone wouldn't account for that).
  w.ensureSpace(40);

  const baselineY = w.currentY() - 12;
  w.line(label, { font: w.bold, size: 12, gapAfter: 0 });
  const badgeColor = mapped.grading ? VERDICT_COLOR[mapped.grading.verdict] : VERDICT_COLOR[mapped.status === "unanswered" ? "unanswered" : "partial"];
  const rightText = scoreText ? `${statusText}  ·  ${scoreText}` : statusText;
  w.lineRightAligned(rightText, { font: w.bold, size: 10, color: badgeColor, baselineY });
  w.spacer(8);

  w.wrapped(truncate(mapped.question.text, 260), { font: w.regular, size: 10, color: INK, gapAfter: 4 });

  if (mapped.grading?.feedback) {
    w.wrapped(`Feedback: ${mapped.grading.feedback}`, { font: w.italic, size: 9.5, color: MUTED, gapAfter: 4 });
  }

  w.spacer(6);
}

function drawQuestions(w: ReportWriter, mappedQuestions: ReportMappedQuestion[]) {
  w.line("Questions", { font: w.bold, size: 14, gapAfter: 10 });

  if (mappedQuestions.length === 0) {
    w.wrapped("No questions were found in the question paper.", { font: w.italic, size: 10, color: MUTED });
    return;
  }

  mappedQuestions.forEach((mapped) => drawQuestionEntry(w, mapped));
}

function drawUnmatchedAnswers(w: ReportWriter, unmatchedAnswers: ReportAnswerBlock[]) {
  if (unmatchedAnswers.length === 0) return;

  w.spacer(6);
  w.divider();
  w.line("Unmatched Answers", { font: w.bold, size: 14, gapAfter: 6 });
  w.wrapped("The following handwritten blocks were detected on the answer sheet but could not be matched to any question:", {
    font: w.regular,
    size: 10,
    color: MUTED,
    gapAfter: 10,
  });

  unmatchedAnswers.forEach((block, index) => {
    const pages = [...new Set(block.pages)].sort((a, b) => a - b).join(", ");
    const label = block.detectedLabel ? `"${block.detectedLabel}"` : "No label";
    w.line(`${index + 1}. ${label} — page ${pages}`, { font: w.bold, size: 10.5, gapAfter: 3 });
    w.wrapped(truncate(block.text, 220), { font: w.regular, size: 9.5, color: MUTED, gapAfter: 6 });
  });
}

function drawFooters(doc: PDFDocument, font: PDFFont) {
  const pages = doc.getPages();
  pages.forEach((page, index) => {
    const text = `Page ${index + 1} of ${pages.length}`;
    const size = 8.5;
    const width = font.widthOfTextAtSize(text, size);
    page.drawText(text, { x: PAGE_WIDTH - MARGIN - width, y: MARGIN / 2, size, font, color: FAINT });
    page.drawText("Generated by VedaAI", { x: MARGIN, y: MARGIN / 2, size, font, color: FAINT });
  });
}

/**
 * Renders a graded (or ungraded, per requirement 4) mapping result into a printable PDF report.
 * Returns the raw PDF bytes — the caller decides how to serve/store them.
 */
export async function generateReportPdf(input: ReportInput): Promise<Uint8Array> {
  const w = await ReportWriter.create();

  drawHeader(w, input.studentName ?? null);
  drawSummary(w, input.mappedQuestions);
  drawQuestions(w, input.mappedQuestions);
  drawUnmatchedAnswers(w, input.unmatchedAnswers);
  drawFooters(w.doc, w.regular);

  return w.doc.save();
}

/** e.g. "alex-kim-report-2026-08-29.pdf" or "answer-sheet-report-2026-08-29.pdf". */
export function buildReportFilename(studentName: string | null): string {
  const datePart = new Date().toISOString().slice(0, 10);
  const namePart = studentName
    ? studentName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
    : null;
  return `${namePart ? `${namePart}-report` : "answer-sheet-report"}-${datePart}.pdf`;
}
