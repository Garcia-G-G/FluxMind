"use client";

import { memo, use, useCallback, useState, type ComponentProps } from "react";
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
  useGenerateFlashcards,
  useGenerateQuiz,
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

type QuizData = OutputData<{ questions: unknown[] }>;
type FlashcardData = OutputData<{ cards: unknown[] }>;
type SlidesData = OutputData<SlidesContent>;
type InfographicData = OutputData<InfographicContent>;
type DataTableData = OutputData<DataTableContent>;
type ThreadData = OutputData<ThreadContent>;
type NewsletterData = OutputData<NewsletterContent>;
type ReelData = OutputData<ReelContent>;
type CourseData = OutputData<CourseContent>;
type MindMapData = OutputData<{ nodes: unknown[]; edges: unknown[] }>;
type VideoData = OutputData<{
  fileUrl?: string;
  chapters?: unknown[];
  status: string;
}>;

// Union of all possible data shapes per tab. Each tab reads the typed slice
// it owns — 11 `useState`s collapsed into a single object-shaped state so
// writing one slice doesn't force the other 10 slices to render.
type StudioOutputs = {
  quiz: QuizData | null;
  flashcards: FlashcardData | null;
  slides: SlidesData | null;
  infographic: InfographicData | null;
  datatable: DataTableData | null;
  thread: ThreadData | null;
  newsletter: NewsletterData | null;
  reel: ReelData | null;
  course: CourseData | null;
  mindmap: MindMapData | null;
  video: VideoData | null;
};

const INITIAL_OUTPUTS: StudioOutputs = {
  quiz: null,
  flashcards: null,
  slides: null,
  infographic: null,
  datatable: null,
  thread: null,
  newsletter: null,
  reel: null,
  course: null,
  mindmap: null,
  video: null,
};

/* Map output type (from the persisted API) → StudioTab */
const TYPE_TO_TAB: Record<string, StudioTab> = {
  quiz: "quiz",
  flashcards: "flashcards",
  slides: "slides",
  infographic: "infographic",
  data_table: "datatable",
  thread: "thread",
  newsletter: "newsletter",
  course: "course",
  mindmap: "mindmap",
  video: "video",
  reel: "reel",
  research_report: "research",
};

const TYPE_ICON: Record<string, { icon: LucideIcon; color: string }> = {
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
  reel: { icon: Video, color: "#e11d48" },
  research_report: { icon: Search, color: "#7c3aed" },
};

const DEFAULT_TYPE_ICON = { icon: Wand2, color: "#6b7280" };

const RESEARCH_CARD_STYLE: React.CSSProperties = {
  background: "var(--fm-glass-bg)",
  border: "1px solid var(--fm-glass-border)",
  ["--fm-card-accent" as string]: "var(--fm-secondary)",
};

const OUTPUT_CARD_STYLE: React.CSSProperties = {
  background: "var(--fm-surface)",
  border: "1px solid var(--fm-surface-border)",
};

// ─────────────────────────────────────────────────────────────────
// Presentational cards — defined at MODULE scope so React preserves
// their identity across StudioPage re-renders. Previously these were
// declared inside the render function, which created a fresh component
// reference on every state change and forced every card subtree to
// unmount and re-mount when the parent set a single useState.

type StudioCardProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  onGenerate: () => void;
  isPending: boolean;
  error: Error | null;
  hasData: boolean;
  accent?: string;
  onHover?: () => void;
  onView?: () => void;
};

