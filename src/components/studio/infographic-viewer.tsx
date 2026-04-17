"use client";

import { useRef, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { InfographicContent } from "@/app/api/studio/infographic/route";

type StylePreset = {
  id: string;
  name: string;
  bg: string;
  card: string;
  text: string;
  accent: string;
  heading: string;
  muted: string;
  border: string;
};

const STYLES: StylePreset[] = [
  { id: "professional", name: "Professional", bg: "bg-white dark:bg-slate-900", card: "bg-slate-50 dark:bg-slate-800", text: "text-slate-900 dark:text-slate-100", accent: "text-blue-600 dark:text-blue-400", heading: "text-slate-800 dark:text-slate-200", muted: "text-slate-500", border: "border-slate-200 dark:border-slate-700" },
  { id: "scientific", name: "Scientific", bg: "bg-stone-50 dark:bg-stone-900", card: "bg-stone-100 dark:bg-stone-800", text: "text-stone-900 dark:text-stone-100", accent: "text-emerald-700 dark:text-emerald-400", heading: "text-stone-800 dark:text-stone-200", muted: "text-stone-500", border: "border-stone-200 dark:border-stone-700" },
  { id: "minimal", name: "Minimal", bg: "bg-white dark:bg-zinc-950", card: "bg-zinc-50 dark:bg-zinc-900", text: "text-zinc-900 dark:text-zinc-100", accent: "text-zinc-900 dark:text-zinc-100", heading: "text-zinc-800 dark:text-zinc-200", muted: "text-zinc-400", border: "border-zinc-200 dark:border-zinc-800" },
  { id: "bold", name: "Bold", bg: "bg-zinc-900 dark:bg-black", card: "bg-zinc-800 dark:bg-zinc-900", text: "text-zinc-100", accent: "text-violet-400", heading: "text-white", muted: "text-zinc-400", border: "border-zinc-700" },
  { id: "neon", name: "Neon", bg: "bg-gray-950", card: "bg-gray-900", text: "text-gray-100", accent: "text-cyan-400", heading: "text-cyan-300", muted: "text-gray-500", border: "border-cyan-900" },
  { id: "editorial", name: "Editorial", bg: "bg-amber-50 dark:bg-amber-950", card: "bg-white dark:bg-amber-900", text: "text-amber-950 dark:text-amber-100", accent: "text-red-700 dark:text-red-400", heading: "text-amber-900 dark:text-amber-200", muted: "text-amber-600 dark:text-amber-400", border: "border-amber-200 dark:border-amber-800" },
];

type Section = InfographicContent["sections"][number];

const SectionRenderer = ({
  section,
  style,
}: {
  section: Section;
  style: StylePreset;
}): React.ReactNode => {
  switch (section.type) {
    case "header":
      return (
        <div className="py-4">
          <h2 className={`text-xl font-bold ${style.heading}`}>
            {section.text}
          </h2>
          <div className={`h-1 w-12 mt-2 rounded ${style.accent.replace("text-", "bg-")}`} />
        </div>
      );
    case "stat":
      return (
        <div className={`rounded-lg p-6 text-center ${style.card} border ${style.border}`}>
          <p className={`text-4xl font-bold ${style.accent}`}>
            {section.value}
          </p>
          <p className={`text-sm mt-2 ${style.muted}`}>{section.label}</p>
        </div>
      );
    case "text":
      return (
        <p className={`text-sm leading-relaxed ${style.text}`}>
          {section.text}
        </p>
      );
    case "comparison":
      return (
        <div className="grid grid-cols-2 gap-3">
          {section.items.map((item, i) => (
            <div
              key={i}
              className={`rounded-lg p-4 text-center ${style.card} border ${style.border}`}
            >
              <p className={`font-semibold ${style.heading}`}>{item.label}</p>
              <p className={`text-sm mt-1 ${style.muted}`}>{item.value}</p>
            </div>
          ))}
        </div>
      );
    case "timeline":
      return (
        <div className="space-y-3 pl-4 border-l-2 border-current" style={{ borderColor: "currentColor" }}>
          {section.events.map((event, i) => (
            <div key={i} className="relative pl-4">
              <div className={`absolute -left-[calc(0.5rem+1px)] top-1.5 h-3 w-3 rounded-full ${style.accent.replace("text-", "bg-")}`} />
              <p className={`text-xs font-medium ${style.accent}`}>
                {event.date}
              </p>
              <p className={`font-medium text-sm ${style.heading}`}>
                {event.title}
              </p>
              <p className={`text-xs ${style.muted}`}>{event.description}</p>
            </div>
          ))}
        </div>
      );
    case "list":
      return (
        <div>
          <h3 className={`font-semibold mb-2 ${style.heading}`}>
            {section.title}
          </h3>
          <ul className="space-y-1.5">
            {section.items.map((item, i) => (
              <li
                key={i}
                className={`flex items-start gap-2 text-sm ${style.text}`}
              >
                <span className={`mt-1.5 h-1.5 w-1.5 rounded-full shrink-0 ${style.accent.replace("text-", "bg-")}`} />
                {item}
              </li>
            ))}
          </ul>
        </div>
      );
    default:
      return null;
  }
};

export const InfographicViewer = ({
  infographic,
}: {
  infographic: InfographicContent;
}): React.ReactNode => {
  const [styleId, setStyleId] = useState("professional");
  const contentRef = useRef<HTMLDivElement>(null);

  const style = STYLES.find((s) => s.id === styleId) ?? STYLES[0];

  const handleExportPng = async (): Promise<void> => {
    if (!contentRef.current) return;
    const html2canvas = (await import("html2canvas-pro")).default;
    const canvas = await html2canvas(contentRef.current, {
      scale: 2,
      useCORS: true,
    });
    const link = document.createElement("a");
    link.download = `${infographic.title}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  return (
    <div>
      {/* Style selector */}
      <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-2">
        {STYLES.map((s) => (
          <button
            key={s.id}
            onClick={() => setStyleId(s.id)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-all shrink-0 ${
              styleId === s.id
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:border-primary/50"
            }`}
          >
            {s.name}
          </button>
        ))}
        <Button
          variant="outline"
          size="sm"
          className="ml-auto shrink-0 gap-1.5"
          onClick={handleExportPng}
        >
          <Download className="h-3.5 w-3.5" />
          PNG
        </Button>
      </div>

      {/* Infographic */}
      <div
        ref={contentRef}
        className={`rounded-xl p-8 max-w-xl mx-auto ${style.bg} border ${style.border}`}
      >
        <div className="text-center mb-8">
          <h1 className={`text-2xl font-bold ${style.heading}`}>
            {infographic.title}
          </h1>
          <p className={`text-sm mt-1 ${style.muted}`}>
            {infographic.subtitle}
          </p>
        </div>

        <div className="space-y-6">
          {infographic.sections.map((section, i) => (
            <SectionRenderer key={i} section={section} style={style} />
          ))}
        </div>

        <div className={`mt-8 pt-4 border-t ${style.border}`}>
          <p className={`text-xs ${style.muted}`}>{infographic.footer}</p>
        </div>
      </div>
    </div>
  );
};
