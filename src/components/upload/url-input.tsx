"use client";

import { useState } from "react";
import { Link, PlayCircle, Loader2, Send, Search, Sparkles } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const YOUTUBE_REGEX =
  /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)/;

const isValidUrl = (str: string): boolean => {
  try {
    const url = new URL(str);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
};

const looksLikeUrl = (str: string): boolean => {
  // Check for common URL patterns even without protocol
  const trimmed = str.trim();
  if (isValidUrl(trimmed)) return true;
  if (isValidUrl(`https://${trimmed}`)) {
    // Only if it has a TLD-like pattern
    return /^[a-zA-Z0-9-]+\.[a-zA-Z]{2,}/.test(trimmed);
  }
  return false;
};

export const UrlInput = ({
  notebookId,
}: {
  notebookId: string;
}): React.ReactNode => {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const trimmed = value.trim();
  const isUrl = looksLikeUrl(trimmed);
  const isYouTube = YOUTUBE_REGEX.test(trimmed);
  const isSearch = trimmed.length > 0 && !isUrl;

  // URL mutation
  const addUrl = useMutation({
    mutationFn: async () => {
      const finalUrl = isValidUrl(trimmed) ? trimmed : `https://${trimmed}`;
      const res = await fetch("/api/sources/url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: finalUrl, notebookId }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to add URL");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sources", notebookId] });
      setValue("");
      setError(null);
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  // Search/research mutation
  const searchQuery = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/sources/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: trimmed, notebookId }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to research topic");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sources", notebookId] });
      setValue("");
      setError(null);
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  const isPending = addUrl.isPending || searchQuery.isPending;

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    if (!trimmed || isPending) return;
    setError(null);

    if (isUrl) {
      addUrl.mutate();
    } else {
      // It's a search query — research it with AI
      searchQuery.mutate();
    }
  };

  const getIcon = (): React.ReactNode => {
    if (isPending) return <Loader2 className="h-3.5 w-3.5 animate-spin" style={{ color: "var(--fm-text-tertiary)" }} />;
    if (isYouTube) return <PlayCircle className="h-3.5 w-3.5 text-red-500" />;
    if (isSearch) return <Search className="h-3.5 w-3.5" style={{ color: "var(--fm-accent-orange)" }} />;
    return <Link className="h-3.5 w-3.5" style={{ color: "var(--fm-text-tertiary)" }} />;
  };

  const getButtonIcon = (): React.ReactNode => {
    if (isPending) return <Loader2 className="h-3.5 w-3.5 animate-spin" />;
    if (isSearch) return <Sparkles className="h-3.5 w-3.5" />;
    return <Send className="h-3.5 w-3.5" />;
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-1.5">
      <div className="flex gap-1.5">
        <div className="relative flex-1">
          <div className="absolute left-2.5 top-1/2 -translate-y-1/2">
            {getIcon()}
          </div>
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Paste URL, YouTube link, or search any topic..."
            className="pl-8 h-8 text-xs"
            disabled={isPending}
          />
        </div>
        <Button
          type="submit"
          size="sm"
          className="h-8 px-2"
          disabled={!trimmed || isPending}
        >
          {getButtonIcon()}
        </Button>
      </div>
      {isSearch && trimmed.length > 2 && !isPending && (
        <p className="text-[10px] flex items-center gap-1 px-1" style={{ color: "var(--fm-text-tertiary)" }}>
          <Sparkles className="h-2.5 w-2.5" style={{ color: "var(--fm-accent-orange)" }} />
          AI will research &quot;{trimmed.length > 40 ? trimmed.slice(0, 40) + "..." : trimmed}&quot; and add it as a source
        </p>
      )}
      {error && <p className="text-xs" style={{ color: "var(--fm-error, #ef4444)" }}>{error}</p>}
    </form>
  );
};
