import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { generateObject } from "ai";
import { z } from "zod";
import { db } from "@/lib/db";
import { outputs } from "@/db/schema/outputs";
import { getModel } from "@/lib/ai/models";
import { getStudioContext, isError } from "@/lib/studio/generate";

const courseSchema = z.object({
  title: z.string(),
  description: z.string(),
  lessons: z
    .array(
      z.object({
        id: z.string(),
        title: z.string(),
        objective: z.string(),
        content: z.string(),
        keyConcepts: z.array(z.string()),
        quiz: z.array(
          z.object({
            question: z.string(),
            options: z.array(z.string()).length(4),
            correct: z.enum(["A", "B", "C", "D"]),
            explanation: z.string(),
          }),
        ),
        flashcards: z.array(
          z.object({
            front: z.string(),
            back: z.string(),
          }),
        ),
      }),
    )
    .min(4)
    .max(10),
  prerequisites: z.array(z.string()),
  estimatedDuration: z.string(),
});

export type CourseContent = z.infer<typeof courseSchema>;

export const POST = async (request: NextRequest): Promise<NextResponse> => {
  try {
    const body = await request.json();
    const {
      notebookId,
      count: rawCount,
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

    // lessons schema min 4, max 10 — clamp the user count into that band.
    const defaultCountByDetail = {
      concise: 5,
      standard: 6,
      detailed: 8,
    } as const;
    const reqCount =
      typeof rawCount === "number" && Number.isFinite(rawCount)
        ? Math.round(rawCount)
        : defaultCountByDetail[detailLevel];
    const count = Math.min(10, Math.max(4, reqCount));

    const detailMap = {
      concise: `${count} lessons, concise content`,
      standard: `${count} lessons, comprehensive`,
      detailed: `${count} lessons, deep dives with advanced topics`,
    } as const;
    const detailInstr = detailMap[detailLevel] ?? detailMap.standard;
    const userInstr = customPrompt.trim()
      ? `\nUSER REQUEST: "${customPrompt.trim()}". Incorporate this focus into the output.\n`
      : "";

    const ctx = await getStudioContext(notebookId, selectedSourceIds, "studioGenerate");
    if (isError(ctx)) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

    const outputId = createId();
    await db.insert(outputs).values({
      id: outputId, notebookId, userId: ctx.userId, type: "course",
      title: `Course: ${ctx.notebookTitle}`, status: "generating",
      createdAt: new Date(), updatedAt: new Date(),
    });

    try {
      const { object: course } = await generateObject({
        model: getModel(modelId),
        schema: courseSchema,
        prompt: `${langInstr}
${userInstr}
You are an expert curriculum designer turning the provided sources into a mini-course that TEACHES real, specific facts. Every lesson must carry concrete content — no "overview of the topic" filler.

═══════════════════════════════════════
STEP 1 — EXTRACT (silently first)
═══════════════════════════════════════
Read the sources and list:
- Every named concept, tool, framework, person, product
- Every number, benchmark, date, measurable claim
- Every defined term
- Every process, workflow, or ordered procedure
- Every comparison or trade-off
- Every cause-effect relationship
- Every common misconception explicitly corrected

These extractions are the raw material for every lesson. Do NOT invent facts.

═══════════════════════════════════════
STEP 2 — STRUCTURE (${detailInstr})
═══════════════════════════════════════
Produce exactly ${count} lessons in a logical progression from fundamentals → advanced.

Top-level:
- title: name of the course (e.g. "HTTP APIs: From First Principles to Production").
- description: 2-3 sentences promising a concrete payoff.
- prerequisites: 2-4 bullets of what the learner should already know (or "None").
- estimatedDuration: total time budget (e.g. "3-4 hours").

Per lesson:
- id: l1, l2, l3, ...
- title: concrete, specific (e.g. "Idempotency keys and safe retries" — not "APIs part 3").
- objective: ONE sentence. What the learner will be able to DO after this lesson.
- content: Markdown. 2-4 paragraphs packed with specific facts from the sources — named things, numbers, cause-effect. Use code blocks / numbered lists when they sharpen the idea.
- keyConcepts: 2-4 short concrete terms the learner must walk away knowing.
- quiz: 2-3 multiple-choice questions (4 options A/B/C/D). Distractors must be plausible neighboring concepts. Include an explanation that cites WHY the correct answer is correct.
- flashcards: 2-3 front/back pairs covering the lesson's core facts (front: term/question; back: 1-2 sentence concrete fact).

═══════════════════════════════════════
STEP 3 — DENSITY CHECK
═══════════════════════════════════════
GOOD lesson content: "PUT replaces a resource idempotently — repeating the same PUT yields the same server state. POST, in contrast, creates a new resource each call, which is why Stripe uses Idempotency-Key headers to dedupe retried POSTs for 24 hours."
BAD lesson content:  "APIs can be tricky. PUT and POST are different. Use them carefully."

GOOD objective: "Choose between PUT and POST by applying the idempotency test to any mutation endpoint."
BAD objective:  "Understand HTTP methods."

Reject any lesson whose content is generic; rewrite until it names specific things.

═══════════════════════════════════════
STEP 4 — QUALITY BAR
═══════════════════════════════════════
- All content in ${LANG_NAME}.
- Lesson count ∈ [4, 10] — aim for ${count}.
- Lessons build on each other: no forward-references to un-introduced concepts.
- Quiz distractors never include "all of the above" / "none of the above".

Sources:
${ctx.sourceContext}`,
      });

      await db.update(outputs).set({ content: course as unknown as Record<string, unknown>, status: "ready", updatedAt: new Date() }).where(eq(outputs.id, outputId));
      return NextResponse.json({ id: outputId, ...course }, { status: 201 });
    } catch (genError) {
      await db.update(outputs).set({ status: "error", content: { error: genError instanceof Error ? genError.message : "Failed" }, updatedAt: new Date() }).where(eq(outputs.id, outputId));
      throw genError;
    }
  } catch (error) {
    console.error("Course generation failed:", error);
    return NextResponse.json({ error: "Generation failed" }, { status: 500 });
  }
};
