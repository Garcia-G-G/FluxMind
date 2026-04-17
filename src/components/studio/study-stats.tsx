"use client";

import { Brain, Target, Clock, Trophy } from "lucide-react";
import { useQuizProgress, useFlashcardProgress } from "@/hooks/use-study";

export const StudyStats = ({
  quizOutputId,
  flashcardOutputId,
  totalCards,
}: {
  quizOutputId?: string;
  flashcardOutputId?: string;
  totalCards?: number;
}): React.ReactNode => {
  const { data: quizAttempts } = useQuizProgress(quizOutputId ?? "");
  const { data: flashcardProgress } = useFlashcardProgress(
    flashcardOutputId ?? ""
  );

  const bestScore =
    quizAttempts && quizAttempts.length > 0
      ? Math.max(...quizAttempts.map((a) => a.score))
      : null;
  const latestScore =
    quizAttempts && quizAttempts.length > 0 ? quizAttempts[0].score : null;
  const latestTotal =
    quizAttempts && quizAttempts.length > 0
      ? quizAttempts[0].totalQuestions
      : null;

  const gotIt =
    flashcardProgress?.filter(
      (p) => p.status === "review" || p.status === "mastered"
    ).length ?? 0;
  const dueCount =
    flashcardProgress?.filter((p) => {
      if (!p.nextReview) return true;
      return new Date() >= new Date(p.nextReview);
    }).length ?? 0;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <div className="rounded-lg border border-border bg-card p-3">
        <div className="flex items-center gap-2 text-muted-foreground mb-1">
          <Brain className="h-4 w-4" />
          <span className="text-xs">Flashcards</span>
        </div>
        <p className="text-lg font-bold">
          {gotIt}/{totalCards ?? flashcardProgress?.length ?? 0}
        </p>
        <p className="text-xs text-muted-foreground">mastered</p>
      </div>

      <div className="rounded-lg border border-border bg-card p-3">
        <div className="flex items-center gap-2 text-muted-foreground mb-1">
          <Clock className="h-4 w-4" />
          <span className="text-xs">Due Today</span>
        </div>
        <p className="text-lg font-bold">{dueCount}</p>
        <p className="text-xs text-muted-foreground">cards to review</p>
      </div>

      <div className="rounded-lg border border-border bg-card p-3">
        <div className="flex items-center gap-2 text-muted-foreground mb-1">
          <Target className="h-4 w-4" />
          <span className="text-xs">Last Quiz</span>
        </div>
        <p className="text-lg font-bold">
          {latestScore !== null && latestTotal
            ? `${Math.round((latestScore / latestTotal) * 100)}%`
            : "—"}
        </p>
        <p className="text-xs text-muted-foreground">
          {latestScore !== null ? `${latestScore}/${latestTotal}` : "no attempts"}
        </p>
      </div>

      <div className="rounded-lg border border-border bg-card p-3">
        <div className="flex items-center gap-2 text-muted-foreground mb-1">
          <Trophy className="h-4 w-4" />
          <span className="text-xs">Best Score</span>
        </div>
        <p className="text-lg font-bold">
          {bestScore !== null && latestTotal
            ? `${Math.round((bestScore / latestTotal) * 100)}%`
            : "—"}
        </p>
        <p className="text-xs text-muted-foreground">
          {quizAttempts ? `${quizAttempts.length} attempts` : ""}
        </p>
      </div>
    </div>
  );
};