const StudioCard = memo(({
  icon: Icon,
  title,
  description,
  onGenerate,
  isPending,
  error,
  hasData,
  accent = "var(--fm-secondary)",
  onHover,
  onView,
}: StudioCardProps): React.ReactNode => (
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
        <h3 className="font-medium text-sm leading-tight" style={{ color: "var(--fm-text)" }}>
          {title}
        </h3>
        <p className="text-xs mt-1 leading-relaxed" style={{ color: "var(--fm-text-tertiary)" }}>
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
      {hasData && onView && (
        <button
          onClick={onView}
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
));
StudioCard.displayName = "StudioCard";

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

const StudioPage = ({
  params,
}: {
  params: Promise<{ id: string }>;
}): React.ReactNode => {
  const { id: notebookId } = use(params);
  const [activeTab, setActiveTab] = useState<StudioTab>("overview");
  const { data: savedOutputs } = useOutputs(notebookId);

  // Dialog-driven generators: every studio output that accepts customization.
  type DialogType =
    | "slides"
    | "infographic"
    | "video"
    | "mindmap"
    | "flashcards"
    | "quiz"
    | "thread"
    | "newsletter"
    | "reel"
    | "course"
    | "datatable";
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

  // One state object keyed by tab instead of 11 parallel useStates. Writing
  // one slice with functional update only re-renders consumers of that slice
  // (StudioCard is memo'd on its own props) and skips the other slices.
  const [outputs, setOutputs] = useState<StudioOutputs>(INITIAL_OUTPUTS);

  const {
    quiz: quizData,
    flashcards: flashcardData,
    slides: slidesData,
    infographic: infographicData,
    datatable: dataTableData,
    thread: threadData,
    newsletter: newsletterData,
    reel: reelData,
    course: courseData,
    mindmap: mindMapData,
    video: videoData,
  } = outputs;

  const setOutput = useCallback(
    <K extends keyof StudioOutputs>(
      tab: K,
      data: StudioOutputs[K],
    ): void => {
      setOutputs((prev) => ({ ...prev, [tab]: data }));
    },
    [],
  );

  /* Open a saved output by loading its content into state */
  const openSavedOutput = useCallback(
    (output: OutputListItem): void => {
      const tab = TYPE_TO_TAB[output.type];
      if (!tab || !output.content) return;

      const data = {
        id: output.id,
        title: output.title,
        ...output.content,
      } as never;

      switch (output.type) {
        case "quiz":
          setOutput("quiz", data);
          break;
        case "flashcards":
          setOutput("flashcards", data);
          break;
        case "slides":
          setOutput("slides", data);
          break;
        case "infographic":
          setOutput("infographic", data);
          break;
        case "data_table":
          setOutput("datatable", data);
          break;
        case "thread":
          setOutput("thread", data);
          break;
        case "newsletter":
          setOutput("newsletter", data);
          break;
        case "course":
          setOutput("course", data);
          break;
        case "mindmap":
          setOutput("mindmap", data);
          break;
        case "video":
          setOutput("video", data);
          break;
        case "reel":
          setOutput("reel", data);
          break;
      }
      setActiveTab(tab);
    },
    [setOutput],
  );

  const generate = async <K extends keyof StudioOutputs, T extends StudioOutputs[K]>(
    tab: K,
    mutateAsync: (
      args: { notebookId: string } & Partial<GenerateConfig>,
    ) => Promise<T>,
    config?: Partial<GenerateConfig>,
  ): Promise<void> => {
    try {
      const result = await mutateAsync({ notebookId, ...config });
      setOutput(tab, result);
      setActiveTab(tab as StudioTab);
    } catch {
      // Error shown by mutation
    }
  };

  /** Fire the right generator for the currently-open dialog. */
  const runDialogGenerate = async (config: GenerateConfig): Promise<void> => {
    if (!dialogType) return;
    switch (dialogType) {
      case "slides":
        await generate("slides", generateSlides.mutateAsync, config);
        break;
      case "infographic":
        await generate(
          "infographic",
          generateInfographic.mutateAsync,
          config,
        );
        break;
      case "video":
        await generate("video", generateVideoOverview.mutateAsync, config);
        break;
      case "mindmap":
        await generate("mindmap", generateMindMap.mutateAsync, config);
        break;
      case "flashcards":
        await generate("flashcards", generateFlashcards.mutateAsync, config);
        break;
      case "quiz":
        await generate("quiz", generateQuiz.mutateAsync, config);
        break;
      case "thread":
        await generate("thread", generateThread.mutateAsync, config);
        break;
      case "newsletter":
        await generate("newsletter", generateNewsletter.mutateAsync, config);
        break;
      case "reel":
        await generate("reel", generateReel.mutateAsync, config);
        break;
      case "course":
        await generate("course", generateCourse.mutateAsync, config);
        break;
      case "datatable":
        await generate("datatable", generateDataTable.mutateAsync, config);
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
    (dialogType === "flashcards" && generateFlashcards.isPending) ||
    (dialogType === "quiz" && generateQuiz.isPending) ||
    (dialogType === "thread" && generateThread.isPending) ||
    (dialogType === "newsletter" && generateNewsletter.isPending) ||
    (dialogType === "reel" && generateReel.isPending) ||
    (dialogType === "course" && generateCourse.isPending) ||
    (dialogType === "datatable" && generateDataTable.isPending) ||
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
        <StudioCard icon={HelpCircle} title="Quiz" onView={() => setActiveTab("quiz")} accent="var(--fm-secondary)"
          description="MC, T/F, and free response questions."
          onGenerate={() => openDialog("quiz")}
          onHover={importQuizView}
          isPending={generateQuiz.isPending} error={generateQuiz.error} hasData={!!quizData} />
        <StudioCard icon={Layers} title="Flashcards" onView={() => setActiveTab("flashcards")} accent="var(--fm-secondary)"
          description="Spaced repetition flashcards."
          onGenerate={() => openDialog("flashcards")}
          onHover={importFlashcardView}
          isPending={generateFlashcards.isPending} error={generateFlashcards.error} hasData={!!flashcardData} />
        <StudioCard icon={GraduationCap} title="Mini-Course" onView={() => setActiveTab("course")} accent="var(--fm-secondary)"
          description="Structured lessons with quizzes."
          onGenerate={() => openDialog("course")}
          onHover={importCourseView}
          isPending={generateCourse.isPending} error={generateCourse.error} hasData={!!courseData} />
      </div>

      {/* Visual section */}
      <SectionHeader label="Visual" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 mb-6">
        <StudioCard icon={Presentation} title="Slide Deck" onView={() => setActiveTab("slides")} accent="var(--fm-secondary)"
          description="Presentation with multiple layouts."
          onGenerate={() => openDialog("slides")}
          onHover={importSlideViewer}
          isPending={generateSlides.isPending} error={generateSlides.error} hasData={!!slidesData} />
        <StudioCard icon={Image} title="Infographic" onView={() => setActiveTab("infographic")} accent="var(--fm-secondary)"
          description="Stats, timelines, and comparisons."
          onGenerate={() => openDialog("infographic")}
          onHover={importInfographicViewer}
          isPending={generateInfographic.isPending} error={generateInfographic.error} hasData={!!infographicData} />
        <StudioCard icon={Table} title="Data Tables" onView={() => setActiveTab("datatable")} accent="var(--fm-secondary)"
          description="Extract tabular data from sources."
          onGenerate={() => openDialog("datatable")}
          onHover={importDataTableView}
          isPending={generateDataTable.isPending} error={generateDataTable.error} hasData={!!dataTableData} />
        <StudioCard icon={Network} title="Mind Map" onView={() => setActiveTab("mindmap")} accent="var(--fm-secondary)"
          description="Explorable knowledge graph from sources."
          onGenerate={() => openDialog("mindmap")}
          onHover={importMindMapCanvas}
          isPending={generateMindMap.isPending} error={generateMindMap.error} hasData={!!mindMapData} />
        <StudioCard icon={Film} title="Video Overview" onView={() => setActiveTab("video")} accent="var(--fm-secondary)"
          description="AI-narrated video with generated visuals."
          onGenerate={() => openDialog("video")}
          onHover={importVideoPlayer}
          isPending={generateVideoOverview.isPending} error={generateVideoOverview.error} hasData={!!videoData} />
      </div>

      {/* Content section */}
      <SectionHeader label="Content" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 mb-6">
        <StudioCard icon={MessageCircle} title="X Thread" onView={() => setActiveTab("thread")} accent="var(--fm-secondary)"
          description="Viral thread with hook and CTA."
          onGenerate={() => openDialog("thread")}
          onHover={importThreadPreview}
          isPending={generateThread.isPending} error={generateThread.error} hasData={!!threadData} />
        <StudioCard icon={Mail} title="Newsletter" onView={() => setActiveTab("newsletter")} accent="var(--fm-secondary)"
          description="Professional email newsletter."
          onGenerate={() => openDialog("newsletter")}
          onHover={importNewsletterPreview}
          isPending={generateNewsletter.isPending} error={generateNewsletter.error} hasData={!!newsletterData} />
        <StudioCard icon={Video} title="Reel Script" onView={() => setActiveTab("reel")} accent="var(--fm-secondary)"
          description="30-60s short-form video script."
          onGenerate={() => openDialog("reel")}
          onHover={importReelScriptView}
          isPending={generateReel.isPending} error={generateReel.error} hasData={!!reelData} />
      </div>

      {/* Deep Research — featured card */}
      <SectionHeader label="Research" />
      <div
        onMouseEnter={importDeepResearch}
        className="fm-hover-tint relative overflow-hidden rounded-2xl p-5 flex items-center gap-4"
        style={RESEARCH_CARD_STYLE}
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
                const cfg = TYPE_ICON[output.type] ?? DEFAULT_TYPE_ICON;
                const Icon = cfg.icon;
                const timeAgo = formatTimeAgo(output.createdAt);
                return (
                  <button
                    key={output.id}
                    onClick={() => openSavedOutput(output)}
                    className="w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-200 text-left group"
                    style={OUTPUT_CARD_STYLE}
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
          notebookId={notebookId}
          onGenerate={runDialogGenerate}
          isGenerating={dialogIsPending}
        />
      )}
    </div>
  );
};

export default StudioPage;
