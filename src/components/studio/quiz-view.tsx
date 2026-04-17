"use client";

import { useState, useMemo } from "react";
import {
  CheckCircle,
  XCircle,
  ChevronRight,
  RotateCcw,
  Trophy,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

const difficultyColors: Record<string, string> = {
  easy: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  medium: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  hard: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
};

export const QuizView = ({
  outputId,
  questions,
}: {
  outputId: string;
  questions: Question[];
}): React.ReactNode => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [freeResponse, setFreeResponse] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [showResults, setShowResults] = useState(false);
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
      // For free response, check if key points are mentioned
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
    setAnswers((prev) => [...prev.filter((a) => a.questionIndex !== currentIndex), answer]);
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
  };

  if (showResults) {
    const pct = Math.round((score / questions.length) * 100);
    const missed = answers.filter((a) => !a.correct);
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-lg mx-auto text-center py-8"
      >
        <Trophy className="h-12 w-12 mx-auto text-primary mb-4" />
        <h2 className="text-2xl font-bold mb-1">Quiz Complete!</h2>
        <p className="text-4xl font-bold text-primary my-4">
          {score}/{questions.length}
        </p>
        <p className="text-muted-foreground mb-6">{pct}% correct</p>
        <div className="flex gap-2 justify-center mb-8">
          <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
            {score} correct
          </Badge>
          <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">
            {questions.length - score} missed
          </Badge>
        </div>
        <div className="flex gap-2 justify-center">
          <Button onClick={retake} variant="outline" className="gap-1.5">
            <RotateCcw className="h-4 w-4" />
            Retake
          </Button>
        </div>

        {missed.length > 0 && (
          <div className="mt-8 text-left space-y-4">
            <h3 className="font-medium text-sm text-muted-foreground">
              Review Mistakes
            </h3>
            {missed.map((a) => {
              const q = questions[a.questionIndex];
              return (
                <div
                  key={a.questionIndex}
                  className="border border-border rounded-lg p-4 text-sm"
                >
                  <p className="font-medium mb-2">{q.question}</p>
                  <p className="text-destructive text-xs">
                    Your answer: {a.selectedAnswer || "(no answer)"}
                  </p>
                  <p className="text-green-600 dark:text-green-400 text-xs mt-1">
                    Correct:{" "}
                    {q.type === "multiple_choice"
                      ? q.correctAnswer
                      : q.type === "true_false"
                        ? String(q.correctAnswer)
                        : q.sampleAnswer}
                  </p>
                  <p className="text-muted-foreground text-xs mt-2">
                    {q.type !== "free_response" ? q.explanation : ""}
                  </p>
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
    <div className="max-w-2xl mx-auto">
      {/* Progress bar */}
      <div className="flex gap-1 mb-6">
        {questions.map((_, i) => {
          const ans = answers.find((a) => a.questionIndex === i);
          return (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                ans
                  ? ans.correct
                    ? "bg-green-500"
                    : "bg-red-500"
                  : i === currentIndex
                    ? "bg-primary"
                    : "bg-muted"
              }`}
            />
          );
        })}
      </div>

      <div className="flex items-center justify-between mb-4">
        <span className="text-sm text-muted-foreground">
          Question {currentIndex + 1} of {questions.length}
        </span>
        <div className="flex gap-1.5">
          <Badge className={difficultyColors[question.difficulty] ?? ""}>
            {question.difficulty}
          </Badge>
          <Badge variant="secondary" className="text-xs">
            {question.type === "multiple_choice"
              ? "MC"
              : question.type === "true_false"
                ? "T/F"
                : "FR"}
          </Badge>
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
          <h3 className="text-lg font-medium mb-4">{question.question}</h3>

          {question.type === "multiple_choice" && (
            <div className="space-y-2">
              {question.options.map((opt, i) => {
                const letter = ["A", "B", "C", "D"][i];
                const isSelected = selectedOption === letter;
                const isCorrect = submitted && letter === question.correctAnswer;
                const isWrong = submitted && isSelected && !isCorrect;
                return (
                  <button
                    key={i}
                    onClick={() => !submitted && setSelectedOption(letter)}
                    disabled={submitted}
                    className={`w-full text-left px-4 py-3 rounded-lg border text-sm transition-all ${
                      isCorrect
                        ? "border-green-500 bg-green-50 dark:bg-green-900/20"
                        : isWrong
                          ? "border-red-500 bg-red-50 dark:bg-red-900/20"
                          : isSelected
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/50"
                    }`}
                  >
                    {opt}
                    {isCorrect && (
                      <CheckCircle className="inline h-4 w-4 ml-2 text-green-500" />
                    )}
                    {isWrong && (
                      <XCircle className="inline h-4 w-4 ml-2 text-red-500" />
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {question.type === "true_false" && (
            <div className="grid grid-cols-2 gap-3">
              {["true", "false"].map((val) => {
                const isSelected = selectedOption === val;
                const isCorrect =
                  submitted &&
                  (val === "true") === question.correctAnswer;
                const isWrong = submitted && isSelected && !isCorrect;
                return (
                  <button
                    key={val}
                    onClick={() => !submitted && setSelectedOption(val)}
                    disabled={submitted}
                    className={`px-6 py-4 rounded-lg border text-sm font-medium transition-all ${
                      isCorrect
                        ? "border-green-500 bg-green-50 dark:bg-green-900/20"
                        : isWrong
                          ? "border-red-500 bg-red-50 dark:bg-red-900/20"
                          : isSelected
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/50"
                    }`}
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
              className="w-full rounded-lg border border-input bg-background px-4 py-3 text-sm min-h-[100px] resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          )}

          {submitted && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`mt-4 p-4 rounded-lg text-sm ${
                currentAnswer?.correct
                  ? "bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800"
                  : "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800"
              }`}
            >
              <div className="flex items-center gap-2 mb-2 font-medium">
                {currentAnswer?.correct ? (
                  <>
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    Correct!
                  </>
                ) : (
                  <>
                    <XCircle className="h-4 w-4 text-red-600" />
                    Incorrect
                  </>
                )}
              </div>
              {question.type !== "free_response" && (
                <p className="text-muted-foreground">{question.explanation}</p>
              )}
              {question.type === "free_response" && (
                <p className="text-muted-foreground">
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
