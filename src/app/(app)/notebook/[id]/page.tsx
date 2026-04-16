"use client";

import { use, useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ChatPanel } from "@/components/chat/chat-panel";
import { ConversationSidebar } from "@/components/chat/conversation-sidebar";
import { useConversation } from "@/hooks/use-conversations";

const NotebookChatPage = ({
  params,
}: {
  params: Promise<{ id: string }>;
}): React.ReactNode => {
  const { id: notebookId } = use(params);
  const [activeConversationId, setActiveConversationId] = useState<
    string | null
  >(null);
  const queryClient = useQueryClient();

  const { data: conversationData } = useConversation(activeConversationId);

  const handleConversationCreated = useCallback(
    (newId: string) => {
      setActiveConversationId(newId);
      queryClient.invalidateQueries({
        queryKey: ["conversations", notebookId],
      });
    },
    [notebookId, queryClient]
  );

  const handleNewChat = useCallback(() => {
    setActiveConversationId(null);
  }, []);

  const initialMessages = conversationData?.messages?.map((m) => ({
    id: m.id,
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  return (
    <div className="flex h-full -m-4">
      <ConversationSidebar
        notebookId={notebookId}
        activeConversationId={activeConversationId}
        onSelectConversation={setActiveConversationId}
        onNewChat={handleNewChat}
      />
      <div className="flex-1 min-w-0">
        <ChatPanel
          key={activeConversationId ?? "new"}
          notebookId={notebookId}
          conversationId={activeConversationId}
          onConversationCreated={handleConversationCreated}
          initialMessages={initialMessages}
        />
      </div>
    </div>
  );
};

export default NotebookChatPage;
