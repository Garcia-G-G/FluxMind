"use client";

import { useState } from "react";
import { Copy, Check, Clock, Music } from "lucide-react";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { ReelContent } from "@/app/api/studio/reel/route";

const sectionColors: Record<string, string> = {
  hook: "bg-red-500",
  content: "bg-blue-500",
  cta: "bg-green-500",
};

const sectionLabels: Record<string, string> = {
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

  const totalDuration = reel.sections.reduce((sum, s) => sum + s.duration, 0);

  const handleCopyScript = async (): Promise<void> => {
    const text = reel.sections
      .map(
        (s) =>
          `[${sectionLabels[s.type]} - ${s.duration}s]\n${s.text}\nVisual: ${s.visualSuggestion}`
      )
      .join("\n\n");
    const full = `${reel.title}\nDuration: ~${totalDuration}s\n\n${text}\n\nCaption: ${reel.caption}\nMusic: ${reel.musicSuggestion}`;
    await navigator.clipboard.writeText(full);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-lg mx-auto">
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            ~{totalDuration}s
          </span>
        </div>
        <Button variant="outline" size="sm" onClick={handleCopyScript} className="gap-1.5">
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copied" : "Copy Script"}
        </Button>
      </div>

      {/* Timeline bar */}
      <div className="flex rounded-full overflow-hidden h-2 mb-6">
        {reel.sections.map((section, i) => (
          <div
            key={i}
            className={`${sectionColors[section.type]} transition-all`}
            style={{ width: `${(section.duration / totalDuration) * 100}%` }}
            title={`${sectionLabels[section.type]}: ${section.duration}s`}
          />
        ))}
      </div>

      {/* Phone mockup */}
      <div className="mx-auto w-72 rounded-[2rem] border-4 border-zinc-800 dark:border-zinc-600 bg-black overflow-hidden">
        <div className="aspect-[9/16] p-4 flex flex-col justify-between relative">
          {/* Sections */}
          <div className="flex-1 flex flex-col justify-center space-y-4">
            {reel.sections.map((section, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.15 }}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Badge className={`${sectionColors[section.type]} text-white text-[10px] px-1.5 py-0`}>
                    {sectionLabels[section.type]}
                  </Badge>
                  <span className="text-[10px] text-zinc-500">{section.duration}s</span>
                </div>
                <p className="text-white text-xs leading-relaxed">
                  {section.text}
                </p>
                <p className="text-zinc-500 text-[10px] mt-1 italic">
                  Visual: {section.visualSuggestion}
                </p>
              </motion.div>
            ))}
          </div>

          {/* Bottom bar */}
          <div className="pt-3 border-t border-zinc-800">
            <p className="text-zinc-400 text-[10px] leading-relaxed line-clamp-2">
              {reel.caption}
            </p>
            <div className="flex items-center gap-1 mt-1.5">
              <Music className="h-3 w-3 text-zinc-500" />
              <span className="text-[10px] text-zinc-500">
                {reel.musicSuggestion}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
