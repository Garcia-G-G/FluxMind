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

// All view components are dynamic: the studio overview never renders them
// at paint, only after a user picks a card. Dynamic import keeps them out
// of the studio-overview bundle and out of hydration on first paint.
const SlideViewer = dynamic(
  () => import("@/components/studio/slide-viewer").then((m) => m.SlideViewer),
  { ssr: false, loading: ViewerFallback },
);
const InfographicViewer = dynamic(
  () => import("@/components/studio/infographic-viewer").then((m) => m.InfographicViewer),
  { ssr: false, loading: ViewerFallback },
);
const DeepResearch = dynamic(
  () => import("@/components/studio/deep-research").then((m) => m.DeepResearch),
  { ssr: false, loading: ViewerFallback },
);
const CourseView = dynamic(
  () => import("@/components/studio/course-view").then((m) => m.CourseView),
  { ssr: false, loading: ViewerFallback },
);
const MindMapCanvas = dynamic(
  () => import("@/components/mind-map/mind-map-canvas").then((m) => m.MindMapCanvas),
  { ssr: false, loading: ViewerFallback },
);
const VideoPlayer = dynamic(
  () => import("@/components/video/video-player").then((m) => m.VideoPlayer),
  { ssr: false, loading: ViewerFallback },
);
const QuizView = dynamic(
  () => import("@/components/studio/quiz-view").then((m) => m.QuizView),
  { ssr: false, loading: ViewerFallback },
);
const FlashcardView = dynamic(
  () => import("@/components/studio/flashcard-view").then((m) => m.FlashcardView),
  { ssr: false, loading: ViewerFallback },
);
const StudyStats = dynamic(
  () => import("@/components/studio/study-stats").then((m) => m.StudyStats),
  { ssr: false },
);
const DataTableView = dynamic(
  () => import("@/components/studio/data-table-view").then((m) => m.DataTableView),
  { ssr: false, loading: ViewerFallback },
);
const ThreadPreview = dynamic(
  () => import("@/components/studio/thread-preview").then((m) => m.ThreadPreview),
  { ssr: false, loading: ViewerFallback },
);
const NewsletterPreview = dynamic(
  () => import("@/components/studio/newsletter-preview").then((m) => m.NewsletterPreview),
  { ssr: false, loading: ViewerFallback },
);
const ReelScriptView = dynamic(
  () => import("@/components/studio/reel-script-view").then((m) => m.ReelScriptView),
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
    accent = "var(--fm-accent-orange)",
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
  }): React.ReactNode => (
    <div
      className="group relative overflow-hidden rounded-2xl p-5 transition-transform duration-300 hover:-translate-y-1"
      style={{
        background: "var(--fm-glass-bg)",
        border: "1px solid var(--fm-glass-border)",
      }}
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
        <StudioCard icon={HelpCircle} title="Quiz" tab="quiz" accent="var(--fm-accent-violet)"
          description="MC, T/F, and free response questions."
          onGenerate={() => generate("quiz", generateQuiz.mutateAsync, setQuizData)}
          isPending={generateQuiz.isPending} error={generateQuiz.error} hasData={!!quizData} />
        <StudioCard icon={Layers} title="Flashcards" tab="flashcards" accent="var(--fm-accent-blue)"
          description="Spaced repetition flashcards."
          onGenerate={() => generate("flashcards", generateFlashcards.mutateAsync, setFlashcardData)}
          isPending={generateFlashcards.isPending} error={generateFlashcards.error} hasData={!!flashcardData} />
        <StudioCard icon={GraduationCap} title="Mini-Course" tab="course" accent="var(--fm-accent-rose)"
          description="Structured lessons with quizzes."
          onGenerate={() => generate("course", generateCourse.mutateAsync, setCourseData)}
          isPending={generateCourse.isPending} error={generateCourse.error} hasData={!!courseData} />
      </div>

      {/* Visual section */}
      <SectionHeader label="Visual" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 mb-6">
        <StudioCard icon={Presentation} title="Slide Deck" tab="slides" accent="var(--fm-accent-orange)"
          description="Presentation with multiple layouts."
          onGenerate={() => generate("slides", generateSlides.mutateAsync, setSlidesData)}
          isPending={generateSlides.isPending} error={generateSlides.error} hasData={!!slidesData} />
        <StudioCard icon={Image} title="Infographic" tab="infographic" accent="var(--fm-accent-rose)"
          description="Stats, timelines, and comparisons."
          onGenerate={() => generate("infographic", generateInfographic.mutateAsync, setInfographicData)}
          isPending={generateInfographic.isPending} error={generateInfographic.error} hasData={!!infographicData} />
        <StudioCard icon={Table} title="Data Tables" tab="datatable" accent="var(--fm-accent-blue)"
          description="Extract tabular data from sources."
          onGenerate={() => generate("datatable", generateDataTable.mutateAsync, setDataTableData)}
          isPending={generateDataTable.isPending} error={generateDataTable.error} hasData={!!dataTableData} />
        <StudioCard icon={Network} title="Mind Map" tab="mindmap" accent="var(--fm-accent-violet)"
          description="Explorable knowledge graph from sources."
          onGenerate={() => generate("mindmap", generateMindMap.mutateAsync, setMindMapData)}
          isPending={generateMindMap.isPending} error={generateMindMap.error} hasData={!!mindMapData} />
        <StudioCard icon={Film} title="Video Overview" tab="video" accent="var(--fm-accent-orange)"
          description="AI-narrated video with generated visuals."
          onGenerate={() => generate("video", generateVideoOverview.mutateAsync, setVideoData)}
          isPending={generateVideoOverview.isPending} error={generateVideoOverview.error} hasData={!!videoData} />
      </div>

      {/* Content section */}
      <SectionHeader label="Content" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 mb-6">
        <StudioCard icon={MessageCircle} title="X Thread" tab="thread" accent="var(--fm-accent-blue)"
          description="Viral thread with hook and CTA."
          onGenerate={() => generate("thread", generateThread.mutateAsync, setThreadData)}
          isPending={generateThread.isPending} error={generateThread.error} hasData={!!threadData} />
        <StudioCard icon={Mail} title="Newsletter" tab="newsletter" accent="var(--fm-accent-violet)"
          description="Professional email newsletter."
          onGenerate={() => generate("newsletter", generateNewsletter.mutateAsync, setNewsletterData)}
          isPending={generateNewsletter.isPending} error={generateNewsletter.error} hasData={!!newsletterData} />
        <StudioCard icon={Video} title="Reel Script" tab="reel" accent="var(--fm-accent-rose)"
          description="30-60s short-form video script."
          onGenerate={() => generate("reel", generateReel.mutateAsync, setReelData)}
          isPending={generateReel.isPending} error={generateReel.error} hasData={!!reelData} />
      </div>

      {/* Deep Research — featured card */}
      <SectionHeader label="Research" />
      <div
        className="relative overflow-hidden rounded-2xl p-5 flex items-center gap-4"
        style={{
          background: "var(--fm-glass-bg)",
          border: "1px solid var(--fm-glass-border)",
        }}
      >
        <div
          className="absolute top-0 left-0 right-0 h-[2px]"
          style={{ background: "linear-gradient(90deg, var(--fm-accent-violet), transparent)" }}
        />
        <div
          className="flex items-center justify-center shrink-0 rounded-lg"
          style={{
            width: 44,
            height: 44,
            background: "color-mix(in srgb, var(--fm-accent-violet) 12%, transparent)",
          }}
        >
          <Globe className="h-5 w-5" style={{ color: "var(--fm-accent-violet)" }} />
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
          style={{ background: "var(--fm-accent-violet)" }}
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
    </div>
  );
};

export default StudioPage;
