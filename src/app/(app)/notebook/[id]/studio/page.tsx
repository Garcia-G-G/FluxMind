"use client";

import { use, useState } from "react";
import {
  HelpCircle,
  Layers,
  Loader2,
  Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { QuizView } from "@/components/studio/quiz-view";
import { FlashcardView } from "@/components/studio/flashcard-view";
import { StudyStats } from "@/components/studio/study-stats";
import { useGenerateQuiz, useGenerateFlashcards } from "@/hooks/use-study";

type StudioTab = "overview" | "quiz" | "flashcards";

const StudioPage = ({
  params,
}: {
  params: Promise<{ id: string }>;
}): React.ReactNode => {
  const { id: notebookId } = use(params);
  const [activeTab, setActiveTab] = useState<StudioTab>("overview");

  const generateQuiz = useGenerateQuiz();
  const generateFlashcards = useGenerateFlashcards();

  const [quizData, setQuizData] = useState<{
    id: string;
    title: string;
    questions: Array<Record<string, unknown>>;
  } | null>(null);

  const [flashcardData, setFlashcardData] = useState<{
    id: string;
    title: string;
    cards: Array<Record<string, unknown>>;
  } | null>(null);

  const handleGenerateQuiz = async (): Promise<void> => {
    try {
      const result = await generateQuiz.mutateAsync({ notebookId });
      setQuizData(result);
      
      setActiveTab("quiz");
    } catch {
      // Error handled by mutation
    }
  };

  const handleGenerateFlashcards = async (): Promise<void> => {
    try {
      const result = await generateFlashcards.mutateAsync({ notebookId });
      setFlashcardData(result);
      
      setActiveTab("flashcards");
    } catch {
      // Error handled by mutation
    }
  };

  if (activeTab === "quiz" && quizData) {
    return (
      <div>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-medium">{quizData.title}</h2>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setActiveTab("overview")}
          >
            Back to Studio
          </Button>
        </div>
        <QuizView
          outputId={quizData.id}
          questions={quizData.questions as Parameters<typeof QuizView>[0]["questions"]}
        />
      </div>
    );
  }

  if (activeTab === "flashcards" && flashcardData) {
    return (
      <div>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-medium">{flashcardData.title}</h2>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setActiveTab("overview")}
          >
            Back to Studio
          </Button>
        </div>
        <FlashcardView
          outputId={flashcardData.id}
          cards={flashcardData.cards as Parameters<typeof FlashcardView>[0]["cards"]}
        />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <h2 className="text-xl font-semibold mb-1">Studio</h2>
      <p className="text-sm text-muted-foreground mb-6">
        Generate study materials from your sources
      </p>

      {(quizData || flashcardData) && (
        <div className="mb-6">
          <StudyStats
            quizOutputId={quizData?.id}
            flashcardOutputId={flashcardData?.id}
            totalCards={flashcardData?.cards.length}
          />
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-2">
            <HelpCircle className="h-5 w-5 text-primary" />
            <h3 className="font-medium">Quiz</h3>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Test your knowledge with multiple choice, true/false, and free
            response questions.
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={handleGenerateQuiz}
              disabled={generateQuiz.isPending}
              className="gap-1.5"
            >
              {generateQuiz.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Wand2 className="h-4 w-4" />
              )}
              Generate Quiz
            </Button>
            {quizData && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setActiveTab("quiz")}
              >
                Resume
              </Button>
            )}
          </div>
          {generateQuiz.error && (
            <p className="text-xs text-destructive mt-2">
              {generateQuiz.error.message}
            </p>
          )}
        </div>

        <div className="rounded-lg border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-2">
            <Layers className="h-5 w-5 text-primary" />
            <h3 className="font-medium">Flashcards</h3>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Learn with spaced repetition flashcards. Cards you miss come back
            sooner.
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={handleGenerateFlashcards}
              disabled={generateFlashcards.isPending}
              className="gap-1.5"
            >
              {generateFlashcards.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Wand2 className="h-4 w-4" />
              )}
              Generate Flashcards
            </Button>
            {flashcardData && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setActiveTab("flashcards")}
              >
                Resume
              </Button>
            )}
          </div>
          {generateFlashcards.error && (
            <p className="text-xs text-destructive mt-2">
              {generateFlashcards.error.message}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default StudioPage;
