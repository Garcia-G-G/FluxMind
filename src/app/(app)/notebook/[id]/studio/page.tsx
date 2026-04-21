"use client";

import { use, useState, type ComponentProps } from "react";
import dynamic from "next/dynamic";
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
  Eye,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const ViewerFallback = (): React.ReactNode => (
  <div className="flex items-center justify-center py-16 text-muted-foreground">
    <Loader2 className="h-5 w-5 animate-spin" />
  </div>
);

// Named import fns so we can also call them on card hover (prefetch) — the
// viewer chunk starts downloading while the user is deciding to click, so
// opening the viewer feels instant instead of waiting on the chunk.
const importSlideViewer = () => import("@/components/studio/slide-viewer");
const importInfographicViewer = () =>
  import("@/components/studio/infographic-viewer");
const importDeepResearch = () => import("@/components/studio/deep-research");
const importCourseView = () => import("@/components/studio/course-view");
const importMindMapCanvas = () =>
  import("@/components/mind-map/mind-map-canvas");
const importVideoPlayer = () => import("@/components/video/video-player");
const importQuizView = () => import("@/components/studio/quiz-view");
const importFlashcardView = () => import("@/components/studio/flashcard-view");
const importStudyStats = () => import("@/components/studio/study-stats");
const importDataTableView = () => import("@/components/studio/data-table-view");
const importThreadPreview = () => import("@/components/studio/thread-preview");
const importNewsletterPreview = () =>
  import("@/components/studio/newsletter-preview");
const importReelScriptView = () => import("@/components/studio/reel-script-view");

