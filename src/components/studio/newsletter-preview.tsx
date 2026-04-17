"use client";

import { useState } from "react";
import { Download, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { NewsletterContent } from "@/app/api/studio/newsletter/route";

type StyleId = "clean" | "editorial" | "modern" | "dark";

const STYLES: Record<
  StyleId,
  { bg: string; card: string; text: string; accent: string; heading: string; muted: string }
> = {
  clean: { bg: "bg-gray-50 dark:bg-gray-950", card: "bg-white dark:bg-gray-900", text: "text-gray-900 dark:text-gray-100", accent: "bg-blue-600", heading: "text-gray-900 dark:text-gray-100", muted: "text-gray-500 dark:text-gray-400" },
  editorial: { bg: "bg-amber-50 dark:bg-amber-950", card: "bg-white dark:bg-amber-900", text: "text-amber-950 dark:text-amber-100", accent: "bg-red-600", heading: "text-amber-900 dark:text-amber-200", muted: "text-amber-600 dark:text-amber-400" },
  modern: { bg: "bg-white dark:bg-zinc-950", card: "bg-zinc-50 dark:bg-zinc-900", text: "text-zinc-900 dark:text-zinc-100", accent: "bg-violet-600", heading: "text-zinc-800 dark:text-zinc-200", muted: "text-zinc-500 dark:text-zinc-400" },
  dark: { bg: "bg-zinc-900", card: "bg-zinc-800", text: "text-zinc-100", accent: "bg-cyan-500", heading: "text-white", muted: "text-zinc-400" },
};

export const NewsletterPreview = ({
  newsletter,
}: {
  newsletter: NewsletterContent;
}): React.ReactNode => {
  const [styleId, setStyleId] = useState<StyleId>("clean");
  const [copied, setCopied] = useState(false);
  const style = STYLES[styleId];

  const toMarkdown = (): string => {
    let md = `# ${newsletter.headline}\n\n${newsletter.introduction}\n\n`;
    for (const section of newsletter.sections) {
      md += `## ${section.title}\n\n${section.body}\n\n`;
      if (section.pullQuote) md += `> ${section.pullQuote}\n\n`;
    }
    md += `### Key Takeaways\n\n${newsletter.keyTakeaways.map((t) => `- ${t}`).join("\n")}\n\n`;
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

  return (
    <div>
      <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1">
        {(Object.keys(STYLES) as StyleId[]).map((id) => (
          <button
            key={id}
            onClick={() => setStyleId(id)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-all shrink-0 capitalize ${
              styleId === id
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:border-primary/50"
            }`}
          >
            {id}
          </button>
        ))}
        <div className="ml-auto flex gap-1 shrink-0">
          <Button variant="outline" size="sm" onClick={handleCopy} className="gap-1.5">
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copied" : "Copy"}
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportMarkdown} className="gap-1.5">
            <Download className="h-3.5 w-3.5" />
            Markdown
          </Button>
        </div>
      </div>

      <div className={`max-w-2xl mx-auto rounded-xl overflow-hidden ${style.bg}`}>
        {/* Header band */}
        <div className={`h-2 ${style.accent}`} />

        <div className={`p-8 ${style.card}`}>
          {/* Headline */}
          <h1 className={`text-2xl font-bold mb-3 ${style.heading}`}>
            {newsletter.headline}
          </h1>

          {/* Introduction */}
          <p className={`text-sm leading-relaxed mb-6 ${style.text}`}>
            {newsletter.introduction}
          </p>

          {/* Sections */}
          {newsletter.sections.map((section, i) => (
            <div key={i} className="mb-6">
              <h2 className={`text-lg font-semibold mb-2 ${style.heading}`}>
                {section.title}
              </h2>
              <p className={`text-sm leading-relaxed ${style.text}`}>
                {section.body}
              </p>
              {section.pullQuote && (
                <blockquote
                  className={`mt-3 pl-4 border-l-2 italic text-sm ${style.muted}`}
                  style={{ borderColor: "currentColor" }}
                >
                  &ldquo;{section.pullQuote}&rdquo;
                </blockquote>
              )}
            </div>
          ))}

          {/* Key Takeaways */}
          <div className={`p-4 rounded-lg mb-6 ${style.bg}`}>
            <h3 className={`font-semibold text-sm mb-2 ${style.heading}`}>
              Key Takeaways
            </h3>
            <ul className="space-y-1">
              {newsletter.keyTakeaways.map((item, i) => (
                <li key={i} className={`text-sm flex items-start gap-2 ${style.text}`}>
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-current shrink-0 opacity-40" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* CTA */}
          <div className="text-center mb-6">
            <p className={`text-sm mb-3 ${style.muted}`}>
              {newsletter.cta.text}
            </p>
            <button className={`px-6 py-2.5 rounded-lg text-white text-sm font-medium ${style.accent}`}>
              {newsletter.cta.buttonLabel}
            </button>
          </div>

          {/* Footer */}
          <p className={`text-xs text-center ${style.muted}`}>
            {newsletter.footer}
          </p>
        </div>
      </div>
    </div>
  );
};
