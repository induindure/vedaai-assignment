import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf-to-img / pdfjs-dist locate sibling asset files (standard fonts, cmaps) relative to
  // their own package.json at runtime, and @napi-rs/canvas ships native binaries — neither
  // survives being bundled, so both must be resolved via normal `require` from node_modules.
  serverExternalPackages: ["pdf-to-img", "pdfjs-dist", "@napi-rs/canvas"],
};

export default nextConfig;
