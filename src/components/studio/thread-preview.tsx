"use client";

import { useState } from "react";
import { Copy, Check, Trash2, Plus } from "lucide-react";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import type { ThreadContent } from "@/app/api/studio/thread/route";

type Tweet = ThreadContent["tweets"][number];

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
    const text = tweets.map((t, i) => `${i + 1}/${tweets.length}\n${t.text}`).join("\n\n");
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
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">
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

          return (
            <motion.div
              key={tweet.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="relative group"
            >
              {/* Thread line */}
              {index < tweets.length - 1 && (
                <div className="absolute left-[19px] top-10 bottom-0 w-0.5 bg-border" />
              )}

              <div className="flex gap-3 pb-4">
                <Avatar className="h-10 w-10 shrink-0">
                  <AvatarFallback className="text-xs bg-primary text-primary-foreground font-bold">
                    F
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-semibold">FluxMind</span>
                    <span className="text-xs text-muted-foreground">
                      @fluxmind
                    </span>
                    {tweet.isHook && (
                      <Badge className="text-[10px] px-1 py-0 bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                        Hook
                      </Badge>
                    )}
                    {tweet.isCTA && (
                      <Badge className="text-[10px] px-1 py-0 bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                        CTA
                      </Badge>
                    )}
                  </div>

                  {editingIndex === index ? (
                    <textarea
                      value={tweet.text}
                      onChange={(e) => handleEdit(index, e.target.value)}
                      onBlur={() => setEditingIndex(null)}
                      autoFocus
                      className="w-full text-sm bg-transparent border border-input rounded-md p-2 resize-none min-h-[60px] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      rows={3}
                    />
                  ) : (
                    <p
                      className="text-sm whitespace-pre-wrap cursor-pointer hover:bg-accent/30 rounded px-1 -mx-1 transition-colors"
                      onClick={() => setEditingIndex(index)}
                    >
                      {tweet.text}
                    </p>
                  )}

                  <div className="flex items-center justify-between mt-1.5">
                    <span
                      className={`text-xs ${isOverLimit ? "text-destructive font-medium" : "text-muted-foreground"}`}
                    >
                      {charCount}/280
                    </span>
                    <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
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
                          className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                          onClick={() => handleDelete(index)}
                        >
                          <Trash2 className="h-3 w-3" />
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
