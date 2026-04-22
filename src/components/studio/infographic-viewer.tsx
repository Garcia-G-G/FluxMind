"use client";

import { useState } from "react";
import Image from "next/image";
import { motion } from "motion/react";
import { Download, Maximize, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NarrationPlayer } from "@/components/studio/narration-player";
import type { InfographicContent } from "@/app/api/studio/infographic/route";

type Props = { infographic: InfographicContent & { id?: string } };

const downloadImage = async (
  url: string,
  filename: string,
): Promise<void> => {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(objectUrl);
  } catch (e) {
    console.error("download failed", e);
  }
};

export const InfographicViewer = ({
  infographic,
}: Props): React.ReactNode => {
  const [isFullscreen, setIsFullscreen] = useState(false);

  const hasImage = Boolean(infographic.imageUrl);
  const safeFilename = `${(infographic.title || "infographic").replace(/[^a-z0-9-_ ]/gi, "_")}.png`;

  if (!hasImage) {
    return (
      <div
        className="rounded-xl p-6"
        style={{
          background: "var(--fm-surface)",
          border: "1px solid var(--fm-surface-border)",
        }}
      >
        <h2
          className="font-semibold text-lg mb-1"
          style={{ color: "var(--fm-text)" }}
        >
          {infographic.title}
        </h2>
        <p
          className="text-sm mb-3"
          style={{ color: "var(--fm-text-secondary)" }}
        >
          {infographic.subtitle}
        </p>
        <p
          className="text-sm mb-4"
          style={{ color: "var(--fm-error, #dc2626)" }}
        >
          {infographic.error
            ? `Image unavailable: ${infographic.error}`
            : "Image generation unavailable — text content below."}
        </p>

        {infographic.keyStats && infographic.keyStats.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            {infographic.keyStats.map((stat, i) => (
              <div
                key={i}
                className="rounded-lg p-4"
                style={{
                  background:
                    "color-mix(in srgb, var(--fm-accent-orange) 8%, transparent)",
                  border:
                    "1px solid color-mix(in srgb, var(--fm-accent-orange) 25%, transparent)",
                }}
              >
                <p
                  className="text-2xl font-bold"
                  style={{ color: "var(--fm-accent-orange)" }}
                >
                  {stat.value}
                </p>
                <p
                  className="text-xs mt-1"
                  style={{ color: "var(--fm-text-tertiary)" }}
                >
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        )}

        {infographic.sections && infographic.sections.length > 0 && (
          <div className="space-y-3">
            {infographic.sections.map((section, i) => (
              <div
                key={i}
                className="rounded-lg overflow-hidden"
                style={{
                  background:
                    "var(--fm-surface-hover, var(--fm-surface))",
                  border: "1px solid var(--fm-surface-border)",
                }}
              >
                {/* Accent header bar — 3px tall stripe at the top of each card */}
                <div
                  style={{
                    height: "3px",
                    background: "var(--fm-accent-orange)",
                  }}
                />
                <div className="p-3">
                  <p
                    className="font-medium text-sm"
                    style={{ color: "var(--fm-text)" }}
                  >
                    {section.heading}
                  </p>
                  <p
                    className="text-sm mt-1 leading-relaxed"
                    style={{ color: "var(--fm-text-secondary)" }}
                  >
                    {section.summary}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div>
          <h2
            className="font-semibold text-lg"
            style={{ color: "var(--fm-text)" }}
          >
            {infographic.title}
          </h2>
          <p
            className="text-sm"
            style={{ color: "var(--fm-text-secondary)" }}
          >
            {infographic.subtitle}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              downloadImage(infographic.imageUrl, safeFilename)
            }
          >
            <Download className="h-4 w-4 mr-1.5" />
            Download
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsFullscreen(true)}
          >
            <Maximize className="h-4 w-4 mr-1.5" />
            Fullscreen
          </Button>
        </div>
      </div>

      {/* Narration player */}
      {infographic.id && (
        <NarrationPlayer
          outputId={infographic.id}
          existingAudioUrl={(infographic as { audioUrl?: string | null }).audioUrl ?? null}
        />
      )}

      {/* Image — fade in on mount so large composites don't pop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4 }}
        className="rounded-xl overflow-hidden"
        style={{
          background: "var(--fm-surface)",
          border: "1px solid var(--fm-surface-border)",
        }}
      >
        <Image
          src={infographic.imageUrl}
          alt={infographic.title}
          width={1280}
          height={1600}
          sizes="(max-width: 768px) 100vw, 800px"
          className="w-full h-auto block cursor-zoom-in"
          priority
          onClick={() => setIsFullscreen(true)}
        />
      </motion.div>

      {/* Key stats */}
      {infographic.keyStats && infographic.keyStats.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
          {infographic.keyStats.map((stat, i) => (
            <div
              key={i}
              className="rounded-lg p-3"
              style={{
                background: "var(--fm-surface)",
                border: "1px solid var(--fm-surface-border)",
              }}
            >
              <p
                className="text-xl font-bold"
                style={{ color: "var(--fm-text)" }}
              >
                {stat.value}
              </p>
              <p
                className="text-xs mt-0.5"
                style={{ color: "var(--fm-text-tertiary)" }}
              >
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Sections (a11y + SEO) */}
      {infographic.sections && infographic.sections.length > 0 && (
        <div className="mt-4 space-y-2">
          {infographic.sections.map((section, i) => (
            <details
              key={i}
              className="text-sm rounded-lg p-3"
              style={{
                background: "var(--fm-surface)",
                border: "1px solid var(--fm-surface-border)",
              }}
            >
              <summary
                className="font-medium cursor-pointer"
                style={{ color: "var(--fm-text)" }}
              >
                {section.heading}
              </summary>
              <p
                className="mt-2 leading-relaxed"
                style={{ color: "var(--fm-text-secondary)" }}
              >
                {section.summary}
              </p>
            </details>
          ))}
        </div>
      )}

      {/* Fullscreen overlay */}
      {isFullscreen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.92)" }}
          onClick={() => setIsFullscreen(false)}
          role="dialog"
          aria-modal="true"
          aria-label={`${infographic.title} fullscreen`}
        >
          <Image
            src={infographic.imageUrl}
            alt={infographic.title}
            width={1280}
            height={1600}
            sizes="100vw"
            className="max-w-full max-h-full w-auto h-auto object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            type="button"
            className="absolute top-4 right-4 p-2 rounded-lg"
            style={{
              background: "rgba(255,255,255,0.1)",
              color: "white",
            }}
            onClick={(e) => {
              e.stopPropagation();
              setIsFullscreen(false);
            }}
            aria-label="Close fullscreen"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      )}
    </div>
  );
};
