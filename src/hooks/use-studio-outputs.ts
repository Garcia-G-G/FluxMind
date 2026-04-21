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
/**
 * Video generation is async on the server (fire-and-forget pipeline:
 * script → images → TTS → composition). POST returns immediately with
 * { id, status: "pending" }. This hook kicks off generation and then
 * polls /api/studio/video?notebookId=X until the latest row is "ready"
 * or "error" (or the 10 min safety timeout elapses).
 */
type VideoResult = {
  id: string;
  title: string;
  status: string;
  fileUrl?: string;
  chapters?: unknown[];
};

export const useGenerateVideo = () => {
  const qc = useQueryClient();
  const { language } = useLanguage();
  return useMutation<VideoResult, Error, { notebookId: string }>({
    mutationFn: async (data) => {
      await generateStudioOutput("/api/studio/video", { ...data, language });

      const deadline = Date.now() + 10 * 60 * 1000;
      let delay = 2000;
      while (Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, delay));
        const res = await fetch(
          `/api/studio/video?notebookId=${encodeURIComponent(data.notebookId)}`,
        );
        if (!res.ok) throw new Error("Failed to poll video status");
        const row = (await res.json()) as {
          id: string;
          title: string;
          status: string;
          fileUrl?: string;
          content?: Record<string, unknown>;
        } | null;
        if (row && row.status === "ready") {
          const content = (row.content ?? {}) as Record<string, unknown>;
          const script = content.script as { chapters?: unknown[] } | undefined;
          const chapters =
            (content.chapters as unknown[] | undefined) ?? script?.chapters;
          return {
            id: row.id,
            title: row.title,
            status: "ready",
            fileUrl: row.fileUrl ?? undefined,
            chapters,
          };
        }
        if (row && row.status === "error") {
          const content = (row.content ?? {}) as Record<string, unknown>;
          throw new Error(
            typeof content.error === "string" ? content.error : "Video generation failed",
          );
        }
        // Slow the poll from 2s → 5s after the first 30s so we don't hammer
        // the DB during the long image/TTS phase.
        if (delay < 5000) delay = 5000;
      }
      throw new Error("Video generation timed out after 10 minutes");
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["outputs", vars.notebookId] });
    },
  });
};
