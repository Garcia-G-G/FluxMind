"use client";

import { useEffect, useState } from "react";
import { Loader2, Search, Wand2, ChevronDown } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/i18n/language";
import type { VisualStyle } from "@/lib/media/styles";
import type { DiscoveredSource } from "@/app/api/studio/discover-sources/route";
import type { ScrapedResult } from "@/app/api/studio/scrape-sources/route";

/** Output types that open the customization dialog. */
type OutputType =
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

export type GenerateConfig = {
  language: "en" | "es";
  orientation: "horizontal" | "vertical" | "square";
  style: VisualStyle;
  detailLevel: "concise" | "standard" | "detailed";
  customPrompt: string;
  slideCount?: number;
  accentColor?: "orange" | "violet" | "blue" | "rose" | "emerald" | "amber";
  /** IDs of existing notebook sources the user selected. Forward-compat plumbing. */
  selectedSourceIds?: string[];
  /** Scraped content from discovered sources, concatenated. */
  extraSourceContent?: string;
};

type GenerateDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  outputType: OutputType;
  notebookId: string;
  onGenerate: (config: GenerateConfig) => void | Promise<void>;
  isGenerating?: boolean;
};

/** Large illustrated SVG previews — one per style. These go inside coloured
 *  gradient tile backgrounds so fills use semi-transparent white/dark rather
 *  than theme vars (the tile itself handles light/dark adaptation). */
const STYLE_PREVIEWS: Record<VisualStyle, React.ReactNode> = {
  auto: (
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <path d="M32 8L35 20L44 16L38 26L50 28L38 32L44 42L35 38L32 50L29 38L20 42L26 32L14 28L26 26L20 16L29 20Z" fill="rgba(255,255,255,0.25)" stroke="rgba(255,255,255,0.6)" strokeWidth="1"/>
      <circle cx="32" cy="28" r="4" fill="rgba(255,255,255,0.5)"/>
      <circle cx="18" cy="12" r="2" fill="rgba(255,255,255,0.3)"/>
      <circle cx="50" cy="46" r="1.5" fill="rgba(255,255,255,0.2)"/>
      <circle cx="12" cy="44" r="1" fill="rgba(255,255,255,0.15)"/>
    </svg>
  ),
  sketch: (
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <rect x="12" y="14" width="40" height="28" rx="2" fill="none" stroke="rgba(100,70,30,0.4)" strokeWidth="1.5" strokeDasharray="3 2"/>
      <path d="M18 22C20 21 23 23 26 22C29 21 32 23 36 22" stroke="rgba(100,70,30,0.35)" strokeWidth="1.2" strokeLinecap="round"/>
      <path d="M18 28C21 27 24 29 28 28C31 27 34 29 38 28" stroke="rgba(100,70,30,0.25)" strokeWidth="1.2" strokeLinecap="round"/>
      <path d="M18 34C22 33 25 35 30 34" stroke="rgba(100,70,30,0.2)" strokeWidth="1.2" strokeLinecap="round"/>
      <path d="M42 44L48 38L52 42L46 48Z" fill="rgba(100,70,30,0.3)"/>
      <path d="M41 45L42 44L46 48L45 49L40 50Z" fill="rgba(100,70,30,0.5)"/>
    </svg>
  ),
  kawaii: (
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <circle cx="32" cy="28" r="16" fill="rgba(255,255,255,0.25)" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5"/>
      <circle cx="26" cy="26" r="2.5" fill="rgba(80,40,100,0.6)"/>
      <circle cx="38" cy="26" r="2.5" fill="rgba(80,40,100,0.6)"/>
      <circle cx="27" cy="25" r="0.8" fill="rgba(255,255,255,0.8)"/>
      <circle cx="39" cy="25" r="0.8" fill="rgba(255,255,255,0.8)"/>
      <path d="M27 32C29 35 35 35 37 32" stroke="rgba(80,40,100,0.5)" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
      <ellipse cx="22" cy="31" rx="3" ry="2" fill="rgba(244,63,94,0.2)"/>
      <ellipse cx="42" cy="31" rx="3" ry="2" fill="rgba(244,63,94,0.2)"/>
      <path d="M12 14L13.5 17L17 17.5L14.5 20L15 23.5L12 22L9 23.5L9.5 20L7 17.5L10.5 17Z" fill="rgba(255,255,255,0.4)"/>
      <path d="M50 10L51 12L53 12.3L51.5 14L52 16L50 15L48 16L48.5 14L47 12.3L49 12Z" fill="rgba(255,255,255,0.3)"/>
      <path d="M48 42C48 40 50 39 51 40.5C52 39 54 40 54 42C54 44 51 46 51 46C51 46 48 44 48 42Z" fill="rgba(255,255,255,0.35)"/>
    </svg>
  ),
  professional: (
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <rect x="8" y="10" width="48" height="6" rx="2" fill="rgba(255,255,255,0.08)"/>
      <rect x="11" y="12" width="12" height="2" rx="1" fill="rgba(255,255,255,0.2)"/>
      <rect x="8" y="20" width="20" height="34" rx="2" fill="rgba(255,255,255,0.05)"/>
      <rect x="12" y="24" width="12" height="2" rx="1" fill="rgba(255,255,255,0.15)"/>
      <rect x="12" y="29" width="10" height="1.5" rx="0.75" fill="rgba(255,255,255,0.08)"/>
      <rect x="12" y="33" width="8" height="1.5" rx="0.75" fill="rgba(255,255,255,0.06)"/>
      <rect x="32" y="20" width="24" height="34" rx="2" fill="rgba(255,255,255,0.04)"/>
      <rect x="36" y="36" width="4" height="14" rx="1" fill="rgba(100,180,255,0.3)"/>
      <rect x="42" y="30" width="4" height="20" rx="1" fill="rgba(100,180,255,0.4)"/>
      <rect x="48" y="26" width="4" height="24" rx="1" fill="rgba(100,180,255,0.5)"/>
    </svg>
  ),
  scientific: (
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <circle cx="24" cy="20" r="5" fill="rgba(27,94,32,0.15)" stroke="rgba(27,94,32,0.4)" strokeWidth="1.5"/>
      <circle cx="38" cy="14" r="3.5" fill="rgba(27,94,32,0.1)" stroke="rgba(27,94,32,0.3)" strokeWidth="1.2"/>
      <circle cx="16" cy="32" r="3.5" fill="rgba(27,94,32,0.1)" stroke="rgba(27,94,32,0.3)" strokeWidth="1.2"/>
      <circle cx="36" cy="28" r="3" fill="rgba(27,94,32,0.08)" stroke="rgba(27,94,32,0.25)" strokeWidth="1"/>
      <line x1="28" y1="17" x2="35" y2="15" stroke="rgba(27,94,32,0.3)" strokeWidth="1.2"/>
      <line x1="21" y1="24" x2="17" y2="29" stroke="rgba(27,94,32,0.3)" strokeWidth="1.2"/>
      <line x1="27" y1="24" x2="34" y2="26" stroke="rgba(27,94,32,0.25)" strokeWidth="1"/>
      <path d="M10 50L18 46L26 48L34 40L42 42L50 36L56 38" stroke="rgba(27,94,32,0.4)" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
      <circle cx="18" cy="46" r="1.5" fill="rgba(27,94,32,0.5)"/>
      <circle cx="34" cy="40" r="1.5" fill="rgba(27,94,32,0.5)"/>
      <circle cx="50" cy="36" r="1.5" fill="rgba(27,94,32,0.5)"/>
    </svg>
  ),
  minimalist: (
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <rect x="14" y="16" width="20" height="3" rx="1.5" fill="rgba(255,255,255,0.3)"/>
      <rect x="14" y="24" width="36" height="1" rx="0.5" fill="rgba(255,255,255,0.08)"/>
      <rect x="14" y="30" width="32" height="1" rx="0.5" fill="rgba(255,255,255,0.06)"/>
      <rect x="14" y="36" width="28" height="1" rx="0.5" fill="rgba(255,255,255,0.04)"/>
      <rect x="14" y="44" width="16" height="2" rx="1" fill="rgba(255,255,255,0.15)"/>
    </svg>
  ),
};

