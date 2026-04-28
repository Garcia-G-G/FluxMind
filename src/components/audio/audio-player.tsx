"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Download,
  Volume2,
  VolumeX,
  Loader2,
  AlertCircle,
  RotateCcw,
} from "lucide-react";
import { motion } from "motion/react";
import dynamic from "next/dynamic";

// Interactive mode is gated on a user toggle; lazy-load it so the audio
// player's first paint doesn't pull motion/AnimatePresence + the
// MediaRecorder code path.
const InteractiveMode = dynamic(
  () =>
    import("@/components/studio/interactive-mode").then(
      (m) => m.InteractiveMode,
    ),
  { ssr: false, loading: () => null },
);

const cardStyle: React.CSSProperties = {
  background: "var(--fm-surface)",
  border: "1px solid var(--fm-surface-border)",
  borderRadius: "1rem",
  padding: "1.25rem",
};

const formatTime = (seconds: number): string => {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
};

// Seeded random for consistent fallback waveform
const seededRandom = (seed: string): (() => number) => {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
  }
  return () => {
    h = (h * 1103515245 + 12345) & 0x7fffffff;
    return (h % 100) / 100;
  };
};

const BAR_COUNT = 80;

type AudioPlayerProps = {
  fileUrl: string | null;
  title: string;
  status: string;
  notebookId: string;
  outputId: string;
  duration?: number;
};

