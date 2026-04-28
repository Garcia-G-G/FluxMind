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
    // Conversations rarely change between tab switches — keep the list
    // fresh for 60 s so re-mounting doesn't refetch on every visit.
    staleTime: 60_000,
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
    // The transcript is updated by mutations (post message, regenerate);
    // explicit invalidation handles freshness, so we can keep the cache
    // hot for 5 minutes between tab switches.
    staleTime: 5 * 60_000,
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
