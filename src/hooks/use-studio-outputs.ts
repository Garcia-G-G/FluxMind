"use client";

import { useMutation } from "@tanstack/react-query";

const generateStudioOutput = async (
  endpoint: string,
  data: { notebookId: string; count?: number; model?: string }
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

export const useGenerateSlides = () => {
  return useMutation({
    mutationFn: (data: { notebookId: string; count?: number; model?: string }) =>
      generateStudioOutput("/api/studio/slides", data),
  });
};

export const useGenerateInfographic = () => {
  return useMutation({
    mutationFn: (data: { notebookId: string; model?: string }) =>
      generateStudioOutput("/api/studio/infographic", data),
  });
};

export const useGenerateDataTable = () => {
  return useMutation({
    mutationFn: (data: { notebookId: string; model?: string }) =>
      generateStudioOutput("/api/studio/datatable", data),
  });
};

export const useGenerateThread = () => {
  return useMutation({
    mutationFn: (data: { notebookId: string; model?: string }) =>
      generateStudioOutput("/api/studio/thread", data),
  });
};

export const useGenerateNewsletter = () => {
  return useMutation({
    mutationFn: (data: { notebookId: string; model?: string }) =>
      generateStudioOutput("/api/studio/newsletter", data),
  });
};

export const useGenerateReel = () => {
  return useMutation({
    mutationFn: (data: { notebookId: string; model?: string }) =>
      generateStudioOutput("/api/studio/reel", data),
  });
};

export const useGenerateCourse = () => {
  return useMutation({
    mutationFn: (data: { notebookId: string; model?: string }) =>
      generateStudioOutput("/api/studio/course", data),
  });
};

export const useGenerateMindMap = () => {
  return useMutation({
    mutationFn: (data: { notebookId: string; model?: string }) =>
      generateStudioOutput("/api/studio/mindmap", data),
  });
};

export const useGenerateAudio = () => {
  return useMutation({
    mutationFn: (data: { notebookId: string }) =>
      generateStudioOutput("/api/studio/audio", data),
  });
};
