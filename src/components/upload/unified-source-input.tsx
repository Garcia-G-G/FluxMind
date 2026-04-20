"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  Upload,
  Link,
  PlayCircle,
  Loader2,
  Send,
  Search,
  Sparkles,
  FileText,
  AlertCircle,
  X,
} from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useUploadSource } from "@/hooks/use-sources";

const YOUTUBE_REGEX =
  /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)/;

const ACCEPTED_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/csv",
  "image/png",
  "image/jpeg",
];

const MAX_SIZE = 50 * 1024 * 1024;

const isValidUrl = (str: string): boolean => {
  try {
    const url = new URL(str);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
};

const looksLikeUrl = (str: string): boolean => {
  const trimmed = str.trim();
  if (isValidUrl(trimmed)) return true;
  if (isValidUrl(`https://${trimmed}`)) {
    return /^[a-zA-Z0-9-]+\.[a-zA-Z]{2,}/.test(trimmed);
  }
  return false;
};

const isLikelyText = (str: string): boolean => {
  // If it has multiple lines or is long, treat as pasted text
  return str.includes("\n") || str.length > 200;
};

type UploadingFile = {
  file: File;
  status: "uploading" | "done" | "error";
  error?: string;
};

export const UnifiedSourceInput = ({
  notebookId,
}: {
  notebookId: string;
}): React.ReactNode => {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploads, setUploads] = useState<UploadingFile[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const cleanupTimerRef = useRef<ReturnType<typeof setTimeout>>(null);
  const queryClient = useQueryClient();
  const uploadSource = useUploadSource();

  useEffect(() => {
    return () => {
      if (cleanupTimerRef.current) clearTimeout(cleanupTimerRef.current);
    };
  }, []);

  const trimmed = value.trim();
  const isUrl = looksLikeUrl(trimmed);
  const isYouTube = YOUTUBE_REGEX.test(trimmed);
  const isText = isLikelyText(trimmed);
  const isSearch = trimmed.length > 0 && !isUrl && !isText;

  // Detect mode for hint text
  const getMode = (): { label: string; icon: React.ReactNode } => {
    if (!trimmed) return { label: "", icon: null };
    if (isYouTube) return { label: "YouTube video detected", icon: <PlayCircle className="h-3 w-3 text-red-500" /> };
    if (isUrl) return { label: "URL detected — will fetch and process", icon: <Link className="h-3 w-3" style={{ color: "var(--fm-accent-blue)" }} /> };
    if (isText) return { label: "Text detected — will add as source", icon: <FileText className="h-3 w-3" style={{ color: "var(--fm-accent-violet)" }} /> };
    if (isSearch) return { label: `AI will research "${trimmed.length > 35 ? trimmed.slice(0, 35) + "..." : trimmed}"`, icon: <Sparkles className="h-3 w-3" style={{ color: "var(--fm-accent-orange)" }} /> };
    return { label: "", icon: null };
  };

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
    onError: (err: Error) => setError(err.message),
  });

  // Text mutation
  const addText = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/sources/text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: trimmed, notebookId }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to add text");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sources", notebookId] });
      setValue("");
      setError(null);
    },
    onError: (err: Error) => setError(err.message),
  });

  // Search mutation
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
    onError: (err: Error) => setError(err.message),
  });

  const isPending = addUrl.isPending || addText.isPending || searchQuery.isPending || uploadSource.isPending;

  const handleSubmit = (): void => {
    if (!trimmed || isPending) return;
    setError(null);

    if (isUrl) {
      addUrl.mutate();
    } else if (isText) {
      addText.mutate();
    } else {
      searchQuery.mutate();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === "Enter" && !e.shiftKey && !isText) {
      e.preventDefault();
      handleSubmit();
    }
    // Shift+Enter always inserts newline (default behavior)
    // For text mode, Enter also inserts newline
  };

  // File handling
  const processFiles = useCallback(
    async (files: FileList | File[]) => {
      const fileArray = Array.from(files);
      const newUploads: UploadingFile[] = fileArray.map((f) => ({
        file: f,
        status: "uploading" as const,
      }));
      setUploads((prev) => [...prev, ...newUploads]);

      for (const file of fileArray) {
        try {
          if (file.size > MAX_SIZE) throw new Error("File too large (50MB max)");
          await uploadSource.mutateAsync({ file, notebookId });
          setUploads((prev) =>
            prev.map((u) => (u.file === file ? { ...u, status: "done" as const } : u))
          );
        } catch (err) {
          setUploads((prev) =>
            prev.map((u) =>
              u.file === file
                ? { ...u, status: "error" as const, error: err instanceof Error ? err.message : "Upload failed" }
                : u
            )
          );
        }
      }

      if (cleanupTimerRef.current) clearTimeout(cleanupTimerRef.current);
      cleanupTimerRef.current = setTimeout(() => {
        setUploads((prev) => prev.filter((u) => u.status === "error"));
      }, 2000);
    },
    [notebookId, uploadSource]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files.length > 0) {
        processFiles(e.dataTransfer.files);
      }
    },
    [processFiles]
  );

  const mode = getMode();

  return (
    <div className="space-y-2">
      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPTED_TYPES.join(",")}
        className="hidden"
        onChange={(e) => e.target.files && processFiles(e.target.files)}
      />

      {/* Main input area */}
      <div
        className="relative rounded-lg transition-colors"
        style={{
          background: "var(--fm-input-bg)",
          border: isDragging
            ? "1.5px solid var(--fm-accent-orange)"
            : "1px solid var(--fm-input-border)",
        }}
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
      >
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Paste URL, YouTube link, or search any topic..."
          disabled={isPending}
          rows={2}
          className="w-full text-xs px-3 py-2.5 bg-transparent outline-none resize-none"
          style={{
            color: "var(--fm-text)",
            minHeight: 56,
            maxHeight: 160,
          }}
        />

        {/* Bottom bar with actions */}
        <div
          className="flex items-center justify-between px-2 py-1.5"
          style={{ borderTop: "1px solid var(--fm-surface-border)" }}
        >
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={isPending}
              className="flex items-center gap-1 px-2 py-1 rounded text-[11px] transition-colors"
              style={{ color: "var(--fm-text-tertiary)" }}
              title="Upload files"
            >
              <Upload className="h-3 w-3" />
              <span className="hidden sm:inline">Files</span>
            </button>
          </div>

          <button
            onClick={handleSubmit}
            disabled={!trimmed || isPending}
            className="flex items-center gap-1 h-6 px-2.5 text-[11px] font-medium text-white rounded-md transition-opacity disabled:opacity-30"
            style={{ background: "var(--fm-accent-orange)" }}
          >
            {isPending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : isSearch ? (
              <Search className="h-3 w-3" />
            ) : (
              <Send className="h-3 w-3" />
            )}
            {isPending ? "Processing..." : isSearch ? "Research" : "Add"}
          </button>
        </div>
      </div>

      {/* Mode hint */}
      {mode.label && !isPending && (
        <p className="flex items-center gap-1 text-[10px] px-1" style={{ color: "var(--fm-text-tertiary)" }}>
          {mode.icon}
          {mode.label}
        </p>
      )}

      {/* Error */}
      {error && <p className="text-[11px] px-1" style={{ color: "var(--fm-error, #ef4444)" }}>{error}</p>}

      {/* Upload progress */}
      {uploads.length > 0 && (
        <div className="space-y-1">
          {uploads.map((u, i) => (
            <div
              key={`${u.file.name}-${i}`}
              className="flex items-center gap-2 text-[11px] px-2 py-1 rounded"
              style={{ background: "var(--fm-bg-tertiary)" }}
            >
              {u.status === "uploading" && <Loader2 className="h-3 w-3 animate-spin" style={{ color: "var(--fm-text-tertiary)" }} />}
              {u.status === "done" && <FileText className="h-3 w-3" style={{ color: "var(--fm-success)" }} />}
              {u.status === "error" && <AlertCircle className="h-3 w-3" style={{ color: "var(--fm-error)" }} />}
              <span className="truncate flex-1" style={{ color: "var(--fm-text-secondary)" }}>{u.file.name}</span>
              {u.status === "error" && (
                <>
                  <span className="truncate" style={{ color: "var(--fm-error)" }}>{u.error}</span>
                  <button onClick={() => setUploads((prev) => prev.filter((p) => p.file !== u.file))}>
                    <X className="h-3 w-3" style={{ color: "var(--fm-text-tertiary)" }} />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Drag overlay */}
      {isDragging && (
        <div
          className="text-xs text-center py-2 rounded-lg"
          style={{
            background: "color-mix(in srgb, var(--fm-accent-orange) 8%, transparent)",
            color: "var(--fm-accent-orange)",
          }}
        >
          Drop files to upload
        </div>
      )}
    </div>
  );
};
