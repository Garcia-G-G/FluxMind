"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Play,
  Pause,
  Maximize,
  Volume2,
  VolumeX,
  Loader2,
  AlertCircle,
  RotateCcw,
} from "lucide-react";
import { GlassCard } from "@/components/shared/glass-card";

type Chapter = {
  title: string;
  narration: string;
  imageUrl?: string;
};

const formatTime = (s: number): string => {
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
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [activeChapter, setActiveChapter] = useState(0);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onTime = (): void => setCurrentTime(video.currentTime);
    const onMeta = (): void => setDuration(video.duration);
    const onEnd = (): void => setIsPlaying(false);
    video.addEventListener("timeupdate", onTime);
    video.addEventListener("loadedmetadata", onMeta);
    video.addEventListener("ended", onEnd);
    return () => {
      video.removeEventListener("timeupdate", onTime);
      video.removeEventListener("loadedmetadata", onMeta);
      video.removeEventListener("ended", onEnd);
    };
  }, [fileUrl]);

  const togglePlay = useCallback((): void => {
    if (!videoRef.current) return;
    if (isPlaying) videoRef.current.pause();
    else videoRef.current.play();
    setIsPlaying(!isPlaying);
  }, [isPlaying]);

  const seek = useCallback((fraction: number): void => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = fraction * videoRef.current.duration;
  }, []);

  const progress = duration > 0 ? currentTime / duration : 0;

  // Processing state
  if (status === "pending" || status === "generating") {
    return (
      <GlassCard padding="lg">
        <div className="text-center py-8">
          <Loader2 className="h-8 w-8 mx-auto mb-4 animate-spin" style={{ color: "var(--fm-accent-violet)" }} />
          <h3 className="font-medium mb-2" style={{ color: "var(--fm-text)" }}>Generating Video Overview</h3>
          <p className="text-sm" style={{ color: "var(--fm-text-secondary)", animation: "typingPulse 2s ease-in-out infinite" }}>
            This may take a few minutes...
          </p>
        </div>
      </GlassCard>
    );
  }

  if (status === "error") {
    return (
      <GlassCard padding="lg">
        <div className="text-center py-8">
          <AlertCircle className="h-8 w-8 mx-auto mb-4" style={{ color: "var(--fm-error)" }} />
          <h3 className="font-medium mb-2" style={{ color: "var(--fm-text)" }}>Generation Failed</h3>
          <button className="flex items-center gap-1.5 mx-auto px-4 py-2 text-sm font-medium text-white" style={{ background: "var(--fm-accent-gradient)", borderRadius: 12 }}>
            <RotateCcw className="h-4 w-4" /> Retry
          </button>
        </div>
      </GlassCard>
    );
  }

  // Script-only mode (no video file)
  if (!fileUrl || fileUrl.startsWith("local://")) {
    return (
      <GlassCard padding="lg">
        <h3 className="text-lg font-bold mb-4" style={{ color: "var(--fm-text)" }}>{title}</h3>
        {chapters && chapters.length > 0 ? (
          <div className="space-y-4">
            {chapters.map((ch, i) => (
              <div key={i} className="rounded-xl p-4" style={{ background: "var(--fm-surface)", border: "1px solid var(--fm-surface-border)" }}>
                <h4 className="font-medium text-sm mb-1" style={{ color: "var(--fm-accent-violet)" }}>
                  Chapter {i + 1}: {ch.title}
                </h4>
                <p className="text-sm" style={{ color: "var(--fm-text-secondary)" }}>{ch.narration}</p>
                {ch.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={ch.imageUrl} alt={ch.title} className="mt-2 rounded-lg w-full aspect-video object-cover" />
                )}
              </div>
            ))}
          </div>
        ) : (
          <p style={{ color: "var(--fm-text-secondary)" }}>Video script generated. Configure FAL_KEY and ELEVENLABS_API_KEY for full video generation.</p>
        )}
      </GlassCard>
    );
  }

  // Full video player
  return (
    <GlassCard padding="md">
      <div className="relative rounded-xl overflow-hidden aspect-video bg-black">
        <video ref={videoRef} src={fileUrl} className="w-full h-full" onClick={togglePlay} />

        {/* Controls overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-3" style={{ background: "linear-gradient(transparent, rgba(0,0,0,0.8))" }}>
          {/* Progress bar */}
          <div className="h-1 rounded-full mb-2 cursor-pointer" style={{ background: "rgba(255,255,255,0.2)" }} onClick={(e) => { const rect = e.currentTarget.getBoundingClientRect(); seek((e.clientX - rect.left) / rect.width); }}>
            <div className="h-full rounded-full" style={{ width: `${progress * 100}%`, background: "var(--fm-accent-gradient)" }} />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button onClick={togglePlay} className="text-white">
                {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
              </button>
              <span className="text-xs text-white/70 font-mono" style={{ fontVariantNumeric: "tabular-nums" }}>
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => { if (videoRef.current) { videoRef.current.muted = !isMuted; setIsMuted(!isMuted); } }} className="text-white/70">
                {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </button>
              <button onClick={() => videoRef.current?.requestFullscreen()} className="text-white/70">
                <Maximize className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Chapter list */}
      {chapters && chapters.length > 0 && (
        <div className="mt-4 space-y-1">
          <h4 className="text-xs font-medium mb-2" style={{ color: "var(--fm-text-tertiary)" }}>Chapters</h4>
          {chapters.map((ch, i) => (
            <button
              key={i}
              className="w-full text-left px-3 py-2 rounded-lg text-xs transition-colors relative"
              style={{
                background: activeChapter === i ? "var(--fm-surface-hover)" : undefined,
                color: activeChapter === i ? "var(--fm-text)" : "var(--fm-text-secondary)",
              }}
              onClick={() => setActiveChapter(i)}
            >
              {activeChapter === i && (
                <div className="absolute left-0 top-1 bottom-1 w-[2px] rounded-r" style={{ background: "var(--fm-accent-gradient)" }} />
              )}
              <span className="font-medium">{ch.title}</span>
            </button>
          ))}
        </div>
      )}
    </GlassCard>
  );
};
