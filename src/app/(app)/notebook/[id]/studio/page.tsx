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
  MessageCircle,
  Mail,
  Video,
  GraduationCap,
  Network,
  Film,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { QuizView } from "@/components/studio/quiz-view";
import { FlashcardView } from "@/components/studio/flashcard-view";
import { StudyStats } from "@/components/studio/study-stats";
import { SlideViewer } from "@/components/studio/slide-viewer";
import { InfographicViewer } from "@/components/studio/infographic-viewer";
import { DataTableView } from "@/components/studio/data-table-view";
import { DeepResearch } from "@/components/studio/deep-research";
import { ThreadPreview } from "@/components/studio/thread-preview";
import { NewsletterPreview } from "@/components/studio/newsletter-preview";
import { ReelScriptView } from "@/components/studio/reel-script-view";
import { CourseView } from "@/components/studio/course-view";
import { MindMapCanvas } from "@/components/mind-map/mind-map-canvas";
import { VideoPlayer } from "@/components/video/video-player";
import { useGenerateQuiz, useGenerateFlashcards } from "@/hooks/use-study";
import {
  useGenerateSlides,
  useGenerateInfographic,
  useGenerateDataTable,
  useGenerateThread,
  useGenerateNewsletter,
  useGenerateReel,
  useGenerateCourse,
  useGenerateMindMap,
  useGenerateVideo,
} from "@/hooks/use-studio-outputs";
import type { SlidesContent } from "@/app/api/studio/slides/route";
import type { InfographicContent } from "@/app/api/studio/infographic/route";
import type { DataTableContent } from "@/app/api/studio/datatable/route";
import type { ThreadContent } from "@/app/api/studio/thread/route";
import type { NewsletterContent } from "@/app/api/studio/newsletter/route";
import type { ReelContent } from "@/app/api/studio/reel/route";
import type { CourseContent } from "@/app/api/studio/course/route";

type StudioTab =
  | "overview"
  | "quiz"
  | "flashcards"
  | "slides"
  | "infographic"
  | "datatable"
  | "research"
  | "thread"
  | "newsletter"
  | "reel"
  | "course"
  | "mindmap"
  | "video";

type OutputData<T> = { id: string; title: string } & T;

