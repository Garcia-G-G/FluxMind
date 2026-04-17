import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { generateText } from "ai";
import { auth } from "@/lib/auth";
import { getModel } from "@/lib/ai/models";
import { retrieveContext, buildSystemPrompt } from "@/lib/ai/rag";

export const POST = async (request: NextRequest): Promise<NextResponse> => {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { question, notebookId } = await request.json();

    if (!question || !notebookId) {
      return NextResponse.json(
        { error: "question and notebookId required" },
        { status: 400 }
      );
    }

    // RAG retrieval for grounded answer
    const chunks = await retrieveContext(notebookId, question, 10);
    const systemPrompt = buildSystemPrompt(chunks);

    const { text } = await generateText({
      model: getModel("gemini-2.5-flash"),
      system: `${systemPrompt}\n\nIMPORTANT: You are answering a spoken question during a podcast. Keep your answer conversational, concise (2-4 sentences), and natural-sounding. Do NOT use markdown formatting. Speak as if you're a podcast host answering a listener's question.`,
      prompt: question,
    });

    return NextResponse.json({
      answer: text,
      citations: chunks.slice(0, 3).map((c) => ({
        sourceTitle: c.sourceTitle,
        pageNumber: c.pageNumber,
      })),
    });
  } catch (error) {
    console.error("Interactive audio Q&A failed:", error);
    return NextResponse.json(
      { error: "Failed to generate answer" },
      { status: 500 }
    );
  }
};
