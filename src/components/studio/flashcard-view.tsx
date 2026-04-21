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
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

export const FlashcardView = ({
  outputId,
  cards,
}: {
  outputId: string;
  cards: Card[];
}): React.ReactNode => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
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
        <p className="text-muted-foreground">No cards match this filter.</p>
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

  return (
    <div className="max-w-lg mx-auto">
      {/* Stats bar */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-2">
          <Badge variant="secondary" className="text-xs">
            {stats.gotIt} got it
          </Badge>
          <Badge variant="secondary" className="text-xs">
            {stats.missed} missed
          </Badge>
          <Badge variant="secondary" className="text-xs">
            {stats.unseen} unseen
          </Badge>
          {stats.due > 0 && (
            <Badge className="text-xs bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
              {stats.due} due
            </Badge>
          )}
        </div>
        <span className="text-xs text-muted-foreground">
          {(currentIndex % filteredOrder.length) + 1} / {filteredOrder.length}
        </span>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-input text-xs text-muted-foreground hover:bg-accent transition-colors cursor-pointer">
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

      {/* Card with 3D flip */}
      <div
        className="perspective-[1000px] cursor-pointer mb-6"
        style={{ perspective: 1000 }}
        onClick={() => setFlipped(!flipped)}
      >
        <motion.div
          animate={{ rotateY: flipped ? 180 : 0 }}
          transition={{ duration: 0.5, type: "spring", stiffness: 300, damping: 30 }}
          style={{ transformStyle: "preserve-3d" }}
          className="relative h-64 w-full"
        >
          {/* Front */}
          <div
            className="absolute inset-0 rounded-xl border border-border bg-card p-6 flex flex-col items-center justify-center text-center shadow-sm"
            style={{ backfaceVisibility: "hidden" }}
          >
            <Badge variant="secondary" className="mb-3 text-xs">
              {card.difficulty}
            </Badge>
            <p className="text-lg font-medium">{card.front}</p>
            {card.hint && (
              <p className="text-xs text-muted-foreground mt-3">
                Hint: {card.hint}
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-4">
              Click or press space to flip
            </p>
          </div>

          {/* Back */}
          <div
            className="absolute inset-0 rounded-xl border border-border bg-card p-6 flex flex-col items-center justify-center text-center shadow-sm"
            style={{
              backfaceVisibility: "hidden",
              transform: "rotateY(180deg)",
            }}
          >
            <p className="text-sm leading-relaxed">{card.back}</p>
            <p className="text-xs text-muted-foreground mt-4">
              Source: {card.sourceReference}
            </p>
          </div>
        </motion.div>
      </div>

      {/* Response buttons */}
      <div className="flex gap-3 justify-center">
        <Button
          variant="outline"
          onClick={() => handleResponse(false)}
          className="gap-2 border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
        >
          <ThumbsDown className="h-4 w-4" />
          Missed It
        </Button>
        <Button
          variant="outline"
          onClick={() => handleResponse(true)}
          className="gap-2 border-green-200 text-green-600 hover:bg-green-50 dark:border-green-800 dark:text-green-400 dark:hover:bg-green-900/20"
        >
          <ThumbsUp className="h-4 w-4" />
          Got It
        </Button>
      </div>
    </div>
  );
};