const STYLE_GRADIENTS: Record<VisualStyle, string> = {
  auto: "linear-gradient(135deg, #667eea, #764ba2)",
  sketch: "linear-gradient(135deg, #f5ebe0, #ddb892)",
  kawaii: "linear-gradient(135deg, #fbc2eb, #a18cd1)",
  professional: "linear-gradient(135deg, #141e30, #243b55)",
  scientific: "linear-gradient(135deg, #d4f1d4, #81c784)",
  minimalist: "linear-gradient(135deg, #2a2a2a, #111)",
};

/** Styles where the label reads better in a dark colour (light gradients). */
const STYLE_DARK_LABEL: Partial<Record<VisualStyle, string>> = {
  sketch: "#5a3e1a",
  scientific: "#1e4d1e",
};

type StyleOption = { value: VisualStyle; label: string };
const STYLE_OPTIONS: readonly StyleOption[] = [
  { value: "auto", label: "Auto" },
  { value: "sketch", label: "Sketch" },
  { value: "kawaii", label: "Kawaii" },
  { value: "professional", label: "Professional" },
  { value: "scientific", label: "Scientific" },
  { value: "minimalist", label: "Minimalist" },
] as const;

type OrientationOption = {
  value: GenerateConfig["orientation"];
  label: string;
};
const ORIENTATION_OPTIONS: readonly OrientationOption[] = [
  { value: "horizontal", label: "Horizontal" },
  { value: "vertical", label: "Vertical" },
  { value: "square", label: "Square" },
] as const;

/** Mini-infographic silhouettes showing the aspect shape + a generic content
 *  skeleton. Uses theme tokens so the cards adapt to light/dark. */
const ORIENTATION_PREVIEWS: Record<
  GenerateConfig["orientation"],
  React.ReactNode
