"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

type ConversationListItem = {
  id: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
};

type ConversationDetail = ConversationListItem & {
  messages: Array<{
    id: string;
    role: "user" | "assistant";
    content: string;
    citations: Array<{ sourceId: string; chunkId: string; text: string }> | null;
    modelUsed: string | null;
    createdAt: string;
  }>;
};

export const useConversations = (notebookId: string) => {
  return useQuery({
    queryKey: ["conversations", notebookId],
    queryFn: async (): Promise<ConversationListItem[]> => {
      const res = await fetch(
        `/api/conversations?notebookId=${notebookId}`
      );
      if (!res.ok) throw new Error("Failed to fetch conversations");
      return res.json();
    },
  });
};

export const useConversation = (conversationId: string | null) => {
  return useQuery({
    queryKey: ["conversation", conversationId],
    queryFn: async (): Promise<ConversationDetail> => {
      const res = await fetch(`/api/conversations/${conversationId}`);
      if (!res.ok) throw new Error("Failed to fetch conversation");
      return res.json();
    },
    enabled: !!conversationId,
  });
};

export const useDeleteConversation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      notebookId,
    }: {
      id: string;
      notebookId: string;
    }) => {
      const res = await fetch(`/api/conversations/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete conversation");
      return { id, notebookId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: ["conversations", data.notebookId],
      });
    },
  });
};
