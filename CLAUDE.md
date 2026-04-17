# FluxMind — Project Instructions

## Stack
- Next.js 15+ (App Router, RSC, Server Actions, TypeScript strict)
- Tailwind CSS v4 + shadcn/ui (copy-paste, not npm package)
- Drizzle ORM + PostgreSQL 16 + pgvector + pgvectorscale
- Redis 7 (BullMQ for queues, caching, rate limiting)
- Better Auth (email/password + Google OAuth + GitHub OAuth)
- Vercel AI SDK v5 (@ai-sdk/google, @ai-sdk/anthropic, @ai-sdk/openai)
- Motion (formerly Framer Motion) for animations
- tldraw SDK for infinite canvas
- ElevenLabs API for TTS/podcasts
- Fal.ai for image/video generation
- Cloudflare R2 for object storage
- Stripe for payments

## Code Style
- Use ES modules (import/export), never CommonJS
- Use named exports, not default exports (except Next.js pages)
- Destructure imports: `import { useState } from 'react'`
- Use `type` imports for type-only imports: `import type { User } from './types'`
- Prefer `const` arrow functions for components: `const MyComponent = () => {}`
- All components must be typed with explicit return types
- Use Zod for all input validation (API routes, forms, env vars)
- Error handling: always use try/catch in async functions, never swallow errors
- File naming: kebab-case for files, PascalCase for components, camelCase for utils

## Testing
- Use Vitest for unit tests, Playwright for E2E
- Run `pnpm test` after every implementation to verify
- Run `pnpm build` after every implementation to check for type errors
- Run `pnpm lint` after every implementation to check for lint errors
- If any of these fail, fix the issue and re-run. Do NOT move on until all pass.

## Database
- Use Drizzle ORM — never write raw SQL except for pgvector queries
- All tables use text IDs generated with `createId()` from `@paralleldrive/cuid2`
- Always add indexes for foreign keys and frequently queried columns
- Use `jsonb` for flexible/structured data, with Zod schemas for validation

## Git
- Commit after each major feature is working and tests pass
- Commit messages: conventional commits (feat:, fix:, chore:, refactor:)
- Never commit .env files or secrets

## Important
- ALWAYS check that the dev server starts without errors after changes
- ALWAYS run the full test suite before considering a task complete
- If you're unsure about an approach, research it first (read docs, check npm, look at examples)
- Prefer established, well-maintained packages over writing from scratch
- When installing packages, verify they support the latest Next.js version
