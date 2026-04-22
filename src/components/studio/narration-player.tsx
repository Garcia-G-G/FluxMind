"use client";

import { useEffect, useRef, useState } from "react";
import { Play, Pause, Download, Loader2, Sparkles } from "lucide-react";
import { useLanguage } from "@/lib/i18n/language";

const SPEEDS = [1, 1.5, 2] as const;
type Speed = (typeof SPEEDS)[number];

export const NarrationPlayer = ({
  outputId,
  existingAudioUrl,
}: {
  outputId: string;
  existingAudioUrl?: string | null;
}): React.ReactNode => {
  const { language } = useLanguage();
  const [audioUrl, setAudioUrl] = useState<string | null>(
    existingAudioUrl ?? null,
  );
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [speed, setSpeed] = useState<Speed>(1);

  // Drag-seek state. While dragging, we suspend the <audio>'s timeupdate
  // from writing into `progress` so the scrub feels smooth — we only
  // commit `currentTime` on mouseup.
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragProgress, setDragProgress] = useState<number>(0);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const handleGenerate = async (): Promise<void> => {
    setIsGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/studio/narrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outputId, language }),
      });
      if (!res.ok) {
        const j = (await res
          .json()
          .catch(() => ({ error: res.statusText }))) as { error?: string };
        throw new Error(j.error ?? "Failed");
      }
      const data = (await res.json()) as { audioUrl: string };
      setAudioUrl(data.audioUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setIsGenerating(false);
    }
  };

  const togglePlay = (): void => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) {
      void a.play();
      setIsPlaying(true);
    } else {
      a.pause();
      setIsPlaying(false);
    }
  };

  const setSpeedAndApply = (next: Speed): void => {
    setSpeed(next);
    if (audioRef.current) audioRef.current.playbackRate = next;
  };

  const formatTime = (sec: number): string => {
    if (!Number.isFinite(sec)) return "0:00";
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onTime = (): void => {
      if (!isDragging) setProgress(a.currentTime);
    };
    const onMeta = (): void => setDuration(a.duration);
    const onEnded = (): void => setIsPlaying(false);
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("loadedmetadata", onMeta);
    a.addEventListener("ended", onEnded);
    return () => {
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("loadedmetadata", onMeta);
      a.removeEventListener("ended", onEnded);
    };
  }, [audioUrl, isDragging]);

  // Global mouse listeners while dragging so a drag that leaves the track
  // still tracks correctly.
  useEffect(() => {
    if (!isDragging) return;
    const onMove = (e: MouseEvent): void => {
      const track = trackRef.current;
      if (!track || !duration) return;
      const rect = track.getBoundingClientRect();
      const pct = Math.max(
        0,
        Math.min(1, (e.clientX - rect.left) / rect.width),
      );
      setDragProgress(pct * duration);
    };
    const onUp = (): void => {
      const a = audioRef.current;
      if (a && duration) {
        a.currentTime = Math.max(0, Math.min(duration, dragProgress));
        setProgress(dragProgress);
      }
      setIsDragging(false);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [isDragging, duration, dragProgress]);

  if (!audioUrl) {
    return (
      <div
        className="flex items-center justify-between gap-3 rounded-lg p-3 mb-3"
        style={{
          background: "var(--fm-surface)",
          border: "1px solid var(--fm-surface-border)",
        }}
      >
        <div className="flex items-center gap-2">
          <Sparkles
            className="h-4 w-4"
            style={{ color: "var(--fm-accent-orange)" }}
          />
          <span
            className="text-sm"
            style={{ color: "var(--fm-text-secondary)" }}
          >
            Listen to an explanation of this output
          </span>
        </div>
        <div className="flex items-center gap-2">
          {error && (
            <span
              className="text-xs"
              style={{ color: "var(--fm-error)" }}
            >
              Couldn&apos;t generate audio: {error}
            </span>
          )}
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white rounded-lg disabled:opacity-60"
            style={{ background: "var(--fm-accent-orange)" }}
            aria-label={
              isGenerating ? "Generating narration" : "Generate narration"
            }
          >
            {isGenerating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            {isGenerating
              ? "Generating narration\u2026"
              : error
                ? "Retry"
                : "Generate audio"}
          </button>
        </div>
      </div>
    );
  }

  const displayProgress = isDragging ? dragProgress : progress;
  const pctWidth =
    duration > 0 ? `${(displayProgress / duration) * 100}%` : "0%";

  return (
    <div
      className="flex items-center gap-3 rounded-lg p-3 mb-3"
      style={{
        background: "var(--fm-surface)",
        border: "1px solid var(--fm-surface-border)",
      }}
    >
      <audio ref={audioRef} src={audioUrl} preload="metadata" />
      <button
        onClick={togglePlay}
        className="flex items-center justify-center h-9 w-9 rounded-full text-white shrink-0"
        style={{ background: "var(--fm-accent-orange)" }}
        aria-label={isPlaying ? "Pause" : "Play"}
      >
        {isPlaying ? (
          <Pause className="h-4 w-4" />
        ) : (
          <Play className="h-4 w-4 ml-0.5" />
        )}
      </button>
      <div className="flex-1 min-w-0">
        <div
          ref={trackRef}
          role="slider"
          aria-label="Seek"
          aria-valuemin={0}
          aria-valuemax={duration || 0}
          aria-valuenow={displayProgress}
          tabIndex={0}
          className="rounded-full overflow-hidden cursor-pointer"
          style={{
            height: 6,
            background: "var(--fm-surface-border)",
          }}
          onMouseDown={(e) => {
            const a = audioRef.current;
            if (!a || !duration) return;
            const rect = e.currentTarget.getBoundingClientRect();
            const pct = Math.max(
              0,
              Math.min(1, (e.clientX - rect.left) / rect.width),
            );
            setDragProgress(pct * duration);
            setIsDragging(true);
          }}
          onKeyDown={(e) => {
            const a = audioRef.current;
            if (!a) return;
            if (e.key === "ArrowRight") {
              a.currentTime = Math.min(duration, a.currentTime + 5);
            } else if (e.key === "ArrowLeft") {
              a.currentTime = Math.max(0, a.currentTime - 5);
            }
          }}
        >
          <div
            className="h-full"
            style={{
              width: pctWidth,
              background: "var(--fm-accent-orange)",
              transition: isDragging ? "none" : "width 60ms linear",
            }}
          />
        </div>
        <div
          className="flex justify-between mt-1 text-[11px]"
          style={{ color: "var(--fm-text-tertiary)" }}
        >
          <span>{formatTime(displayProgress)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Segmented speed control */}
      <div
        className="inline-flex rounded-md p-0.5"
        role="group"
        aria-label="Playback speed"
        style={{
          background: "var(--fm-surface-elevated)",
          border: "1px solid var(--fm-surface-border)",
        }}
      >
        {SPEEDS.map((s) => {
          const active = speed === s;
          return (
            <button
              key={s}
              type="button"
              onClick={() => setSpeedAndApply(s)}
              className="px-2 py-0.5 text-xs font-medium rounded transition-colors"
              style={{
                background: active
                  ? "var(--fm-accent-orange)"
                  : "transparent",
                color: active ? "white" : "var(--fm-text-secondary)",
              }}
              aria-pressed={active}
            >
              {s}x
            </button>
          );
        })}
      </div>

      <a
        href={audioUrl}
        download={`narration-${outputId}.mp3`}
        className="flex items-center justify-center h-8 w-8 rounded-lg"
        style={{
          color: "var(--fm-text-secondary)",
          border: "1px solid var(--fm-surface-border)",
        }}
        aria-label="Download narration"
      >
        <Download className="h-3.5 w-3.5" />
      </a>
    </div>
  );
};
