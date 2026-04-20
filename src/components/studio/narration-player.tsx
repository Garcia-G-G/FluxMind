"use client";

import { useEffect, useRef, useState } from "react";
import { Play, Pause, Download, Loader2, Sparkles } from "lucide-react";

const SPEEDS = [1, 1.5, 2] as const;
type Speed = (typeof SPEEDS)[number];

export const NarrationPlayer = ({
  outputId,
  existingAudioUrl,
}: {
  outputId: string;
  existingAudioUrl?: string | null;
}): React.ReactNode => {
  const [audioUrl, setAudioUrl] = useState<string | null>(
    existingAudioUrl ?? null,
  );
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [speed, setSpeed] = useState<Speed>(1);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const handleGenerate = async (): Promise<void> => {
    setIsGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/studio/narrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outputId }),
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

  const cycleSpeed = (): void => {
    const idx = SPEEDS.indexOf(speed);
    const next = SPEEDS[(idx + 1) % SPEEDS.length];
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
    const onTime = (): void => setProgress(a.currentTime);
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
  }, [audioUrl]);

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
          role="slider"
          aria-label="Seek"
          aria-valuemin={0}
          aria-valuemax={duration || 0}
          aria-valuenow={progress}
          tabIndex={0}
          className="h-1.5 rounded-full overflow-hidden cursor-pointer"
          style={{ background: "var(--fm-surface-border)" }}
          onClick={(e) => {
            const a = audioRef.current;
            if (!a || !duration) return;
            const rect = e.currentTarget.getBoundingClientRect();
            const pct = (e.clientX - rect.left) / rect.width;
            a.currentTime = Math.max(
              0,
              Math.min(duration, pct * duration),
            );
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
              width:
                duration > 0
                  ? `${(progress / duration) * 100}%`
                  : "0%",
              background: "var(--fm-accent-orange)",
            }}
          />
        </div>
        <div
          className="flex justify-between mt-1 text-[11px]"
          style={{ color: "var(--fm-text-tertiary)" }}
        >
          <span>{formatTime(progress)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>
      <button
        onClick={cycleSpeed}
        className="text-xs font-medium px-2 py-1 rounded"
        style={{
          color: "var(--fm-text-secondary)",
          border: "1px solid var(--fm-surface-border)",
        }}
        aria-label="Playback speed"
      >
        {speed}x
      </button>
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
