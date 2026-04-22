"use client";

import { useRef, useState } from "react";
import { Copy, Check, Clock, Music } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ReelContent } from "@/app/api/studio/reel/route";

/** Each reel section has a canonical color. These are spec-mandated status
 *  hues, not theme-tokenable (Hook=red, Content=blue, CTA=green). */
const SECTION_COLORS: Record<string, string> = {
  hook: "#ef4444",
  content: "#3b82f6",
  cta: "#22c55e",
};

const SECTION_LABELS: Record<string, string> = {
  hook: "Hook",
  content: "Content",
  cta: "CTA",
};

export const ReelScriptView = ({
  reel,
}: {
  reel: ReelContent;
}): React.ReactNode => {
  const [copied, setCopied] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState<number | null>(null);
  const sectionRefs = useRef<Array<HTMLDivElement | null>>([]);

  const totalDuration = reel.sections.reduce(
    (sum, s) => sum + s.duration,
    0,
  );

  const handleCopyScript = async (): Promise<void> => {
    const text = reel.sections
      .map(
        (s) =>
          `[${SECTION_LABELS[s.type]} - ${s.duration}s]\n${s.text}\nVisual: ${s.visualSuggestion}`,
      )
      .join("\n\n");
    const full = `${reel.title}\nDuration: ~${totalDuration}s\n\n${text}\n\nCaption: ${reel.caption}\nMusic: ${reel.musicSuggestion}`;
    await navigator.clipboard.writeText(full);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const scrollToSection = (i: number): void => {
    const el = sectionRefs.current[i];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    setHighlightIndex(i);
    setTimeout(() => setHighlightIndex(null), 1200);
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Clock
            className="h-4 w-4"
            style={{ color: "var(--fm-text-tertiary)" }}
          />
          <span
            className="text-sm"
            style={{ color: "var(--fm-text-secondary)" }}
          >
            ~{totalDuration}s
          </span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleCopyScript}
          className="gap-1.5"
        >
          {copied ? (
            <Check className="h-3.5 w-3.5" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
          {copied ? "Copied" : "Copy Script"}
        </Button>
      </div>

      {/* Clickable timeline bar */}
      <div
        className="flex rounded-full overflow-hidden mb-6"
        style={{ height: 10, background: "var(--fm-surface-border)" }}
      >
        {reel.sections.map((section, i) => (
          <button
            key={i}
            type="button"
            onClick={() => scrollToSection(i)}
            className="transition-opacity hover:opacity-80"
            style={{
              width: `${(section.duration / totalDuration) * 100}%`,
              background: SECTION_COLORS[section.type],
            }}
            title={`${SECTION_LABELS[section.type]}: ${section.duration}s`}
            aria-label={`Jump to ${SECTION_LABELS[section.type]} section`}
          />
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Phone mockup */}
        <div className="flex justify-center">
          <div
            className="w-72 rounded-[2.25rem] overflow-hidden relative"
            style={{
              background: "var(--fm-bg-secondary)",
              border: "8px solid var(--fm-surface-border)",
              boxShadow: "0 8px 32px rgba(0,0,0,0.24)",
            }}
          >
            {/* Notch / island */}
            <div
              className="absolute left-1/2 -translate-x-1/2 z-10"
              style={{
                top: 8,
                width: 84,
                height: 22,
                borderRadius: "9999px",
                background: "var(--fm-bg-primary, #000)",
              }}
            />
            <div className="aspect-[9/16] p-5 flex flex-col justify-between relative">
              {/* Sections */}
              <div className="flex-1 flex flex-col justify-center space-y-4 pt-6">
                {reel.sections.map((section, i) => (
                  <div key={i}>
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className="text-[10px] px-1.5 py-0 rounded font-semibold text-white"
                        style={{
                          background: SECTION_COLORS[section.type],
                        }}
                      >
                        {SECTION_LABELS[section.type]}
                      </span>
                      <span
                        className="text-[10px]"
                        style={{ color: "var(--fm-text-tertiary)" }}
                      >
                        {section.duration}s
                      </span>
                    </div>
                    <p
                      className="text-sm leading-relaxed"
                      style={{ color: "var(--fm-text)" }}
                    >
                      {section.text}
                    </p>
                  </div>
                ))}
              </div>

              {/* Bottom bar */}
              <div
                className="pt-3 mt-2"
                style={{ borderTop: "1px solid var(--fm-surface-border)" }}
              >
                <p
                  className="text-sm leading-relaxed line-clamp-2"
                  style={{ color: "var(--fm-text-secondary)" }}
                >
                  {reel.caption}
                </p>
                <div className="flex items-center gap-1 mt-1.5">
                  <Music
                    className="h-3 w-3"
                    style={{ color: "var(--fm-text-tertiary)" }}
                  />
                  <span
                    className="text-sm"
                    style={{ color: "var(--fm-text-tertiary)" }}
                  >
                    {reel.musicSuggestion}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Script breakdown table */}
        <div
          className="rounded-xl p-4"
          style={{
            background: "var(--fm-surface)",
            border: "1px solid var(--fm-surface-border)",
          }}
        >
          <h3
            className="text-sm font-semibold mb-3"
            style={{ color: "var(--fm-text)" }}
          >
            Script breakdown
          </h3>
          {/* Header row */}
          <div
            className="grid text-[11px] font-bold uppercase tracking-wider pb-2"
            style={{
              gridTemplateColumns: "70px 60px 1fr 1fr",
              color: "var(--fm-text-tertiary)",
              borderBottom: "1px solid var(--fm-surface-border)",
              gap: "0.75rem",
            }}
          >
            <div>Section</div>
            <div>Duration</div>
            <div>Text</div>
            <div>Visual</div>
          </div>
          {/* Rows */}
          <div className="flex flex-col">
            {reel.sections.map((section, i) => {
              const isHighlighted = highlightIndex === i;
              return (
                <div
                  key={i}
                  ref={(el) => {
                    sectionRefs.current[i] = el;
                  }}
                  className="grid text-xs py-3 transition-colors"
                  style={{
                    gridTemplateColumns: "70px 60px 1fr 1fr",
                    borderBottom:
                      i < reel.sections.length - 1
                        ? "1px solid var(--fm-surface-border)"
                        : undefined,
                    gap: "0.75rem",
                    background: isHighlighted
                      ? `color-mix(in srgb, ${SECTION_COLORS[section.type]} 14%, transparent)`
                      : "transparent",
                    color: "var(--fm-text)",
                  }}
                >
                  <div>
                    <span
                      className="inline-block text-[10px] px-1.5 py-0.5 rounded font-semibold text-white"
                      style={{
                        background: SECTION_COLORS[section.type],
                      }}
                    >
                      {SECTION_LABELS[section.type]}
                    </span>
                  </div>
                  <div
                    className="tabular-nums"
                    style={{ color: "var(--fm-text-secondary)" }}
                  >
                    {section.duration}s
                  </div>
                  <div className="leading-relaxed">{section.text}</div>
                  <div
                    className="leading-relaxed italic"
                    style={{ color: "var(--fm-text-tertiary)" }}
                  >
                    {section.visualSuggestion}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
