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
import { cacheDel, statsCacheKey } from "@/lib/cache/redis";

const quizSchema = z.object({
  title: z.string(),
  questions: z.array(
    z.discriminatedUnion("type", [
      z.object({
        id: z.string(),
        type: z.literal("multiple_choice"),
        question: z.string(),
        options: z.array(z.string()).length(4),
        correctAnswer: z.enum(["A", "B", "C", "D"]),
        explanation: z.string(),
        difficulty: z.enum(["easy", "medium", "hard"]),
        sourceReference: z.string(),
      }),
      z.object({
        id: z.string(),
        type: z.literal("true_false"),
        question: z.string(),
        correctAnswer: z.boolean(),
        explanation: z.string(),
        difficulty: z.enum(["easy", "medium", "hard"]),
        sourceReference: z.string(),
      }),
      z.object({
        id: z.string(),
        type: z.literal("free_response"),
        question: z.string(),
        sampleAnswer: z.string(),
        keyPoints: z.array(z.string()),
        difficulty: z.enum(["easy", "medium", "hard"]),
        sourceReference: z.string(),
      }),
    ])
  ),
});

export const POST = async (request: NextRequest): Promise<NextResponse> => {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const limited = await checkRateLimit({
      userId: session.user.id,
      bucket: "studio.quiz",
      ...RATE_LIMITS.studioGenerate,
    });
    if (limited) return limited;

    const body = await request.json();
    const {
      notebookId,
      count = 15,
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
      concise: `${count} short questions`,
      standard: `${count} balanced questions`,
      detailed: `${count} comprehensive questions with deep analysis`,
    } as const;
    const detailInstr = detailMap[detailLevel] ?? detailMap.standard;
    const userInstr = customPrompt.trim()
      ? `\nUSER REQUEST: "${customPrompt.trim()}". Incorporate this focus into the output.\n`
      : "";

    if (!notebookId) {
      return NextResponse.json({ error: "notebookId required" }, { status: 400 });
    }

    // Shared studio context: auth, ownership check, and DB-sliced source
    // text (LEFT() + LIMIT) in a single parallelized call.
    const ctx = await getStudioContext(notebookId, selectedSourceIds);
    if (isError(ctx)) {
      return NextResponse.json({ error: ctx.error }, { status: ctx.status });
    }
    const { notebookTitle, sourceContext } = ctx;

    // Create output record first
    const outputId = createId();
    await db.insert(outputs).values({
      id: outputId,
      notebookId,
      userId: session.user.id,
      type: "quiz",
      title: `Quiz: ${notebookTitle}`,
      status: "generating",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    // Stats cache invalidation — fire-and-forget, never fails the request.
    try {
      await cacheDel(statsCacheKey(session.user.id));
    } catch {
      /* no-op */
    }

    try {
      const { object: quiz } = await generateObject({
        model: getModel(modelId),
        schema: quizSchema,
        prompt: `${langInstr}
${userInstr}
You are an expert assessor building a quiz that tests real, specific knowledge from the provided sources. Every question must probe a concrete fact or relationship — NOT a vague "what is the main idea" prompt.

═══════════════════════════════════════
STEP 1 — EXTRACT (silently first)
═══════════════════════════════════════
Read the sources and list:
- Every precise definition
- Every number, statistic, date, or measurable claim
- Every named entity, technique, framework, or tool
- Every cause-effect relationship
- Every comparison, trade-off, or alternative
- Every ordered process or workflow
- Every common misconception the sources explicitly correct

Questions come from these extractions ONLY. Do NOT invent facts.

═══════════════════════════════════════
STEP 2 — STRUCTURE (${detailInstr})
═══════════════════════════════════════
Produce exactly that many questions, mixed:
- 60% Multiple Choice — 4 options labeled A) B) C) D), exactly 1 correct. Distractors MUST be plausible — pull from neighboring concepts in the sources, not obvious throwaways.
- 20% True/False — make the statement concrete enough that guessing is unreliable.
- 20% Free Response — ask for a short written answer (1-3 sentences). Provide a sampleAnswer and 2-4 keyPoints a grader should look for.

Every question needs:
- question: a specific, unambiguous prompt anchored to a fact in the sources.
- explanation: cite WHY the correct answer is correct AND reference the source.
- sourceReference: the [Title] of the source.
- difficulty: "easy" / "medium" / "hard".

Use sequential IDs: q1, q2, q3, ...

═══════════════════════════════════════
STEP 3 — DENSITY CHECK
═══════════════════════════════════════
GOOD question: "Which HTTP method is idempotent but NOT safe per RFC 7231?"
BAD question:  "What is the main point of the article about HTTP?"

GOOD explanation: "PUT is idempotent (repeating the request has the same effect) but not safe because it mutates state. See [RFC 7231 overview]."
BAD explanation:  "Because it is the correct answer."

For MC, reject any distractor that's a language trick ("all of the above", "none") — every distractor must reflect a real, adjacent concept.

═══════════════════════════════════════
STEP 4 — QUALITY BAR
═══════════════════════════════════════
- All content in ${LANG_NAME}.
- Difficulty distribution: ~30% easy / ~50% medium / ~20% hard.
- Questions answerable ONLY from the sources — no external trivia.
- No duplicate questions or paraphrased repeats.

Sources:
${sourceContext}`,
      });

      await db
        .update(outputs)
        .set({
          content: quiz as unknown as Record<string, unknown>,
          status: "ready",
          updatedAt: new Date(),
        })
        .where(eq(outputs.id, outputId));

      return NextResponse.json({ id: outputId, ...quiz }, { status: 201 });
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
    console.error("Quiz generation failed:", error);
    return NextResponse.json(
      { error: "Quiz generation failed" },
      { status: 500 }
    );
  }
};
