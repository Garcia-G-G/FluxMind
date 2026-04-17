import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { generateObject } from "ai";
import { z } from "zod";
import { db } from "@/lib/db";
import { outputs } from "@/db/schema/outputs";
import { getModel } from "@/lib/ai/models";
import { getStudioContext, isError } from "@/lib/studio/generate";

const dataTableSchema = z.object({
  tables: z.array(
    z.object({
      title: z.string(),
      description: z.string(),
      columns: z.array(
        z.object({
          key: z.string(),
          label: z.string(),
          type: z.enum(["text", "number", "date"]),
        })
      ),
      rows: z.array(z.record(z.string(), z.unknown())),
      sourceReference: z.string(),
    })
  ),
});

export type DataTableContent = z.infer<typeof dataTableSchema>;

export const POST = async (request: NextRequest): Promise<NextResponse> => {
  try {
    const body = await request.json();
    const { notebookId, model: modelId = "gemini-2.5-flash" } = body;

    const ctx = await getStudioContext(notebookId);
    if (isError(ctx)) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

    const outputId = createId();
    await db.insert(outputs).values({
      id: outputId, notebookId, userId: ctx.userId, type: "data_table",
      title: `Data Tables: ${ctx.notebookTitle}`, status: "generating",
      createdAt: new Date(), updatedAt: new Date(),
    });

    try {
      const { object: tables } = await generateObject({
        model: getModel(modelId),
        schema: dataTableSchema,
        prompt: `Extract all structured/tabular data from the following sources. Identify data that can be meaningfully organized in rows and columns. If no explicit tables exist, extract any data that COULD be organized as a table (comparisons, lists with attributes, statistics, timelines). Column types: "text", "number", "date". Cite the source for each table.\n\nSources:\n${ctx.sourceContext}`,
      });

      await db.update(outputs).set({ content: tables as unknown as Record<string, unknown>, status: "ready", updatedAt: new Date() }).where(eq(outputs.id, outputId));
      return NextResponse.json({ id: outputId, ...tables }, { status: 201 });
    } catch (genError) {
      await db.update(outputs).set({ status: "error", content: { error: genError instanceof Error ? genError.message : "Failed" }, updatedAt: new Date() }).where(eq(outputs.id, outputId));
      throw genError;
    }
  } catch (error) {
    console.error("Data table generation failed:", error);
    return NextResponse.json({ error: "Generation failed" }, { status: 500 });
  }
};
