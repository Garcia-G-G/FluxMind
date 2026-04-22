"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
} from "@tanstack/react-query";
import { useLanguage, type Language } from "@/lib/i18n/language";
import type { GenerateConfig } from "@/components/studio/generate-dialog";

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

const generateStudioOutput = async <TArgs extends { notebookId: string }>(
  endpoint: string,
  data: TArgs & { language: Language },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> => {
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

/**
 * Factory: auto-invalidates the notebook's outputs query after generation.
 *
 * The hook injects the current `language` from `useLanguage()` into every
 * request. If the caller's payload already has a `language` (e.g. chosen in
 * the generate-dialog), that value wins.
 *
 * Result is typed `any` so downstream callers can assign to concrete
 * output-content shapes without casting — matching the legacy behavior.
 */
const useGenerate = <TArgs extends { notebookId: string }>(
  endpoint: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): UseMutationResult<any, Error, TArgs> => {
  const qc = useQueryClient();
  const { language } = useLanguage();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return useMutation<any, Error, TArgs>({
    mutationFn: async (data: TArgs) => {
      const payload = { language, ...data };
      return await generateStudioOutput(endpoint, payload);
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["outputs", vars.notebookId] });
    },
  });
};

/* ── Every studio generator accepts an optional GenerateConfig ── */
type DialogArgs = { notebookId: string } & Partial<GenerateConfig>;
type SlidesArgs = DialogArgs & { count?: number; model?: string };
type InfographicArgs = DialogArgs & { model?: string };
type VideoArgs = DialogArgs & { model?: string };
type MindMapArgs = DialogArgs & { model?: string };
type FlashcardsArgs = DialogArgs & { count?: number; model?: string };
type QuizArgs = DialogArgs & { count?: number; model?: string };
type CourseArgs = DialogArgs & { count?: number; model?: string };
type ThreadArgs = DialogArgs & { model?: string };
type NewsletterArgs = DialogArgs & { model?: string };
type ReelArgs = DialogArgs & { model?: string };
type DataTableArgs = DialogArgs & { model?: string };

export const useGenerateSlides = (): UseMutationResult<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  any,
  Error,
  SlidesArgs
> => useGenerate<SlidesArgs>("/api/studio/slides");
export const useGenerateInfographic = (): UseMutationResult<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  any,
  Error,
  InfographicArgs
> => useGenerate<InfographicArgs>("/api/studio/infographic");
export const useGenerateDataTable = (): UseMutationResult<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  any,
  Error,
  DataTableArgs
> => useGenerate<DataTableArgs>("/api/studio/datatable");
export const useGenerateThread = (): UseMutationResult<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  any,
  Error,
  ThreadArgs
> => useGenerate<ThreadArgs>("/api/studio/thread");
export const useGenerateNewsletter = (): UseMutationResult<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  any,
  Error,
  NewsletterArgs
> => useGenerate<NewsletterArgs>("/api/studio/newsletter");
export const useGenerateReel = (): UseMutationResult<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  any,
  Error,
  ReelArgs
> => useGenerate<ReelArgs>("/api/studio/reel");
export const useGenerateCourse = (): UseMutationResult<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  any,
  Error,
  CourseArgs
> => useGenerate<CourseArgs>("/api/studio/course");
export const useGenerateFlashcards = (): UseMutationResult<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  any,
  Error,
  FlashcardsArgs
> => useGenerate<FlashcardsArgs>("/api/studio/flashcards");
export const useGenerateQuiz = (): UseMutationResult<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  any,
  Error,
  QuizArgs
> => useGenerate<QuizArgs>("/api/studio/quiz");
export const useGenerateMindMap = (): UseMutationResult<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  any,
  Error,
  MindMapArgs
> => useGenerate<MindMapArgs>("/api/studio/mindmap");
export const useGenerateAudio = (): UseMutationResult<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  any,
  Error,
  { notebookId: string; language?: "en" | "es" }
> =>
  useGenerate<{ notebookId: string; language?: "en" | "es" }>(
    "/api/studio/audio",
  );

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

export const useGenerateVideo = (): UseMutationResult<
  VideoResult,
  Error,
  VideoArgs
> => {
  const qc = useQueryClient();
  const { language } = useLanguage();
  return useMutation<VideoResult, Error, VideoArgs>({
    mutationFn: async (data) => {
      const payload = { language, ...data };
      await generateStudioOutput("/api/studio/video", payload);

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
            typeof content.error === "string"
              ? content.error
              : "Video generation failed",
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
