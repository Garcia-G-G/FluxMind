import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { generateObject } from "ai";
import { z } from "zod";
import { db } from "@/lib/db";
import { outputs } from "@/db/schema/outputs";
import { getModel } from "@/lib/ai/models";
import { getStudioContext, isError } from "@/lib/studio/generate";

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
    const { notebookId, model: modelId = "gemini-2.5-flash" } = body;

    const ctx = await getStudioContext(notebookId);
    if (isError(ctx)) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

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
        prompt: `Analyze these sources and create a mind map. Identify the central topic, then 4-7 subtopics, each with 2-4 details. Use IDs like st1, st2 for subtopics and d1, d2 for details.\n\nSources:\n${ctx.sourceContext}`,
      });

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
