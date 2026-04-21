import { z } from "zod";

/**
 * Single source of truth for environment variables.
 *
 * - Required vars are validated at module load; build fails fast if missing.
 * - Optional vars are validated when provided (e.g. if BETTER_AUTH_SECRET is
 *   set, it must be 32+ chars of high entropy).
 * - Import from here (`import { env } from "@/env"`) instead of reading
 *   `process.env.X` directly. The types flow through.
 *
 * Client-exposed vars must be prefixed with `NEXT_PUBLIC_` — those land on
 * the browser bundle. Everything else is server-only.
 */

const optionalString = z.string().trim().min(1).optional();
const optionalUrl = z.string().trim().url().optional();

const serverSchema = z.object({
  // Required
  DATABASE_URL: z.string().trim().url(),
  REDIS_URL: z.string().trim().min(1),
  BETTER_AUTH_SECRET: z
    .string()
    .trim()
    .min(32, "BETTER_AUTH_SECRET must be at least 32 characters. Generate one with `openssl rand -base64 32`."),
  BETTER_AUTH_URL: z.string().trim().url(),

  // Optional — features degrade when missing.
  OPENAI_API_KEY: optionalString,
  GOOGLE_GENERATIVE_AI_API_KEY: optionalString,
  GEMINI_API_KEY: optionalString,
  ELEVENLABS_API_KEY: optionalString,
  ELEVENLABS_VOICE_ALEX: optionalString,
  ELEVENLABS_VOICE_JORDAN: optionalString,
  ELEVENLABS_VOICE_VIDEO: optionalString,
  FAL_KEY: optionalString,

  // R2 storage (optional — falls back to public/uploads/)
  R2_ACCOUNT_ID: optionalString,
  R2_ACCESS_KEY_ID: optionalString,
  R2_SECRET_ACCESS_KEY: optionalString,
  R2_BUCKET_NAME: optionalString,
  R2_PUBLIC_URL: optionalUrl,

  // OAuth (optional — providers aren't registered when either half is missing)
  GOOGLE_CLIENT_ID: optionalString,
  GOOGLE_CLIENT_SECRET: optionalString,
  GITHUB_CLIENT_ID: optionalString,
  GITHUB_CLIENT_SECRET: optionalString,

  // Stripe (optional — billing features no-op when missing)
  STRIPE_SECRET_KEY: optionalString,
  STRIPE_WEBHOOK_SECRET: optionalString,
  STRIPE_PRO_PRICE_ID: optionalString,
  STRIPE_ULTRA_PRICE_ID: optionalString,

  // Web search for deep research
  SERPER_API_KEY: optionalString,

  // Processing toggles
  MOCK_EMBEDDINGS: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),

  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

const clientSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().trim().url(),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: optionalString,
});

const parseOrThrow = <T extends z.ZodTypeAny>(
  schema: T,
  raw: Record<string, unknown>,
  label: string,
): z.infer<T> => {
  const result = schema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid ${label} environment variables:\n${issues}`);
  }
  return result.data;
};

// Skip validation during `next build` collection when the runtime hasn't been
// told whether it's the server or client — this lets `pnpm build` work even
// when env vars are supplied at runtime.
const SKIP_VALIDATION = process.env.SKIP_ENV_VALIDATION === "1";

const serverRaw = {
  DATABASE_URL: process.env.DATABASE_URL,
  REDIS_URL: process.env.REDIS_URL,
  BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
  BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  GOOGLE_GENERATIVE_AI_API_KEY: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  ELEVENLABS_API_KEY: process.env.ELEVENLABS_API_KEY,
  ELEVENLABS_VOICE_ALEX: process.env.ELEVENLABS_VOICE_ALEX,
  ELEVENLABS_VOICE_JORDAN: process.env.ELEVENLABS_VOICE_JORDAN,
  ELEVENLABS_VOICE_VIDEO: process.env.ELEVENLABS_VOICE_VIDEO,
  FAL_KEY: process.env.FAL_KEY,
  R2_ACCOUNT_ID: process.env.R2_ACCOUNT_ID,
  R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY,
  R2_BUCKET_NAME: process.env.R2_BUCKET_NAME,
  R2_PUBLIC_URL: process.env.R2_PUBLIC_URL,
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID,
  GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET,
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
  STRIPE_PRO_PRICE_ID: process.env.STRIPE_PRO_PRICE_ID,
  STRIPE_ULTRA_PRICE_ID: process.env.STRIPE_ULTRA_PRICE_ID,
  SERPER_API_KEY: process.env.SERPER_API_KEY,
  MOCK_EMBEDDINGS: process.env.MOCK_EMBEDDINGS,
  NODE_ENV: process.env.NODE_ENV,
};

const clientRaw = {
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
};

type ServerEnv = z.infer<typeof serverSchema>;
type ClientEnv = z.infer<typeof clientSchema>;

const buildEnv = (): ServerEnv & ClientEnv => {
  if (SKIP_VALIDATION) {
    return { ...serverRaw, ...clientRaw } as unknown as ServerEnv & ClientEnv;
  }
  const server =
    typeof window === "undefined"
      ? parseOrThrow(serverSchema, serverRaw, "server")
      : ({} as ServerEnv);
  const client = parseOrThrow(clientSchema, clientRaw, "client");
  return { ...server, ...client };
};

export const env = buildEnv();
