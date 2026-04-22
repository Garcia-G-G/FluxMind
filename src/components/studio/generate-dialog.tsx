"use client";

import { useEffect, useState } from "react";
import { Loader2, Search, Wand2 } from "lucide-react";
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

/** Small inline SVGs — one per style option. stroke=currentColor so the
 *  selected-state tint flows through from the parent's `color` style. */
const STYLE_ICONS: Record<VisualStyle, React.ReactNode> = {
  auto: (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v8M8 12h8" />
    </svg>
  ),
  sketch: (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 21l3.5-1 11.5-11.5a2.121 2.121 0 0 0-3-3L3.5 17 3 21z" />
      <path d="M14 6l3 3" />
    </svg>
  ),
  kawaii: (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M9 10h.01M15 10h.01" />
      <path d="M9 15c.83.7 1.85 1 3 1s2.17-.3 3-1" />
    </svg>
  ),
  professional: (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="3" width="8" height="8" rx="1" />
      <rect x="13" y="3" width="8" height="5" rx="1" />
      <rect x="13" y="10" width="8" height="11" rx="1" />
      <rect x="3" y="13" width="8" height="8" rx="1" />
    </svg>
  ),
  scientific: (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 3h6" />
      <path d="M10 3v6.5L4.5 18a2 2 0 0 0 1.7 3h11.6a2 2 0 0 0 1.7-3L14 9.5V3" />
      <path d="M7 14h10" />
    </svg>
  ),
  minimalist: (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 12h14" />
    </svg>
  ),
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

type DetailOption = { value: GenerateConfig["detailLevel"]; label: string };
const DETAIL_OPTIONS: readonly DetailOption[] = [
  { value: "concise", label: "Concise" },
  { value: "standard", label: "Standard" },
  { value: "detailed", label: "Detailed" },
] as const;

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

const SLIDE_COUNTS: readonly number[] = [4, 6, 8, 10, 12] as const;

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

const sectionLabelClass = "text-[13px] font-semibold";
const sectionLabelStyle = { color: "var(--fm-text)" } as const;

const tileBaseStyle = (selected: boolean): React.CSSProperties => ({
  background: selected
    ? "color-mix(in srgb, var(--fm-accent-orange) 8%, transparent)"
    : "var(--fm-surface-elevated)",
  borderColor: selected
    ? "var(--fm-accent-orange)"
    : "var(--fm-surface-border)",
  color: selected ? "var(--fm-text)" : "var(--fm-text-secondary)",
});

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
                {/* Orientation — infographic only */}
                {showOrientation && (
                  <div className="flex flex-col gap-2">
                    <span
                      className={sectionLabelClass}
                      style={sectionLabelStyle}
                    >
                      Orientation
                    </span>
                    <div className="grid grid-cols-3 gap-2">
                      {ORIENTATION_OPTIONS.map((opt) => {
                        const selected = orientation === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => setOrientation(opt.value)}
                            className="h-10 rounded-lg border text-xs font-medium transition-colors"
                            style={tileBaseStyle(selected)}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Style — everything except mindmap */}
                {showStyle && (
                  <div className="flex flex-col gap-2">
                    <span
                      className={sectionLabelClass}
                      style={sectionLabelStyle}
                    >
                      Style
                    </span>
                    <div className="grid grid-cols-3 gap-2">
                      {STYLE_OPTIONS.map((opt) => {
                        const selected = style === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => setStyle(opt.value)}
                            className="flex flex-col items-center justify-center gap-1.5 min-h-[4.5rem] rounded-lg border px-3 transition-colors"
                            style={{
                              ...tileBaseStyle(selected),
                              color: selected
                                ? "var(--fm-accent-orange)"
                                : "var(--fm-text-tertiary)",
                            }}
                            aria-pressed={selected}
                          >
                            <span aria-hidden="true">
                              {STYLE_ICONS[opt.value]}
                            </span>
                            <span
                              className="text-[11px] uppercase tracking-wider font-medium"
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

                {/* Detail level — all (part of appearance group) */}
                <div className="flex flex-col gap-2">
                  <span
                    className={sectionLabelClass}
                    style={sectionLabelStyle}
                  >
                    Detail
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    {DETAIL_OPTIONS.map((opt) => {
                      const selected = detailLevel === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setDetailLevel(opt.value)}
                          className="h-10 rounded-lg border text-xs font-medium transition-colors"
                          style={tileBaseStyle(selected)}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Slide count — slides only (replaces range slider) */}
                {showSlideCount && (
                  <div className="flex flex-col gap-2">
                    <span
                      className={sectionLabelClass}
                      style={sectionLabelStyle}
                    >
                      Slide count
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {SLIDE_COUNTS.map((n) => {
                        const selected = slideCount === n;
                        return (
                          <button
                            key={n}
                            type="button"
                            onClick={() => setSlideCount(n)}
                            className="min-w-12 py-2 px-3 rounded-lg text-sm font-medium border transition-colors"
                            style={{
                              background: selected
                                ? "var(--fm-accent-orange)"
                                : "var(--fm-surface-elevated)",
                              borderColor: selected
                                ? "var(--fm-accent-orange)"
                                : "var(--fm-surface-border)",
                              color: selected
                                ? "white"
                                : "var(--fm-text-secondary)",
                            }}
                            aria-pressed={selected}
                          >
                            {n}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}

            <hr style={groupDividerStyle} />

            {/* ── Personalization group ── */}
            {showAccent && (
              <div className="flex flex-col gap-2">
                <span className={sectionLabelClass} style={sectionLabelStyle}>
                  Accent color
                </span>
                <div className="flex items-center gap-2">
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
                          width: 24,
                          height: 24,
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
              <span className={sectionLabelClass} style={sectionLabelStyle}>
                Language
              </span>
              <div className="grid grid-cols-2 gap-2">
                {LANGUAGE_OPTIONS.map((opt) => {
                  const selected = language === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setLanguage(opt.value)}
                      className="h-10 rounded-lg border text-xs font-medium transition-colors"
                      style={tileBaseStyle(selected)}
                    >
                      {opt.label}
                    </button>
                  );
                })}
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
              <div className="flex items-center justify-between">
                <span
                  className={sectionLabelClass}
                  style={sectionLabelStyle}
                >
                  Sources
                </span>
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

          <div className="mt-4 flex items-center justify-end gap-2">
            <Button
              variant="outline"
              size="default"
              onClick={() => onOpenChange(false)}
              disabled={isGenerating}
            >
              Cancel
            </Button>
            <Button
              variant="default"
              size="default"
              onClick={submit}
              disabled={submitDisabled}
            >
              {isGenerating || isScrapingOnSubmit ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Wand2 className="h-3.5 w-3.5" />
              )}
              {isScrapingOnSubmit ? "Fetching…" : "Generate"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
