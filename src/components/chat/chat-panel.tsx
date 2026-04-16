"use client";

import { useRef, useEffect, useState, useMemo } from "react";
import { DefaultChatTransport } from "ai";
import { useChat } from "@ai-sdk/react";
import { ChatMessage } from "@/components/chat/chat-message";
import { ChatInput } from "@/components/chat/chat-input";
import { SuggestedQuestions } from "@/components/chat/suggested-questions";

const getTextFromParts = (
  parts: Array<{ type: string; text?: string }>
): string => {
  return parts
    .filter((p) => p.type === "text" && p.text)
    .map((p) => p.text!)
    .join("");
};

export const ChatPanel = ({
  notebookId,
  conversationId,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onConversationCreated,
  initialMessages,
}: {
  notebookId: string;
  conversationId: string | null;
  onConversationCreated?: (id: string) => void;
  initialMessages?: Array<{
    id: string;
    role: "user" | "assistant";
    content: string;
  }>;
}): React.ReactNode => {
  const [selectedModel, setSelectedModel] = useState(() => {
    if (typeof window === "undefined") return "gemini-2.5-flash";
    return (
      localStorage.getItem(`fluxmind:model:${notebookId}`) ??
      "gemini-2.5-flash"
    );
  });
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: {
          notebookId,
          model: selectedModel,
          conversationId,
        },
      }),
    [notebookId, selectedModel, conversationId]
  );

  const { messages, sendMessage, stop, regenerate, status, error } = useChat({
    transport,
    messages: initialMessages?.map((m) => ({
      id: m.id,
      role: m.role,
      parts: [{ type: "text" as const, text: m.content }],
    })),
    onFinish: () => {
      // Conversation ID comes back in headers — handled by transport
    },
  });

  const isLoading = status === "streaming" || status === "submitted";

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleModelChange = (modelId: string): void => {
    setSelectedModel(modelId);
    localStorage.setItem(`fluxmind:model:${notebookId}`, modelId);
  };

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    sendMessage({ text: input });
    setInput("");
  };

  const handleSuggestedQuestion = (question: string): void => {
    sendMessage({ text: question });
  };

  return (
    <div className="flex flex-col h-full">
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <SuggestedQuestions onSelect={handleSuggestedQuestion} />
        ) : (
          <div className="max-w-3xl mx-auto py-4 px-4 space-y-6">
            {messages.map((message, i) => {
              const text = getTextFromParts(
                message.parts as Array<{ type: string; text?: string }>
              );
              return (
                <ChatMessage
                  key={message.id}
                  role={message.role as "user" | "assistant"}
                  content={text}
                  isStreaming={
                    isLoading &&
                    i === messages.length - 1 &&
                    message.role === "assistant"
                  }
                  onRegenerate={
                    message.role === "assistant" && i === messages.length - 1
                      ? () => regenerate()
                      : undefined
                  }
                />
              );
            })}
            {error && (
              <div className="text-sm text-destructive text-center py-2">
                {error.message ?? "An error occurred. Please try again."}
              </div>
            )}
          </div>
        )}
      </div>

      <ChatInput
        input={input}
        onInputChange={setInput}
        onSubmit={handleSubmit}
        isLoading={isLoading}
        onStop={stop}
        selectedModel={selectedModel}
        onModelChange={handleModelChange}
      />
    </div>
  );
};
