"use client";

import { useState } from "react";
import { Download, Copy, Check } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { Button } from "@/components/ui/button";
import type { NewsletterContent } from "@/app/api/studio/newsletter/route";

type StyleId = "clean" | "editorial" | "modern" | "dark";

type StyleSpec = {
  headingFont?: string;
  accent: string;
  tint: string;
  serif: boolean;
};

const STYLE_SPECS: Record<StyleId, StyleSpec> = {
  clean: {
    accent: "var(--fm-accent-blue)",
    tint: "color-mix(in srgb, var(--fm-accent-blue) 10%, transparent)",
    serif: true,
  },
  editorial: {
    accent: "var(--fm-accent-rose)",
    tint: "color-mix(in srgb, var(--fm-accent-rose) 10%, transparent)",
    serif: true,
  },
  modern: {
    accent: "var(--fm-accent-violet)",
    tint: "color-mix(in srgb, var(--fm-accent-violet) 10%, transparent)",
    serif: false,
  },
  dark: {
    accent: "var(--fm-accent-orange)",
    tint: "color-mix(in srgb, var(--fm-accent-orange) 10%, transparent)",
    serif: false,
  },
};

export const NewsletterPreview = ({
  newsletter,
}: {
  newsletter: NewsletterContent;
}): React.ReactNode => {
  const [styleId, setStyleId] = useState<StyleId>("clean");
  const [copied, setCopied] = useState(false);
  const spec = STYLE_SPECS[styleId];

  const headingFont = spec.serif
    ? "'Georgia', 'Times New Roman', serif"
    : undefined;

  const toMarkdown = (): string => {
    let md = `# ${newsletter.headline}\n\n${newsletter.introduction}\n\n`;
    for (const section of newsletter.sections) {
      md += `## ${section.title}\n\n${section.body}\n\n`;
      if (section.pullQuote) md += `> ${section.pullQuote}\n\n`;
    }
    md += `### Key Takeaways\n\n${newsletter.keyTakeaways
      .map((t) => `- ${t}`)
      .join("\n")}\n\n`;
    md += `---\n\n${newsletter.cta.text}\n\n${newsletter.footer}`;
    return md;
  };

  const handleCopy = async (): Promise<void> => {
    await navigator.clipboard.writeText(toMarkdown());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExportMarkdown = (): void => {
    const blob = new Blob([toMarkdown()], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${newsletter.title}.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const styleIds: readonly StyleId[] = [
    "clean",
    "editorial",
    "modern",
    "dark",
  ];

  return (
    <div>
      {/* Segmented control + actions */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <div
          className="inline-flex rounded-lg p-1"
          style={{
            background: "var(--fm-surface-elevated)",
            border: "1px solid var(--fm-surface-border)",
          }}
          role="tablist"
          aria-label="Newsletter style"
        >
          {styleIds.map((id) => {
            const active = styleId === id;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setStyleId(id)}
                className="px-3 py-1 rounded-md text-xs font-medium capitalize transition-colors"
                style={{
                  background: active ? "var(--fm-surface)" : "transparent",
                  color: active
                    ? "var(--fm-text)"
                    : "var(--fm-text-secondary)",
                  boxShadow: active
                    ? "0 1px 2px rgba(0,0,0,0.08)"
                    : "none",
                }}
              >
                {id}
              </button>
            );
          })}
        </div>
        <div className="ml-auto flex gap-1 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopy}
            className="gap-1.5"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
            {copied ? "Copied" : "Copy"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportMarkdown}
            className="gap-1.5"
          >
            <Download className="h-3.5 w-3.5" />
            Markdown
          </Button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={styleId}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="max-w-2xl mx-auto rounded-2xl overflow-hidden"
          style={{
            background: "var(--fm-surface)",
            border: "1px solid var(--fm-surface-border)",
          }}
        >
          {/* Header accent band */}
          <div style={{ height: 6, background: spec.accent }} />

          <div className="p-8">
            {/* Headline */}
            <h1
              className="text-3xl font-bold mb-3 leading-tight"
              style={{
                color: "var(--fm-text)",
                fontFamily: headingFont,
              }}
            >
              {newsletter.headline}
            </h1>

            {/* Introduction */}
            <p
              className="text-[15px] leading-relaxed mb-8"
              style={{ color: "var(--fm-text-secondary)" }}
            >
              {newsletter.introduction}
            </p>

            {/* Sections */}
            {newsletter.sections.map((section, i) => (
              <div
                key={i}
                className="mb-6 rounded-xl p-5"
                style={{
                  background: "var(--fm-surface-elevated)",
                  border: "1px solid var(--fm-surface-border)",
                }}
              >
                <h2
                  className="font-semibold mb-3"
                  style={{
                    color: "var(--fm-text)",
                    fontSize: "18px",
                    fontFamily: headingFont,
                  }}
                >
                  {section.title}
                </h2>
                <p
                  className="leading-relaxed"
                  style={{
                    color: "var(--fm-text-secondary)",
                    fontSize: "15px",
                  }}
                >
                  {section.body}
                </p>
                {section.pullQuote && (
                  <blockquote
                    className="mt-4 italic"
                    style={{
                      borderLeft: `3px solid ${spec.accent}`,
                      paddingLeft: "0.875rem",
                      color: "var(--fm-text)",
                      fontSize: "16px",
                      lineHeight: 1.5,
                    }}
                  >
                    &ldquo;{section.pullQuote}&rdquo;
                  </blockquote>
                )}
              </div>
            ))}

            {/* Key Takeaways */}
            <div
              className="rounded-xl p-5 mb-6"
              style={{
                background: spec.tint,
                border: `1px solid color-mix(in srgb, ${spec.accent} 30%, transparent)`,
              }}
            >
              <h3
                className="font-semibold mb-3 text-sm uppercase tracking-wide"
                style={{ color: "var(--fm-text)" }}
              >
                Key Takeaways
              </h3>
              <ol className="space-y-2 list-none">
                {newsletter.keyTakeaways.map((item, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-3 text-sm leading-relaxed"
                    style={{ color: "var(--fm-text)" }}
                  >
                    <span
                      className="shrink-0 font-bold tabular-nums"
                      style={{ color: spec.accent, minWidth: "1.25rem" }}
                    >
                      {i + 1}.
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ol>
            </div>

            {/* CTA (display-only) */}
            <div className="text-center mb-6">
              <p
                className="text-sm mb-3"
                style={{ color: "var(--fm-text-tertiary)" }}
              >
                {newsletter.cta.text}
              </p>
              <button
                type="button"
                className="px-6 py-2.5 rounded-lg text-white text-sm font-medium pointer-events-none cursor-default"
                style={{ background: spec.accent }}
                tabIndex={-1}
                aria-disabled="true"
              >
                {newsletter.cta.buttonLabel}
              </button>
            </div>

            {/* Footer */}
            <p
              className="text-xs text-center"
              style={{ color: "var(--fm-text-tertiary)" }}
            >
              {newsletter.footer}
            </p>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
};
