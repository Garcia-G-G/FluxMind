"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLanguage } from "@/lib/i18n/language";

type QuizAttempt = {
  id: string;
  outputId: string;
  score: number;
  totalQuestions: number;
  answers: Array<{
    questionIndex: number;
    selectedAnswer: string;
    correct: boolean;
  }> | null;
  completedAt: string | null;
  createdAt: string;
};

type FlashcardProgressItem = {
  id: string;
  outputId: string;
  cardIndex: number;
  status: string;
  easeFactor: number;
  interval: number;
  repetitions: number;
  nextReview: string | null;
};

export const useQuizProgress = (outputId: string) => {
  return useQuery({
    queryKey: ["quiz-progress", outputId],
    queryFn: async (): Promise<QuizAttempt[]> => {
      const res = await fetch(`/api/progress/quiz?outputId=${outputId}`);
      if (!res.ok) throw new Error("Failed to fetch quiz progress");
      return res.json();
    },
    enabled: !!outputId,
  });
};

export const useSaveQuizProgress = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      outputId: string;
      score: number;
      totalQuestions: number;
      answers: Array<{
        questionIndex: number;
        selectedAnswer: string;
        correct: boolean;
      }>;
    }) => {
      const res = await fetch("/api/progress/quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to save");
      return res.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["quiz-progress", variables.outputId],
      });
    },
  });
};

export const useFlashcardProgress = (outputId: string) => {
  return useQuery({
    queryKey: ["flashcard-progress", outputId],
    queryFn: async (): Promise<FlashcardProgressItem[]> => {
      const res = await fetch(
        `/api/progress/flashcards?outputId=${outputId}`
      );
      if (!res.ok) throw new Error("Failed to fetch flashcard progress");
      return res.json();
    },
    enabled: !!outputId,
  });
};

export const useUpdateFlashcardProgress = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      outputId: string;
      cardIndex: number;
      gotIt: boolean;
    }) => {
      const res = await fetch("/api/progress/flashcards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to save");
      return res.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["flashcard-progress", variables.outputId],
      });
    },
  });
};

export const useGenerateQuiz = () => {
  const { language } = useLanguage();
  return useMutation({
    mutationFn: async (data: {
      notebookId: string;
      count?: number;
      model?: string;
    }) => {
      const res = await fetch("/api/studio/quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, language }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Generation failed");
      }
      return res.json();
    },
  });
};

export const useGenerateFlashcards = () => {
  const { language } = useLanguage();
  return useMutation({
    mutationFn: async (data: {
      notebookId: string;
      count?: number;
      model?: string;
    }) => {
      const res = await fetch("/api/studio/flashcards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, language }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Generation failed");
      }
      return res.json();
    },
  });
};
