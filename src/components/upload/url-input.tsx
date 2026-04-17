"use client";

import { useState } from "react";
import { Link, PlayCircle, Loader2, Send } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const YOUTUBE_REGEX =
  /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)/;

export const UrlInput = ({
  notebookId,
}: {
  notebookId: string;
}): React.ReactNode => {
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const isYouTube = YOUTUBE_REGEX.test(url);

  const addUrl = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/sources/url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, notebookId }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to add URL");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sources", notebookId] });
      setUrl("");
      setError(null);
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    setError(null);
    try {
      new URL(url);
    } catch {
      setError("Please enter a valid URL");
      return;
    }
    addUrl.mutate();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <div className="flex gap-1.5">
        <div className="relative flex-1">
          <div className="absolute left-2.5 top-1/2 -translate-y-1/2">
            {isYouTube ? (
              <PlayCircle className="h-3.5 w-3.5 text-red-500" />
            ) : (
              <Link className="h-3.5 w-3.5 text-muted-foreground" />
            )}
          </div>
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Paste URL or YouTube link..."
            className="pl-8 h-8 text-xs"
            disabled={addUrl.isPending}
          />
        </div>
        <Button
          type="submit"
          size="sm"
          className="h-8 px-2"
          disabled={!url.trim() || addUrl.isPending}
        >
          {addUrl.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Send className="h-3.5 w-3.5" />
          )}
        </Button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </form>
  );
};