> = {
  horizontal: (
    <svg width="88" height="48" viewBox="0 0 88 48" fill="none" aria-hidden="true">
      <rect x="1" y="1" width="86" height="46" rx="4" fill="var(--fm-surface)" stroke="var(--fm-surface-border)" strokeWidth="1"/>
      <rect x="6" y="6" width="28" height="4" rx="1.5" fill="var(--fm-accent-rose)" fillOpacity="0.4"/>
      <rect x="6" y="13" width="18" height="2" rx="1" fill="var(--fm-text-tertiary)" fillOpacity="0.3"/>
      <rect x="6" y="20" width="22" height="20" rx="3" fill="var(--fm-accent-rose)" fillOpacity="0.12"/>
      <rect x="32" y="20" width="22" height="20" rx="3" fill="var(--fm-accent-rose)" fillOpacity="0.09"/>
      <rect x="58" y="20" width="22" height="20" rx="3" fill="var(--fm-accent-rose)" fillOpacity="0.06"/>
    </svg>
  ),
  vertical: (
    <svg width="36" height="60" viewBox="0 0 36 60" fill="none" aria-hidden="true">
      <rect x="1" y="1" width="34" height="58" rx="4" fill="var(--fm-surface)" stroke="var(--fm-surface-border)" strokeWidth="1"/>
      <rect x="5" y="5" width="16" height="3" rx="1.5" fill="var(--fm-text-tertiary)" fillOpacity="0.3"/>
      <rect x="5" y="12" width="26" height="10" rx="2" fill="var(--fm-text-tertiary)" fillOpacity="0.08"/>
      <rect x="5" y="25" width="26" height="10" rx="2" fill="var(--fm-text-tertiary)" fillOpacity="0.06"/>
      <rect x="5" y="38" width="26" height="10" rx="2" fill="var(--fm-text-tertiary)" fillOpacity="0.04"/>
    </svg>
  ),
  square: (
    <svg width="52" height="52" viewBox="0 0 52 52" fill="none" aria-hidden="true">
      <rect x="1" y="1" width="50" height="50" rx="4" fill="var(--fm-surface)" stroke="var(--fm-surface-border)" strokeWidth="1"/>
      <rect x="6" y="6" width="18" height="3" rx="1.5" fill="var(--fm-text-tertiary)" fillOpacity="0.3"/>
      <rect x="6" y="14" width="18" height="14" rx="2" fill="var(--fm-text-tertiary)" fillOpacity="0.08"/>
      <rect x="28" y="14" width="18" height="14" rx="2" fill="var(--fm-text-tertiary)" fillOpacity="0.06"/>
      <rect x="6" y="32" width="18" height="14" rx="2" fill="var(--fm-text-tertiary)" fillOpacity="0.05"/>
      <rect x="28" y="32" width="18" height="14" rx="2" fill="var(--fm-text-tertiary)" fillOpacity="0.04"/>
    </svg>
  ),
};

type DetailOption = { value: GenerateConfig["detailLevel"]; label: string };
const DETAIL_OPTIONS: readonly DetailOption[] = [
  { value: "concise", label: "Concise" },
  { value: "standard", label: "Standard" },
  { value: "detailed", label: "Detailed" },
] as const;

const DETAIL_DESCRIPTIONS: Record<GenerateConfig["detailLevel"], string> = {
  concise: "Key points only",
  standard: "Balanced",
  detailed: "Deep dive",
};

type LanguageOption = { value: GenerateConfig["language"]; label: string };
const LANGUAGE_OPTIONS: readonly LanguageOption[] = [
  { value: "en", label: "English" },
  { value: "es", label: "Español" },
] as const;

type AccentOption = {
  value: NonNullable<GenerateConfig["accentColor"]>;
  color: string;
};
/** Accent palette. Orange/violet/blue/rose use theme tokens; emerald & amber
 *  are not in the token file, so they fall back to hex — these are swatches,
 *  not text colors, so the "no hardcoded accent hex" rule doesn't apply. */
const ACCENT_OPTIONS: readonly AccentOption[] = [
  { value: "orange", color: "var(--fm-accent-orange)" },
  { value: "violet", color: "var(--fm-accent-violet)" },
  { value: "blue", color: "var(--fm-accent-blue)" },
  { value: "rose", color: "var(--fm-accent-rose)" },
  { value: "emerald", color: "#10b981" },
  { value: "amber", color: "#f59e0b" },
] as const;

/** Per-output accent used for the Generate button and the type dot in the
 *  header. Kept in sync with the palette in studio/page.tsx's CARD_COLORS. */
const OUTPUT_ACCENT: Record<OutputType, string> = {
  slides: "#FF7A45",
  infographic: "#F43F5E",
  video: "#EC4899",
  mindmap: "#10B981",
  flashcards: "#3B82F6",
  quiz: "#8B5CF6",
  thread: "#0EA5E9",
  newsletter: "#F59E0B",
  reel: "#EC4899",
  course: "#A855F7",
  datatable: "#64748B",
};

const OUTPUT_TITLE: Record<OutputType, string> = {
  slides: "Generate slide deck",
  infographic: "Generate infographic",
  video: "Generate video overview",
  mindmap: "Generate mind map",
  flashcards: "Generate flashcards",
  quiz: "Generate quiz",
  thread: "Generate X thread",
  newsletter: "Generate newsletter",
  reel: "Generate reel script",
  course: "Generate mini-course",
  datatable: "Generate data tables",
};

