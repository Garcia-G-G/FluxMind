"use client";

import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import type { Notebook } from "@/db/schema/notebooks";
import type { CreateNotebookInput, UpdateNotebookInput } from "@/lib/validations/notebook";

type NotebookWithCount = Notebook & { sourceCount: number };

const fetchNotebooks = async (
  search: string,
  sort: string,
  order: string
): Promise<NotebookWithCount[]> => {
  const params = new URLSearchParams();
  if (search) params.set("search", search);
  if (sort) params.set("sort", sort);
  if (order) params.set("order", order);
  const res = await fetch(`/api/notebooks?${params.toString()}`);
  if (!res.ok) throw new Error("Failed to fetch notebooks");
  return res.json();
};

export const useNotebooks = (
  search = "",
  sort = "updatedAt",
  order = "desc",
  options?: { initialData?: NotebookWithCount[]; staleTime?: number },
) => {
  return useQuery({
    queryKey: ["notebooks", search, sort, order],
    queryFn: () => fetchNotebooks(search, sort, order),
    initialData: options?.initialData,
    // 60s default: sidebar + dashboard won't re-fetch on every route change,
    // which was causing the "Recent Notebooks" flicker during navigation.
    // Mutations (create/update/delete) still invalidate immediately.
    staleTime: options?.staleTime ?? 60_000,
  });
};

export const useCreateNotebook = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateNotebookInput) => {
      const res = await fetch("/api/notebooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to create notebook");
      }
      return res.json() as Promise<Notebook>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notebooks"] });
    },
  });
};

export const useUpdateNotebook = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...input
    }: UpdateNotebookInput & { id: string }) => {
      const res = await fetch(`/api/notebooks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to update notebook");
      }
      return res.json() as Promise<Notebook>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notebooks"] });
    },
  });
};

export const useDeleteNotebook = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/notebooks/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to delete notebook");
      }
      return id;
    },
    onMutate: async (deletedId) => {
      await queryClient.cancelQueries({ queryKey: ["notebooks"] });
      const previous = queryClient.getQueriesData<NotebookWithCount[]>({
        queryKey: ["notebooks"],
      });
      queryClient.setQueriesData<NotebookWithCount[]>(
        { queryKey: ["notebooks"] },
        (old) => old?.filter((n) => n.id !== deletedId)
      );
      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous) {
        for (const [key, data] of context.previous) {
          queryClient.setQueryData(key, data);
        }
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["notebooks"] });
    },
  });
};
