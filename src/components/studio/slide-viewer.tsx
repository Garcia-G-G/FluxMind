"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Maximize,
  Minimize,
  FileText,
  Download,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "@/components/ui/button";
import type { SlidesContent } from "@/app/api/studio/slides/route";

type Slide = SlidesContent["slides"][number];

const SlideContent = ({ slide }: { slide: Slide }): React.ReactNode => {
  switch (slide.layout) {
    case "title":
      return (
        <div className="flex flex-col items-center justify-center h-full bg-gradient-to-br from-primary/10 via-background to-primary/5 p-12 text-center">
          <h1 className="text-4xl font-bold mb-4">{slide.title}</h1>
          {slide.subtitle && (
            <p className="text-xl text-muted-foreground">{slide.subtitle}</p>
          )}
        </div>
      );
    case "content":
      return (
        <div className="flex flex-col h-full p-10">
          <h2 className="text-2xl font-bold mb-6">{slide.title}</h2>
          {slide.bullets && (
            <ul className="space-y-3 flex-1">
              {slide.bullets.map((bullet, i) => (
                <li key={i} className="flex items-start gap-3 text-base">
                  <span className="h-2 w-2 rounded-full bg-primary mt-2 shrink-0" />
                  {bullet}
                </li>
              ))}
            </ul>
          )}
        </div>
      );
    case "two_column":
      return (
        <div className="flex flex-col h-full p-10">
          <h2 className="text-2xl font-bold mb-6">{slide.title}</h2>
          <div className="grid grid-cols-2 gap-8 flex-1">
            {slide.leftColumn && (
              <div>
                <h3 className="font-semibold mb-3 text-primary">
                  {slide.leftColumn.heading}
                </h3>
                <ul className="space-y-2">
                  {slide.leftColumn.points.map((p, i) => (
                    <li key={i} className="text-sm flex items-start gap-2">
                      <span className="text-primary mt-1">-</span> {p}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {slide.rightColumn && (
              <div>
                <h3 className="font-semibold mb-3 text-primary">
                  {slide.rightColumn.heading}
                </h3>
                <ul className="space-y-2">
                  {slide.rightColumn.points.map((p, i) => (
                    <li key={i} className="text-sm flex items-start gap-2">
                      <span className="text-primary mt-1">-</span> {p}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      );
    case "quote":
      return (
        <div className="flex flex-col items-center justify-center h-full p-12 bg-muted/30">
          <blockquote className="text-2xl italic text-center max-w-2xl leading-relaxed">
            &ldquo;{slide.quote}&rdquo;
          </blockquote>
          {slide.attribution && (
            <p className="mt-6 text-sm text-muted-foreground">
              — {slide.attribution}
            </p>
          )}
        </div>
      );
    case "stat":
      return (
        <div className="flex flex-col items-center justify-center h-full p-12">
          <p className="text-6xl font-bold text-primary mb-4">{slide.stat}</p>
          <p className="text-xl text-muted-foreground text-center max-w-md">
            {slide.description}
          </p>
        </div>
      );
    case "closing":
      return (
        <div className="flex flex-col items-center justify-center h-full bg-gradient-to-br from-primary/10 via-background to-primary/5 p-12 text-center">
          <h2 className="text-3xl font-bold mb-4">
            {slide.title ?? "Thank You"}
          </h2>
          {slide.subtitle && (
            <p className="text-lg text-muted-foreground">{slide.subtitle}</p>
          )}
        </div>
      );
    default:
      return (
        <div className="flex items-center justify-center h-full p-10">
          <p className="text-muted-foreground">Unsupported layout</p>
        </div>
      );
  }
};

export const SlideViewer = ({
  slides,
}: {
  slides: SlidesContent;
}): React.ReactNode => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [direction, setDirection] = useState(0);

  const slide = slides.slides[currentIndex];

  const goTo = useCallback(
    (index: number, dir: number) => {
      if (index >= 0 && index < slides.slides.length) {
        setDirection(dir);
        setCurrentIndex(index);
      }
    },
    [slides.slides.length]
  );

  useEffect(() => {
    const handleKey = (e: KeyboardEvent): void => {
      if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        goTo(currentIndex + 1, 1);
      } else if (e.key === "ArrowLeft") {
        goTo(currentIndex - 1, -1);
      } else if (e.key === "Escape") {
        setIsFullscreen(false);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [currentIndex, goTo]);

  const handleExportPdf = async (): Promise<void> => {
    const { jsPDF } = await import("jspdf");
    const pdf = new jsPDF({ orientation: "landscape", unit: "pt", format: [960, 540] });
    slides.slides.forEach((s, i) => {
      if (i > 0) pdf.addPage();
      pdf.setFontSize(24);
      pdf.text(s.title ?? "", 60, 80);
      if (s.bullets) {
        pdf.setFontSize(14);
        s.bullets.forEach((b, j) => {
          pdf.text(`• ${b}`, 80, 130 + j * 28);
        });
      }
      if (s.quote) {
        pdf.setFontSize(16);
        pdf.text(`"${s.quote}"`, 60, 200, { maxWidth: 840 });
      }
      if (s.stat) {
        pdf.setFontSize(48);
        pdf.text(s.stat, 480, 250, { align: "center" });
        if (s.description) {
          pdf.setFontSize(14);
          pdf.text(s.description, 480, 300, { align: "center", maxWidth: 600 });
        }
      }
    });
    pdf.save(`${slides.title}.pdf`);
  };

  const containerClass = isFullscreen
    ? "fixed inset-0 z-50 bg-background flex flex-col"
    : "flex flex-col";

  return (
    <div className={containerClass}>
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border shrink-0">
        <span className="text-sm text-muted-foreground">
          {currentIndex + 1} / {slides.slides.length}
        </span>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-8"
            onClick={() => setShowNotes(!showNotes)}
          >
            <FileText className="h-4 w-4 mr-1" />
            Notes
          </Button>
          <Button variant="ghost" size="sm" className="h-8" onClick={handleExportPdf}>
            <Download className="h-4 w-4 mr-1" />
            PDF
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8"
            onClick={() => setIsFullscreen(!isFullscreen)}
          >
            {isFullscreen ? (
              <Minimize className="h-4 w-4" />
            ) : (
              <Maximize className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Slide area */}
      <div className="flex-1 flex items-center justify-center p-4 min-h-0">
        <div className="relative w-full max-w-4xl aspect-video rounded-lg border border-border bg-card overflow-hidden shadow-sm">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={currentIndex}
              custom={direction}
              initial={{ opacity: 0, x: direction * 100 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: direction * -100 }}
              transition={{ duration: 0.25 }}
              className="absolute inset-0"
            >
              <SlideContent slide={slide} />
            </motion.div>
          </AnimatePresence>

          {/* Navigation overlay */}
          <button
            className="absolute left-0 top-0 bottom-0 w-1/4 cursor-pointer opacity-0 hover:opacity-100 flex items-center justify-start pl-2 transition-opacity"
            onClick={() => goTo(currentIndex - 1, -1)}
            aria-label="Previous slide"
          >
            <ChevronLeft className="h-8 w-8 text-muted-foreground/50" />
          </button>
          <button
            className="absolute right-0 top-0 bottom-0 w-1/4 cursor-pointer opacity-0 hover:opacity-100 flex items-center justify-end pr-2 transition-opacity"
            onClick={() => goTo(currentIndex + 1, 1)}
            aria-label="Next slide"
          >
            <ChevronRight className="h-8 w-8 text-muted-foreground/50" />
          </button>
        </div>
      </div>

      {/* Dot indicators */}
      <div className="flex justify-center gap-1.5 py-2 shrink-0">
        {slides.slides.map((_, i) => (
          <button
            key={i}
            onClick={() => goTo(i, i > currentIndex ? 1 : -1)}
            className={`h-2 rounded-full transition-all ${
              i === currentIndex
                ? "w-6 bg-primary"
                : "w-2 bg-muted-foreground/30 hover:bg-muted-foreground/50"
            }`}
            aria-label={`Go to slide ${i + 1}`}
          />
        ))}
      </div>

      {/* Speaker notes */}
      {showNotes && slide.notes && (
        <div className="border-t border-border p-4 bg-muted/30 text-sm text-muted-foreground max-h-32 overflow-y-auto shrink-0">
          <p className="font-medium text-foreground text-xs mb-1">
            Speaker Notes
          </p>
          {slide.notes}
        </div>
      )}
    </div>
  );
};
