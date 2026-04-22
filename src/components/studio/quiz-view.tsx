"use client";

import { useState, useMemo } from "react";
import {
  CheckCircle,
  XCircle,
  ChevronRight,
  RotateCcw,
  Trophy,
  BookOpen,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "@/components/ui/button";
import { useSaveQuizProgress } from "@/hooks/use-study";

type MCQuestion = {
  id: string;
  type: "multiple_choice";
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
  difficulty: string;
  sourceReference: string;
};

type TFQuestion = {
  id: string;
  type: "true_false";
  question: string;
  correctAnswer: boolean;
  explanation: string;
  difficulty: string;
  sourceReference: string;
};

type FRQuestion = {
  id: string;
  type: "free_response";
  question: string;
  sampleAnswer: string;
  keyPoints: string[];
  difficulty: string;
  sourceReference: string;
};

type Question = MCQuestion | TFQuestion | FRQuestion;

type Answer = {
  questionIndex: number;
  selectedAnswer: string;
  correct: boolean;
};

/** Spec-mandated per-option hues. Kept as hex because they are the
 *  semantic identity of A/B/C/D — not skin-able theme tokens. */
const MC_COLORS: readonly { fill: string; fg: string }[] = [
  { fill: "#3b82f6", fg: "#ffffff" }, // blue — A
  { fill: "#ef4444", fg: "#ffffff" }, // red — B
  { fill: "#f59e0b", fg: "#ffffff" }, // amber — C
  { fill: "#22c55e", fg: "#ffffff" }, // green — D
] as const;

const DIFFICULTY_COLOR: Record<string, string> = {
  easy: "#22c55e",
  medium: "#f59e0b",
  hard: "#ef4444",
};

const difficultyPillStyle = (difficulty: string): React.CSSProperties => {
  const c = DIFFICULTY_COLOR[difficulty] ?? DIFFICULTY_COLOR.medium;
  return {
    background: `color-mix(in srgb, ${c} 14%, transparent)`,
    color: c,
    borderRadius: "9999px",
    padding: "0.125rem 0.625rem",
    fontSize: "11px",
    fontWeight: 600,
    textTransform: "capitalize",
  };
};

export const QuizView = ({
  outputId,
  questions,
  coverImage,
}: {
  outputId: string;
  questions: Question[];
  coverImage?: string | null;
}): React.ReactNode => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [freeResponse, setFreeResponse] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [showExplanations, setShowExplanations] = useState(false);
  const saveProgress = useSaveQuizProgress();

  const question = questions[currentIndex];
  const currentAnswer = answers.find((a) => a.questionIndex === currentIndex);

  const score = useMemo(
    () => answers.filter((a) => a.correct).length,
    [answers]
  );

  const checkAnswer = (): void => {
    if (!question || submitted) return;
    let correct = false;
    let selected = "";

    if (question.type === "multiple_choice") {
      selected = selectedOption ?? "";
      correct = selected === question.correctAnswer;
    } else if (question.type === "true_false") {
      selected = selectedOption ?? "";
      correct = (selected === "true") === question.correctAnswer;
    } else {
      selected = freeResponse;
      const response = freeResponse.toLowerCase();
      const hits = question.keyPoints.filter((kp) =>
        response.includes(kp.toLowerCase())
      );
      correct = hits.length >= Math.ceil(question.keyPoints.length / 2);
    }

    const answer: Answer = {
      questionIndex: currentIndex,
      selectedAnswer: selected,
      correct,
    };
    setAnswers((prev) => [
      ...prev.filter((a) => a.questionIndex !== currentIndex),
      answer,
    ]);
    setSubmitted(true);
  };

  const nextQuestion = (): void => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setSelectedOption(null);
      setFreeResponse("");
      setSubmitted(false);
    } else {
      finishQuiz();
    }
  };

  const finishQuiz = (): void => {
    setShowResults(true);
    saveProgress.mutate({
      outputId,
      score,
      totalQuestions: questions.length,
      answers,
    });
  };

  const retake = (): void => {
    setCurrentIndex(0);
    setAnswers([]);
    setSelectedOption(null);
    setFreeResponse("");
    setSubmitted(false);
    setShowResults(false);
    setShowExplanations(false);
  };

  if (showResults) {
    const pct = Math.round((score / questions.length) * 100);
    const wrongList = answers.filter((a) => !a.correct);
    const ringCircumference = 2 * Math.PI * 54;
    const dashOffset = ringCircumference * (1 - pct / 100);

    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-2xl mx-auto text-center py-8"
      >
        {/* SVG score ring */}
        <div className="relative mx-auto mb-5" style={{ width: 140, height: 140 }}>
          <svg width="140" height="140" viewBox="0 0 140 140">
            <circle
              cx="70"
              cy="70"
              r="54"
              fill="none"
              stroke="var(--fm-surface-border)"
              strokeWidth="10"
            />
            <circle
              cx="70"
              cy="70"
              r="54"
              fill="none"
              stroke="var(--fm-accent-orange)"
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={ringCircumference}
              strokeDashoffset={dashOffset}
              transform="rotate(-90 70 70)"
              style={{ transition: "stroke-dashoffset 0.6s ease" }}
            />
          </svg>
          <div
            className="absolute inset-0 flex flex-col items-center justify-center"
            style={{ color: "var(--fm-text)" }}
          >
            <span className="text-3xl font-bold">{pct}%</span>
            <span
              className="text-xs"
              style={{ color: "var(--fm-text-tertiary)" }}
            >
              {score}/{questions.length}
            </span>
          </div>
        </div>
        <Trophy className="h-9 w-9 mx-auto mb-3" style={{ color: "#f59e0b" }} />
        <h2
          className="text-2xl font-bold mb-2"
          style={{ color: "var(--fm-text)" }}
        >
          Quiz Complete!
        </h2>
        <div className="flex gap-2 justify-center mb-8">
          <span
            style={{
              background: "color-mix(in srgb, #22c55e 12%, transparent)",
              color: "#15803d",
              borderRadius: "9999px",
              padding: "0.25rem 0.75rem",
              fontSize: "12px",
              fontWeight: 600,
            }}
          >
            {score} correct
          </span>
          <span
            style={{
              background: "color-mix(in srgb, #ef4444 12%, transparent)",
              color: "#b91c1c",
              borderRadius: "9999px",
              padding: "0.25rem 0.75rem",
              fontSize: "12px",
              fontWeight: 600,
            }}
          >
            {questions.length - score} missed
          </span>
        </div>
        <div className="flex gap-2 justify-center">
          <Button onClick={retake} variant="outline" className="gap-1.5">
            <RotateCcw className="h-4 w-4" />
            Retake
          </Button>
          {wrongList.length > 0 && (
            <Button
              variant="outline"
              onClick={() => setShowExplanations((v) => !v)}
              className="gap-1.5"
            >
              <BookOpen className="h-4 w-4" />
              {showExplanations ? "Hide" : "Review"} Explanations
            </Button>
          )}
        </div>

        {showExplanations && wrongList.length > 0 && (
          <div className="mt-8 text-left space-y-3">
            <h3
              className="font-medium text-sm"
              style={{ color: "var(--fm-text-tertiary)" }}
            >
              Review Mistakes
            </h3>
            {wrongList.map((a) => {
              const q = questions[a.questionIndex];
              return (
                <div
                  key={a.questionIndex}
                  className="rounded-lg p-4 text-sm"
                  style={{
                    background: "var(--fm-surface)",
                    border: "1px solid var(--fm-surface-border)",
                  }}
                >
                  <p
                    className="font-medium mb-2"
                    style={{ color: "var(--fm-text)" }}
                  >
                    {q.question}
                  </p>
                  <p className="text-xs" style={{ color: "#ef4444" }}>
                    Your answer: {a.selectedAnswer || "(no answer)"}
                  </p>
                  <p className="text-xs mt-1" style={{ color: "#22c55e" }}>
                    Correct:{" "}
                    {q.type === "multiple_choice"
                      ? q.correctAnswer
                      : q.type === "true_false"
                        ? String(q.correctAnswer)
                        : q.sampleAnswer}
                  </p>
                  {q.type !== "free_response" && (
                    <p
                      className="text-xs mt-2"
                      style={{ color: "var(--fm-text-tertiary)" }}
                    >
                      {q.explanation}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </motion.div>
    );
  }

  if (!question) return null;

  return (
    <div className="max-w-3xl mx-auto">
      {coverImage && (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={coverImage}
          alt=""
          className="w-full h-32 sm:h-40 object-cover rounded-xl mb-4"
          loading="lazy"
          style={{ border: "1px solid var(--fm-surface-border)" }}
        />
      )}

      {/* Segmented progress bar */}
      <div className="flex gap-1 mb-6">
        {questions.map((_, i) => {
          const ans = answers.find((a) => a.questionIndex === i);
          let bg = "var(--fm-surface-border)"; // unanswered / muted
          if (ans) bg = ans.correct ? "#22c55e" : "#ef4444";
          else if (i === currentIndex) bg = "var(--fm-accent-orange)";
          return (
            <div
              key={i}
              className="flex-1 rounded-full transition-colors"
              style={{ height: "10px", background: bg }}
            />
          );
        })}
      </div>

      <div className="flex items-center justify-between mb-4">
        <span
          className="text-sm"
          style={{ color: "var(--fm-text-tertiary)" }}
        >
          Question {currentIndex + 1} of {questions.length}
        </span>
        <div className="flex gap-1.5">
          <span style={difficultyPillStyle(question.difficulty)}>
            {question.difficulty}
          </span>
          <span
            style={{
              background: "var(--fm-surface-elevated)",
              color: "var(--fm-text-secondary)",
              borderRadius: "9999px",
              padding: "0.125rem 0.625rem",
              fontSize: "11px",
              fontWeight: 600,
              border: "1px solid var(--fm-surface-border)",
            }}
          >
            {question.type === "multiple_choice"
              ? "MC"
              : question.type === "true_false"
                ? "T/F"
                : "FR"}
          </span>
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={currentIndex}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
        >
          <div
            className="rounded-2xl p-8 mb-4"
            style={{
              background: "var(--fm-surface)",
              border: "1px solid var(--fm-surface-border)",
            }}
          >
            <h3
              className="text-2xl font-semibold mb-6 text-center leading-snug"
              style={{ color: "var(--fm-text)" }}
            >
              {question.question}
            </h3>

            {question.type === "multiple_choice" && (
              <div className="space-y-3">
                {question.options.map((opt, i) => {
                  const letter = ["A", "B", "C", "D"][i];
                  const isSelected = selectedOption === letter;
                  const isCorrect =
                    submitted && letter === question.correctAnswer;
                  const isWrong = submitted && isSelected && !isCorrect;
                  const color = MC_COLORS[i % MC_COLORS.length];
                  let background = "var(--fm-surface-elevated)";
                  let borderColor = "var(--fm-surface-border)";
                  if (isCorrect) {
                    background =
                      "color-mix(in srgb, #22c55e 14%, transparent)";
                    borderColor = "#22c55e";
                  } else if (isWrong) {
                    background =
                      "color-mix(in srgb, #ef4444 14%, transparent)";
                    borderColor = "#ef4444";
                  } else if (isSelected) {
                    background = `color-mix(in srgb, ${color.fill} 12%, transparent)`;
                    borderColor = color.fill;
                  }
                  return (
                    <button
                      key={i}
                      onClick={() => !submitted && setSelectedOption(letter)}
                      disabled={submitted}
                      className="w-full text-left min-h-14 rounded-xl border text-base px-4 py-3 transition-all flex items-center gap-3"
                      style={{
                        background,
                        borderColor,
                        color: "var(--fm-text)",
                      }}
                    >
                      <span
                        className="flex items-center justify-center shrink-0 font-bold text-sm"
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: "9999px",
                          background: color.fill,
                          color: color.fg,
                        }}
                      >
                        {letter}
                      </span>
                      <span className="flex-1">{opt}</span>
                      {isCorrect && (
                        <CheckCircle
                          className="h-5 w-5"
                          style={{ color: "#22c55e" }}
                        />
                      )}
                      {isWrong && (
                        <XCircle
                          className="h-5 w-5"
                          style={{ color: "#ef4444" }}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {question.type === "true_false" && (
              <div className="grid grid-cols-2 gap-3">
                {(["true", "false"] as const).map((val) => {
                  const isSelected = selectedOption === val;
                  const isCorrect =
                    submitted && (val === "true") === question.correctAnswer;
                  const isWrong = submitted && isSelected && !isCorrect;
                  const baseColor = val === "true" ? "#22c55e" : "#ef4444";
                  let background = `color-mix(in srgb, ${baseColor} 10%, transparent)`;
                  let borderColor = `color-mix(in srgb, ${baseColor} 30%, transparent)`;
                  if (isSelected || isCorrect) {
                    background = `color-mix(in srgb, ${baseColor} 18%, transparent)`;
                    borderColor = baseColor;
                  }
                  if (isWrong) {
                    background = `color-mix(in srgb, ${baseColor} 18%, transparent)`;
                    borderColor = baseColor;
                  }
                  return (
                    <button
                      key={val}
                      onClick={() => !submitted && setSelectedOption(val)}
                      disabled={submitted}
                      className="min-h-16 rounded-xl border text-lg font-semibold transition-all"
                      style={{
                        background,
                        borderColor,
                        color: baseColor,
                      }}
                    >
                      {val === "true" ? "True" : "False"}
                    </button>
                  );
                })}
              </div>
            )}

            {question.type === "free_response" && (
              <textarea
                value={freeResponse}
                onChange={(e) => setFreeResponse(e.target.value)}
                disabled={submitted}
                placeholder="Type your answer..."
                className="w-full rounded-xl px-4 py-3 text-sm min-h-30 resize-none outline-none"
                style={{
                  background: "var(--fm-surface-elevated)",
                  border: "1px solid var(--fm-surface-border)",
                  color: "var(--fm-text)",
                }}
              />
            )}
          </div>

          {submitted && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl p-4 text-sm"
              style={{
                background: currentAnswer?.correct
                  ? "color-mix(in srgb, #22c55e 10%, transparent)"
                  : "color-mix(in srgb, #ef4444 10%, transparent)",
                border: `1px solid ${
                  currentAnswer?.correct
                    ? "color-mix(in srgb, #22c55e 30%, transparent)"
                    : "color-mix(in srgb, #ef4444 30%, transparent)"
                }`,
                color: "var(--fm-text)",
              }}
            >
              <div className="flex items-center gap-2 mb-2 font-medium">
                {currentAnswer?.correct ? (
                  <>
                    <CheckCircle
                      className="h-4 w-4"
                      style={{ color: "#22c55e" }}
                    />
                    Correct!
                  </>
                ) : (
                  <>
                    <XCircle
                      className="h-4 w-4"
                      style={{ color: "#ef4444" }}
                    />
                    Incorrect
                  </>
                )}
              </div>
              {question.type !== "free_response" && (
                <p style={{ color: "var(--fm-text-secondary)" }}>
                  {question.explanation}
                </p>
              )}
              {question.type === "free_response" && (
                <p style={{ color: "var(--fm-text-secondary)" }}>
                  Sample answer: {question.sampleAnswer}
                </p>
              )}
            </motion.div>
          )}

          <div className="flex justify-end mt-6 gap-2">
            {!submitted ? (
              <Button
                onClick={checkAnswer}
                disabled={
                  (question.type !== "free_response" && !selectedOption) ||
                  (question.type === "free_response" && !freeResponse.trim())
                }
              >
                Submit Answer
              </Button>
            ) : (
              <Button onClick={nextQuestion} className="gap-1.5">
                {currentIndex < questions.length - 1 ? (
                  <>
                    Next <ChevronRight className="h-4 w-4" />
                  </>
                ) : (
                  "See Results"
                )}
              </Button>
            )}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
};
