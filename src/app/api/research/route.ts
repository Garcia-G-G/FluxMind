import { NextRequest } from "next/server";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { notebooks } from "@/db/schema/notebooks";
import { sources } from "@/db/schema/sources";
import { outputs } from "@/db/schema/outputs";
import { runResearchPipeline, type ResearchStep } from "@/lib/research/pipeline";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

export const maxDuration = 120;

export const POST = async (request: NextRequest): Promise<Response> => {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return new Response("Unauthorized", { status: 401 });
    }

    const limited = await checkRateLimit({
      userId: session.user.id,
      bucket: "research",
      ...RATE_LIMITS.deepResearch,
    });
    if (limited) return limited;

    const { query, notebookId, language: rawLanguage = "en" } = await request.json();

    if (!query || !notebookId) {
      return new Response("query and notebookId required", { status: 400 });
    }

    const language: "en" | "es" = rawLanguage === "es" ? "es" : "en";

    // Verify access
    const [notebook] = await db
      .select({ userId: notebooks.userId, title: notebooks.title })
      .from(notebooks)
      .where(eq(notebooks.id, notebookId));

    if (!notebook || notebook.userId !== session.user.id) {
      return new Response("Not found", { status: 404 });
    }

    // Get source summaries
    const notebookSources = await db
      .select({ title: sources.title, rawText: sources.rawText })
      .from(sources)
      .where(eq(sources.notebookId, notebookId));

    const sourceContext = notebookSources
      .filter((s) => s.rawText)
      .map((s) => `[${s.title}]\n${s.rawText!.slice(0, 3000)}`)
      .join("\n\n---\n\n");

    // SSE stream
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (step: ResearchStep): void => {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(step)}\n\n`)
          );
        };

        try {
          const report = await runResearchPipeline({
            query,
            sourceContext,
            language,
            onStep: send,
          });

          // Save as output
          const outputId = createId();
          await db.insert(outputs).values({
            id: outputId,
            notebookId,
            userId: session.user.id,
            type: "research_report",
            title: `Research: ${query.slice(0, 80)}`,
            content: { report, query },
            status: "ready",
            createdAt: new Date(),
            updatedAt: new Date(),
          });

          send({
            type: "complete",
            message: "Research complete!",
            progress: 100,
            data: { outputId, report },
          });
        } catch (error) {
          send({
            type: "error",
            message:
              error instanceof Error
                ? error.message
                : "Research failed",
            progress: 0,
          });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Research failed:", error);
    return new Response("Internal server error", { status: 500 });
  }
};
