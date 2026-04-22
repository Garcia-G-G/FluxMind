import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { generateObject } from "ai";
import { z } from "zod";
import { db } from "@/lib/db";
import { outputs } from "@/db/schema/outputs";
import { getModel } from "@/lib/ai/models";
import { getStudioContext, isError } from "@/lib/studio/generate";

const threadSchema = z.object({
  title: z.string(),
  tweets: z.array(
    z.object({
      id: z.string(),
      text: z.string().max(280),
      isHook: z.boolean().nullable(),
      isCTA: z.boolean().nullable(),
    })
  ),
});

export type ThreadContent = z.infer<typeof threadSchema>;

export const POST = async (request: NextRequest): Promise<NextResponse> => {
  try {
    const body = await request.json();
    const {
      notebookId,
      model: modelId = "gemini-2.5-flash",
      language: rawLanguage = "en",
      customPrompt: rawCustom = "",
      selectedSourceIds: rawSelectedSourceIds,
    } = body as {
      notebookId: string;
      model?: string;
      language?: string;
      customPrompt?: string;
      selectedSourceIds?: string[];
    };
    const language: "en" | "es" = rawLanguage === "es" ? "es" : "en";
    const LANG_NAME = language === "es" ? "Spanish" : "English";
    const langInstr = `IMPORTANT: Generate ALL content in ${LANG_NAME}. Titles, body text, labels, prompts, everything must be in ${LANG_NAME}. Do not mix languages.`;

    const customPrompt = typeof rawCustom === "string" ? rawCustom : "";
    const selectedSourceIds: string[] = Array.isArray(rawSelectedSourceIds)
      ? rawSelectedSourceIds.filter((s): s is string => typeof s === "string")
      : [];
    const userInstr = customPrompt.trim()
      ? `\nUSER REQUEST: "${customPrompt.trim()}". Incorporate this focus into the output.\n`
      : "";

    const ctx = await getStudioContext(notebookId, selectedSourceIds, "studioGenerate");
    if (isError(ctx)) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

    const outputId = createId();
    await db.insert(outputs).values({
      id: outputId, notebookId, userId: ctx.userId, type: "thread",
      title: `Thread: ${ctx.notebookTitle}`, status: "generating",
      createdAt: new Date(), updatedAt: new Date(),
    });

    try {
      const { object: thread } = await generateObject({
        model: getModel(modelId),
        schema: threadSchema,
        prompt: `${langInstr}
${userInstr}
You are an expert X/Twitter ghostwriter turning the provided sources into a thread that TEACHES real, specific facts. Every tweet must carry a concrete idea — no "more soon" filler, no vague inspiration.

═══════════════════════════════════════
STEP 1 — EXTRACT (silently first)
═══════════════════════════════════════
From the sources pull:
- The single most counter-intuitive claim (hook candidate)
- Specific numbers, benchmarks, or dates
- Named tools, frameworks, people, or products
- A contrarian take or common misconception being corrected
- One memorable example, anecdote, or mini case study
- Actionable steps the reader can do today

Every tweet must be anchored in these extractions. Do NOT invent facts.

═══════════════════════════════════════
STEP 2 — STRUCTURE (8-15 tweets total)
═══════════════════════════════════════
- Tweet 1 = HOOK. Set isHook: true. Lead with a bold, specific claim, surprising stat, or provocative question drawn from the sources. No "A thread 🧵". Earn the click.
- Tweets 2 .. N-1 = value tweets. Each carries ONE concrete idea:
  • a specific claim + a number or named example
  • or a short bullet list (use •) of 3-4 concrete items
  • or a tiny before/after or do/don't contrast
  Vary the rhythm — never two long blocks in a row.
- Final tweet = CTA. Set isCTA: true. Recap the #1 takeaway in one line, then one low-friction ask (follow, reply with X, bookmark).

Per-tweet rules:
- MAX 280 characters per tweet. Count carefully — exceeding 280 is a failure.
- Plain language. No jargon unless you define it inline.
- Line breaks for rhythm, not padding.
- Maximum 1-2 emojis TOTAL across the whole thread. Zero is fine.
- NO hashtags anywhere.
- Sequential IDs: t1, t2, t3, ...

═══════════════════════════════════════
STEP 3 — DENSITY CHECK
═══════════════════════════════════════
GOOD hook: "99% of React devs use useEffect wrong. Here's the 1-line fix that cut our re-renders by 40%:"
BAD hook:  "Let's talk about React hooks. A thread 🧵"

GOOD middle tweet: "React batches updates inside event handlers — but NOT inside setTimeout, promise callbacks, or native event listeners. That's where extra re-renders sneak in."
BAD middle tweet:  "React is important. Many devs use it. Let's continue."

Reject any tweet that does not carry a concrete fact, number, name, or instruction.

═══════════════════════════════════════
STEP 4 — QUALITY BAR
═══════════════════════════════════════
- All content in ${LANG_NAME}.
- Exactly one tweet marked isHook: true (the first). Exactly one marked isCTA: true (the last). All others: both flags null or false.
- Every tweet under 280 chars.
- Thread should be re-shareable as-is by someone skimming their feed.

Sources:
${ctx.sourceContext}`,
      });

      await db.update(outputs).set({ content: thread as unknown as Record<string, unknown>, status: "ready", updatedAt: new Date() }).where(eq(outputs.id, outputId));
      return NextResponse.json({ id: outputId, ...thread }, { status: 201 });
    } catch (genError) {
      await db.update(outputs).set({ status: "error", content: { error: genError instanceof Error ? genError.message : "Failed" }, updatedAt: new Date() }).where(eq(outputs.id, outputId));
      throw genError;
    }
  } catch (error) {
    console.error("Thread generation failed:", error);
    return NextResponse.json({ error: "Generation failed" }, { status: 500 });
  }
};
