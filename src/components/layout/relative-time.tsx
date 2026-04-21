"use client";

import { useEffect, useState, type ReactNode } from "react";

const formatRelativeTime = (date: Date | string, nowMs: number): string => {
  const diff = nowMs - new Date(date).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `Updated ${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Updated ${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `Updated ${days}d ago`;
};

/**
 * Isolated clock component — keeps the "updated Xm ago" tick from forcing the
 * parent dashboard grid to re-render every minute. Only the <span> itself
 * re-renders on the 60 s interval.
 */
export const RelativeTime = ({
  timestamp,
  className,
  style,
}: {
  timestamp: Date | string;
  className?: string;
  style?: React.CSSProperties;
}): ReactNode => {
  const [nowMs, setNowMs] = useState<number | null>(null);

  useEffect(() => {
    setNowMs(Date.now());
    const id = setInterval(() => setNowMs(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  return (
    <span className={className} style={style} suppressHydrationWarning>
      {nowMs ? formatRelativeTime(timestamp, nowMs) : "\u00A0"}
    </span>
  );
};
