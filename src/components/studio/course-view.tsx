"use client";

import { useState } from "react";
import {
  CheckCircle,
  Circle,
  Clock,
  BookOpen,
  ChevronRight,
  Trophy,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { CourseContent } from "@/app/api/studio/course/route";

type LessonStatus = "not_started" | "in_progress" | "completed";

export const CourseView = ({
  course,
}: {
  course: CourseContent;
}): React.ReactNode => {
  const [activeLesson, setActiveLesson] = useState(0);
  const [lessonStatus, setLessonStatus] = useState<Record<string, LessonStatus>>(
    () => Object.fromEntries(course.lessons.map((l) => [l.id, "not_started"]))
  );
  const [showCompletion, setShowCompletion] = useState(false);

  const lesson = course.lessons[activeLesson];
  const completedCount = Object.values(lessonStatus).filter(
    (s) => s === "completed"
  ).length;
  const progress = Math.round((completedCount / course.lessons.length) * 100);

  const markComplete = (): void => {
    setLessonStatus((prev) => ({
      ...prev,
      [lesson.id]: "completed",
    }));

    // Check if all complete
    const newCompleted = completedCount + 1;
    if (newCompleted === course.lessons.length) {
      setShowCompletion(true);
    } else if (activeLesson < course.lessons.length - 1) {
      setActiveLesson(activeLesson + 1);
    }
  };

  if (showCompletion) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md mx-auto text-center py-12"
      >
        <Trophy className="h-16 w-16 mx-auto text-amber-500 mb-4" />
        <h2 className="text-2xl font-bold mb-2">Course Complete!</h2>
        <p className="text-muted-foreground mb-4">
          You&apos;ve completed all {course.lessons.length} lessons in{" "}
          <strong>{course.title}</strong>.
        </p>
        <Button onClick={() => setShowCompletion(false)} variant="outline">
          Review Lessons
        </Button>
      </motion.div>
    );
  }

  return (
    <div className="flex gap-4 h-full">
      {/* Lesson sidebar */}
      <div className="w-56 shrink-0 border-r border-border pr-3 hidden md:block">
        <div className="mb-3">
          <p className="text-xs text-muted-foreground">{progress}% complete</p>
          <div className="h-1.5 bg-muted rounded-full mt-1">
            <div
              className="h-full bg-primary rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
        <div className="space-y-0.5">
          {course.lessons.map((l, i) => {
            const status = lessonStatus[l.id];
            return (
              <button
                key={l.id}
                onClick={() => setActiveLesson(i)}
                className={cn(
                  "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left text-xs transition-colors",
                  i === activeLesson
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent/50"
                )}
              >
                {status === "completed" ? (
                  <CheckCircle className="h-3.5 w-3.5 text-green-500 shrink-0" />
                ) : (
                  <Circle className="h-3.5 w-3.5 shrink-0" />
                )}
                <span className="truncate">{l.title}</span>
              </button>
            );
          })}
        </div>
        <div className="mt-3 pt-3 border-t border-border">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            {course.estimatedDuration}
          </div>
        </div>
      </div>

      {/* Lesson content */}
      <div className="flex-1 min-w-0 overflow-y-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={lesson.id}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="secondary" className="text-xs">
                Lesson {activeLesson + 1}
              </Badge>
            </div>
            <h2 className="text-xl font-semibold mb-1">{lesson.title}</h2>
            <p className="text-sm text-muted-foreground mb-4">
              {lesson.objective}
            </p>

            {/* Content */}
            <div className="prose prose-sm dark:prose-invert max-w-none mb-6 [&>*:first-child]:mt-0">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {lesson.content}
              </ReactMarkdown>
            </div>

            {/* Key Concepts */}
            <div className="rounded-lg border border-border bg-primary/5 p-4 mb-6">
              <h3 className="font-medium text-sm mb-2 flex items-center gap-1.5">
                <BookOpen className="h-4 w-4" />
                Key Concepts
              </h3>
              <div className="flex flex-wrap gap-2">
                {lesson.keyConcepts.map((concept, i) => (
                  <Badge key={i} variant="secondary" className="text-xs">
                    {concept}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Inline Quiz */}
            {lesson.quiz.length > 0 && (
              <div className="rounded-lg border border-border p-4 mb-6">
                <h3 className="font-medium text-sm mb-3">Quick Check</h3>
                {lesson.quiz.map((q, qi) => (
                  <QuickQuiz key={qi} question={q} />
                ))}
              </div>
            )}

            {/* Mark complete */}
            <div className="flex justify-between items-center pt-4 border-t border-border">
              <Button
                variant="outline"
                size="sm"
                disabled={activeLesson === 0}
                onClick={() => setActiveLesson(activeLesson - 1)}
              >
                Previous
              </Button>
              {lessonStatus[lesson.id] === "completed" ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    activeLesson < course.lessons.length - 1 &&
                    setActiveLesson(activeLesson + 1)
                  }
                  className="gap-1"
                >
                  Next <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              ) : (
                <Button size="sm" onClick={markComplete} className="gap-1.5">
                  <CheckCircle className="h-4 w-4" />
                  Mark Complete
                </Button>
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

// Inline quick quiz for lessons
const QuickQuiz = ({
  question,
}: {
  question: {
    question: string;
    options: string[];
    correct: string;
    explanation: string;
  };
}): React.ReactNode => {
  const [selected, setSelected] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const correctIndex = ["A", "B", "C", "D"].indexOf(question.correct);

  return (
    <div className="mb-4 last:mb-0">
      <p className="text-sm font-medium mb-2">{question.question}</p>
      <div className="space-y-1.5">
        {question.options.map((opt, i) => {
          const letter = ["A", "B", "C", "D"][i];
          const isSelected = selected === letter;
          const isCorrect = submitted && i === correctIndex;
          const isWrong = submitted && isSelected && i !== correctIndex;
          return (
            <button
              key={i}
              onClick={() => {
                if (!submitted) {
                  setSelected(letter);
                  setSubmitted(true);
                }
              }}
              className={cn(
                "w-full text-left px-3 py-2 rounded-md border text-xs transition-all",
                isCorrect
                  ? "border-green-500 bg-green-50 dark:bg-green-900/20"
                  : isWrong
                    ? "border-red-500 bg-red-50 dark:bg-red-900/20"
                    : "border-border hover:border-primary/50"
              )}
            >
              {opt}
            </button>
          );
        })}
      </div>
      {submitted && (
        <p className="text-xs text-muted-foreground mt-2">
          {question.explanation}
        </p>
      )}
    </div>
  );
};
