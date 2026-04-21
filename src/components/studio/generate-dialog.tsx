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
import { useLanguage } from "@/lib/i18n/language";
import type { VisualStyle } from "@/lib/media/styles";
import type { DiscoveredSource } from "@/app/api/studio/discover-sources/route";
import type { ScrapedResult } from "@/app/api/studio/scrape-sources/route";

/** Output types that open the customization dialog. */
type OutputType = "slides" | "infographic" | "video" | "mindmap";

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

type StyleOption = { value: VisualStyle; label: string; emoji: string };
const STYLE_OPTIONS: readonly StyleOption[] = [
  { value: "auto", label: "Auto", emoji: "🔄" },
  { value: "sketch", label: "Sketch", emoji: "✏️" },
  { value: "kawaii", label: "Kawaii", emoji: "🌸" },
  { value: "professional", label: "Professional", emoji: "💼" },
  { value: "scientific", label: "Scientific", emoji: "🔬" },
  { value: "minimalist", label: "Minimalist", emoji: "◻️" },
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

const OUTPUT_TITLE: Record<OutputType, string> = {
  slides: "Generate slide deck",
  infographic: "Generate infographic",
  video: "Generate video overview",
  mindmap: "Generate mind map",
};

const OUTPUT_DESCRIPTION: Record<OutputType, string> = {
  slides: "Customize style, detail, and layout before generating.",
  infographic: "Customize orientation, style, and detail before generating.",
  video: "Customize style and detail for the video overview.",
  mindmap: "Customize the depth and language of the mind map.",
};

const CUSTOM_PROMPT_PLACEHOLDER: Record<OutputType, string> = {
  slides: "Any specific focus, audience, or talking points? (optional)",
  infographic: "Anything to emphasize or avoid in the infographic? (optional)",
  video: "Any specific tone, pacing, or focus for the narration? (optional)",
  mindmap: "Any particular branches or themes to emphasize? (optional)",
};

const sectionLabelClass = "text-xs font-medium";
const sectionLabelStyle = { color: "var(--fm-text-secondary)" } as const;

const tileBaseStyle = (selected: boolean): React.CSSProperties => ({
  background: selected
    ? "color-mix(in srgb, var(--fm-accent-orange) 12%, transparent)"
    : "var(--fm-surface)",
  borderColor: selected
    ? "var(--fm-accent-orange)"
    : "var(--fm-surface-border)",
  color: "var(--fm-text)",
});

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
  const showStyle = outputType !== "mindmap";
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!max-w-lg overflow-y-auto max-h-[85vh]">
        <DialogHeader>
          <DialogTitle>{OUTPUT_TITLE[outputType]}</DialogTitle>
          <DialogDescription>
            {OUTPUT_DESCRIPTION[outputType]}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {/* Orientation — infographic only */}
          {showOrientation && (
            <div className="flex flex-col gap-2">
              <span className={sectionLabelClass} style={sectionLabelStyle}>
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
              <span className={sectionLabelClass} style={sectionLabelStyle}>
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
                      className="flex flex-col items-center gap-1 rounded-lg border py-2 px-2 text-xs font-medium transition-colors"
                      style={tileBaseStyle(selected)}
                    >
                      <span className="text-base leading-none">
                        {opt.emoji}
                      </span>
                      <span>{opt.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Detail level — all */}
          <div className="flex flex-col gap-2">
            <span className={sectionLabelClass} style={sectionLabelStyle}>
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

          {/* Slide count — slides only */}
          {showSlideCount && (
            <div className="flex flex-col gap-2">
              <span className={sectionLabelClass} style={sectionLabelStyle}>
                Slide count: {slideCount}
              </span>
              <input
                type="range"
                min={4}
                max={16}
                step={1}
                value={slideCount}
                onChange={(e) => setSlideCount(Number(e.target.value))}
                className="w-full accent-[var(--fm-accent-orange)]"
              />
            </div>
          )}

          {/* Accent color — slides + infographic */}
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

          {/* Language — all */}
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

          {/* ── Sources section ── */}
          <div className="flex flex-col gap-3 pt-2">
            <div
              className="h-px w-full"
              style={{ background: "var(--fm-surface-border)" }}
            />
            <span className={sectionLabelClass} style={sectionLabelStyle}>
              Sources
            </span>

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
              <div className="flex items-center justify-between">
                <span
                  className="text-[11px]"
                  style={{ color: "var(--fm-text-tertiary)" }}
                >
                  Discover more from the web
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

          {/* Custom prompt — all */}
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

        <div className="mt-2 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={isGenerating}
            className="h-9 rounded-lg border px-4 text-xs font-medium transition-colors disabled:opacity-50"
            style={{
              background: "var(--fm-surface)",
              borderColor: "var(--fm-surface-border)",
              color: "var(--fm-text-secondary)",
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={submitDisabled}
            className="flex h-9 items-center gap-1.5 rounded-lg px-4 text-xs font-medium text-white transition-opacity disabled:opacity-50"
            style={{ background: "var(--fm-accent-orange)" }}
          >
            {isGenerating || isScrapingOnSubmit ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Wand2 className="h-3.5 w-3.5" />
            )}
            {isScrapingOnSubmit ? "Fetching…" : "Generate"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
