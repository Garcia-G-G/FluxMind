import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { generateObject } from "ai";
import { z } from "zod";
import { db } from "@/lib/db";
import { outputs } from "@/db/schema/outputs";
import { getModel } from "@/lib/ai/models";
import { getStudioContext, isError } from "@/lib/studio/generate";

const newsletterSchema = z.object({
  title: z.string(),
  headline: z.string(),
  introduction: z.string(),
  sections: z.array(
    z.object({
      title: z.string(),
      body: z.string(),
      pullQuote: z.string().nullable(),
    })
  ),
  keyTakeaways: z.array(z.string()),
  cta: z.object({
    text: z.string(),
    buttonLabel: z.string(),
  }),
  footer: z.string(),
});

export type NewsletterContent = z.infer<typeof newsletterSchema>;

export const POST = async (request: NextRequest): Promise<NextResponse> => {
  try {
    const body = await request.json();
    const {
      notebookId,
      model: modelId = "gemini-2.5-flash",
      language: rawLanguage = "en",
      detailLevel: rawDetail = "standard",
      customPrompt: rawCustom = "",
      selectedSourceIds: rawSelectedSourceIds,
    } = body as {
      notebookId: string;
      model?: string;
      language?: string;
      detailLevel?: string;
      customPrompt?: string;
      selectedSourceIds?: string[];
    };
    const language: "en" | "es" = rawLanguage === "es" ? "es" : "en";
    const LANG_NAME = language === "es" ? "Spanish" : "English";
    const langInstr = `IMPORTANT: Generate ALL content in ${LANG_NAME}. Titles, body text, labels, prompts, everything must be in ${LANG_NAME}. Do not mix languages.`;

    const ALLOWED_DETAIL = ["concise", "standard", "detailed"] as const;
    const detailLevel: (typeof ALLOWED_DETAIL)[number] =
      ALLOWED_DETAIL.includes(rawDetail as (typeof ALLOWED_DETAIL)[number])
        ? (rawDetail as (typeof ALLOWED_DETAIL)[number])
        : "standard";
    const customPrompt = typeof rawCustom === "string" ? rawCustom : "";
    const selectedSourceIds: string[] = Array.isArray(rawSelectedSourceIds)
      ? rawSelectedSourceIds.filter((s): s is string => typeof s === "string")
      : [];

    const detailMap = {
      concise: "3 sections, 1 paragraph each, ~500 words",
      standard: "3-4 sections, 2-3 paragraphs each, 800-1200 words",
      detailed: "4 sections, 3 paragraphs each with deep analysis, 1500-2000 words",
    } as const;
    const detailInstr = detailMap[detailLevel] ?? detailMap.standard;
    const userInstr = customPrompt.trim()
      ? `\nUSER REQUEST: "${customPrompt.trim()}". Incorporate this focus into the output.\n`
      : "";

    const ctx = await getStudioContext(notebookId, selectedSourceIds, "studioGenerate");
    if (isError(ctx)) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

    const outputId = createId();
    await db.insert(outputs).values({
      id: outputId, notebookId, userId: ctx.userId, type: "newsletter",
      title: `Newsletter: ${ctx.notebookTitle}`, status: "generating",
      createdAt: new Date(), updatedAt: new Date(),
    });

    try {
      const { object: newsletter } = await generateObject({
        model: getModel(modelId),
        schema: newsletterSchema,
        prompt: `${langInstr}
${userInstr}
You are writing a Substack-grade newsletter that TEACHES real, specific facts from the provided sources. Conversational but authoritative tone. Every paragraph must pay rent — no filler, no throat-clearing.

═══════════════════════════════════════
STEP 1 — EXTRACT (silently first)
═══════════════════════════════════════
From the sources pull:
- The single most newsworthy claim or insight (future headline)
- Specific numbers, benchmarks, dates, names
- A surprising counter-intuitive finding
- One vivid example, anecdote, or mini case study
- A clear contrarian take or common misconception being corrected
- Direct quotable lines from the sources (future pullQuote material)
- Actions the reader can take after reading

Every sentence in the newsletter must trace back to an extraction. Do NOT invent facts.

═══════════════════════════════════════
STEP 2 — STRUCTURE (${detailInstr})
═══════════════════════════════════════
Produce:
- headline: punchy, specific, <12 words. Promises a concrete payoff.
- introduction: 2-3 sentences. Open with a hook (stat, scene, or contrarian claim) and state what the reader will learn.
- sections: per the detail level above. Each section:
  • title: short, concrete, no clickbait (e.g. "Why PUT is idempotent but not safe" — not "The shocking truth about HTTP").
  • body: the prescribed number of paragraphs of substantive prose. Use named entities, numbers, and cause-effect. NO generic "it's important to note" padding.
  • pullQuote: a vivid sentence lifted (or lightly edited) from the sources that earns a standalone callout. Null if none fits.
- keyTakeaways: 3-5 bullets. Each is ONE concrete, shareable line (not "be mindful of X").
- cta: text + buttonLabel. Specific ask (e.g. "Reply with the one framework you'll try this week" — "Send your pick").
- footer: 1 line. Signature / disclaimer / unsubscribe vibe.

═══════════════════════════════════════
STEP 3 — DENSITY CHECK
═══════════════════════════════════════
GOOD body paragraph: "Stripe's API uses idempotency keys to dedupe retried POSTs — the client sends Idempotency-Key: <uuid>, and Stripe stores the full response for 24 hours. That's why a flaky mobile connection doesn't result in double-charged customers."
BAD body paragraph:  "APIs can be tricky. It's important to handle retries carefully. Many companies struggle with this."

GOOD takeaway: "Treat idempotency keys as a 24-hour cache — retry with the same key, get the same response."
BAD takeaway:  "Be careful with API retries."

Reject and rewrite any section body that doesn't name specific things or give specific numbers.

═══════════════════════════════════════
STEP 4 — QUALITY BAR
═══════════════════════════════════════
- All content in ${LANG_NAME}.
- Voice: like a senior practitioner emailing a smart colleague — warm, opinionated, zero corporate-speak.
- Hit the target word count (see detail level).
- Pull quotes must read well standalone.

Sources:
${ctx.sourceContext}`,
      });

      await db.update(outputs).set({ content: newsletter as unknown as Record<string, unknown>, status: "ready", updatedAt: new Date() }).where(eq(outputs.id, outputId));
      return NextResponse.json({ id: outputId, ...newsletter }, { status: 201 });
    } catch (genError) {
      await db.update(outputs).set({ status: "error", content: { error: genError instanceof Error ? genError.message : "Failed" }, updatedAt: new Date() }).where(eq(outputs.id, outputId));
      throw genError;
    }
  } catch (error) {
    console.error("Newsletter generation failed:", error);
    return NextResponse.json({ error: "Generation failed" }, { status: 500 });
  }
};
