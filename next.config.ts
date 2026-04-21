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

  // `next/image` remote sources: R2 public bucket, fal.ai, ElevenLabs CDN,
  // Google / GitHub avatars (for OAuth profile images).
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.r2.cloudflarestorage.com" },
      { protocol: "https", hostname: "**.r2.dev" },
      { protocol: "https", hostname: "*.fal.media" },
      { protocol: "https", hostname: "fal.media" },
      { protocol: "https", hostname: "*.fal.run" },
      { protocol: "https", hostname: "fal.run" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
    ],
  },

  // Security headers.
  // CSP allows Stripe (checkout, webhooks), ElevenLabs audio streams,
  // fal.ai image + api, R2 storage, and the user's own origin. Next.js
  // requires 'unsafe-inline' for styles; scripts use 'self' + 'unsafe-eval'
  // only because dev + Next runtime inline-eval some chunks (production
  // removes most but not all).
  async headers() {
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' data: https://fonts.gstatic.com",
      "img-src 'self' data: blob: https:",
      "media-src 'self' blob: https://api.elevenlabs.io https:",
      "connect-src 'self' https: wss:",
      "frame-src 'self' https://js.stripe.com https://hooks.stripe.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "upgrade-insecure-requests",
    ].join("; ");

    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
          },
          { key: "X-DNS-Prefetch-Control", value: "on" },
        ],
      },
    ];
  },
};

export default nextConfig;
