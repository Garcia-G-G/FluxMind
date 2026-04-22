"use client";

import { useState } from "react";
import {
  CheckCircle,
  Clock,
  BookOpen,
  ChevronRight,
  Trophy,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import type { CourseContent } from "@/app/api/studio/course/route";

type LessonStatus = "not_started" | "in_progress" | "completed";

/** Spec-mandated MC per-option hues (shared with main quiz). */
const INLINE_MC_COLORS: readonly string[] = [
  "#3b82f6",
  "#ef4444",
  "#f59e0b",
  "#22c55e",
] as const;

export const CourseView = ({
  course,
}: {
  course: CourseContent;
}): React.ReactNode => {
  const [activeLesson, setActiveLesson] = useState(0);
  const [lessonStatus, setLessonStatus] = useState<
    Record<string, LessonStatus>
  >(() =>
    Object.fromEntries(course.lessons.map((l) => [l.id, "not_started"])),
  );
  const [showCompletion, setShowCompletion] = useState(false);

  const lesson = course.lessons[activeLesson];
  const completedCount = Object.values(lessonStatus).filter(
    (s) => s === "completed",
  ).length;
  const progress = Math.round(
    (completedCount / course.lessons.length) * 100,
  );

  const markComplete = (): void => {
    setLessonStatus((prev) => ({
      ...prev,
      [lesson.id]: "completed",
    }));

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
        <Trophy
          className="h-16 w-16 mx-auto mb-4"
          style={{ color: "#f59e0b" }}
        />
        <h2
          className="text-2xl font-bold mb-2"
          style={{ color: "var(--fm-text)" }}
        >
          Course Complete!
        </h2>
        <p
          className="mb-4"
          style={{ color: "var(--fm-text-secondary)" }}
        >
          You&apos;ve completed all {course.lessons.length} lessons in{" "}
          <strong>{course.title}</strong>.
        </p>
        <Button onClick={() => setShowCompletion(false)} variant="outline">
          Review Lessons
        </Button>
      </motion.div>
    );
  }

  const lessonImage = course.lessonImages?.[lesson.id];

  return (
    <div className="flex flex-col h-full">
      {course.coverImage && (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={course.coverImage}
          alt=""
          className="w-full h-32 sm:h-40 object-cover rounded-xl mb-4"
          loading="lazy"
          style={{ border: "1px solid var(--fm-surface-border)" }}
        />
      )}
      <div className="flex flex-col md:flex-row gap-4 flex-1 min-h-0">
      {/* Mobile dropdown selector */}
      <div className="md:hidden mb-2">
        <label
          className="text-xs font-semibold uppercase tracking-wider block mb-1"
          style={{ color: "var(--fm-text-tertiary)" }}
        >
          Lesson
        </label>
        <select
          value={activeLesson}
          onChange={(e) => setActiveLesson(Number(e.target.value))}
          className="w-full rounded-lg px-3 py-2 text-sm outline-none"
          style={{
            background: "var(--fm-surface-elevated)",
            border: "1px solid var(--fm-surface-border)",
            color: "var(--fm-text)",
          }}
        >
          {course.lessons.map((l, i) => (
            <option key={l.id} value={i}>
              {i + 1}. {l.title}
              {lessonStatus[l.id] === "completed" ? " ✓" : ""}
            </option>
          ))}
        </select>
      </div>

      {/* Desktop sidebar */}
      <div
        className="w-60 shrink-0 hidden md:block"
        style={{
          borderRight: "1px solid var(--fm-surface-border)",
          paddingRight: "0.75rem",
        }}
      >
        <div className="mb-3">
          <p
            className="text-xs"
            style={{ color: "var(--fm-text-tertiary)" }}
          >
            {progress}% complete
          </p>
          <div
            className="rounded-full mt-1 overflow-hidden"
            style={{
              height: 6,
              background: "var(--fm-surface-border)",
            }}
          >
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${progress}%`,
                background: "var(--fm-accent-orange)",
              }}
            />
          </div>
        </div>
        <div className="flex flex-col gap-1">
          {course.lessons.map((l, i) => {
            const status = lessonStatus[l.id];
            const isActive = i === activeLesson;
            return (
              <button
                key={l.id}
                onClick={() => setActiveLesson(i)}
                className="w-full flex items-center gap-2 px-2 py-2 rounded-md text-left text-xs transition-colors"
                style={{
                  background: isActive
                    ? "var(--fm-surface-elevated)"
                    : "transparent",
                  color: isActive
                    ? "var(--fm-text)"
                    : "var(--fm-text-secondary)",
                  borderLeft: isActive
                    ? `3px solid var(--fm-accent-orange)`
                    : "3px solid transparent",
                  paddingLeft: isActive ? "0.5rem" : "0.625rem",
                }}
              >
                <span
                  className="flex items-center justify-center shrink-0 text-[10px] font-bold tabular-nums"
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: "9999px",
                    background:
                      status === "completed"
                        ? "#22c55e"
                        : isActive
                          ? "var(--fm-accent-orange)"
                          : "var(--fm-surface-border)",
                    color:
                      status === "completed" || isActive
                        ? "white"
                        : "var(--fm-text-tertiary)",
                  }}
                >
                  {status === "completed" ? "✓" : i + 1}
                </span>
                <span className="truncate">{l.title}</span>
              </button>
            );
          })}
        </div>
        <div
          className="mt-3 pt-3"
          style={{ borderTop: "1px solid var(--fm-surface-border)" }}
        >
          <div
            className="flex items-center gap-1.5 text-xs"
            style={{ color: "var(--fm-text-tertiary)" }}
          >
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
            {lessonImage && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={lessonImage}
                alt=""
                className="w-full h-40 object-cover rounded-xl mb-3"
                loading="lazy"
                style={{ border: "1px solid var(--fm-surface-border)" }}
              />
            )}
            <div className="flex items-center gap-2 mb-1">
              <span
                className="text-[11px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-md"
                style={{
                  background: "var(--fm-surface-elevated)",
                  color: "var(--fm-text-tertiary)",
                  border: "1px solid var(--fm-surface-border)",
                }}
              >
                Lesson {activeLesson + 1}
              </span>
            </div>
            <h2
              className="text-xl font-semibold mb-1"
              style={{ color: "var(--fm-text)" }}
            >
              {lesson.title}
            </h2>
            <p
              className="text-sm mb-4"
              style={{ color: "var(--fm-text-secondary)" }}
            >
              {lesson.objective}
            </p>

            {/* Prose content */}
            <div
              className="prose prose-sm max-w-none mb-6 [&>*:first-child]:mt-0 [&_p]:leading-relaxed"
              style={{ color: "var(--fm-text)" }}
            >
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {lesson.content}
              </ReactMarkdown>
            </div>

            {/* Key Concepts */}
            <div
              className="rounded-xl p-4 mb-6"
              style={{
                background:
                  "color-mix(in srgb, var(--fm-accent-orange) 6%, transparent)",
                border:
                  "1px solid color-mix(in srgb, var(--fm-accent-orange) 24%, transparent)",
              }}
            >
              <h3
                className="font-semibold text-sm mb-3 flex items-center gap-1.5"
                style={{ color: "var(--fm-text)" }}
              >
                <BookOpen
                  className="h-4 w-4"
                  style={{ color: "var(--fm-accent-orange)" }}
                />
                Key Concepts
              </h3>
              <div className="flex flex-wrap gap-2">
                {lesson.keyConcepts.map((concept, i) => (
                  <span
                    key={i}
                    className="rounded-full px-2 py-0.5 text-xs font-medium"
                    style={{
                      background:
                        "color-mix(in srgb, var(--fm-accent-orange) 10%, transparent)",
                      color: "var(--fm-accent-orange)",
                    }}
                  >
                    {concept}
                  </span>
                ))}
              </div>
            </div>

            {/* Inline Quiz */}
            {lesson.quiz.length > 0 && (
              <div
                className="rounded-xl p-4 mb-6"
                style={{
                  background: "var(--fm-surface)",
                  border: "1px solid var(--fm-surface-border)",
                }}
              >
                <h3
                  className="font-semibold text-sm mb-3"
                  style={{ color: "var(--fm-text)" }}
                >
                  Quick Check
                </h3>
                {lesson.quiz.map((q, qi) => (
                  <QuickQuiz key={qi} question={q} />
                ))}
              </div>
            )}

            {/* Nav */}
            <div
              className="flex justify-between items-center pt-4"
              style={{ borderTop: "1px solid var(--fm-surface-border)" }}
            >
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
    </div>
  );
};

// Inline quick quiz for lessons — small, colored-tile variant of the main quiz
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
      <p
        className="text-sm font-medium mb-2"
        style={{ color: "var(--fm-text)" }}
      >
        {question.question}
      </p>
      <div className="space-y-1.5">
        {question.options.map((opt, i) => {
          const letter = ["A", "B", "C", "D"][i];
          const isSelected = selected === letter;
          const isCorrect = submitted && i === correctIndex;
          const isWrong = submitted && isSelected && i !== correctIndex;
          const baseColor = INLINE_MC_COLORS[i % INLINE_MC_COLORS.length];
          let background = "var(--fm-surface-elevated)";
          let borderColor = "var(--fm-surface-border)";
          if (isCorrect) {
            background = "color-mix(in srgb, #22c55e 12%, transparent)";
            borderColor = "#22c55e";
          } else if (isWrong) {
            background = "color-mix(in srgb, #ef4444 12%, transparent)";
            borderColor = "#ef4444";
          } else if (isSelected) {
            background = `color-mix(in srgb, ${baseColor} 10%, transparent)`;
            borderColor = baseColor;
          }
          return (
            <button
              key={i}
              onClick={() => {
                if (!submitted) {
                  setSelected(letter);
                  setSubmitted(true);
                }
              }}
              className="w-full text-left px-3 py-2 rounded-md border text-xs transition-all flex items-center gap-2"
              style={{
                background,
                borderColor,
                color: "var(--fm-text)",
              }}
            >
              <span
                className="flex items-center justify-center shrink-0 text-[10px] font-bold"
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: "9999px",
                  background: baseColor,
                  color: "white",
                }}
              >
                {letter}
              </span>
              <span className="flex-1">{opt}</span>
            </button>
          );
        })}
      </div>
      {submitted && (
        <p
          className="text-xs mt-2"
          style={{ color: "var(--fm-text-tertiary)" }}
        >
          {question.explanation}
        </p>
      )}
    </div>
  );
};
