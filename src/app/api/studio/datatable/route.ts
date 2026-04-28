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
      id: outputId, notebookId, userId: ctx.userId, type: "data_table",
      title: `Data Tables: ${ctx.notebookTitle}`, status: "generating",
      createdAt: new Date(), updatedAt: new Date(),
    });

    try {
      const { object: tables } = await generateObject({
        model: getModel(modelId),
        schema: dataTableSchema,
        prompt: `${langInstr}
${userInstr}
You are an analyst turning the provided sources into structured data tables. Every row must carry real values lifted from the sources — no invented data, no placeholder rows.

═══════════════════════════════════════
STEP 1 — EXTRACT (silently first)
═══════════════════════════════════════
Scan the sources and list every piece of data that could sit in a table:
- Explicit tables / stat blocks / lists with attributes
- Comparisons between 2+ named things (tool A vs tool B)
- Timelines (events with dates)
- Benchmarks and measurements (tool + metric + value)
- Specifications (property + value pairs)
- Taxonomies or hierarchies with attributes
- Case studies / examples with shared fields

═══════════════════════════════════════
STEP 2 — STRUCTURE
═══════════════════════════════════════
Produce 1-5 tables. Each table must be genuinely useful — never force data into a table that isn't tabular. For each:
- title: describes the entities being tabulated (e.g. "HTTP methods: safety and idempotency").
- description: 1 sentence on what the table shows AND why it's useful.
- columns: 3-6 columns. Each has:
  • key: snake_case programmatic key (e.g. "safe", "idempotent", "common_use").
  • label: human label (e.g. "Safe?", "Idempotent?", "Common use").
  • type: "text" / "number" / "date". Pick the type that matches the actual cell values.
- rows: 3-20 rows. Each row is a record keyed by the column keys. Values MUST match the column type:
  • "number" → raw JS number (NOT "42 ms" strings; put units in the label).
  • "date" → ISO-ish string the viewer can parse ("2025-03-14" or "March 2025").
  • "text" → concrete string; avoid "N/A" unless the source itself says unknown.
- sourceReference: the [Title] of the source the table was built from.

═══════════════════════════════════════
STEP 3 — DENSITY CHECK
═══════════════════════════════════════
GOOD table: HTTP methods × {safe, idempotent, typical use} with rows GET/POST/PUT/PATCH/DELETE and real values.
BAD table:  "Topics" with rows "Topic 1 / Topic 2 / Topic 3" — no structure, just a list.

GOOD cell value: 250 (type "number", column "p99_ms")
BAD cell value:  "fast" (type "number") — type mismatch

Reject any table where >25% of cells are empty, "N/A", or repeated filler. Drop that table rather than pad it.

═══════════════════════════════════════
STEP 4 — QUALITY BAR
═══════════════════════════════════════
- All labels / descriptions / cell strings in ${LANG_NAME}.
- Column keys are stable snake_case (no spaces, no punctuation).
- Numeric columns contain only numbers. Date columns contain only dates.
- If the sources contain NO tabular data, return tables: [] — do NOT invent content.

Sources:
${ctx.sourceContext}`,
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
