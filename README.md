# VedaAI

AI-assisted exam grading: upload a question paper and a student's handwritten answer sheet, and VedaAI extracts, maps, and grades the answers automatically.

**Live demo:** [PLACEHOLDER]

## Tech Stack

- [Next.js](https://nextjs.org) (App Router) + TypeScript
- [Tailwind CSS](https://tailwindcss.com)
- [Google Gemini API](https://ai.google.dev) (`@google/genai`) for vision extraction, content matching, and grading

## Features

- **Question extraction** — reads a question paper PDF/image and extracts every question (including labeled sub-parts, e.g. `11(a)`/`11(b)`) with a bounding box per question.
- **Handwritten answer extraction** — reads a scanned/photographed answer sheet and extracts each distinct block of handwriting, with its own bounding box, label (if any), and page.
- **Two-pass answer mapping** — direct label matching first, then a batched AI pass for anything left unresolved (see below).
- **Click-to-highlight** — selecting a question or an unmatched answer highlights exactly where it appears on the answer sheet image.
- **AI-generated grading and feedback** — each answered question gets a score, a verdict (correct/partial/incorrect), and 1–2 sentences of feedback.
- **PDF report export** — a printable summary (score, breakdown, per-question feedback, unmatched answers) generated server-side and downloadable from the results screen.
- **Multi-key Gemini failover** — automatically rotates to a backup API key on a quota-exhausted (429) response, so grading a batch of sheets isn't blocked by a single key's daily limit.

## How the Mapping Logic Works

Answers are matched to questions in two passes:

**Pass 1 — direct label matching.** Each handwritten block's detected label (e.g. `"Q11a"`, `"11 (a)"`, `"11a)"`, `"Ans 4"`) is normalized — stripping `Q`/`Ans`/`Answer` prefixes and punctuation — down to a bare `{number, subpart}` pair, and matched against questions normalized the same way. This resolves the common case cheaply and deterministically, with no AI call involved.

**Pass 2 — AI-assisted content matching.** Anything Pass 1 couldn't resolve (missing label, or a label that doesn't match any question) is batched into a single Gemini call alongside the full question list, asking it to match by topic/content — or leave it unmatched if nothing clearly fits, rather than forcing a guess.

Two more things happen as part of mapping:

- **Multi-page continuation** — an answer block flagged as continuing from the previous page is merged into the block before it, so an answer spanning a page break becomes one answer, not two.
- **Out-of-order detection** — while walking the mapped questions in question-paper order, a question is flagged "out of order" if its answer appears *earlier* on the answer sheet than an already-in-order preceding question's answer does — mirroring how a human grader reading top-to-bottom would notice it.

## Known Limitations

- **Gemini free-tier quota** — 20 requests/day per API key. Mitigated with automatic multi-key failover (`GEMINI_API_KEY`, `GEMINI_API_KEY_2`, ...), but a fixed number of evaluations/day is still the ceiling without a paid key.
- **Extraction accuracy** depends on handwriting legibility and image quality — messy handwriting or a low-quality scan/photo can affect what gets read correctly.
- **Processing time** varies with Gemini's response latency — typically **20–45 seconds** per full evaluation (extraction + mapping + grading), with some run-to-run variance outside the app's control.

## Running Locally

```bash
git clone <repository-url>
cd vedaai-assignment
npm install
```

Create a `.env` file in the project root with at least one Gemini API key:

```
GEMINI_API_KEY=your_key_here
# optional — enables automatic failover once the first key hits its quota
GEMINI_API_KEY_2=your_second_key_here
GEMINI_API_KEY_3=your_third_key_here
```

Then start the dev server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).
