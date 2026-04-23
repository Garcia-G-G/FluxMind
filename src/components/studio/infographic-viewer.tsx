"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "motion/react";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Maximize,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { NarrationPlayer } from "@/components/studio/narration-player";
import type {
  InfographicContent,
  InfographicPage,
} from "@/app/api/studio/infographic/route";

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
  const [currentPage, setCurrentPage] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Backward compat: if no `pages` array, wrap the single image as page 1
  // so every downstream read treats multi-page as the normal case.
  const pages = useMemo<InfographicPage[]>(() => {
    if (
      Array.isArray(infographic.pages) &&
      infographic.pages.length > 0
    ) {
      return infographic.pages;
    }
    return [
      {
        index: 1,
        title: infographic.title,
        subtitle: infographic.subtitle,
        imageUrl: infographic.imageUrl,
        thumbnailUrl: infographic.thumbnailUrl ?? null,
      },
    ];
  }, [infographic]);

  const totalPages = pages.length;
  const activePage = pages[Math.min(currentPage, totalPages - 1)];

  // Keyboard navigation — arrows step pages, esc closes fullscreen.
  useEffect(() => {
    const handleKey = (e: KeyboardEvent): void => {
      if (e.key === "ArrowRight") {
        e.preventDefault();
        setCurrentPage((i) => (i + 1 < totalPages ? i + 1 : i));
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        setCurrentPage((i) => (i - 1 >= 0 ? i - 1 : i));
      } else if (e.key === "Escape") {
        setIsFullscreen(false);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [totalPages]);

  const hasImage = Boolean(activePage.imageUrl);
  const safeFilename = `${(activePage.title || "infographic").replace(
    /[^a-z0-9-_ ]/gi,
    "_",
  )}-p${activePage.index}.png`;

  // Fallback render — text content only, no image available for any page.
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
                  background: "var(--fm-surface-hover, var(--fm-surface))",
                  border: "1px solid var(--fm-surface-border)",
                }}
              >
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

  const goPrev = (): void =>
    setCurrentPage((i) => Math.max(0, i - 1));
  const goNext = (): void =>
    setCurrentPage((i) => Math.min(totalPages - 1, i + 1));

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div>
          <h2
            className="font-semibold text-lg"
            style={{ color: "var(--fm-text)" }}
          >
            {activePage.title}
          </h2>
          <p
            className="text-sm"
            style={{ color: "var(--fm-text-secondary)" }}
          >
            {activePage.subtitle}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              activePage.imageUrl &&
              downloadImage(activePage.imageUrl, safeFilename)
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

      {/* Narration player — shared across pages for now. */}
      {infographic.id && (
        <NarrationPlayer
          outputId={infographic.id}
          existingAudioUrl={
            (infographic as { audioUrl?: string | null }).audioUrl ?? null
          }
        />
      )}

      {/* Image — animated page swap */}
      <div
        className="rounded-xl overflow-hidden"
        style={{
          background: "var(--fm-surface)",
          border: "1px solid var(--fm-surface-border)",
        }}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={activePage.index}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            {activePage.imageUrl ? (
              <Image
                src={activePage.imageUrl}
                alt={activePage.title}
                width={1280}
                height={1600}
                sizes="(max-width: 768px) 100vw, 800px"
                className="w-full h-auto block cursor-zoom-in"
                priority={currentPage === 0}
                onClick={() => setIsFullscreen(true)}
              />
            ) : (
              <div
                className="w-full aspect-[4/5] flex items-center justify-center"
                style={{ color: "var(--fm-text-tertiary)" }}
              >
                Page unavailable
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Pagination — prev/next + 1/N counter. Hidden for single page. */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-3">
          <button
            type="button"
            onClick={goPrev}
            disabled={currentPage === 0}
            className="w-8 h-8 rounded-lg border flex items-center justify-center transition-colors disabled:opacity-30"
            style={{
              borderColor: "var(--fm-surface-border)",
              color: "var(--fm-text-secondary)",
              background: "var(--fm-surface-elevated)",
            }}
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span
            className="text-sm font-medium tabular-nums"
            style={{ color: "var(--fm-text-secondary)" }}
            aria-live="polite"
          >
            {currentPage + 1} / {totalPages}
          </span>
          <button
            type="button"
            onClick={goNext}
            disabled={currentPage === totalPages - 1}
            className="w-8 h-8 rounded-lg border flex items-center justify-center transition-colors disabled:opacity-30"
            style={{
              borderColor: "var(--fm-surface-border)",
              color: "var(--fm-text-secondary)",
              background: "var(--fm-surface-elevated)",
            }}
            aria-label="Next page"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Thumbnail strip — jump directly to a page. */}
      {totalPages > 1 && (
        <div className="flex gap-2 mt-3 overflow-x-auto pb-2 px-1">
          {pages.map((page, i) => {
            const isActive = i === currentPage;
            return (
              <button
                key={page.index}
                type="button"
                onClick={() => setCurrentPage(i)}
                className="shrink-0 rounded-lg overflow-hidden border-2 transition-all"
                style={{
                  borderColor: isActive
                    ? "var(--fm-accent-orange)"
                    : "var(--fm-surface-border)",
                  opacity: isActive ? 1 : 0.55,
                  background: "var(--fm-surface-elevated)",
                }}
                aria-label={`Page ${page.index}`}
                aria-pressed={isActive}
              >
                {page.thumbnailUrl ? (
                  <Image
                    src={page.thumbnailUrl}
                    alt={`Page ${page.index}`}
                    width={80}
                    height={100}
                    className="object-cover block"
                    loading="lazy"
                  />
                ) : (
                  <div
                    className="w-20 h-[100px] flex items-center justify-center text-xs font-semibold"
                    style={{ color: "var(--fm-text-tertiary)" }}
                  >
                    {page.index}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Key stats (from page 1) */}
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

      {/* Fullscreen overlay — shows the currently active page. */}
      {isFullscreen && activePage.imageUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.92)" }}
          onClick={() => setIsFullscreen(false)}
          role="dialog"
          aria-modal="true"
          aria-label={`${activePage.title} fullscreen`}
        >
          <Image
            src={activePage.imageUrl}
            alt={activePage.title}
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