export const AudioPlayer = ({
  fileUrl,
  title,
  status,
  notebookId,
  outputId,
  duration,
}: AudioPlayerProps): React.ReactNode => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(duration ?? 0);
  const [isMuted, setIsMuted] = useState(false);
  const [progress, setProgress] = useState(0);

  const rand = useMemo(() => seededRandom(outputId), [outputId]);
  const barHeights = useMemo(
    () => Array.from({ length: BAR_COUNT }, () => 0.2 + rand() * 0.8),
    [rand]
  );

  useEffect(() => {
    if (!fileUrl || fileUrl.startsWith("local://")) return;
    const audio = new Audio(fileUrl);
    audioRef.current = audio;

    audio.addEventListener("loadedmetadata", () => {
      setTotalDuration(audio.duration);
    });
    audio.addEventListener("timeupdate", () => {
      setCurrentTime(audio.currentTime);
      if (audio.duration) setProgress(audio.currentTime / audio.duration);
    });
    audio.addEventListener("ended", () => {
      setIsPlaying(false);
      setProgress(0);
      setCurrentTime(0);
    });

    return () => {
      audio.pause();
      audio.src = "";
    };
  }, [fileUrl]);

  const togglePlay = useCallback((): void => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  }, [isPlaying]);

  const skip = useCallback((seconds: number): void => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = Math.max(
      0,
      Math.min(audioRef.current.duration, audioRef.current.currentTime + seconds)
    );
  }, []);

  const seekTo = useCallback((fraction: number): void => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = fraction * audioRef.current.duration;
  }, []);

  const toggleMute = useCallback((): void => {
    if (!audioRef.current) return;
    audioRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  }, [isMuted]);

  const handlePause = useCallback((): void => {
    audioRef.current?.pause();
    setIsPlaying(false);
  }, []);

  const handleResume = useCallback((): void => {
    audioRef.current?.play();
    setIsPlaying(true);
  }, []);

  // Processing state
  if (status === "pending" || status === "generating") {
    return (
      <div style={cardStyle}>
        <div className="text-center py-8">
          <Loader2
            className="h-8 w-8 mx-auto mb-4 animate-spin"
            style={{ color: "var(--fm-accent-violet)" }}
          />
          <h3 className="font-medium mb-2" style={{ color: "var(--fm-text)" }}>
            Generating Audio Overview
          </h3>
          <p
            className="text-sm mb-4"
            style={{
              color: "var(--fm-text-secondary)",
              animation: "typingPulse 2s ease-in-out infinite",
            }}
          >
            {status === "pending"
              ? "Preparing..."
              : "Synthesizing audio..."}
          </p>
          {/* Progress bar */}
          <div
            className="h-2 rounded-full overflow-hidden max-w-xs mx-auto"
            style={{ background: "var(--fm-surface)" }}
          >
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: "60%",
                background: "var(--fm-accent-gradient)",
              }}
            />
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (status === "error") {
    return (
      <div style={cardStyle}>
        <div className="text-center py-8">
          <AlertCircle className="h-8 w-8 mx-auto mb-4" style={{ color: "var(--fm-error)" }} />
          <h3 className="font-medium mb-2" style={{ color: "var(--fm-text)" }}>
            Generation Failed
          </h3>
          <button
            className="flex items-center gap-1.5 mx-auto px-4 py-2 text-sm font-medium text-white transition-transform hover:-translate-y-0.5"
            style={{ background: "var(--fm-accent-gradient)", borderRadius: 12 }}
          >
            <RotateCcw className="h-4 w-4" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Player
  return (
    <div style={cardStyle}>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h3 className="text-lg font-bold" style={{ color: "var(--fm-text)" }}>
            Audio Overview
          </h3>
          <p className="text-sm" style={{ color: "var(--fm-text-secondary)" }}>
            {title} &middot; {formatTime(totalDuration)}
          </p>
        </div>
        <div className="flex gap-2">
          {fileUrl && !fileUrl.startsWith("local://") && (
            <a
              href={fileUrl}
              download
              className="h-8 w-8 rounded-lg flex items-center justify-center transition-colors"
              style={{
                background: "var(--fm-surface)",
                border: "1px solid var(--fm-surface-border)",
                color: "var(--fm-text-secondary)",
              }}
            >
              <Download className="h-4 w-4" />
            </a>
          )}
        </div>
      </div>

      {/* Waveform */}
      <div
        className="relative h-16 mb-4 cursor-pointer flex items-end gap-[2px]"
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const fraction = (e.clientX - rect.left) / rect.width;
          seekTo(fraction);
        }}
      >
        {barHeights.map((height, i) => {
          const fraction = i / BAR_COUNT;
          const isPlayed = fraction <= progress;
          return (
            <motion.div
              key={i}
              initial={{ scaleY: 0 }}
              animate={{ scaleY: 1 }}
              transition={{ delay: i * 0.008, duration: 0.3 }}
              className="flex-1 rounded-sm origin-bottom"
              style={{
                height: `${height * 100}%`,
                background: isPlayed
                  ? `linear-gradient(180deg, var(--fm-accent-orange), var(--fm-accent-rose))`
                  : "var(--fm-surface-border)",
                transition: "background 0.1s",
              }}
            />
          );
        })}
      </div>

      {/* Transport controls */}
      <div className="flex items-center justify-center gap-4 mb-3">
        <button
          onClick={() => skip(-15)}
          className="h-9 w-9 rounded-full flex items-center justify-center relative transition-colors"
          style={{
            background: "var(--fm-glass-bg)",
            border: "1px solid var(--fm-glass-border)",
            color: "var(--fm-text-secondary)",
          }}
        >
          <SkipBack className="h-4 w-4" />
          <span className="absolute text-[8px] font-medium" style={{ bottom: -2 }}>
            15
          </span>
        </button>

        <button
          onClick={togglePlay}
          className="h-12 w-12 rounded-full flex items-center justify-center text-white transition-transform hover:scale-105 active:scale-95"
          style={{
            background: "linear-gradient(135deg, var(--fm-accent-orange), var(--fm-accent-rose))",
            boxShadow: "0 4px 20px var(--fm-glow-orange)",
          }}
        >
          {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
        </button>

        <button
          onClick={() => skip(15)}
          className="h-9 w-9 rounded-full flex items-center justify-center relative transition-colors"
          style={{
            background: "var(--fm-glass-bg)",
            border: "1px solid var(--fm-glass-border)",
            color: "var(--fm-text-secondary)",
          }}
        >
          <SkipForward className="h-4 w-4" />
          <span className="absolute text-[8px] font-medium" style={{ bottom: -2 }}>
            15
          </span>
        </button>
      </div>

      {/* Time + Volume */}
      <div className="flex items-center justify-between">
        <span
          className="text-xs font-mono"
          style={{ color: "var(--fm-text-tertiary)", fontVariantNumeric: "tabular-nums" }}
        >
          {formatTime(currentTime)} / {formatTime(totalDuration)}
        </span>
        <div className="flex items-center gap-2">
          <InteractiveMode
            notebookId={notebookId}
            onPause={handlePause}
            onResume={handleResume}
          />
          <button
            onClick={toggleMute}
            className="h-8 w-8 rounded-lg flex items-center justify-center transition-colors"
            style={{ color: "var(--fm-text-secondary)" }}
          >
            {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  );
};
