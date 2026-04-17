"use client";

import { use, useState } from "react";
import {
  HelpCircle,
  Layers,
  Loader2,
  Wand2,
  Presentation,
  Image,
  Table,
  Globe,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { QuizView } from "@/components/studio/quiz-view";
import { FlashcardView } from "@/components/studio/flashcard-view";
import { StudyStats } from "@/components/studio/study-stats";
import { SlideViewer } from "@/components/studio/slide-viewer";
import { InfographicViewer } from "@/components/studio/infographic-viewer";
import { DataTableView } from "@/components/studio/data-table-view";
import { DeepResearch } from "@/components/studio/deep-research";
import { useGenerateQuiz, useGenerateFlashcards } from "@/hooks/use-study";
import {
  useGenerateSlides,
  useGenerateInfographic,
  useGenerateDataTable,
} from "@/hooks/use-studio-outputs";
import type { SlidesContent } from "@/app/api/studio/slides/route";
import type { InfographicContent } from "@/app/api/studio/infographic/route";
import type { DataTableContent } from "@/app/api/studio/datatable/route";

type StudioTab =
  | "overview"
  | "quiz"
  | "flashcards"
  | "slides"
  | "infographic"
  | "datatable"
  | "research";

type OutputData<T> = { id: string; title: string } & T;

const StudioPage = ({
  params,
}: {
  params: Promise<{ id: string }>;
}): React.ReactNode => {
  const { id: notebookId } = use(params);
  const [activeTab, setActiveTab] = useState<StudioTab>("overview");

  // Generators
  const generateQuiz = useGenerateQuiz();
  const generateFlashcards = useGenerateFlashcards();
  const generateSlides = useGenerateSlides();
  const generateInfographic = useGenerateInfographic();
  const generateDataTable = useGenerateDataTable();

  // State for generated data
  const [quizData, setQuizData] = useState<OutputData<{ questions: unknown[] }> | null>(null);
  const [flashcardData, setFlashcardData] = useState<OutputData<{ cards: unknown[] }> | null>(null);
  const [slidesData, setSlidesData] = useState<OutputData<SlidesContent> | null>(null);
  const [infographicData, setInfographicData] = useState<OutputData<InfographicContent> | null>(null);
  const [dataTableData, setDataTableData] = useState<OutputData<DataTableContent> | null>(null);

  const generate = async <T,>(
    type: StudioTab,
    mutateAsync: (args: { notebookId: string }) => Promise<T>,
    setter: (data: T) => void
  ): Promise<void> => {
    try {
      const result = await mutateAsync({ notebookId });
      setter(result);
      setActiveTab(type);
    } catch {
      // Error shown by mutation
    }
  };

  // Render active output view
  if (activeTab !== "overview") {
    const backBtn = (
      <Button variant="outline" size="sm" onClick={() => setActiveTab("overview")}>
        Back to Studio
      </Button>
    );

    if (activeTab === "quiz" && quizData) {
      return (
        <div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-medium">{quizData.title}</h2>
            {backBtn}
          </div>
          <QuizView outputId={quizData.id} questions={quizData.questions as Parameters<typeof QuizView>[0]["questions"]} />
        </div>
      );
    }
    if (activeTab === "flashcards" && flashcardData) {
      return (
        <div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-medium">{flashcardData.title}</h2>
            {backBtn}
          </div>
          <FlashcardView outputId={flashcardData.id} cards={flashcardData.cards as Parameters<typeof FlashcardView>[0]["cards"]} />
        </div>
      );
    }
    if (activeTab === "slides" && slidesData) {
      return (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium">{slidesData.title}</h2>
            {backBtn}
          </div>
          <SlideViewer slides={slidesData as SlidesContent} />
        </div>
      );
    }
    if (activeTab === "infographic" && infographicData) {
      return (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium">{infographicData.title}</h2>
            {backBtn}
          </div>
          <InfographicViewer infographic={infographicData as InfographicContent} />
        </div>
      );
    }
    if (activeTab === "datatable" && dataTableData) {
      return (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium">{dataTableData.title}</h2>
            {backBtn}
          </div>
          <DataTableView data={dataTableData as DataTableContent} />
        </div>
      );
    }
    if (activeTab === "research") {
      return (
        <div>
          <div className="flex justify-end mb-4">{backBtn}</div>
          <DeepResearch notebookId={notebookId} />
        </div>
      );
    }
    // Fallback to overview if data not ready
    setActiveTab("overview");
  }

  // Studio card helper
  const StudioCard = ({
    icon: Icon,
    title,
    description,
    onGenerate,
    isPending,
    error,
    hasData,
    tab,
  }: {
    icon: React.ElementType;
    title: string;
    description: string;
    onGenerate: () => void;
    isPending: boolean;
    error: Error | null;
    hasData: boolean;
    tab: StudioTab;
  }): React.ReactNode => (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="h-5 w-5 text-primary" />
        <h3 className="font-medium">{title}</h3>
      </div>
      <p className="text-sm text-muted-foreground mb-4">{description}</p>
      <div className="flex gap-2">
        <Button size="sm" onClick={onGenerate} disabled={isPending} className="gap-1.5">
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
          Generate
        </Button>
        {hasData && (
          <Button size="sm" variant="outline" onClick={() => setActiveTab(tab)}>
            View
          </Button>
        )}
      </div>
      {error && <p className="text-xs text-destructive mt-2">{error.message}</p>}
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-xl font-semibold mb-1">Studio</h2>
      <p className="text-sm text-muted-foreground mb-6">
        Generate study materials and visual outputs from your sources
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

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <StudioCard
          icon={HelpCircle} title="Quiz" tab="quiz"
          description="Test knowledge with MC, T/F, and free response questions."
          onGenerate={() => generate("quiz", generateQuiz.mutateAsync, setQuizData)}
          isPending={generateQuiz.isPending} error={generateQuiz.error} hasData={!!quizData}
        />
        <StudioCard
          icon={Layers} title="Flashcards" tab="flashcards"
          description="Learn with spaced repetition flashcards."
          onGenerate={() => generate("flashcards", generateFlashcards.mutateAsync, setFlashcardData)}
          isPending={generateFlashcards.isPending} error={generateFlashcards.error} hasData={!!flashcardData}
        />
        <StudioCard
          icon={Presentation} title="Slide Deck" tab="slides"
          description="Generate a presentation with multiple layouts."
          onGenerate={() => generate("slides", generateSlides.mutateAsync, setSlidesData)}
          isPending={generateSlides.isPending} error={generateSlides.error} hasData={!!slidesData}
        />
        <StudioCard
          icon={Image} title="Infographic" tab="infographic"
          description="Visual infographic with stats, timelines, and comparisons."
          onGenerate={() => generate("infographic", generateInfographic.mutateAsync, setInfographicData)}
          isPending={generateInfographic.isPending} error={generateInfographic.error} hasData={!!infographicData}
        />
        <StudioCard
          icon={Table} title="Data Tables" tab="datatable"
          description="Extract and organize tabular data from sources."
          onGenerate={() => generate("datatable", generateDataTable.mutateAsync, setDataTableData)}
          isPending={generateDataTable.isPending} error={generateDataTable.error} hasData={!!dataTableData}
        />
      </div>

      {/* Deep Research section */}
      <div className="mt-6 rounded-lg border border-border bg-card p-5">
        <div className="flex items-center gap-2 mb-2">
          <Globe className="h-5 w-5 text-primary" />
          <h3 className="font-medium">Deep Research</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Go beyond your sources — search the web, read articles, and produce a
          comprehensive research report.
        </p>
        <Button
          size="sm"
          onClick={() => setActiveTab("research")}
          className="gap-1.5"
        >
          <Search className="h-4 w-4" />
          Start Research
        </Button>
      </div>
    </div>
  );
};

export default StudioPage;