// All view components are dynamic: the studio overview never renders them
// at paint, only after a user picks a card. Dynamic import keeps them out
// of the studio-overview bundle and out of hydration on first paint.
const SlideViewer = dynamic(
  () => importSlideViewer().then((m) => m.SlideViewer),
  { ssr: false, loading: ViewerFallback },
);
const InfographicViewer = dynamic(
  () => importInfographicViewer().then((m) => m.InfographicViewer),
  { ssr: false, loading: ViewerFallback },
);
const DeepResearch = dynamic(
  () => importDeepResearch().then((m) => m.DeepResearch),
  { ssr: false, loading: ViewerFallback },
);
const CourseView = dynamic(
  () => importCourseView().then((m) => m.CourseView),
  { ssr: false, loading: ViewerFallback },
);
const MindMapCanvas = dynamic(
  () => importMindMapCanvas().then((m) => m.MindMapCanvas),
  { ssr: false, loading: ViewerFallback },
);
const VideoPlayer = dynamic(
  () => importVideoPlayer().then((m) => m.VideoPlayer),
  { ssr: false, loading: ViewerFallback },
);
const QuizView = dynamic(
  () => importQuizView().then((m) => m.QuizView),
  { ssr: false, loading: ViewerFallback },
);
const FlashcardView = dynamic(
  () => importFlashcardView().then((m) => m.FlashcardView),
  { ssr: false, loading: ViewerFallback },
);
const StudyStats = dynamic(
  () => importStudyStats().then((m) => m.StudyStats),
  { ssr: false },
);
const DataTableView = dynamic(
  () => importDataTableView().then((m) => m.DataTableView),
  { ssr: false, loading: ViewerFallback },
);
const ThreadPreview = dynamic(
  () => importThreadPreview().then((m) => m.ThreadPreview),
  { ssr: false, loading: ViewerFallback },
);
const NewsletterPreview = dynamic(
  () => importNewsletterPreview().then((m) => m.NewsletterPreview),
  { ssr: false, loading: ViewerFallback },
);
const ReelScriptView = dynamic(
  () => importReelScriptView().then((m) => m.ReelScriptView),
  { ssr: false, loading: ViewerFallback },
);
import { useGenerateQuiz, useGenerateFlashcards } from "@/hooks/use-study";
import {
  useOutputs,
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
import type { OutputListItem } from "@/hooks/use-studio-outputs";
import {
  GenerateDialog,
  type GenerateConfig,
} from "@/components/studio/generate-dialog";
import type { SlidesContent } from "@/app/api/studio/slides/route";
import type { InfographicContent } from "@/app/api/studio/infographic/route";
import type { DataTableContent } from "@/app/api/studio/datatable/route";
import type { ThreadContent } from "@/app/api/studio/thread/route";
import type { NewsletterContent } from "@/app/api/studio/newsletter/route";
import type { ReelContent } from "@/app/api/studio/reel/route";
import type { CourseContent } from "@/app/api/studio/course/route";

const formatTimeAgo = (dateStr: string): string => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

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
  const { data: savedOutputs } = useOutputs(notebookId);

  // Dialog-driven generators: slides, infographic, video, mindmap.
  // Everything else generates instantly on Generate-button click.
  type DialogType = "slides" | "infographic" | "video" | "mindmap";
  const [dialogOpen, setDialogOpen] = useState<boolean>(false);
  const [dialogType, setDialogType] = useState<DialogType | null>(null);

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

  /* Map output type → StudioTab */
  const typeToTab: Record<string, StudioTab> = {
    quiz: "quiz", flashcards: "flashcards", slides: "slides",
    infographic: "infographic", data_table: "datatable",
    thread: "thread", newsletter: "newsletter", course: "course",
    mindmap: "mindmap", video: "video", research_report: "research",
  };

  const typeIcon: Record<string, { icon: LucideIcon; color: string }> = {
    quiz: { icon: HelpCircle, color: "#7c3aed" },
    flashcards: { icon: Layers, color: "#2563eb" },
    slides: { icon: Presentation, color: "#ff6b35" },
    infographic: { icon: Image, color: "#e11d48" },
    data_table: { icon: Table, color: "#2563eb" },
    thread: { icon: MessageCircle, color: "#2563eb" },
    newsletter: { icon: Mail, color: "#7c3aed" },
    course: { icon: GraduationCap, color: "#e11d48" },
    mindmap: { icon: Network, color: "#7c3aed" },
    video: { icon: Film, color: "#ff6b35" },
    research_report: { icon: Search, color: "#7c3aed" },
  };

  /* Open a saved output by loading its content into state */
  const openSavedOutput = (output: OutputListItem): void => {
    const tab = typeToTab[output.type];
    if (!tab || !output.content) return;

    const data = { id: output.id, title: output.title, ...output.content } as never;

    switch (output.type) {
      case "quiz": setQuizData(data); break;
      case "flashcards": setFlashcardData(data); break;
      case "slides": setSlidesData(data); break;
      case "infographic": setInfographicData(data); break;
      case "data_table": setDataTableData(data); break;
      case "thread": setThreadData(data); break;
      case "newsletter": setNewsletterData(data); break;
      case "course": setCourseData(data); break;
      case "mindmap": setMindMapData(data); break;
      case "video": setVideoData(data); break;
    }
    setActiveTab(tab);
  };

  const generate = async <T,>(
    type: StudioTab,
    mutateAsync: (
      args: { notebookId: string } & Partial<GenerateConfig>,
    ) => Promise<T>,
    setter: (data: T) => void,
    config?: Partial<GenerateConfig>,
  ): Promise<void> => {
    try {
      const result = await mutateAsync({ notebookId, ...config });
      setter(result);
      setActiveTab(type);
    } catch {
      // Error shown by mutation
    }
  };

  /** Fire the right generator for the currently-open dialog. */
  const runDialogGenerate = async (config: GenerateConfig): Promise<void> => {
    if (!dialogType) return;
    switch (dialogType) {
      case "slides":
        await generate(
          "slides",
          generateSlides.mutateAsync,
          setSlidesData,
          config,
        );
        break;
      case "infographic":
        await generate(
          "infographic",
          generateInfographic.mutateAsync,
          setInfographicData,
          config,
        );
        break;
      case "video":
        await generate(
          "video",
          generateVideoOverview.mutateAsync,
          setVideoData,
          config,
        );
        break;
      case "mindmap":
        await generate(
          "mindmap",
          generateMindMap.mutateAsync,
          setMindMapData,
          config,
        );
        break;
    }
    setDialogOpen(false);
  };

  /** Open the customization dialog for a given output type. */
  const openDialog = (type: DialogType): void => {
    setDialogType(type);
    setDialogOpen(true);
  };

  /** `isPending` for whichever dialog-type is currently open. */
  const dialogIsPending =
    (dialogType === "slides" && generateSlides.isPending) ||
    (dialogType === "infographic" && generateInfographic.isPending) ||
    (dialogType === "video" && generateVideoOverview.isPending) ||
    (dialogType === "mindmap" && generateMindMap.isPending) ||
    false;

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
      return wrap(quizData.title, <QuizView outputId={quizData.id} questions={quizData.questions as ComponentProps<typeof QuizView>["questions"]} />);
    if (activeTab === "flashcards" && flashcardData)
      return wrap(flashcardData.title, <FlashcardView outputId={flashcardData.id} cards={flashcardData.cards as ComponentProps<typeof FlashcardView>["cards"]} />);
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
      return wrap(videoData.title, <VideoPlayer fileUrl={(videoData as Record<string, unknown>).fileUrl as string ?? null} title={videoData.title} status={videoData.status ?? "ready"} chapters={(videoData as Record<string, unknown>).chapters as ComponentProps<typeof VideoPlayer>["chapters"]} />);
    if (activeTab === "mindmap" && mindMapData)
      return wrap(mindMapData.title, <MindMapCanvas data={mindMapData as { nodes: ComponentProps<typeof MindMapCanvas>["data"]["nodes"]; edges: ComponentProps<typeof MindMapCanvas>["data"]["edges"] }} />);
    if (activeTab === "research")
      return <div><div className="flex justify-end mb-4">{backBtn}</div><DeepResearch notebookId={notebookId} /></div>;

    // Data not yet loaded for this tab — show loading or go back
    return (
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium" style={{ color: "var(--fm-text)" }}>Loading...</h2>
          {backBtn}
        </div>
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin" style={{ color: "var(--fm-text-tertiary)" }} />
        </div>
      </div>
    );
  }

  // Studio card — clean minimal design
  const StudioCard = ({
    icon: Icon,
    title,
    description,
    onGenerate,
    isPending,
    error,
    hasData,
    tab,
    accent = "var(--fm-secondary)",
    onHover,
  }: {
    icon: LucideIcon;
    title: string;
    description: string;
    onGenerate: () => void;
    isPending: boolean;
    error: Error | null;
    hasData: boolean;
    tab: StudioTab;
    accent?: string;
    onHover?: () => void;
  }): React.ReactNode => (
    <div
      onMouseEnter={onHover}
      onFocus={onHover}
      className="fm-hover-tint group relative overflow-hidden rounded-2xl p-5 transition-transform duration-150 ease-out hover:-translate-y-0.5"
      style={{
        background: "var(--fm-glass-bg)",
        border: "1px solid var(--fm-glass-border)",
        ["--fm-card-accent" as string]: accent,
      } as React.CSSProperties}
    >
      {/* Top accent line */}
      <div
        className="absolute top-0 left-0 right-0 h-[2px]"
        style={{ background: `linear-gradient(90deg, ${accent}, transparent)` }}
      />
      <div className="flex items-start gap-3">
        <div
          className="shrink-0 flex items-center justify-center rounded-lg"
          style={{
            width: 36,
            height: 36,
            background: `color-mix(in srgb, ${accent} 12%, transparent)`,
          }}
        >
          <Icon style={{ width: 18, height: 18, color: accent }} strokeWidth={1.8} />
        </div>
        <div className="flex-1 min-w-0">
          <h3
            className="font-medium text-sm leading-tight"
            style={{ color: "var(--fm-text)" }}
          >
            {title}
          </h3>
          <p
            className="text-xs mt-1 leading-relaxed"
            style={{ color: "var(--fm-text-tertiary)" }}
          >
            {description}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 mt-4">
        <button
          onClick={onGenerate}
          disabled={isPending}
          className="flex items-center gap-1.5 h-8 px-3.5 text-xs font-medium text-white rounded-lg transition-opacity disabled:opacity-50"
          style={{ background: accent }}
        >
          {isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Wand2 className="h-3.5 w-3.5" />
          )}
          Generate
        </button>
        {hasData && (
          <button
            onClick={() => setActiveTab(tab)}
            className="flex items-center h-8 px-3.5 text-xs font-medium rounded-lg transition-colors"
            style={{
              background: "var(--fm-bg-tertiary)",
              color: "var(--fm-text-secondary)",
            }}
          >
            View
          </button>
        )}
      </div>

      {error && (
        <p
          className="text-xs mt-3 px-2 py-1.5 rounded-md"
          style={{
            color: "var(--fm-error, #ef4444)",
            background: "color-mix(in srgb, var(--fm-error, #ef4444) 8%, transparent)",
          }}
        >
          {error.message}
        </p>
      )}
    </div>
  );

  const SectionHeader = ({ label }: { label: string }): React.ReactNode => (
    <div className="mb-3 mt-6">
      <span
        className="text-xs font-medium uppercase tracking-wide"
        style={{ color: "var(--fm-text-tertiary)" }}
      >
        {label}
      </span>
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto">
      <h2
        className="font-display text-3xl font-normal tracking-tight mb-1.5"
        style={{ color: "var(--fm-text)" }}
      >
        Studio
      </h2>
      <p
        className="text-sm mb-8"
        style={{ color: "var(--fm-text-tertiary)" }}
      >
        Generate study materials, presentations, and content from your sources.
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
      <SectionHeader label="Study" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 mb-6">
        <StudioCard icon={HelpCircle} title="Quiz" tab="quiz" accent="var(--fm-secondary)"
          description="MC, T/F, and free response questions."
          onGenerate={() => generate("quiz", generateQuiz.mutateAsync, setQuizData)}
          onHover={importQuizView}
          isPending={generateQuiz.isPending} error={generateQuiz.error} hasData={!!quizData} />
        <StudioCard icon={Layers} title="Flashcards" tab="flashcards" accent="var(--fm-secondary)"
          description="Spaced repetition flashcards."
          onGenerate={() => generate("flashcards", generateFlashcards.mutateAsync, setFlashcardData)}
          onHover={importFlashcardView}
          isPending={generateFlashcards.isPending} error={generateFlashcards.error} hasData={!!flashcardData} />
        <StudioCard icon={GraduationCap} title="Mini-Course" tab="course" accent="var(--fm-secondary)"
          description="Structured lessons with quizzes."
          onGenerate={() => generate("course", generateCourse.mutateAsync, setCourseData)}
          onHover={importCourseView}
          isPending={generateCourse.isPending} error={generateCourse.error} hasData={!!courseData} />
      </div>

      {/* Visual section */}
      <SectionHeader label="Visual" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 mb-6">
        <StudioCard icon={Presentation} title="Slide Deck" tab="slides" accent="var(--fm-secondary)"
          description="Presentation with multiple layouts."
          onGenerate={() => openDialog("slides")}
          onHover={importSlideViewer}
          isPending={generateSlides.isPending} error={generateSlides.error} hasData={!!slidesData} />
        <StudioCard icon={Image} title="Infographic" tab="infographic" accent="var(--fm-secondary)"
          description="Stats, timelines, and comparisons."
          onGenerate={() => openDialog("infographic")}
          onHover={importInfographicViewer}
          isPending={generateInfographic.isPending} error={generateInfographic.error} hasData={!!infographicData} />
        <StudioCard icon={Table} title="Data Tables" tab="datatable" accent="var(--fm-secondary)"
          description="Extract tabular data from sources."
          onGenerate={() => generate("datatable", generateDataTable.mutateAsync, setDataTableData)}
          onHover={importDataTableView}
          isPending={generateDataTable.isPending} error={generateDataTable.error} hasData={!!dataTableData} />
        <StudioCard icon={Network} title="Mind Map" tab="mindmap" accent="var(--fm-secondary)"
          description="Explorable knowledge graph from sources."
          onGenerate={() => openDialog("mindmap")}
          onHover={importMindMapCanvas}
          isPending={generateMindMap.isPending} error={generateMindMap.error} hasData={!!mindMapData} />
        <StudioCard icon={Film} title="Video Overview" tab="video" accent="var(--fm-secondary)"
          description="AI-narrated video with generated visuals."
          onGenerate={() => openDialog("video")}
          onHover={importVideoPlayer}
          isPending={generateVideoOverview.isPending} error={generateVideoOverview.error} hasData={!!videoData} />
      </div>

      {/* Content section */}
      <SectionHeader label="Content" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 mb-6">
        <StudioCard icon={MessageCircle} title="X Thread" tab="thread" accent="var(--fm-secondary)"
          description="Viral thread with hook and CTA."
          onGenerate={() => generate("thread", generateThread.mutateAsync, setThreadData)}
          onHover={importThreadPreview}
          isPending={generateThread.isPending} error={generateThread.error} hasData={!!threadData} />
        <StudioCard icon={Mail} title="Newsletter" tab="newsletter" accent="var(--fm-secondary)"
          description="Professional email newsletter."
          onGenerate={() => generate("newsletter", generateNewsletter.mutateAsync, setNewsletterData)}
          onHover={importNewsletterPreview}
          isPending={generateNewsletter.isPending} error={generateNewsletter.error} hasData={!!newsletterData} />
        <StudioCard icon={Video} title="Reel Script" tab="reel" accent="var(--fm-secondary)"
          description="30-60s short-form video script."
          onGenerate={() => generate("reel", generateReel.mutateAsync, setReelData)}
          onHover={importReelScriptView}
          isPending={generateReel.isPending} error={generateReel.error} hasData={!!reelData} />
      </div>

      {/* Deep Research — featured card */}
      <SectionHeader label="Research" />
      <div
        onMouseEnter={importDeepResearch}
        className="fm-hover-tint relative overflow-hidden rounded-2xl p-5 flex items-center gap-4"
        style={{
          background: "var(--fm-glass-bg)",
          border: "1px solid var(--fm-glass-border)",
          ["--fm-card-accent" as string]: "var(--fm-secondary)",
        } as React.CSSProperties}
      >
        <div
          className="absolute top-0 left-0 right-0 h-[2px]"
          style={{ background: "linear-gradient(90deg, var(--fm-secondary), transparent)" }}
        />
        <div
          className="flex items-center justify-center shrink-0 rounded-lg"
          style={{
            width: 44,
            height: 44,
            background: "color-mix(in srgb, var(--fm-secondary) 12%, transparent)",
          }}
        >
          <Globe className="h-5 w-5" style={{ color: "var(--fm-secondary)" }} />
        </div>
        <div className="flex-1 min-w-0">
          <h3
            className="font-medium text-sm leading-tight"
            style={{ color: "var(--fm-text)" }}
          >
            Deep Research
          </h3>
          <p
            className="text-xs mt-1 leading-relaxed"
            style={{ color: "var(--fm-text-tertiary)" }}
          >
            Search the web and produce a comprehensive research report with citations.
          </p>
        </div>
        <button
          onClick={() => setActiveTab("research")}
          className="flex items-center gap-1.5 h-8 px-4 text-xs font-medium text-white rounded-lg shrink-0"
          style={{ background: "var(--fm-secondary)" }}
        >
          <Search className="h-3.5 w-3.5" />
          Start
        </button>
      </div>

      {/* ── Your Generated Outputs ── */}
      {savedOutputs && savedOutputs.filter((o) => o.status === "ready").length > 0 && (
        <>
          <SectionHeader label="Your Outputs" />
          <div className="space-y-2 mb-8">
            {savedOutputs
              .filter((o) => o.status === "ready")
              .map((output) => {
                const cfg = typeIcon[output.type] ?? { icon: Wand2, color: "#6b7280" };
                const Icon = cfg.icon;
                const timeAgo = formatTimeAgo(output.createdAt);
                return (
                  <button
                    key={output.id}
                    onClick={() => openSavedOutput(output)}
                    className="w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-200 text-left group"
                    style={{
                      background: "var(--fm-surface)",
                      border: "1px solid var(--fm-surface-border)",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "var(--fm-surface-hover)";
                      e.currentTarget.style.borderColor = `${cfg.color}30`;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "var(--fm-surface)";
                      e.currentTarget.style.borderColor = "var(--fm-surface-border)";
                    }}
                  >
                    <div
                      className="shrink-0 flex items-center justify-center rounded-lg"
                      style={{
                        width: 36,
                        height: 36,
                        background: `${cfg.color}15`,
                      }}
                    >
                      <Icon style={{ width: 18, height: 18, color: cfg.color }} strokeWidth={1.8} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p
                        className="text-sm font-medium truncate"
                        style={{ color: "var(--fm-text)" }}
                      >
                        {output.title}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span
                          className="text-[11px] capitalize"
                          style={{ color: cfg.color }}
                        >
                          {output.type.replace("_", " ")}
                        </span>
                        <span className="text-[10px]" style={{ color: "var(--fm-text-tertiary)" }}>
                          · {timeAgo}
                        </span>
                      </div>
                    </div>
                    <div
                      className="shrink-0 flex items-center gap-1 text-[11px] opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ color: "var(--fm-text-secondary)" }}
                    >
                      <Eye className="h-3.5 w-3.5" />
                      View
                    </div>
                  </button>
                );
              })}
          </div>
        </>
      )}

      {/* Customization dialog — slides, infographic, video, mindmap */}
      {dialogType && (
        <GenerateDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          outputType={dialogType}
          onGenerate={runDialogGenerate}
          isGenerating={dialogIsPending}
        />
      )}
    </div>
  );
};

export default StudioPage;
