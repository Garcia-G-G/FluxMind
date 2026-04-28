import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { generateObject } from "ai";
import { z } from "zod";
import { db } from "@/lib/db";
import { outputs } from "@/db/schema/outputs";
import { getModel } from "@/lib/ai/models";
import { getStudioContext, isError } from "@/lib/studio/generate";

export const maxDuration = 60;

const mindMapSchema = z.object({
  centralTopic: z.object({
    label: z.string(),
    description: z.string(),
  }),
  subtopics: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      description: z.string(),
      details: z.array(
        z.object({
          id: z.string(),
          label: z.string(),
          description: z.string(),
        })
      ),
    })
  ),
});

export type MindMapContent = z.infer<typeof mindMapSchema>;

const LEVEL_1_COLORS = [
  "#e11d48", "#7c3aed", "#2563eb", "#ff6b35",
  "#22c55e", "#f59e0b", "#06b6d4",
];

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
      extraSourceContent: rawExtraSourceContent,
    } = body;
    const language: "en" | "es" = rawLanguage === "es" ? "es" : "en";
    const ALLOWED_DETAIL = ["concise", "standard", "detailed"] as const;
    const detailLevel: (typeof ALLOWED_DETAIL)[number] =
      ALLOWED_DETAIL.includes(rawDetail as (typeof ALLOWED_DETAIL)[number])
        ? (rawDetail as (typeof ALLOWED_DETAIL)[number])
        : "standard";
    const customPrompt = typeof rawCustom === "string" ? rawCustom : "";
    const selectedSourceIds: string[] = Array.isArray(rawSelectedSourceIds)
      ? rawSelectedSourceIds.filter((s): s is string => typeof s === "string")
      : [];
    const extraSourceContent: string =
      typeof rawExtraSourceContent === "string"
        ? rawExtraSourceContent.slice(0, 80_000)
        : "";

    // Hard caps per detail level — enforced both in prompt and by trimming.
    const detailMap = {
      concise: { subtopics: 3, details: 2, label: "3 subtopics, 2 details each" },
      standard: { subtopics: 5, details: 3, label: "4-5 subtopics, 2-3 details each" },
      detailed: { subtopics: 6, details: 4, label: "5-6 subtopics, 3-4 details each" },
    } as const;
    const pick = detailMap[detailLevel];
    const detailInstr = pick.label;

    const LANG_NAME = language === "es" ? "Spanish" : "English";
    const langInstr = `IMPORTANT: Generate ALL content in ${LANG_NAME}. Titles, body text, labels, prompts, everything must be in ${LANG_NAME}. Do not mix languages.`;
    const userInstr = customPrompt.trim()
      ? `\nUSER REQUEST: "${customPrompt.trim()}". Incorporate this focus into the output.\n`
      : "";

    const ctx = await getStudioContext(notebookId, selectedSourceIds, "studioGenerate");
    if (isError(ctx)) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

    const finalContext = extraSourceContent
      ? `${ctx.sourceContext}\n\n--- Additional sources ---\n${extraSourceContent}`
      : ctx.sourceContext;

    const outputId = createId();
    await db.insert(outputs).values({
      id: outputId, notebookId, userId: ctx.userId, type: "mindmap",
      title: `Mind Map: ${ctx.notebookTitle}`, status: "generating",
      createdAt: new Date(), updatedAt: new Date(),
    });

    try {
      const { object: mindMap } = await generateObject({
        model: getModel(modelId),
        schema: mindMapSchema,
        prompt: `${langInstr}
${userInstr}
You are building a mind map that TEACHES real, specific facts from the provided sources. Every node must carry a concrete piece of information extracted from the sources — NOT filler like "important concept" or "key idea".

═══════════════════════════════════════
STEP 1 — EXTRACT (silently first)
═══════════════════════════════════════
Read the sources and pull out:
- The central subject and the 3-6 ideas around it that matter most
- Named entities, tools, frameworks, people, or products under each idea
- Numbers, dates, benchmarks, measurable claims
- Definitions of key terms
- Cause-effect relationships
- Comparisons and trade-offs

Every node must trace back to an extraction. Do NOT invent facts.

═══════════════════════════════════════
STEP 2 — STRUCTURE (detail level: ${detailLevel} — ${detailInstr})
═══════════════════════════════════════
- Identify ONE central topic (2-4 words, the name of the whole subject).
- Produce ${pick.subtopics} subtopics (hard cap: no more than 6). Each subtopic is a major facet of the central topic.
- Each subtopic gets ${pick.details} details (hard cap: no more than 4). Each detail is a concrete fact under that subtopic.

ID rules:
- Subtopic IDs: st1, st2, st3, ...
- Detail IDs are globally unique across the whole map: d1, d2, d3, ...

Per-node content rules:
- label: 2-4 words max. Short, scannable, concrete (e.g. "DOM Tree Traversal" — NOT "How the DOM works").
- description: ONE sentence containing a REAL, specific fact from the sources — a named entity, a number, a technique, a cause-effect, or a direct definition.

═══════════════════════════════════════
STEP 3 — DENSITY CHECK
═══════════════════════════════════════
GOOD description: "React re-renders a component whenever its state or props change, using a virtual DOM diff to batch updates."
BAD description:  "Important concept in frontend development."

GOOD label: "Virtual DOM Diffing"
BAD label:  "How React Works Under the Hood in Modern Apps"  (too long)
BAD label:  "Important"                                        (too vague)

Reject any node whose description lacks a concrete fact; rewrite until every description names something specific.

═══════════════════════════════════════
STEP 4 — QUALITY BAR
═══════════════════════════════════════
- All text in ${LANG_NAME}.
- No two subtopics cover the same idea. No two details under one subtopic repeat.
- Subtopic order = logical flow (fundamentals → advanced, or cause → effect).

Sources:
${finalContext}`,
      });

      // Defensive cap: trim to hard limits even if the LLM over-generates.
      mindMap.subtopics = mindMap.subtopics.slice(0, 6).map((st) => ({
        ...st,
        details: st.details.slice(0, 4),
      }));

      // Transform to React Flow nodes and edges
      const nodes: Array<{
        id: string;
        label: string;
        description: string;
        level: number;
        color: string;
        parentId: string | null;
      }> = [];
      const edges: Array<{ source: string; target: string }> = [];

      // Central node
      const centralId = "central";
      nodes.push({
        id: centralId,
        label: mindMap.centralTopic.label,
        description: mindMap.centralTopic.description,
        level: 0,
        color: "#ff6b35",
        parentId: null,
      });

      // Subtopics
      mindMap.subtopics.forEach((st, i) => {
        const color = LEVEL_1_COLORS[i % LEVEL_1_COLORS.length];
        nodes.push({
          id: st.id,
          label: st.label,
          description: st.description,
          level: 1,
          color,
          parentId: centralId,
        });
        edges.push({ source: centralId, target: st.id });

        // Details
        st.details.forEach((d) => {
          nodes.push({
            id: d.id,
            label: d.label,
            description: d.description,
            level: 2,
            color: color + "99", // 60% opacity via hex alpha
            parentId: st.id,
          });
          edges.push({ source: st.id, target: d.id });
        });
      });

      const content = { nodes, edges, raw: mindMap };

      await db.update(outputs).set({
        content: content as unknown as Record<string, unknown>,
        status: "ready",
        updatedAt: new Date(),
      }).where(eq(outputs.id, outputId));

      return NextResponse.json({ id: outputId, ...content }, { status: 201 });
    } catch (genError) {
      await db.update(outputs).set({
        status: "error",
        content: { error: genError instanceof Error ? genError.message : "Failed" },
        updatedAt: new Date(),
      }).where(eq(outputs.id, outputId));
      throw genError;
    }
  } catch (error) {
    console.error("Mind map generation failed:", error);
    return NextResponse.json({ error: "Generation failed" }, { status: 500 });
  }
};
