import { streamText, convertToModelMessages, type UIMessage } from "ai";
import { NextRequest } from "next/server";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { notebooks } from "@/db/schema/notebooks";
import {
  conversations,
  messages as messagesTable,
} from "@/db/schema/conversations";
import { getModel } from "@/lib/ai/models";
import {
  retrieveContext,
  buildSystemPrompt,
  parseCitations,
  type RetrievedChunk,
} from "@/lib/ai/rag";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

export const maxDuration = 60;

const getMessageText = (message: UIMessage): string => {
  return message.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("");
};

export const POST = async (request: NextRequest): Promise<Response> => {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return new Response("Unauthorized", { status: 401 });
    }

    const limited = await checkRateLimit({
      userId: session.user.id,
      bucket: "chat",
      ...RATE_LIMITS.chat,
    });
    if (limited) return limited;

    const body = await request.json();
    const {
      messages,
      notebookId,
      model: modelId = "gpt-4o",
      conversationId,
      language: rawLanguage = "en",
    } = body as {
      messages: UIMessage[];
      notebookId: string;
      model?: string;
      conversationId?: string;
      language?: string;
    };
    const language: "en" | "es" = rawLanguage === "es" ? "es" : "en";
    const LANG_NAME = language === "es" ? "Spanish" : "English";

    if (!notebookId || !messages?.length) {
      return new Response("Missing notebookId or messages", { status: 400 });
    }

    // Verify notebook access
    const [notebook] = await db
      .select({ userId: notebooks.userId })
      .from(notebooks)
      .where(eq(notebooks.id, notebookId));

    if (!notebook || notebook.userId !== session.user.id) {
      return new Response("Notebook not found", { status: 404 });
    }

    // Get last user message for RAG query
    const lastUserMessage = [...messages]
      .reverse()
      .find((m) => m.role === "user");

    if (!lastUserMessage) {
      return new Response("No user message found", { status: 400 });
    }

    const userText = getMessageText(lastUserMessage);

    // Retrieve context via RAG pipeline
    let chunks: RetrievedChunk[] = [];
    try {
      chunks = await retrieveContext(notebookId, userText);
    } catch (ragError) {
      console.error("RAG retrieval failed:", ragError);
    }

    const basePrompt = buildSystemPrompt(chunks);
    const systemPrompt = `${basePrompt}

IMPORTANT LANGUAGE PREFERENCE: The user has selected ${LANG_NAME} as their preferred language. Unless the user explicitly writes their question in a different language, respond in ${LANG_NAME}. Citations and source titles stay in their original form.`;

    // Ensure or create conversation
    let activeConversationId = conversationId;
    if (!activeConversationId) {
      activeConversationId = createId();
      await db.insert(conversations).values({
        id: activeConversationId,
        notebookId,
        userId: session.user.id,
        title: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    // Save user message
    await db.insert(messagesTable).values({
      id: createId(),
      conversationId: activeConversationId,
      role: "user",
      content: userText,
      createdAt: new Date(),
    });

    const result = streamText({
      model: getModel(modelId),
      system: systemPrompt,
      messages: await convertToModelMessages(messages),
      onFinish: async ({ text, usage }) => {
        try {
          const citationRefs = parseCitations(text, chunks);
          await db.insert(messagesTable).values({
            id: createId(),
            conversationId: activeConversationId!,
            role: "assistant",
            content: text,
            citations: citationRefs.map((c) => ({
              sourceId: c.sourceId ?? "",
              chunkId: "",
              text: c.sourceTitle,
            })),
            modelUsed: modelId,
            tokensUsed: usage.totalTokens,
            createdAt: new Date(),
          });

          // Auto-title with first user message
          const [convo] = await db
            .select({ title: conversations.title })
            .from(conversations)
            .where(eq(conversations.id, activeConversationId!));

          if (!convo?.title) {
            await db
              .update(conversations)
              .set({
                title: userText.slice(0, 100),
                updatedAt: new Date(),
              })
              .where(eq(conversations.id, activeConversationId!));
          } else {
            await db
              .update(conversations)
              .set({ updatedAt: new Date() })
              .where(eq(conversations.id, activeConversationId!));
          }
        } catch (saveError) {
          console.error("Failed to save message:", saveError);
        }
      },
    });

    return result.toUIMessageStreamResponse({
      headers: {
        "X-Conversation-Id": activeConversationId,
      },
    });
  } catch (error) {
    console.error("Chat error:", error);
    return new Response("Internal server error", { status: 500 });
  }
};
