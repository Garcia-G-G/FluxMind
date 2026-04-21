"use client";

import { useEffect, useState } from "react";
import { Loader2, Wand2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useLanguage } from "@/lib/i18n/language";
import type { VisualStyle } from "@/lib/media/styles";

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
};

type GenerateDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  outputType: OutputType;
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

export const GenerateDialog = ({
  open,
  onOpenChange,
  outputType,
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
    }
  }, [open, currentLanguage]);

  const showOrientation = outputType === "infographic";
  const showStyle = outputType !== "mindmap";
  const showSlideCount = outputType === "slides";
  const showAccent =
    outputType === "slides" || outputType === "infographic";

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
    await onGenerate(config);
  };

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
            disabled={isGenerating}
            className="flex h-9 items-center gap-1.5 rounded-lg px-4 text-xs font-medium text-white transition-opacity disabled:opacity-50"
            style={{ background: "var(--fm-accent-orange)" }}
          >
            {isGenerating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Wand2 className="h-3.5 w-3.5" />
            )}
            Generate
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
