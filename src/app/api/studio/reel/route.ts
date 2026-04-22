import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { generateObject } from "ai";
import { z } from "zod";
import { db } from "@/lib/db";
import { outputs } from "@/db/schema/outputs";
import { getModel } from "@/lib/ai/models";
import { getStudioContext, isError } from "@/lib/studio/generate";

const reelSchema = z.object({
  title: z.string(),
  durationEstimate: z.number(),
  sections: z.array(
    z.object({
      type: z.enum(["hook", "content", "cta"]),
      text: z.string(),
      visualSuggestion: z.string(),
      duration: z.number(),
    })
  ),
  caption: z.string(),
  musicSuggestion: z.string(),
});

export type ReelContent = z.infer<typeof reelSchema>;

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
      id: outputId, notebookId, userId: ctx.userId, type: "reel",
      title: `Reel: ${ctx.notebookTitle}`, status: "generating",
      createdAt: new Date(), updatedAt: new Date(),
    });

    try {
      const { object: reel } = await generateObject({
        model: getModel(modelId),
        schema: reelSchema,
        prompt: `${langInstr}
${userInstr}
You are a short-form video writer (TikTok / Reels / Shorts) turning the provided sources into a 30-60 second script that TEACHES ONE concrete idea. Scroll-stop rhythm, zero filler.

═══════════════════════════════════════
STEP 1 — EXTRACT (silently first)
═══════════════════════════════════════
From the sources pull:
- The single most counter-intuitive or surprising claim (becomes the hook)
- 3-5 supporting beats: a named technique, a number, an example, a do/don't
- One payoff the viewer can DO after watching
- Visual hooks the scene can cut to (a diagram, a side-by-side, a before/after, an object on screen)

Every line the narrator says must trace back to an extraction. Do NOT invent facts.

═══════════════════════════════════════
STEP 2 — STRUCTURE (30-60 seconds total)
═══════════════════════════════════════
Produce sections in this order:
1. HOOK (type: "hook", 0-3s). ONE sentence. A specific claim, number, or question that makes the viewer stop scrolling. text: narrator line (spoken in <3s). visualSuggestion: what is ON SCREEN during the hook (e.g. "Text overlay of the claim in bold, pan across a messy codebase"). duration: 2-3.
2. CONTENT (type: "content", 3-50s). 3-5 sections. Each carries ONE concrete beat (a named thing + a specific detail). text: ~1 sentence. visualSuggestion: concrete scene (NOT "b-roll of coding"). duration: 6-12 each.
3. CTA (type: "cta", last 5-10s). ONE sentence. Name the ONE action: follow for part 2, try X this week, bookmark for Y. text + visualSuggestion + duration: 5-10.

Top-level:
- title: internal label, <8 words.
- durationEstimate: sum of all section durations (must land in 30-60).
- caption: the actual post caption — 1-2 sentences, specific payoff, then 3-5 relevant hashtags on a new line.
- musicSuggestion: name a genre + vibe (e.g. "Lo-fi hip-hop, building energy. Think 'Nujabes instrumental'."). Not a specific copyrighted song.

═══════════════════════════════════════
STEP 3 — DENSITY CHECK
═══════════════════════════════════════
GOOD hook text: "99% of React devs use useEffect wrong. Here's the one-line fix."
BAD hook text:  "Today we're going to talk about React."

GOOD content text: "React batches updates inside onClick — but NOT inside setTimeout. That's where the double render sneaks in."
BAD content text:  "State management is important. Be careful with hooks."

GOOD visualSuggestion: "Split-screen: left shows the buggy setTimeout version with 3 re-renders flashing; right shows the flushSync fix with 1 render."
BAD visualSuggestion:  "B-roll of a developer typing."

Reject any section whose text or visualSuggestion is generic.

═══════════════════════════════════════
STEP 4 — QUALITY BAR
═══════════════════════════════════════
- All content in ${LANG_NAME}.
- Total duration MUST be between 30 and 60 seconds (sum(duration) ∈ [30, 60]).
- ONE idea per reel. No topic hopping.
- Sentence lengths tuned for spoken delivery (short, punchy).

Sources:
${ctx.sourceContext}`,
      });

      await db.update(outputs).set({ content: reel as unknown as Record<string, unknown>, status: "ready", updatedAt: new Date() }).where(eq(outputs.id, outputId));
      return NextResponse.json({ id: outputId, ...reel }, { status: 201 });
    } catch (genError) {
      await db.update(outputs).set({ status: "error", content: { error: genError instanceof Error ? genError.message : "Failed" }, updatedAt: new Date() }).where(eq(outputs.id, outputId));
      throw genError;
    }
  } catch (error) {
    console.error("Reel generation failed:", error);
    return NextResponse.json({ error: "Generation failed" }, { status: 500 });
  }
};