const OUTPUT_DESCRIPTION: Record<OutputType, string> = {
  slides: "Customize style, detail, and layout before generating.",
  infographic: "Customize orientation, style, and detail before generating.",
  video: "Customize style and detail for the video overview.",
  mindmap: "Customize the depth and language of the mind map.",
  flashcards: "Customize detail and focus before generating.",
  quiz: "Customize detail and focus before generating.",
  thread: "Customize the angle and focus of the thread.",
  newsletter: "Customize length, depth, and focus of the newsletter.",
  reel: "Customize the hook and focus of the 30-60s script.",
  course: "Customize depth and focus of the mini-course.",
  datatable: "Customize which data to extract into tables.",
};

const CUSTOM_PROMPT_PLACEHOLDER: Record<OutputType, string> = {
  slides: "Any specific focus, audience, or talking points? (optional)",
  infographic: "Anything to emphasize or avoid in the infographic? (optional)",
  video: "Any specific tone, pacing, or focus for the narration? (optional)",
  mindmap: "Any particular branches or themes to emphasize? (optional)",
  flashcards: "Any particular topics or card types to emphasize? (optional)",
  quiz: "Any particular areas, question types, or difficulty focus? (optional)",
  thread: "Any particular angle, audience, or tone for the thread? (optional)",
  newsletter: "Any particular angle, audience, or sections to feature? (optional)",
  reel: "Any particular hook, tone, or single idea to land? (optional)",
  course: "Any particular audience, pace, or lessons to prioritize? (optional)",
  datatable: "Any particular kind of tables or data to extract? (optional)",
};

const sectionLabelClass = "text-[10px] font-semibold uppercase tracking-wider";
const sectionLabelStyle = { color: "var(--fm-text-tertiary)" } as const;

const groupDividerStyle: React.CSSProperties = {
  border: "none",
  borderTop: "1px solid var(--fm-surface-border)",
  margin: "1.25rem 0",
};

const MAX_EXTRA_SOURCE_CONTENT = 80_000;

type ExistingSource = { id: string; title: string };

