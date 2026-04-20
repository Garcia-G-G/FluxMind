"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLanguage, type Language } from "@/lib/i18n/language";

/* ── Fetch existing outputs for a notebook ── */
export type OutputListItem = {
  id: string;
  type: string;
  title: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  content: Record<string, unknown> | null;
  fileUrl: string | null;
  thumbnailUrl: string | null;
};

export const useOutputs = (notebookId: string) => {
  return useQuery<OutputListItem[]>({
    queryKey: ["outputs", notebookId],
    queryFn: async () => {
      const res = await fetch(`/api/outputs?notebookId=${notebookId}`);
      if (!res.ok) throw new Error("Failed to fetch outputs");
      return res.json();
    },
    staleTime: 30_000,
  });
};

const generateStudioOutput = async (
  endpoint: string,
  data: { notebookId: string; count?: number; model?: string; language: Language }
) => {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error ?? "Generation failed");
  }
  return res.json();
};

/* Factory: auto-invalidates outputs query after generation */
const useGenerate = <T extends { notebookId: string }>(endpoint: string) => {
  const qc = useQueryClient();
  const { language } = useLanguage();
  return useMutation({
    mutationFn: (data: T) =>
      generateStudioOutput(endpoint, { ...data, language }),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["outputs", vars.notebookId] });
    },
  });
};

export const useGenerateSlides = () =>
  useGenerate<{ notebookId: string; count?: number; model?: string }>("/api/studio/slides");
export const useGenerateInfographic = () =>
  useGenerate<{ notebookId: string; model?: string }>("/api/studio/infographic");
export const useGenerateDataTable = () =>
  useGenerate<{ notebookId: string; model?: string }>("/api/studio/datatable");
export const useGenerateThread = () =>
  useGenerate<{ notebookId: string; model?: string }>("/api/studio/thread");
export const useGenerateNewsletter = () =>
  useGenerate<{ notebookId: string; model?: string }>("/api/studio/newsletter");
export const useGenerateReel = () =>
  useGenerate<{ notebookId: string; model?: string }>("/api/studio/reel");
export const useGenerateCourse = () =>
  useGenerate<{ notebookId: string; model?: string }>("/api/studio/course");
export const useGenerateMindMap = () =>
  useGenerate<{ notebookId: string; model?: string }>("/api/studio/mindmap");
export const useGenerateAudio = () =>
  useGenerate<{ notebookId: string }>("/api/studio/audio");
export const useGenerateVideo = () =>
  useGenerate<{ notebookId: string }>("/api/studio/video");
