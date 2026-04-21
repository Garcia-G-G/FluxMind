"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Maximize,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { NarrationPlayer } from "@/components/studio/narration-player";
import type { SlidesContent } from "@/app/api/studio/slides/route";

const ACCENT_VAR: Record<string, string> = {
  orange: "var(--fm-accent-orange)",
  violet: "var(--fm-accent-violet)",
  blue: "var(--fm-accent-blue)",
  rose: "var(--fm-accent-rose)",
  emerald: "#22c55e",
  amber: "#f59e0b",
};

type Props = { slides: SlidesContent & { id?: string } };

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

const safeName = (s: string): string =>
  (s || "slide").replace(/[^a-z0-9-_ ]/gi, "_");

export const SlideViewer = ({ slides }: Props): React.ReactNode => {
  const [index, setIndex] = useState<number>(0);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  const total = slides.slides.length;
  const current = slides.slides[index];
  const accent = ACCENT_VAR[slides.accent] ?? ACCENT_VAR.orange;

  const goTo = useCallback(
    (next: number): void => {
      if (next < 0 || next >= total) return;
      setIndex(next);
    },
    [total],
  );

  useEffect(() => {
    const handleKey = (e: KeyboardEvent): void => {
      if (e.key === "ArrowRight") {
        e.preventDefault();
        setIndex((i) => (i + 1 < total ? i + 1 : i));
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        setIndex((i) => (i - 1 >= 0 ? i - 1 : i));
      } else if (e.key === "Escape") {
        setIsFullscreen(false);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [total]);

  const handleDownload = (): void => {
    if (!current?.imageUrl) return;
    void downloadImage(
      current.imageUrl,
      `${safeName(slides.deckTitle)}-${current.id}.png`,
    );
  };

  if (!total || !current) {
    return (
      <div
        className="rounded-xl p-6"
        style={{
          background: "var(--fm-surface)",
          border: "1px solid var(--fm-surface-border)",
        }}
      >
        <p style={{ color: "var(--fm-text-secondary)" }}>
          No slides to display.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Header strip */}
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="min-w-0">
          <h2
            className="font-semibold text-lg truncate"
            style={{ color: "var(--fm-text)" }}
          >
            {slides.deckTitle}
          </h2>
          <p
            className="text-sm truncate"
            style={{ color: "var(--fm-text-secondary)" }}
          >
            {slides.deckSubtitle}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="text-sm font-medium tabular-nums"
            style={{ color: "var(--fm-text-secondary)" }}
          >
            {index + 1} / {total}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownload}
            disabled={!current.imageUrl}
          >
            <Download className="h-4 w-4 mr-1.5" />
            Download
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsFullscreen(true)}
            disabled={!current.imageUrl}
          >
            <Maximize className="h-4 w-4 mr-1.5" />
            Fullscreen
          </Button>
        </div>
      </div>

      {/* Narration player */}
      {slides.id && (
        <NarrationPlayer
          outputId={slides.id}
          existingAudioUrl={slides.audioUrl ?? null}
        />
      )}

      {/* Error banner */}
      {slides.error && (
        <div
          className="rounded-lg p-3 mb-3 text-sm"
          style={{
            background: "var(--fm-surface)",
            border: "1px solid var(--fm-surface-border)",
            color: "var(--fm-error, #dc2626)",
          }}
        >
          {slides.error}
        </div>
      )}

      {/* Main slide area */}
      <div className="relative">
        <div
          className="rounded-xl overflow-hidden relative"
          style={{
            background: "var(--fm-surface)",
            border: "1px solid var(--fm-surface-border)",
          }}
        >
          {current.imageUrl ? (
            <Image
              src={current.imageUrl}
              alt={current.title}
              width={1280}
              height={1600}
              sizes="(max-width: 768px) 100vw, 800px"
              className="w-full h-auto block cursor-zoom-in"
              priority={index === 0}
              onClick={() => setIsFullscreen(true)}
            />
          ) : (
            <div className="p-8">
              <h3
                className="font-semibold text-xl mb-1"
                style={{ color: "var(--fm-text)" }}
              >
                {current.title}
              </h3>
              {current.subtitle && (
                <p
                  className="text-sm mb-4"
                  style={{ color: "var(--fm-text-secondary)" }}
                >
                  {current.subtitle}
                </p>
              )}
              <p
                className="text-xs mb-3 italic"
                style={{ color: "var(--fm-text-tertiary)" }}
              >
                Image unavailable — showing key points
              </p>
              <ul className="space-y-2">
                {current.keyPoints.map((p, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-sm leading-relaxed"
                    style={{ color: "var(--fm-text)" }}
                  >
                    <span
                      className="h-1.5 w-1.5 rounded-full mt-[7px] shrink-0"
                      style={{ background: accent }}
                    />
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Prev / Next arrows */}
        {index > 0 && (
          <button
            type="button"
            onClick={() => goTo(index - 1)}
            aria-label="Previous slide"
            className="absolute left-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full flex items-center justify-center"
            style={{
              background: "var(--fm-surface)",
              border: "1px solid var(--fm-surface-border)",
              color: "var(--fm-text)",
            }}
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        )}
        {index < total - 1 && (
          <button
            type="button"
            onClick={() => goTo(index + 1)}
            aria-label="Next slide"
            className="absolute right-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full flex items-center justify-center"
            style={{
              background: "var(--fm-surface)",
              border: "1px solid var(--fm-surface-border)",
              color: "var(--fm-text)",
            }}
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Key points under image */}
      {current.keyPoints.length > 0 && current.imageUrl && (
        <div
          className="mt-4 rounded-lg p-4"
          style={{
            background: "var(--fm-surface)",
            border: "1px solid var(--fm-surface-border)",
          }}
        >
          <p
            className="text-xs uppercase tracking-wide mb-2 font-semibold"
            style={{ color: "var(--fm-text-tertiary)" }}
          >
            {current.title}
          </p>
          <ul className="space-y-1.5">
            {current.keyPoints.map((p, i) => (
              <li
                key={i}
                className="flex items-start gap-2 text-sm leading-relaxed"
                style={{ color: "var(--fm-text-secondary)" }}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full mt-[7px] shrink-0"
                  style={{ background: accent }}
                />
                {p}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Thumbnail strip */}
      <div
        className="mt-4 rounded-lg p-2 overflow-x-auto"
        style={{
          background: "var(--fm-surface)",
          border: "1px solid var(--fm-surface-border)",
        }}
      >
        <div className="flex gap-2">
          {slides.slides.map((s, i) => {
            const isActive = i === index;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => goTo(i)}
                aria-label={`Go to slide ${i + 1}: ${s.title}`}
                aria-current={isActive ? "true" : undefined}
                className="shrink-0 rounded-md overflow-hidden relative text-left"
                style={{
                  width: 120,
                  height: 150,
                  border: isActive
                    ? `2px solid ${accent}`
                    : "1px solid var(--fm-surface-border)",
                  background: "var(--fm-surface-hover, var(--fm-surface))",
                }}
              >
                {s.imageUrl ? (
                  <Image
                    src={s.imageUrl}
                    alt={s.title}
                    width={120}
                    height={150}
                    sizes="120px"
                    className="w-full h-full object-cover block"
                  />
                ) : (
                  <div
                    className="w-full h-full flex flex-col items-center justify-center p-2 text-center"
                    style={{ color: "var(--fm-text-tertiary)" }}
                  >
                    <span className="text-[10px] uppercase tracking-wide mb-1">
                      {s.layout}
                    </span>
                    <span
                      className="text-[11px] font-medium line-clamp-3"
                      style={{ color: "var(--fm-text-secondary)" }}
                    >
                      {s.title}
                    </span>
                  </div>
                )}
                <div
                  className="absolute bottom-0 left-0 right-0 px-1.5 py-0.5 text-[10px] font-semibold"
                  style={{
                    background: isActive ? accent : "rgba(0,0,0,0.55)",
                    color: "white",
                  }}
                >
                  {i + 1}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Fullscreen overlay */}
      {isFullscreen && current.imageUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.92)" }}
          onClick={() => setIsFullscreen(false)}
          role="dialog"
          aria-modal="true"
          aria-label={`${current.title} fullscreen`}
        >
          <Image
            src={current.imageUrl}
            alt={current.title}
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
          {/* Fullscreen nav arrows */}
          {index > 0 && (
            <button
              type="button"
              className="absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full"
              style={{
                background: "rgba(255,255,255,0.1)",
                color: "white",
              }}
              onClick={(e) => {
                e.stopPropagation();
                goTo(index - 1);
              }}
              aria-label="Previous slide"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
          )}
          {index < total - 1 && (
            <button
              type="button"
              className="absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full"
              style={{
                background: "rgba(255,255,255,0.1)",
                color: "white",
              }}
              onClick={(e) => {
                e.stopPropagation();
                goTo(index + 1);
              }}
              aria-label="Next slide"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          )}
        </div>
      )}
    </div>
  );
};
