import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { generateObject } from "ai";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { outputs } from "@/db/schema/outputs";
import { getModel } from "@/lib/ai/models";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { getStudioContext, isError } from "@/lib/studio/generate";
import { cacheDel, statsCacheKey, dashboardCacheKey } from "@/lib/cache/redis";

const flashcardsSchema = z.object({
  title: z.string(),
  cards: z.array(
    z.object({
      id: z.string(),
      front: z.string(),
      back: z.string(),
      hint: z.string().min(5),
      difficulty: z.enum(["easy", "medium", "hard"]),
      sourceReference: z.string(),
      tags: z.array(z.string()),
    })
  ),
});

export type FlashcardContent = z.infer<typeof flashcardsSchema>;

export const POST = async (request: NextRequest): Promise<NextResponse> => {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const limited = await checkRateLimit({
      userId: session.user.id,
      bucket: "studio.flashcards",
      ...RATE_LIMITS.studioGenerate,
    });
    if (limited) return limited;

    const body = await request.json();
    const {
      notebookId,
      count = 20,
      model: modelId = "gemini-2.5-flash",
      language: rawLanguage = "en",
      detailLevel: rawDetail = "standard",
      customPrompt: rawCustom = "",
      selectedSourceIds: rawSelectedSourceIds,
    } = body as {
      notebookId: string;
      count?: number;
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
      concise: `${count} cards, 10 most critical facts only`,
      standard: `${count} cards covering all major concepts`,
      detailed: `${count} cards incl. advanced concepts + edge cases`,
    } as const;
    const detailInstr = detailMap[detailLevel] ?? detailMap.standard;
    const userInstr = customPrompt.trim()
      ? `\nUSER REQUEST: "${customPrompt.trim()}". Incorporate this focus into the output.\n`
      : "";

    if (!notebookId) {
      return NextResponse.json({ error: "notebookId required" }, { status: 400 });
    }

    // Shared studio context: auth + ownership check + DB-sliced source text.
    const ctx = await getStudioContext(notebookId, selectedSourceIds);
    if (isError(ctx)) {
      return NextResponse.json({ error: ctx.error }, { status: ctx.status });
    }
    const { notebookTitle, sourceContext } = ctx;

    const outputId = createId();
    await db.insert(outputs).values({
      id: outputId,
      notebookId,
      userId: session.user.id,
      type: "flashcards",
      title: `Flashcards: ${notebookTitle}`,
      status: "generating",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    try {
      await cacheDel(statsCacheKey(session.user.id));
      await cacheDel(dashboardCacheKey(session.user.id));
    } catch {
      /* no-op */
    }

    try {
      const { object: flashcards } = await generateObject({
        model: getModel(modelId),
        schema: flashcardsSchema,
        prompt: `${langInstr}
${userInstr}
You are an expert teacher producing flashcards that TEACH real, specific facts from the provided sources. Do NOT generate filler. Every card must carry concrete information lifted from the sources.

═══════════════════════════════════════
STEP 1 — EXTRACT (silently first)
═══════════════════════════════════════
Read the sources and list:
- Every term with a precise definition
- Every named entity, tool, framework, person, place, or product
- Every number, date, percentage, or measurable claim
- Every cause-effect relationship
- Every comparison, trade-off, or contrast
- Every process or ordered workflow
- Every key insight the author wants the reader to remember

These extractions are the raw material. Do NOT invent facts.

═══════════════════════════════════════
STEP 2 — STRUCTURE (${detailInstr})
═══════════════════════════════════════
Produce exactly that set of flashcards. For each card:
- front: ONE focused term, concept, or question (short, no compound questions).
- back: 1-3 sentences, packed with a real fact, number, name, or cause from the sources. Never vague.
- hint: ONE short nudge (5-15 words) that helps the learner recall the answer WITHOUT giving it away. Always required.
- difficulty: "easy" (recognition), "medium" (recall + light reasoning), or "hard" (multi-step reasoning or edge case).
- sourceReference: the [Title] of the source this fact came from.
- tags: 1-3 short tags grouping related cards (e.g. "api-design", "perf", "auth").

Mix card types:
- ~40% definitions (term → meaning)
- ~25% application ("When would you use X?")
- ~20% comparison ("Difference between X and Y")
- ~15% process/step questions

Use sequential IDs: f1, f2, f3, ...

═══════════════════════════════════════
STEP 3 — DENSITY CHECK
═══════════════════════════════════════
Reject any card whose "back" is vague ("it is important", "a key concept", "helps with things"). Rewrite until every back carries a concrete fact.

GOOD back: "React batches state updates inside event handlers so multiple setState calls in the same tick produce a single re-render."
BAD back:  "React updates state in a useful way."

GOOD hint: "Think about what happens inside onClick handlers."
BAD hint:  "It's about React state."

═══════════════════════════════════════
STEP 4 — QUALITY BAR
═══════════════════════════════════════
- All content in ${LANG_NAME}.
- No duplicated concepts across cards.
- Every card must be answerable ONLY from the sources.
- Balance difficulty: roughly 30% easy / 50% medium / 20% hard.

Sources:
${sourceContext}`,
      });

      await db
        .update(outputs)
        .set({
          content: flashcards as unknown as Record<string, unknown>,
          status: "ready",
          updatedAt: new Date(),
        })
        .where(eq(outputs.id, outputId));

      return NextResponse.json({ id: outputId, ...flashcards }, { status: 201 });
    } catch (genError) {
      await db
        .update(outputs)
        .set({
          status: "error",
          content: {
            error:
              genError instanceof Error
                ? genError.message
                : "Generation failed",
          },
          updatedAt: new Date(),
        })
        .where(eq(outputs.id, outputId));
      throw genError;
    }
  } catch (error) {
    console.error("Flashcard generation failed:", error);
    return NextResponse.json(
      { error: "Flashcard generation failed" },
      { status: 500 }
    );
  }
};
