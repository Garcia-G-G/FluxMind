import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  reactStrictMode: true,

  compiler: {
    // Strip console.* in prod except error/warn so real problems still surface.
    removeConsole: process.env.NODE_ENV === "production" ? { exclude: ["error", "warn"] } : false,
  },

  experimental: {
    // Next 15 default-optimizes lucide-react, date-fns, etc. These are the
    // heavy barrels FluxMind uses that aren't in the default list.
    optimizePackageImports: [
      "motion",
      "@xyflow/react",
      "@tanstack/react-table",
      "cmdk",
      "react-markdown",
      "remark-gfm",
      "sonner",
      "@ai-sdk/react",
    ],
  },

  // Keep these heavy / native-dependency packages as server-only externals
  // so Next doesn't try to bundle them into server chunks. Skipped:
  // youtube-transcript and cheerio are ESM-only (externalizing breaks
  // require()); let Next bundle them normally.
  serverExternalPackages: [
    "pdf-parse",
    "mammoth",
    "@aws-sdk/client-s3",
    "ioredis",
    "bullmq",
    "stripe",
  ],

  // Dev server: keep compiled routes warm for longer so flipping back to a
  // route doesn't recompile from scratch every time.
  onDemandEntries: {
    maxInactiveAge: 5 * 60 * 1000,
    pagesBufferLength: 8,
  },

  // Turbopack opt-in for `next dev` (stable in 15.5). The empty object is
  // a valid config; also requires `--turbopack` on the dev script.
  turbopack: {},
};

export default nextConfig;
