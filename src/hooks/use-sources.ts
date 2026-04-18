"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

type SourceListItem = {
  id: string;
  type: string;
  title: string;
  tokenCount: number | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  chunkCount: number;
};

export const useSources = (notebookId: string) => {
  return useQuery({
    queryKey: ["sources", notebookId],
    queryFn: async (): Promise<SourceListItem[]> => {
      const res = await fetch(`/api/sources?notebookId=${notebookId}`);
      if (!res.ok) throw new Error("Failed to fetch sources");
      return res.json();
    },
    // Poll every 3 seconds if any source is processing
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return false;
      const hasProcessing = data.some(
        (s) => s.status === "pending" || s.status === "processing"
      );
      return hasProcessing ? 5000 : false;
    },
  });
};

export const useUploadSource = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      file,
      notebookId,
    }: {
      file: File;
      notebookId: string;
    }) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("notebookId", notebookId);

      const res = await fetch("/api/sources/upload", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Upload failed");
      }
      return res.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["sources", variables.notebookId],
      });
    },
  });
};

export const useDeleteSource = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      notebookId,
    }: {
      id: string;
      notebookId: string;
    }) => {
      const res = await fetch(`/api/sources/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete source");
      return { id, notebookId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: ["sources", data.notebookId],
      });
    },
  });
};
