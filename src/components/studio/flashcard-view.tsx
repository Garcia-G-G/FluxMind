"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import {
  ThumbsUp,
  ThumbsDown,
  Shuffle,
  ChevronLeft,
  ChevronRight,
  Filter,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  useFlashcardProgress,
  useUpdateFlashcardProgress,
} from "@/hooks/use-study";
import { isDue } from "@/lib/study/sm2";

type Card = {
  id: string;
  front: string;
  back: string;
  hint?: string;
  difficulty: string;
  sourceReference: string;
  tags: string[];
};

type FilterMode = "all" | "new" | "due" | "missed" | "mastered";

/** Spec-mandated difficulty colors (not theme tokens — treat as semantic
 *  status hues, same rule as MC_COLORS.) */
const DIFFICULTY_BORDER: Record<string, string> = {
  easy: "#22c55e",
  medium: "#f59e0b",
  hard: "#ef4444",
};

const pillStyle = (bg: string, fg: string): React.CSSProperties => ({
  background: bg,
  color: fg,
  borderRadius: "9999px",
  padding: "0.125rem 0.625rem",
  fontSize: "11px",
  fontWeight: 600,
  lineHeight: 1.4,
});

export const FlashcardView = ({
  outputId,
  cards,
  coverImage,
  cardImages,
}: {
  outputId: string;
  cards: Card[];
  coverImage?: string | null;
  cardImages?: Record<string, string>;
}): React.ReactNode => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [hasFlipped, setHasFlipped] = useState(false);
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [shuffled, setShuffled] = useState(false);
  const [cardOrder, setCardOrder] = useState<number[]>(
    cards.map((_, i) => i)
  );

  const { data: progress } = useFlashcardProgress(outputId);
  const updateProgress = useUpdateFlashcardProgress();

  const getCardStatus = useCallback(
    (cardIndex: number): string => {
      const p = progress?.find((p) => p.cardIndex === cardIndex);
      return p?.status ?? "new";
    },
    [progress]
  );

  const isCardDue = useCallback(
    (cardIndex: number): boolean => {
      const p = progress?.find((p) => p.cardIndex === cardIndex);
      if (!p) return true;
      return isDue(p.nextReview ? new Date(p.nextReview) : null);
    },
    [progress]
  );

  const filteredOrder = useMemo(() => {
    return cardOrder.filter((idx) => {
      const status = getCardStatus(idx);
      switch (filterMode) {
        case "new":
          return status === "new";
        case "due":
          return isCardDue(idx);
        case "missed":
          return status === "learning";
        case "mastered":
          return status === "mastered" || status === "review";
        default:
          return true;
      }
    });
  }, [cardOrder, filterMode, getCardStatus, isCardDue]);

  const actualIndex =
    filteredOrder.length > 0
      ? filteredOrder[currentIndex % filteredOrder.length]
      : 0;
  const card = cards[actualIndex];

  // Stats
  const stats = useMemo(() => {
    const total = cards.length;
    const gotIt =
      progress?.filter(
        (p) => p.status === "review" || p.status === "mastered"
      ).length ?? 0;
    const missed =
      progress?.filter((p) => p.status === "learning").length ?? 0;
    const unseen = total - (progress?.length ?? 0);
    const due = cards.filter((_, i) => isCardDue(i)).length;
    return { total, gotIt, missed, unseen, due };
  }, [cards, progress, isCardDue]);

  const goNext = useCallback((): void => {
    setFlipped(false);
    setCurrentIndex((i) =>
      filteredOrder.length > 0 ? (i + 1) % filteredOrder.length : 0,
    );
  }, [filteredOrder.length]);

  const goPrev = useCallback((): void => {
    setFlipped(false);
    setCurrentIndex((i) =>
      filteredOrder.length > 0
        ? (i - 1 + filteredOrder.length) % filteredOrder.length
        : 0,
    );
  }, [filteredOrder.length]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        setFlipped((f) => !f);
        setHasFlipped(true);
      } else if (e.key === "ArrowRight") {
        goNext();
      } else if (e.key === "ArrowLeft") {
        goPrev();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [goNext, goPrev]);

  const handleResponse = (gotIt: boolean): void => {
    updateProgress.mutate({ outputId, cardIndex: actualIndex, gotIt });
    goNext();
  };

  const toggleShuffle = (): void => {
    if (shuffled) {
      setCardOrder(cards.map((_, i) => i));
    } else {
      const shuffledOrder = [...cardOrder];
      for (let i = shuffledOrder.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffledOrder[i], shuffledOrder[j]] = [
          shuffledOrder[j],
          shuffledOrder[i],
        ];
      }
      setCardOrder(shuffledOrder);
    }
    setShuffled(!shuffled);
    setCurrentIndex(0);
    setFlipped(false);
  };

  if (!card || filteredOrder.length === 0) {
    return (
      <div className="text-center py-12">
        <p style={{ color: "var(--fm-text-secondary)" }}>
          No cards match this filter.
        </p>
        <Button
          variant="outline"
          size="sm"
          className="mt-4"
          onClick={() => setFilterMode("all")}
        >
          Show all cards
        </Button>
      </div>
    );
  }

  const difficultyColor =
    DIFFICULTY_BORDER[card.difficulty] ?? DIFFICULTY_BORDER.medium;

  const gotItPill = pillStyle(
    "color-mix(in srgb, #22c55e 12%, transparent)",
    "#15803d",
  );
  const missedPill = pillStyle(
    "color-mix(in srgb, #ef4444 12%, transparent)",
    "#b91c1c",
  );
  const duePill = pillStyle(
    "color-mix(in srgb, #f59e0b 12%, transparent)",
    "#b45309",
  );
  const unseenPill: React.CSSProperties = {
    background: "var(--fm-surface-elevated)",
    color: "var(--fm-text-tertiary)",
    borderRadius: "9999px",
    padding: "0.125rem 0.625rem",
    fontSize: "11px",
    fontWeight: 600,
    lineHeight: 1.4,
    border: "1px solid var(--fm-surface-border)",
  };

  const cardImageUrl = cardImages?.[card.id];

  return (
    <div className="max-w-2xl mx-auto">
      {/* Cover illustration — optional, skipped on old outputs */}
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

      {/* Stats bar */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex gap-2 flex-wrap">
          <span style={gotItPill}>{stats.gotIt} got it</span>
          <span style={missedPill}>{stats.missed} missed</span>
          <span style={unseenPill}>{stats.unseen} unseen</span>
          {stats.due > 0 && <span style={duePill}>{stats.due} due</span>}
        </div>
        <span
          className="text-xs"
          style={{ color: "var(--fm-text-tertiary)" }}
        >
          {(currentIndex % filteredOrder.length) + 1} / {filteredOrder.length}
        </span>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md border text-xs transition-colors cursor-pointer"
              style={{
                borderColor: "var(--fm-surface-border)",
                color: "var(--fm-text-secondary)",
              }}
            >
              <Filter className="h-3 w-3" />
              {filterMode === "all" ? "All" : filterMode}
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => { setFilterMode("all"); setCurrentIndex(0); }}>
                All
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { setFilterMode("new"); setCurrentIndex(0); }}>
                Unseen
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { setFilterMode("due"); setCurrentIndex(0); }}>
                Due for review
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { setFilterMode("missed"); setCurrentIndex(0); }}>
                Missed
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { setFilterMode("mastered"); setCurrentIndex(0); }}>
                Got it
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant={shuffled ? "secondary" : "ghost"}
            size="sm"
            className="h-7 px-2"
            onClick={toggleShuffle}
          >
            <Shuffle className="h-3.5 w-3.5" />
          </Button>
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={goPrev}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={goNext}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Card with slide-between + 3D flip */}
      <AnimatePresence mode="wait">
        <motion.div
          key={actualIndex}
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -24 }}
          transition={{ duration: 0.18 }}
          className="mb-6"
        >
          <div
            className="cursor-pointer"
            style={{ perspective: 1000 }}
            onClick={() => {
              setFlipped((f) => !f);
              setHasFlipped(true);
            }}
          >
            <motion.div
              animate={{ rotateY: flipped ? 180 : 0 }}
              transition={{
                duration: 0.5,
                type: "spring",
                stiffness: 300,
                damping: 30,
              }}
              style={{ transformStyle: "preserve-3d" }}
              className="relative min-h-[18rem] w-full"
            >
              {/* Front */}
              <div
                className="absolute inset-0 rounded-2xl p-10 flex flex-col items-center justify-center text-center"
                style={{
                  backfaceVisibility: "hidden",
                  background: "var(--fm-surface)",
                  border: "1px solid var(--fm-surface-border)",
                  borderLeft: `4px solid ${difficultyColor}`,
                  color: "var(--fm-text)",
                  boxShadow: "0 2px 14px rgba(0,0,0,0.08)",
                }}
              >
                <span
                  style={{
                    ...pillStyle(
                      `color-mix(in srgb, ${difficultyColor} 14%, transparent)`,
                      difficultyColor,
                    ),
                    marginBottom: "1rem",
                  }}
                >
                  {card.difficulty}
                </span>
                {cardImageUrl && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={cardImageUrl}
                    alt=""
                    className="w-40 h-40 object-cover rounded-lg mb-4"
                    loading="lazy"
                  />
                )}
                <p className="text-xl font-semibold leading-snug">
                  {card.front}
                </p>
                {card.hint && (
                  <p
                    className="text-xs mt-4"
                    style={{ color: "var(--fm-text-tertiary)" }}
                  >
                    Hint: {card.hint}
                  </p>
                )}
                {!hasFlipped && (
                  <p
                    className="text-xs mt-6"
                    style={{ color: "var(--fm-text-tertiary)" }}
                  >
                    Click or press space to flip
                  </p>
                )}
              </div>

              {/* Back */}
              <div
                className="absolute inset-0 rounded-2xl p-10 flex flex-col items-center justify-center text-center"
                style={{
                  backfaceVisibility: "hidden",
                  transform: "rotateY(180deg)",
                  background: "var(--fm-surface)",
                  border: "1px solid var(--fm-surface-border)",
                  borderLeft: `4px solid ${difficultyColor}`,
                  color: "var(--fm-text)",
                  boxShadow: "0 2px 14px rgba(0,0,0,0.08)",
                }}
              >
                <p className="text-base leading-relaxed">{card.back}</p>
                <p
                  className="text-xs mt-5"
                  style={{ color: "var(--fm-text-tertiary)" }}
                >
                  Source: {card.sourceReference}
                </p>
              </div>
            </motion.div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Response buttons */}
      <div className="flex gap-3 justify-center">
        <button
          type="button"
          onClick={() => handleResponse(false)}
          className="flex items-center justify-center gap-2 min-w-32 py-3 rounded-xl font-medium transition-colors"
          style={{
            background: "color-mix(in srgb, #ef4444 10%, transparent)",
            color: "#ef4444",
            border: "1px solid color-mix(in srgb, #ef4444 30%, transparent)",
          }}
        >
          <ThumbsDown className="h-4 w-4" />
          Missed It
        </button>
        <button
          type="button"
          onClick={() => handleResponse(true)}
          className="flex items-center justify-center gap-2 min-w-32 py-3 rounded-xl font-medium transition-colors"
          style={{
            background: "color-mix(in srgb, #22c55e 10%, transparent)",
            color: "#22c55e",
            border: "1px solid color-mix(in srgb, #22c55e 30%, transparent)",
          }}
        >
          <ThumbsUp className="h-4 w-4" />
          Got It
        </button>
      </div>
    </div>
  );
};