const StudioPage = ({
  params,
}: {
  params: Promise<{ id: string }>;
}): React.ReactNode => {
  const { id: notebookId } = use(params);
  const [activeTab, setActiveTab] = useState<StudioTab>("overview");

  // All generators
  const generateQuiz = useGenerateQuiz();
  const generateFlashcards = useGenerateFlashcards();
  const generateSlides = useGenerateSlides();
  const generateInfographic = useGenerateInfographic();
  const generateDataTable = useGenerateDataTable();
  const generateThread = useGenerateThread();
  const generateNewsletter = useGenerateNewsletter();
  const generateReel = useGenerateReel();
  const generateCourse = useGenerateCourse();
  const generateMindMap = useGenerateMindMap();
  const generateVideoOverview = useGenerateVideo();

  // All output data
  const [quizData, setQuizData] = useState<OutputData<{ questions: unknown[] }> | null>(null);
  const [flashcardData, setFlashcardData] = useState<OutputData<{ cards: unknown[] }> | null>(null);
  const [slidesData, setSlidesData] = useState<OutputData<SlidesContent> | null>(null);
  const [infographicData, setInfographicData] = useState<OutputData<InfographicContent> | null>(null);
  const [dataTableData, setDataTableData] = useState<OutputData<DataTableContent> | null>(null);
  const [threadData, setThreadData] = useState<OutputData<ThreadContent> | null>(null);
  const [newsletterData, setNewsletterData] = useState<OutputData<NewsletterContent> | null>(null);
  const [reelData, setReelData] = useState<OutputData<ReelContent> | null>(null);
  const [courseData, setCourseData] = useState<OutputData<CourseContent> | null>(null);
  const [mindMapData, setMindMapData] = useState<OutputData<{ nodes: unknown[]; edges: unknown[] }> | null>(null);
  const [videoData, setVideoData] = useState<OutputData<{ fileUrl?: string; chapters?: unknown[]; status: string }> | null>(null);

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

    const wrap = (title: string, content: React.ReactNode): React.ReactNode => (
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium">{title}</h2>
          {backBtn}
        </div>
        {content}
      </div>
    );

    if (activeTab === "quiz" && quizData)
      return wrap(quizData.title, <QuizView outputId={quizData.id} questions={quizData.questions as Parameters<typeof QuizView>[0]["questions"]} />);
    if (activeTab === "flashcards" && flashcardData)
      return wrap(flashcardData.title, <FlashcardView outputId={flashcardData.id} cards={flashcardData.cards as Parameters<typeof FlashcardView>[0]["cards"]} />);
    if (activeTab === "slides" && slidesData)
      return wrap(slidesData.title, <SlideViewer slides={slidesData as SlidesContent} />);
    if (activeTab === "infographic" && infographicData)
      return wrap(infographicData.title, <InfographicViewer infographic={infographicData as InfographicContent} />);
    if (activeTab === "datatable" && dataTableData)
      return wrap(dataTableData.title, <DataTableView data={dataTableData as DataTableContent} />);
    if (activeTab === "thread" && threadData)
      return wrap(threadData.title, <ThreadPreview thread={threadData as ThreadContent} />);
    if (activeTab === "newsletter" && newsletterData)
      return wrap(newsletterData.title, <NewsletterPreview newsletter={newsletterData as NewsletterContent} />);
    if (activeTab === "reel" && reelData)
      return wrap(reelData.title, <ReelScriptView reel={reelData as ReelContent} />);
    if (activeTab === "course" && courseData)
      return wrap(courseData.title, <CourseView course={courseData as CourseContent} />);
    if (activeTab === "video" && videoData)
      return wrap(videoData.title, <VideoPlayer fileUrl={(videoData as Record<string, unknown>).fileUrl as string ?? null} title={videoData.title} status={videoData.status ?? "ready"} chapters={(videoData as Record<string, unknown>).chapters as Parameters<typeof VideoPlayer>[0]["chapters"]} />);
    if (activeTab === "mindmap" && mindMapData)
      return wrap(mindMapData.title, <MindMapCanvas data={mindMapData as { nodes: Parameters<typeof MindMapCanvas>[0]["data"]["nodes"]; edges: Parameters<typeof MindMapCanvas>[0]["data"]["edges"] }} />);
    if (activeTab === "research")
      return <div><div className="flex justify-end mb-4">{backBtn}</div><DeepResearch notebookId={notebookId} /></div>;

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
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-2 mb-1.5">
        <Icon className="h-4 w-4 text-primary" />
        <h3 className="font-medium text-sm">{title}</h3>
      </div>
      <p className="text-xs text-muted-foreground mb-3">{description}</p>
      <div className="flex gap-2">
        <Button size="sm" onClick={onGenerate} disabled={isPending} className="gap-1.5 h-7 text-xs">
          {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
          Generate
        </Button>
        {hasData && (
          <Button size="sm" variant="outline" onClick={() => setActiveTab(tab)} className="h-7 text-xs">
            View
          </Button>
        )}
      </div>
      {error && <p className="text-xs text-destructive mt-1.5">{error.message}</p>}
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto">
      <h2 className="text-xl font-semibold mb-1">Studio</h2>
      <p className="text-sm text-muted-foreground mb-6">
        Generate study materials, presentations, and content from your sources
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

      {/* Study section */}
      <h3 className="text-sm font-medium text-muted-foreground mb-2">Study</h3>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 mb-6">
        <StudioCard icon={HelpCircle} title="Quiz" tab="quiz"
          description="MC, T/F, and free response questions."
          onGenerate={() => generate("quiz", generateQuiz.mutateAsync, setQuizData)}
          isPending={generateQuiz.isPending} error={generateQuiz.error} hasData={!!quizData} />
        <StudioCard icon={Layers} title="Flashcards" tab="flashcards"
          description="Spaced repetition flashcards."
          onGenerate={() => generate("flashcards", generateFlashcards.mutateAsync, setFlashcardData)}
          isPending={generateFlashcards.isPending} error={generateFlashcards.error} hasData={!!flashcardData} />
        <StudioCard icon={GraduationCap} title="Mini-Course" tab="course"
          description="Structured lessons with quizzes."
          onGenerate={() => generate("course", generateCourse.mutateAsync, setCourseData)}
          isPending={generateCourse.isPending} error={generateCourse.error} hasData={!!courseData} />
      </div>

      {/* Visual section */}
      <h3 className="text-sm font-medium text-muted-foreground mb-2">Visual</h3>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 mb-6">
        <StudioCard icon={Presentation} title="Slide Deck" tab="slides"
          description="Presentation with multiple layouts."
          onGenerate={() => generate("slides", generateSlides.mutateAsync, setSlidesData)}
          isPending={generateSlides.isPending} error={generateSlides.error} hasData={!!slidesData} />
        <StudioCard icon={Image} title="Infographic" tab="infographic"
          description="Stats, timelines, and comparisons."
          onGenerate={() => generate("infographic", generateInfographic.mutateAsync, setInfographicData)}
          isPending={generateInfographic.isPending} error={generateInfographic.error} hasData={!!infographicData} />
        <StudioCard icon={Table} title="Data Tables" tab="datatable"
          description="Extract tabular data from sources."
          onGenerate={() => generate("datatable", generateDataTable.mutateAsync, setDataTableData)}
          isPending={generateDataTable.isPending} error={generateDataTable.error} hasData={!!dataTableData} />
        <StudioCard icon={Network} title="Mind Map" tab="mindmap"
          description="Explorable knowledge graph from sources."
          onGenerate={() => generate("mindmap", generateMindMap.mutateAsync, setMindMapData)}
          isPending={generateMindMap.isPending} error={generateMindMap.error} hasData={!!mindMapData} />
        <StudioCard icon={Film} title="Video Overview" tab="video"
          description="AI-narrated video with generated visuals."
          onGenerate={() => generate("video", generateVideoOverview.mutateAsync, setVideoData)}
          isPending={generateVideoOverview.isPending} error={generateVideoOverview.error} hasData={!!videoData} />
      </div>

      {/* Content section */}
      <h3 className="text-sm font-medium text-muted-foreground mb-2">Content</h3>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 mb-6">
        <StudioCard icon={MessageCircle} title="X Thread" tab="thread"
          description="Viral thread with hook and CTA."
          onGenerate={() => generate("thread", generateThread.mutateAsync, setThreadData)}
          isPending={generateThread.isPending} error={generateThread.error} hasData={!!threadData} />
        <StudioCard icon={Mail} title="Newsletter" tab="newsletter"
          description="Professional email newsletter."
          onGenerate={() => generate("newsletter", generateNewsletter.mutateAsync, setNewsletterData)}
          isPending={generateNewsletter.isPending} error={generateNewsletter.error} hasData={!!newsletterData} />
        <StudioCard icon={Video} title="Reel Script" tab="reel"
          description="30-60s short-form video script."
          onGenerate={() => generate("reel", generateReel.mutateAsync, setReelData)}
          isPending={generateReel.isPending} error={generateReel.error} hasData={!!reelData} />
      </div>

      {/* Deep Research */}
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center gap-2 mb-1.5">
          <Globe className="h-4 w-4 text-primary" />
          <h3 className="font-medium text-sm">Deep Research</h3>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Search the web and produce a comprehensive research report.
        </p>
        <Button size="sm" onClick={() => setActiveTab("research")} className="gap-1.5 h-7 text-xs">
          <Search className="h-3.5 w-3.5" />
          Start Research
        </Button>
      </div>
    </div>
  );
};

export default StudioPage;
