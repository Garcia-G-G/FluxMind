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

  const cardStyle: React.CSSProperties = {
    background: "var(--fm-glass-bg)",
    border: "1px solid var(--fm-glass-border)",
    borderRadius: 12,
  };
  const labelStyle: React.CSSProperties = { color: "var(--fm-text-tertiary)" };
  const valueStyle: React.CSSProperties = { color: "var(--fm-text)" };

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <div className="p-3" style={cardStyle}>
        <div className="flex items-center gap-2 mb-1" style={labelStyle}>
          <Brain className="h-4 w-4" />
          <span className="text-xs">Flashcards</span>
        </div>
        <p className="text-lg font-bold" style={valueStyle}>
          {gotIt}/{totalCards ?? flashcardProgress?.length ?? 0}
        </p>
        <p className="text-xs" style={labelStyle}>mastered</p>
      </div>

      <div className="p-3" style={cardStyle}>
        <div className="flex items-center gap-2 mb-1" style={labelStyle}>
          <Clock className="h-4 w-4" />
          <span className="text-xs">Due Today</span>
        </div>
        <p className="text-lg font-bold" style={valueStyle}>{dueCount}</p>
        <p className="text-xs" style={labelStyle}>cards to review</p>
      </div>

      <div className="p-3" style={cardStyle}>
        <div className="flex items-center gap-2 mb-1" style={labelStyle}>
          <Target className="h-4 w-4" />
          <span className="text-xs">Last Quiz</span>
        </div>
        <p className="text-lg font-bold" style={valueStyle}>
          {latestScore !== null && latestTotal
            ? `${Math.round((latestScore / latestTotal) * 100)}%`
            : "—"}
        </p>
        <p className="text-xs" style={labelStyle}>
          {latestScore !== null ? `${latestScore}/${latestTotal}` : "no attempts"}
        </p>
      </div>

      <div className="p-3" style={cardStyle}>
        <div className="flex items-center gap-2 mb-1" style={labelStyle}>
          <Trophy className="h-4 w-4" />
          <span className="text-xs">Best Score</span>
        </div>
        <p className="text-lg font-bold" style={valueStyle}>
          {bestScore !== null && latestTotal
            ? `${Math.round((bestScore / latestTotal) * 100)}%`
            : "—"}
        </p>
        <p className="text-xs" style={labelStyle}>
          {quizAttempts ? `${quizAttempts.length} attempts` : ""}
        </p>
      </div>
    </div>
  );
};
