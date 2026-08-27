import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf-to-img / pdfjs-dist locate sibling asset files (standard fonts, cmaps) relative to
  // their own package.json at runtime, and @napi-rs/canvas ships native binaries — neither
  // survives being bundled, so both must be resolved via normal `require` from node_modules.
  serverExternalPackages: ["pdf-to-img", "pdfjs-dist", "@napi-rs/canvas"],

  // `serverExternalPackages` only stops these from being bundled — it doesn't guarantee
  // Vercel's file tracer (which decides what actually ships in the deployed function) picks
  // up every file these packages touch at runtime. Two known gaps in this pipeline:
  //
  // 1. @napi-rs/canvas resolves its native .node binding through a long chain of
  //    platform-branching `require()` calls (see js-binding.js), and pdfjs-dist's own
  //    `require("@napi-rs/canvas")` is itself wrapped in a try/catch specifically so it can
  //    degrade gracefully when the package is absent — exactly the pattern static tracers
  //    most often under-include. This is also Next's own documented example for this class
  //    of problem (see the `sharp` example in the outputFileTracingIncludes docs).
  // 2. pdfjs-dist's standard-fonts/cmaps assets aren't `require`d/`import`ed at all — our
  //    code (lib/fileToImages.ts) reads them via `fs.readFile` at a path built from
  //    `process.cwd()` at runtime, which no static tracer can follow. Missing these doesn't
  //    crash anything; it silently degrades to garbled glyphs for PDFs using non-embedded
  //    standard fonts (we hit exactly this on Windows before fixing the path computation),
  //    which is worse than a crash because it fails quietly in production.
  outputFileTracingIncludes: {
    "/api/process": [
      "./node_modules/@napi-rs/canvas/**/*",
      "./node_modules/@napi-rs/canvas-*/**/*",
      "./node_modules/pdfjs-dist/standard_fonts/**/*",
      "./node_modules/pdfjs-dist/cmaps/**/*",
    ],
  },
};

export default nextConfig;
