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

    // Ensure or create conversation. We also need to know whether the
    // conversation currently has a title so we can decide in onFinish
    // whether to populate it — reading this BEFORE the stream starts
    // eliminates the extra SELECT inside the hot onFinish path.
    let activeConversationId = conversationId;
    let titleWasEmpty = true;

    if (!activeConversationId) {
      // Brand-new conversation: title is definitionally empty.
      activeConversationId = createId();
      await db.insert(conversations).values({
        id: activeConversationId,
        notebookId,
        userId: session.user.id,
        title: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      titleWasEmpty = true;
    } else {
      // Existing conversation: check title once, synchronously, so
      // onFinish can avoid an extra round-trip entirely.
      const [existing] = await db
        .select({ title: conversations.title })
        .from(conversations)
        .where(eq(conversations.id, activeConversationId));
      titleWasEmpty = !existing?.title;
    }

    // Save user message
    await db.insert(messagesTable).values({
      id: createId(),
      conversationId: activeConversationId,
      role: "user",
      content: userText,
      createdAt: new Date(),
    });

    // Capture into closures — streamText runs onFinish after the HTTP
    // response is already flushing, so we can't re-read local `let`
    // state inside it safely.
    const conversationIdForFinish: string = activeConversationId;
    const titleWasEmptyForFinish: boolean = titleWasEmpty;

    const result = streamText({
      model: getModel(modelId),
      system: systemPrompt,
      messages: await convertToModelMessages(messages),
      onFinish: async ({ text, usage }) => {
        try {
          const citationRefs = parseCitations(text, chunks);

          // Insert assistant message + update conversation in parallel.
          // We already know (from the pre-stream check) whether to set
          // the title, so we avoid the old SELECT-then-UPDATE pattern.
          const now = new Date();
          const updateSet = titleWasEmptyForFinish
            ? { title: userText.slice(0, 100), updatedAt: now }
            : { updatedAt: now };

          await Promise.all([
            db.insert(messagesTable).values({
              id: createId(),
              conversationId: conversationIdForFinish,
              role: "assistant",
              content: text,
              citations: citationRefs.map((c) => ({
                sourceId: c.sourceId ?? "",
                chunkId: "",
                text: c.sourceTitle,
              })),
              modelUsed: modelId,
              tokensUsed: usage.totalTokens,
              createdAt: now,
            }),
            db
              .update(conversations)
              .set(updateSet)
              .where(eq(conversations.id, conversationIdForFinish)),
          ]);
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
