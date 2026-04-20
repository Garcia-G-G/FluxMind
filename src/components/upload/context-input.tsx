"use client";

import { useState, useRef, useEffect } from "react";
import { Type, Loader2, Plus, ChevronDown, ChevronUp } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";

export const ContextInput = ({
  notebookId,
}: {
  notebookId: string;
}): React.ReactNode => {
  const [expanded, setExpanded] = useState(false);
  const [text, setText] = useState("");
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const contentRef = useRef<HTMLFormElement>(null);
  const [contentHeight, setContentHeight] = useState(0);

  const charCount = text.length;
  const hasContent = text.trim().length > 0;

  useEffect(() => {
    if (contentRef.current) {
      setContentHeight(expanded ? contentRef.current.scrollHeight : 0);
    }
  }, [expanded, text, title]);

  const addText = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/sources/text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          title: title.trim() || undefined,
          notebookId,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to add text");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sources", notebookId] });
      setText("");
      setTitle("");
      setExpanded(false);
      setError(null);
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    if (!hasContent) return;
    setError(null);
    addText.mutate();
  };

  return (
    <div className="space-y-1.5">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 w-full text-left px-2 py-1.5 rounded-lg text-xs transition-colors"
        style={{ color: "var(--fm-text-secondary)" }}
      >
        <Type className="h-3.5 w-3.5" style={{ color: "var(--fm-accent-orange)" }} />
        <span className="flex-1 font-medium">Paste text context</span>
        {expanded ? (
          <ChevronUp className="h-3 w-3" />
        ) : (
          <ChevronDown className="h-3 w-3" />
        )}
      </button>

      <div
        style={{
          height: expanded ? contentHeight : 0,
          opacity: expanded ? 1 : 0,
          overflow: "hidden",
          transition: "height 0.2s ease, opacity 0.2s ease",
        }}
      >
        <form
          ref={contentRef}
          onSubmit={handleSubmit}
          className="space-y-2"
        >
          {/* Optional title */}
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title (optional)"
            disabled={addText.isPending}
            className="w-full text-xs px-2.5 py-1.5 rounded-lg outline-none transition-colors"
            style={{
              background: "var(--fm-input-bg)",
              border: "1px solid var(--fm-input-border)",
              color: "var(--fm-text)",
            }}
          />

          {/* Text area */}
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste notes, articles, or any text you want to use as context..."
            disabled={addText.isPending}
            rows={4}
            className="w-full text-xs px-2.5 py-2 rounded-lg outline-none resize-y transition-colors"
            style={{
              background: "var(--fm-input-bg)",
              border: "1px solid var(--fm-input-border)",
              color: "var(--fm-text)",
              minHeight: 80,
              maxHeight: 200,
            }}
          />

          {/* Footer: char count + submit */}
          <div className="flex items-center justify-between">
            <span
              className="text-[10px] tabular-nums"
              style={{ color: "var(--fm-text-tertiary)" }}
            >
              {charCount > 0 ? `${charCount.toLocaleString()} chars` : ""}
            </span>
            <Button
              type="submit"
              size="sm"
              className="h-7 px-3 text-xs gap-1.5"
              disabled={!hasContent || addText.isPending}
            >
              {addText.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Plus className="h-3 w-3" />
              )}
              Add Source
            </Button>
          </div>

          {error && (
            <p className="text-xs" style={{ color: "var(--fm-error, #ef4444)" }}>
              {error}
            </p>
          )}
        </form>
      </div>
    </div>
  );
};
