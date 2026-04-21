"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Image from "next/image";
import {
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from "lucide-react";

type Chapter = {
  title: string;
  narration: string;
  imagePrompt?: string;
  imageUrl?: string;
  audioUrl?: string;
  duration?: number;
};

const CARD_STYLE: React.CSSProperties = {
  background: "var(--fm-surface)",
  border: "1px solid var(--fm-surface-border)",
  borderRadius: "1rem",
  padding: "1.25rem",
};

const formatTime = (s: number): string => {
  if (!Number.isFinite(s) || s < 0) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
};

export const VideoPlayer = ({
  fileUrl,
  title,
  status,
  chapters,
}: {
  fileUrl: string | null;
  title: string;
  status: string;
  chapters?: Chapter[];
}): React.ReactNode => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [activeChapter, setActiveChapter] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [chapterDuration, setChapterDuration] = useState(0);

  const hasChapters = Array.isArray(chapters) && chapters.length > 0;
  const hasSlideshow =
    hasChapters && chapters!.some((c) => c.audioUrl && c.imageUrl);
  const currentChapter =
    hasChapters && chapters![activeChapter] ? chapters![activeChapter] : null;

  const goToChapter = useCallback(
    (index: number): void => {
      if (!hasChapters) return;
      const clamped = Math.max(0, Math.min(chapters!.length - 1, index));
      setActiveChapter(clamped);
      setCurrentTime(0);
    },
    [hasChapters, chapters],
  );

  const handleEnded = useCallback((): void => {
    if (!hasChapters) return;
    if (activeChapter < chapters!.length - 1) {
      setActiveChapter(activeChapter + 1);
      setCurrentTime(0);
    } else {
      setIsPlaying(false);
    }
  }, [activeChapter, chapters, hasChapters]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTime = (): void => setCurrentTime(audio.currentTime);
    const onMeta = (): void => setChapterDuration(audio.duration);
    const onPlay = (): void => setIsPlaying(true);
    const onPause = (): void => setIsPlaying(false);
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
    };
  }, [activeChapter, hasSlideshow]);

  const togglePlay = useCallback((): void => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      void audio.play();
    } else {
      audio.pause();
    }
  }, []);

  const seek = useCallback((fraction: number): void => {
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(audio.duration)) return;
    audio.currentTime = Math.max(0, Math.min(1, fraction)) * audio.duration;
  }, []);

  // Loading state
  if (status === "generating" || status === "pending") {
    return (
      <div style={CARD_STYLE}>
        <div className="text-center py-8">
          <Loader2
            className="h-8 w-8 mx-auto mb-4 animate-spin"
            style={{ color: "var(--fm-accent-orange)" }}
          />
          <h3
            className="font-medium mb-2"
            style={{ color: "var(--fm-text)" }}
          >
            Generating Video Overview
          </h3>
          <p className="text-sm" style={{ color: "var(--fm-text-secondary)" }}>
            This may take a few minutes...
          </p>
        </div>
      </div>
    );
  }

  // Slideshow mode
  if (hasSlideshow && currentChapter) {
    const totalDuration = chapters!.reduce(
      (acc, c) => acc + (typeof c.duration === "number" ? c.duration : 0),
      0,
    );
    const progress =
      chapterDuration > 0 ? currentTime / chapterDuration : 0;

    return (
      <div style={CARD_STYLE}>
        <h3
          className="text-lg font-bold mb-4"
          style={{ color: "var(--fm-text)" }}
        >
          {title}
        </h3>

        <div
          className="relative rounded-xl overflow-hidden aspect-video"
          style={{
            background: "var(--fm-surface-hover)",
            border: "1px solid var(--fm-surface-border)",
          }}
        >
          {currentChapter.imageUrl ? (
            <Image
              src={currentChapter.imageUrl}
              alt={currentChapter.title}
              fill
              sizes="(max-width: 768px) 100vw, 720px"
              className="object-cover"
              priority
            />
          ) : null}
        </div>

        <div className="mt-4">
          <h4
            className="text-xs font-medium mb-1"
            style={{ color: "var(--fm-accent-orange)" }}
          >
            Chapter {activeChapter + 1} of {chapters!.length}
          </h4>
          <h5
            className="text-base font-semibold mb-2"
            style={{ color: "var(--fm-text)" }}
          >
            {currentChapter.title}
          </h5>
          <p
            className="text-sm"
            style={{ color: "var(--fm-text-secondary)" }}
          >
            {currentChapter.narration}
          </p>
        </div>

        {/* Audio element (hidden, controlled via custom UI) */}
        <audio
          ref={audioRef}
          src={currentChapter.audioUrl}
          autoPlay
          onEnded={handleEnded}
          preload="auto"
        />

        {/* Progress bar - tracks current chapter's audio */}
        <div className="mt-4">
          <div
            className="h-1.5 rounded-full cursor-pointer"
            style={{ background: "var(--fm-surface-hover)" }}
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              seek((e.clientX - rect.left) / rect.width);
            }}
          >
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${progress * 100}%`,
                background: "var(--fm-accent-orange)",
              }}
            />
          </div>
          <div
            className="flex items-center justify-between mt-1.5 text-xs font-mono"
            style={{
              color: "var(--fm-text-tertiary)",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            <span>
              {formatTime(currentTime)} / {formatTime(chapterDuration)}
            </span>
            {totalDuration > 0 && (
              <span>Total: {formatTime(totalDuration)}</span>
            )}
          </div>
        </div>

        {/* Controls */}
        <div className="mt-3 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => goToChapter(activeChapter - 1)}
            disabled={activeChapter === 0}
            className="p-2 rounded-full transition-opacity disabled:opacity-40"
            style={{
              background: "var(--fm-surface-hover)",
              color: "var(--fm-text)",
            }}
            aria-label="Previous chapter"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={togglePlay}
            className="p-3 rounded-full"
            style={{
              background: "var(--fm-accent-orange)",
              color: "white",
            }}
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? (
              <Pause className="h-5 w-5" />
            ) : (
              <Play className="h-5 w-5" />
            )}
          </button>
          <button
            type="button"
            onClick={() => goToChapter(activeChapter + 1)}
            disabled={activeChapter >= chapters!.length - 1}
            className="p-2 rounded-full transition-opacity disabled:opacity-40"
            style={{
              background: "var(--fm-surface-hover)",
              color: "var(--fm-text)",
            }}
            aria-label="Next chapter"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* Thumbnail strip */}
        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          {chapters!.map((ch, i) => (
            <button
              key={i}
              type="button"
              onClick={() => goToChapter(i)}
              className="flex-shrink-0 rounded-lg overflow-hidden transition-all"
              style={{
                width: 96,
                height: 54,
                border:
                  i === activeChapter
                    ? "2px solid var(--fm-accent-orange)"
                    : "1px solid var(--fm-surface-border)",
                opacity: i === activeChapter ? 1 : 0.6,
                background: "var(--fm-surface-hover)",
              }}
              aria-label={`Jump to chapter ${i + 1}: ${ch.title}`}
            >
              {ch.imageUrl ? (
                <Image
                  src={ch.imageUrl}
                  alt={ch.title}
                  fill
                  sizes="128px"
                  className="object-cover"
                />
              ) : (
                <div
                  className="w-full h-full flex items-center justify-center text-xs"
                  style={{ color: "var(--fm-text-tertiary)" }}
                >
                  {i + 1}
                </div>
              )}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Script-only mode (chapters without audio)
  if (hasChapters) {
    return (
      <div style={CARD_STYLE}>
        <h3
          className="text-lg font-bold mb-4"
          style={{ color: "var(--fm-text)" }}
        >
          {title}
        </h3>
        <div className="space-y-4">
          {chapters!.map((ch, i) => (
            <div
              key={i}
              className="rounded-xl p-4"
              style={{
                background: "var(--fm-surface-hover)",
                border: "1px solid var(--fm-surface-border)",
              }}
            >
              <h4
                className="font-medium text-sm mb-1"
                style={{ color: "var(--fm-accent-orange)" }}
              >
                Chapter {i + 1}: {ch.title}
              </h4>
              <p
                className="text-sm mb-2"
                style={{ color: "var(--fm-text-secondary)" }}
              >
                {ch.narration}
              </p>
              {ch.imagePrompt && (
                <p
                  className="text-xs italic"
                  style={{ color: "var(--fm-text-tertiary)" }}
                >
                  Image: {ch.imagePrompt}
                </p>
              )}
              {ch.imageUrl && (
                <Image
                  src={ch.imageUrl}
                  alt={ch.title}
                  width={1280}
                  height={720}
                  sizes="(max-width: 768px) 100vw, 720px"
                  className="mt-2 rounded-lg w-full h-auto aspect-video object-cover"
                />
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Empty/fallback
  return (
    <div style={CARD_STYLE}>
      <h3
        className="text-lg font-bold mb-2"
        style={{ color: "var(--fm-text)" }}
      >
        {title}
      </h3>
      <p style={{ color: "var(--fm-text-secondary)" }}>
        {fileUrl
          ? "Video available."
          : "Video script generated. Configure FAL_KEY and ELEVENLABS_API_KEY for full video generation."}
      </p>
    </div>
  );
};