export const GenerateDialog = ({
  open,
  onOpenChange,
  outputType,
  notebookId,
  onGenerate,
  isGenerating = false,
}: GenerateDialogProps): React.ReactNode => {
  const { language: currentLanguage } = useLanguage();

  const [language, setLanguage] = useState<GenerateConfig["language"]>(
    currentLanguage,
  );
  const [orientation, setOrientation] =
    useState<GenerateConfig["orientation"]>("horizontal");
  const [style, setStyle] = useState<VisualStyle>("auto");
  const [detailLevel, setDetailLevel] =
    useState<GenerateConfig["detailLevel"]>("standard");
  const [customPrompt, setCustomPrompt] = useState<string>("");
  const [slideCount, setSlideCount] = useState<number>(8);
  const [accentColor, setAccentColor] =
    useState<NonNullable<GenerateConfig["accentColor"]>>("orange");

  // ── Sources section state ──
  const [existingSources, setExistingSources] = useState<ExistingSource[]>([]);
  const [selectedSourceIds, setSelectedSourceIds] = useState<Set<string>>(
    new Set(),
  );

  const [isDiscovering, setIsDiscovering] = useState<boolean>(false);
  const [hasDiscovered, setHasDiscovered] = useState<boolean>(false);
  const [discoveredSources, setDiscoveredSources] = useState<
    DiscoveredSource[]
  >([]);
  const [selectedDiscoveredUrls, setSelectedDiscoveredUrls] = useState<
    Set<string>
  >(new Set());
  const [isScrapingOnSubmit, setIsScrapingOnSubmit] = useState<boolean>(false);
  const [sourcesExpanded, setSourcesExpanded] = useState<boolean>(false);

  // Reset defaults whenever the dialog opens with a new type
  useEffect(() => {
    if (open) {
      setLanguage(currentLanguage);
      setOrientation("horizontal");
      setStyle("auto");
      setDetailLevel("standard");
      setCustomPrompt("");
      setSlideCount(8);
      setAccentColor("orange");
      setIsDiscovering(false);
      setHasDiscovered(false);
      setDiscoveredSources([]);
      setSelectedDiscoveredUrls(new Set());
      setIsScrapingOnSubmit(false);
      setSourcesExpanded(false);
    }
  }, [open, currentLanguage]);

  // Fetch existing sources when dialog opens.
  useEffect(() => {
    if (!open || !notebookId) return;
    let cancelled = false;
    void (async (): Promise<void> => {
      try {
        const res = await fetch(
          `/api/sources?notebookId=${encodeURIComponent(notebookId)}`,
        );
        if (!res.ok) return;
        const list = (await res.json()) as Array<{
          id: string;
          title: string;
          status: string;
        }>;
        if (cancelled) return;
        const mapped = list.map((s) => ({ id: s.id, title: s.title }));
        setExistingSources(mapped);
        // Start with ALL existing sources selected.
        setSelectedSourceIds(new Set(mapped.map((s) => s.id)));
      } catch {
        // silently ignore — existing sources just won't appear
      }
    })();
    return (): void => {
      cancelled = true;
    };
  }, [open, notebookId]);

  const showOrientation = outputType === "infographic";
  const showStyle =
    outputType === "slides" ||
    outputType === "infographic" ||
    outputType === "video";
  const showSlideCount = outputType === "slides";
  const showAccent =
    outputType === "slides" || outputType === "infographic";

  const toggleExistingSource = (id: string): void => {
    setSelectedSourceIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleDiscovered = (url: string): void => {
    setSelectedDiscoveredUrls((prev) => {
      const next = new Set(prev);
      if (next.has(url)) next.delete(url);
      else next.add(url);
      return next;
    });
  };

  const selectAllDiscovered = (): void => {
    setSelectedDiscoveredUrls(new Set(discoveredSources.map((d) => d.url)));
  };
  const deselectAllDiscovered = (): void => {
    setSelectedDiscoveredUrls(new Set());
  };

  const findSources = async (): Promise<void> => {
    if (isDiscovering) return;
    setIsDiscovering(true);
    try {
      const res = await fetch("/api/studio/discover-sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notebookId,
          query: customPrompt.trim() || undefined,
        }),
      });
      const json = (await res.json()) as {
        sources?: DiscoveredSource[];
      };
      const list = json.sources ?? [];
      setDiscoveredSources(list);
      // Default-select the first 5 (or however many returned).
      setSelectedDiscoveredUrls(
        new Set(list.slice(0, 5).map((d) => d.url)),
      );
      setHasDiscovered(true);
    } catch (err) {
      console.error("discover-sources request failed:", err);
      setDiscoveredSources([]);
      setSelectedDiscoveredUrls(new Set());
      setHasDiscovered(true);
    } finally {
      setIsDiscovering(false);
    }
  };

  const submit = async (): Promise<void> => {
    const config: GenerateConfig = {
      language,
      orientation,
      style,
      detailLevel,
      customPrompt: customPrompt.trim(),
    };
    if (showSlideCount) config.slideCount = slideCount;
    if (showAccent) config.accentColor = accentColor;

    // Thread selected existing source ids through (forward-compat).
    config.selectedSourceIds = Array.from(selectedSourceIds);

    // Scrape discovered selections on demand.
    const urlsToScrape = Array.from(selectedDiscoveredUrls);
    if (urlsToScrape.length > 0) {
      setIsScrapingOnSubmit(true);
      try {
        const res = await fetch("/api/studio/scrape-sources", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ urls: urlsToScrape }),
        });
        if (res.ok) {
          const { results } = (await res.json()) as {
            results: ScrapedResult[];
          };
          const chunks: string[] = [];
          for (const r of results) {
            if (!r.content || r.error) continue;
            chunks.push(
              `\n\n[Source: ${r.title || r.url} — ${r.url}]\n${r.content}`,
            );
          }
          let combined = chunks.join("");
          if (combined.length > MAX_EXTRA_SOURCE_CONTENT) {
            combined = combined.slice(0, MAX_EXTRA_SOURCE_CONTENT);
          }
          if (combined.trim().length > 0) {
            config.extraSourceContent = combined;
          }
        }
      } catch (err) {
        console.error("scrape-sources request failed:", err);
        // Non-fatal — proceed without extraSourceContent.
      } finally {
        setIsScrapingOnSubmit(false);
      }
    }

    await onGenerate(config);
  };

  const submitDisabled = isGenerating || isScrapingOnSubmit;
  const discoveredSelectedCount = selectedDiscoveredUrls.size;
  const discoveredTotal = discoveredSources.length;

  const hasAppearance = showOrientation || showStyle;

  const capitalize = (s: string): string =>
    s.charAt(0).toUpperCase() + s.slice(1);
  const sourceCount =
    existingSources.filter((s) => selectedSourceIds.has(s.id)).length +
    selectedDiscoveredUrls.size;
  const summaryParts: string[] = [
    showOrientation ? capitalize(orientation) : null,
    showStyle ? capitalize(style) : null,
    showSlideCount ? `${slideCount} slides` : null,
    capitalize(detailLevel),
    `${sourceCount} source${sourceCount === 1 ? "" : "s"}`,
  ].filter((x): x is string => Boolean(x));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!max-w-lg overflow-y-auto max-h-[85vh]">
        <div className="fm-dialog-slide-up">
          <DialogHeader>
            <DialogTitle>{OUTPUT_TITLE[outputType]}</DialogTitle>
            <DialogDescription>
              {OUTPUT_DESCRIPTION[outputType]}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 mt-3">
            {/* ── Appearance group ── */}
            {hasAppearance && (
              <>
                {/* Orientation — infographic only (visual layout cards) */}
                {showOrientation && (
                  <div className="flex flex-col gap-2">
                    <span
                      className={sectionLabelClass}
                      style={sectionLabelStyle}
                    >
                      Layout
                    </span>
                    <div className="grid grid-cols-3 gap-2.5">
                      {ORIENTATION_OPTIONS.map((opt) => {
                        const selected = orientation === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => setOrientation(opt.value)}
                            className="flex flex-col items-center justify-between gap-2 rounded-xl border p-3 transition-all min-h-[108px]"
                            style={{
                              borderColor: selected
                                ? "var(--fm-accent-rose)"
                                : "var(--fm-surface-border)",
                              background: selected
                                ? "color-mix(in srgb, var(--fm-accent-rose) 6%, transparent)"
                                : "var(--fm-surface-elevated)",
                            }}
                            aria-pressed={selected}
                          >
                            <span className="flex flex-1 items-center justify-center" aria-hidden="true">
                              {ORIENTATION_PREVIEWS[opt.value]}
                            </span>
                            <span
                              className="text-[11px] font-medium"
                              style={{
                                color: selected
                                  ? "var(--fm-text)"
                                  : "var(--fm-text-tertiary)",
                              }}
                            >
                              {opt.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Style — gradient tiles with illustrated previews */}
                {showStyle && (
                  <div className="flex flex-col gap-2">
                    <span
                      className={sectionLabelClass}
                      style={sectionLabelStyle}
                    >
                      Visual style
                    </span>
                    <div className="grid grid-cols-3 gap-2.5">
                      {STYLE_OPTIONS.map((opt) => {
                        const selected = style === opt.value;
                        const labelColor =
                          STYLE_DARK_LABEL[opt.value] ?? "#fff";
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => setStyle(opt.value)}
                            className="relative flex flex-col items-center justify-end rounded-xl border-2 transition-all overflow-hidden"
                            style={{
                              aspectRatio: "1 / 1",
                              background: STYLE_GRADIENTS[opt.value],
                              borderColor: selected
                                ? "#fff"
                                : "transparent",
                              boxShadow: selected
                                ? "0 0 0 1px rgba(255,255,255,0.3)"
                                : "none",
                            }}
                            aria-pressed={selected}
                            aria-label={opt.label}
                          >
                            <span
                              className="flex flex-1 items-center justify-center p-3"
                              aria-hidden="true"
                            >
                              {STYLE_PREVIEWS[opt.value]}
                            </span>
                            <span
                              className="pb-2.5 text-[11px] font-semibold relative z-[1]"
                              style={{
                                color: labelColor,
                                textShadow:
                                  STYLE_DARK_LABEL[opt.value]
                                    ? "none"
                                    : "0 1px 4px rgba(0,0,0,0.4)",
                              }}
                            >
                              {opt.label}
                            </span>
                            {selected && (
                              <span
                                className="absolute top-1.5 right-1.5 w-[18px] h-[18px] rounded-full bg-white flex items-center justify-center z-[2]"
                                aria-hidden="true"
                              >
                                <svg
                                  width="10"
                                  height="10"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="#1e1c1a"
                                  strokeWidth="3"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                >
                                  <polyline points="20 6 9 17 4 12" />
                                </svg>
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Detail level — segmented bar with subtitles */}
                <div className="flex flex-col gap-2">
                  <span
                    className={sectionLabelClass}
                    style={sectionLabelStyle}
                  >
                    Content depth
                  </span>
                  <div
                    className="flex rounded-xl overflow-hidden border"
                    style={{
                      borderColor: "var(--fm-surface-border)",
                      height: 48,
                    }}
                  >
                    {DETAIL_OPTIONS.map((opt, i) => {
                      const selected = detailLevel === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setDetailLevel(opt.value)}
                          className="flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors"
                          style={{
                            background: selected
                              ? "color-mix(in srgb, var(--fm-accent-rose) 10%, transparent)"
                              : "var(--fm-surface-elevated)",
                            borderRight:
                              i < DETAIL_OPTIONS.length - 1
                                ? "1px solid var(--fm-surface-border)"
                                : "none",
                          }}
                          aria-pressed={selected}
                        >
                          <span
                            className="text-xs font-semibold"
                            style={{
                              color: selected
                                ? "var(--fm-text)"
                                : "var(--fm-text-tertiary)",
                            }}
                          >
                            {opt.label}
                          </span>
                          <span
                            className="text-[9px]"
                            style={{
                              color: selected
                                ? "var(--fm-text-secondary)"
                                : "var(--fm-text-tertiary)",
                            }}
                          >
                            {DETAIL_DESCRIPTIONS[opt.value]}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Slide count — stepper replaces fixed pills */}
                {showSlideCount && (
                  <div className="flex flex-col gap-2">
                    <span
                      className={sectionLabelClass}
                      style={sectionLabelStyle}
                    >
                      Number of slides
                    </span>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() =>
                          setSlideCount(Math.max(4, slideCount - 2))
                        }
                        disabled={slideCount <= 4}
                        aria-label="Decrease slide count"
                        className="w-8 h-8 rounded-lg border flex items-center justify-center text-base transition-colors disabled:opacity-30"
                        style={{
                          background: "var(--fm-surface-elevated)",
                          borderColor: "var(--fm-surface-border)",
                          color: "var(--fm-text-secondary)",
                        }}
                      >
                        −
                      </button>
                      <span
                        className="text-xl font-bold min-w-[32px] text-center"
                        style={{ color: "var(--fm-text)" }}
                        aria-live="polite"
                      >
                        {slideCount}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setSlideCount(Math.min(20, slideCount + 2))
                        }
                        disabled={slideCount >= 20}
                        aria-label="Increase slide count"
                        className="w-8 h-8 rounded-lg border flex items-center justify-center text-base transition-colors disabled:opacity-30"
                        style={{
                          background: "var(--fm-surface-elevated)",
                          borderColor: "var(--fm-surface-border)",
                          color: "var(--fm-text-secondary)",
                        }}
                      >
                        +
                      </button>
                      <span
                        className="text-[11px]"
                        style={{ color: "var(--fm-text-tertiary)" }}
                      >
                        slides
                      </span>
                    </div>
                  </div>
                )}
              </>
            )}

            <hr style={groupDividerStyle} />

            {/* ── Personalization row: accent + language side by side ── */}
            <div className="flex flex-wrap gap-5">
              {showAccent && (
                <div className="flex flex-col gap-2">
                  <span
                    className={sectionLabelClass}
                    style={sectionLabelStyle}
                  >
                    Accent
                  </span>
                  <div className="flex items-center gap-2 h-7">
                    {ACCENT_OPTIONS.map((opt) => {
                      const selected = accentColor === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          aria-label={opt.value}
                          onClick={() => setAccentColor(opt.value)}
                          className="rounded-full transition-all"
                          style={{
                            width: 22,
                            height: 22,
                            background: opt.color,
                            boxShadow: selected
                              ? "0 0 0 2px var(--fm-bg-secondary), 0 0 0 4px var(--fm-text)"
                              : "none",
                          }}
                        />
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-2">
                <span
                  className={sectionLabelClass}
                  style={sectionLabelStyle}
                >
                  Language
                </span>
                <div className="flex gap-1.5">
                  {LANGUAGE_OPTIONS.map((opt) => {
                    const selected = language === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setLanguage(opt.value)}
                        className="h-7 px-3.5 rounded-full text-xs font-medium border transition-colors"
                        style={{
                          background: selected
                            ? "var(--fm-text)"
                            : "transparent",
                          color: selected
                            ? "var(--fm-bg)"
                            : "var(--fm-text-tertiary)",
                          borderColor: selected
                            ? "var(--fm-text)"
                            : "var(--fm-surface-border)",
                        }}
                        aria-pressed={selected}
                      >
                        {opt.value.toUpperCase()}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <hr style={groupDividerStyle} />

            {/* ── Content group ── */}
            <div
              className="flex flex-col gap-3"
              style={{
                background: "var(--fm-surface-elevated)",
                border: "1px solid var(--fm-surface-border)",
                padding: "1rem",
                borderRadius: "0.75rem",
              }}
            >
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSourcesExpanded((v) => !v)}
                  aria-expanded={sourcesExpanded}
                  className="flex flex-1 items-center gap-2 text-left"
                >
                  <span
                    className={sectionLabelClass}
                    style={sectionLabelStyle}
                  >
                    Sources
                  </span>
                  <span
                    className="inline-flex items-center text-[10px] font-semibold rounded-full px-1.5 py-0.5"
                    style={{
                      background:
                        "color-mix(in srgb, var(--fm-accent-rose) 10%, transparent)",
                      color: "var(--fm-accent-rose)",
                    }}
                  >
                    {selectedSourceIds.size + selectedDiscoveredUrls.size}
                  </span>
                  <ChevronDown
                    className="h-3.5 w-3.5 transition-transform"
                    style={{
                      color: "var(--fm-text-tertiary)",
                      transform: sourcesExpanded
                        ? "rotate(180deg)"
                        : "none",
                    }}
                  />
                </button>
                <button
                  type="button"
                  onClick={findSources}
                  disabled={isDiscovering || isGenerating}
                  className="flex h-7 items-center gap-1.5 rounded-md border px-2.5 text-[11px] font-medium transition-colors disabled:opacity-50"
                  style={{
                    background: "var(--fm-surface)",
                    borderColor: "var(--fm-surface-border)",
                    color: "var(--fm-text-secondary)",
                  }}
                >
                  {isDiscovering ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Search className="h-3 w-3" />
                  )}
                  Find sources
                </button>
              </div>
              {sourcesExpanded && (
              <>
              {/* begin collapsible body */}

              {/* Existing notebook sources */}
              {existingSources.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <span
                    className="text-[11px]"
                    style={{ color: "var(--fm-text-tertiary)" }}
                  >
                    Your sources
                  </span>
                  <div
                    className="flex max-h-[160px] flex-col gap-1 overflow-y-auto rounded-lg border p-2"
                    style={{
                      background: "var(--fm-surface)",
                      borderColor: "var(--fm-surface-border)",
                    }}
                  >
                    {existingSources.map((s) => {
                      const selected = selectedSourceIds.has(s.id);
                      return (
                        <label
                          key={s.id}
                          className="flex cursor-pointer items-center gap-2 rounded-md border px-2 py-1.5 text-xs transition-colors"
                          style={{
                            background: selected
                              ? "color-mix(in srgb, var(--fm-accent-orange) 12%, transparent)"
                              : "transparent",
                            borderColor: selected
                              ? "var(--fm-accent-orange)"
                              : "transparent",
                            color: "var(--fm-text)",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => toggleExistingSource(s.id)}
                            className="accent-[var(--fm-accent-orange)]"
                          />
                          <span className="truncate">{s.title}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Discover more from the web */}
              <div className="flex flex-col gap-1.5">
                {hasDiscovered && discoveredSources.length === 0 && (
                  <p
                    className="rounded-md border px-2 py-1.5 text-[11px]"
                    style={{
                      background: "var(--fm-surface)",
                      borderColor: "var(--fm-surface-border)",
                      color: "var(--fm-text-tertiary)",
                    }}
                  >
                    No results. If nothing shows up repeatedly, configure
                    SERPER_API_KEY to enable web discovery.
                  </p>
                )}

                {discoveredSources.length > 0 && (
                  <>
                    <div className="flex items-center justify-between">
                      <span
                        className="text-[11px]"
                        style={{ color: "var(--fm-text-tertiary)" }}
                      >
                        Selected: {discoveredSelectedCount} of{" "}
                        {discoveredTotal}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={selectAllDiscovered}
                          className="h-6 rounded px-1.5 text-[11px]"
                          style={{ color: "var(--fm-text-secondary)" }}
                        >
                          Select all
                        </button>
                        <span
                          style={{ color: "var(--fm-text-tertiary)" }}
                          className="text-[11px]"
                        >
                          ·
                        </span>
                        <button
                          type="button"
                          onClick={deselectAllDiscovered}
                          className="h-6 rounded px-1.5 text-[11px]"
                          style={{ color: "var(--fm-text-secondary)" }}
                        >
                          Deselect all
                        </button>
                      </div>
                    </div>
                    <div
                      className="flex max-h-[200px] flex-col gap-1 overflow-y-auto rounded-lg border p-2"
                      style={{
                        background: "var(--fm-surface)",
                        borderColor: "var(--fm-surface-border)",
                      }}
                    >
                      {discoveredSources.map((d) => {
                        const selected = selectedDiscoveredUrls.has(d.url);
                        return (
                          <label
                            key={d.url}
                            className="flex cursor-pointer items-start gap-2 rounded-md border px-2 py-1.5 text-xs transition-colors"
                            style={{
                              background: selected
                                ? "color-mix(in srgb, var(--fm-accent-orange) 12%, transparent)"
                                : "transparent",
                              borderColor: selected
                                ? "var(--fm-accent-orange)"
                                : "transparent",
                              color: "var(--fm-text)",
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={selected}
                              onChange={() => toggleDiscovered(d.url)}
                              className="mt-0.5 accent-[var(--fm-accent-orange)]"
                            />
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={d.favicon}
                              alt=""
                              width={16}
                              height={16}
                              className="mt-0.5 shrink-0 rounded-sm"
                              style={{ objectFit: "contain" }}
                            />
                            <div className="flex min-w-0 flex-1 flex-col">
                              <span className="truncate font-medium">
                                {d.title}
                              </span>
                              <span
                                className="truncate text-[10px]"
                                style={{ color: "var(--fm-text-tertiary)" }}
                              >
                                {d.domain}
                              </span>
                              <span
                                className="line-clamp-2 text-[11px]"
                                style={{ color: "var(--fm-text-secondary)" }}
                              >
                                {d.snippet}
                              </span>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
              {/* end collapsible body */}
              </>
              )}
            </div>

            {/* Custom prompt */}
            <div className="flex flex-col gap-2">
              <span className={sectionLabelClass} style={sectionLabelStyle}>
                Custom prompt
              </span>
              <textarea
                rows={3}
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder={CUSTOM_PROMPT_PLACEHOLDER[outputType]}
                className="w-full resize-none rounded-lg border p-2.5 text-xs outline-none"
                style={{
                  background: "var(--fm-input-bg)",
                  borderColor: "var(--fm-input-border)",
                  color: "var(--fm-text)",
                }}
              />
            </div>
          </div>

          {/* Summary + output-coloured Generate */}
          <div
            className="mt-4 flex items-center justify-between gap-3 border-t pt-3"
            style={{ borderColor: "var(--fm-surface-border)" }}
          >
            <span
              className="text-[11px] flex-1 min-w-0 truncate"
              style={{ color: "var(--fm-text-tertiary)" }}
            >
              {summaryParts.join(" · ")}
            </span>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="outline"
                size="default"
                onClick={() => onOpenChange(false)}
                disabled={isGenerating}
              >
                Cancel
              </Button>
              <button
                type="button"
                onClick={submit}
                disabled={submitDisabled}
                className="inline-flex items-center gap-1.5 h-9 px-4 rounded-md text-sm font-medium text-white transition-[filter,transform] hover:brightness-110 hover:-translate-y-px active:translate-y-0 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:brightness-100 disabled:hover:translate-y-0"
                style={{ background: OUTPUT_ACCENT[outputType] }}
              >
                {isGenerating || isScrapingOnSubmit ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Wand2 className="h-3.5 w-3.5" />
                )}
                {isScrapingOnSubmit ? "Fetching…" : "Generate"}
              </button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
