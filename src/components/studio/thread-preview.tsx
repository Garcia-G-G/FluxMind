"use client";

import { useState } from "react";
import {
  Copy,
  Check,
  Trash2,
  Plus,
  MessageCircle,
  Repeat2,
  Heart,
  BarChart2,
} from "lucide-react";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import type { ThreadContent } from "@/app/api/studio/thread/route";

type Tweet = ThreadContent["tweets"][number];

const tagPillStyle = (color: string): React.CSSProperties => ({
  background: `color-mix(in srgb, ${color} 14%, transparent)`,
  color,
  borderRadius: "9999px",
  padding: "0 0.5rem",
  fontSize: "10px",
  fontWeight: 600,
  lineHeight: "1.4rem",
});

export const ThreadPreview = ({
  thread,
}: {
  thread: ThreadContent;
}): React.ReactNode => {
  const [tweets, setTweets] = useState<Tweet[]>(thread.tweets);
  const [copiedAll, setCopiedAll] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const handleCopyAll = async (): Promise<void> => {
    const text = tweets
      .map((t, i) => `${i + 1}/${tweets.length}\n${t.text}`)
      .join("\n\n");
    await navigator.clipboard.writeText(text);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  const handleCopySingle = async (index: number): Promise<void> => {
    await navigator.clipboard.writeText(tweets[index].text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleEdit = (index: number, newText: string): void => {
    setTweets((prev) =>
      prev.map((t, i) => (i === index ? { ...t, text: newText } : t))
    );
  };

  const handleDelete = (index: number): void => {
    setTweets((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddAfter = (index: number): void => {
    const newTweet: Tweet = {
      id: `t${Date.now()}`,
      text: "New tweet...",
      isHook: null,
      isCTA: null,
    };
    setTweets((prev) => [
      ...prev.slice(0, index + 1),
      newTweet,
      ...prev.slice(index + 1),
    ]);
    setEditingIndex(index + 1);
  };

  return (
    <div className="max-w-xl mx-auto">
      {thread.coverImage && (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={thread.coverImage}
          alt=""
          className="w-full h-40 object-cover rounded-xl mb-4"
          loading="lazy"
          style={{ border: "1px solid var(--fm-surface-border)" }}
        />
      )}
      <div className="flex items-center justify-between mb-4">
        <p
          className="text-sm"
          style={{ color: "var(--fm-text-tertiary)" }}
        >
          {tweets.length} tweets
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={handleCopyAll}
          className="gap-1.5"
        >
          {copiedAll ? (
            <Check className="h-3.5 w-3.5" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
          {copiedAll ? "Copied!" : "Copy Thread"}
        </Button>
      </div>

      <div className="space-y-0">
        {tweets.map((tweet, index) => {
          const charCount = tweet.text.length;
          const isOverLimit = charCount > 280;
          const isLast = index === tweets.length - 1;

          return (
            <motion.div
              key={tweet.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="relative group"
            >
              {/* 2px connector from avatar bottom to next avatar top */}
              {!isLast && (
                <div
                  className="absolute"
                  style={{
                    left: "19px",
                    top: "40px",
                    bottom: "0",
                    width: "2px",
                    background: "var(--fm-surface-border)",
                  }}
                />
              )}

              <div className="flex gap-3 pb-4">
                {/* 40px avatar circle with initial */}
                <div
                  className="flex items-center justify-center shrink-0 font-bold text-sm"
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: "9999px",
                    background: "var(--fm-accent-orange)",
                    color: "white",
                  }}
                >
                  F
                </div>

                <div className="flex-1 min-w-0">
                  {/* Header row: name + @handle + timestamp + numbering */}
                  <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                    <span
                      className="text-sm font-semibold"
                      style={{ color: "var(--fm-text)" }}
                    >
                      FluxMind
                    </span>
                    <span
                      className="text-xs"
                      style={{ color: "var(--fm-text-tertiary)" }}
                    >
                      @fluxmind
                    </span>
                    <span
                      className="text-xs"
                      style={{ color: "var(--fm-text-tertiary)" }}
                    >
                      ·
                    </span>
                    <span
                      className="text-xs"
                      style={{ color: "var(--fm-text-tertiary)" }}
                    >
                      just now
                    </span>
                    <span
                      className="text-xs ml-auto font-medium tabular-nums"
                      style={{ color: "var(--fm-text-tertiary)" }}
                    >
                      {index + 1}/{tweets.length}
                    </span>
                    {tweet.isHook && (
                      <span style={tagPillStyle("#f59e0b")}>Hook</span>
                    )}
                    {tweet.isCTA && (
                      <span style={tagPillStyle("#3b82f6")}>CTA</span>
                    )}
                  </div>

                  {editingIndex === index ? (
                    <textarea
                      value={tweet.text}
                      onChange={(e) => handleEdit(index, e.target.value)}
                      onBlur={() => setEditingIndex(null)}
                      autoFocus
                      className="w-full text-sm rounded-md p-2 resize-none min-h-[60px] outline-none"
                      style={{
                        background: "var(--fm-surface-elevated)",
                        border: "1px solid var(--fm-surface-border)",
                        color: "var(--fm-text)",
                      }}
                      rows={3}
                    />
                  ) : (
                    <p
                      className="text-sm whitespace-pre-wrap cursor-pointer rounded px-1 -mx-1 transition-colors"
                      style={{ color: "var(--fm-text)" }}
                      onClick={() => setEditingIndex(index)}
                    >
                      {tweet.text}
                    </p>
                  )}

                  {/* Character count */}
                  <div className="mt-1">
                    <span
                      className="text-xs"
                      style={{
                        color: isOverLimit
                          ? "#ef4444"
                          : "var(--fm-text-tertiary)",
                        fontWeight: isOverLimit ? 600 : 400,
                      }}
                    >
                      {charCount}/280
                    </span>
                  </div>

                  {/* Engagement row (static counts) */}
                  <div className="flex items-center gap-6 mt-3">
                    <span
                      className="flex items-center gap-1.5 text-sm"
                      style={{ color: "var(--fm-text-tertiary)" }}
                    >
                      <MessageCircle className="h-4 w-4" />
                      <span>—</span>
                    </span>
                    <span
                      className="flex items-center gap-1.5 text-sm"
                      style={{ color: "var(--fm-text-tertiary)" }}
                    >
                      <Repeat2 className="h-4 w-4" />
                      <span>—</span>
                    </span>
                    <span
                      className="flex items-center gap-1.5 text-sm"
                      style={{ color: "var(--fm-text-tertiary)" }}
                    >
                      <Heart className="h-4 w-4" />
                      <span>—</span>
                    </span>
                    <span
                      className="flex items-center gap-1.5 text-sm"
                      style={{ color: "var(--fm-text-tertiary)" }}
                    >
                      <BarChart2 className="h-4 w-4" />
                      <span>—</span>
                    </span>
                    <div className="ml-auto flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => handleCopySingle(index)}
                      >
                        {copiedIndex === index ? (
                          <Check className="h-3 w-3" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => handleAddAfter(index)}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                      {tweets.length > 2 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => handleDelete(index)}
                        >
                          <Trash2
                            className="h-3 w-3"
                            style={{ color: "var(--fm-text-tertiary)" }}
                          />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};
