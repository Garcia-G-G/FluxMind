"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Upload, X, FileText, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUploadSource } from "@/hooks/use-sources";

const ACCEPTED_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/csv",
  "image/png",
  "image/jpeg",
];

const MAX_SIZE = 50 * 1024 * 1024;

type UploadingFile = {
  file: File;
  status: "uploading" | "done" | "error";
  error?: string;
};

export const FileUploader = ({
  notebookId,
  compact,
}: {
  notebookId: string;
  compact?: boolean;
}): React.ReactNode => {
  const [isDragging, setIsDragging] = useState(false);
  const [uploads, setUploads] = useState<UploadingFile[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const cleanupTimerRef = useRef<ReturnType<typeof setTimeout>>(null);
  const uploadSource = useUploadSource();

  useEffect(() => {
    return () => {
      if (cleanupTimerRef.current) clearTimeout(cleanupTimerRef.current);
    };
  }, []);

  const processFiles = useCallback(
    async (files: FileList | File[]) => {
      const fileArray = Array.from(files);
      const newUploads: UploadingFile[] = fileArray.map((f) => ({
        file: f,
        status: "uploading" as const,
      }));
      setUploads((prev) => [...prev, ...newUploads]);

      for (let i = 0; i < fileArray.length; i++) {
        const file = fileArray[i];
        try {
          if (file.size > MAX_SIZE) {
            throw new Error("File too large (50MB max)");
          }
          await uploadSource.mutateAsync({ file, notebookId });
          setUploads((prev) =>
            prev.map((u) =>
              u.file === file ? { ...u, status: "done" as const } : u
            )
          );
        } catch (err) {
          setUploads((prev) =>
            prev.map((u) =>
              u.file === file
                ? {
                    ...u,
                    status: "error" as const,
                    error:
                      err instanceof Error ? err.message : "Upload failed",
                  }
                : u
            )
          );
        }
      }

      // Clear done uploads after 2 seconds
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

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  if (compact) {
    return (
      <div>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPTED_TYPES.join(",")}
          className="hidden"
          onChange={(e) => e.target.files && processFiles(e.target.files)}
        />
        <Button
          variant="outline"
          size="sm"
          className="w-full gap-1.5"
          onClick={() => inputRef.current?.click()}
          disabled={uploadSource.isPending}
        >
          {uploadSource.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Upload className="h-3.5 w-3.5" />
          )}
          Add Source
        </Button>
        <UploadList uploads={uploads} onDismiss={(f) => setUploads((prev) => prev.filter((u) => u.file !== f))} />
      </div>
    );
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPTED_TYPES.join(",")}
        className="hidden"
        onChange={(e) => e.target.files && processFiles(e.target.files)}
      />
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload files by dropping or clicking"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
          isDragging
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/50"
        }`}
      >
        <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
        <p className="text-sm font-medium mb-1">
          Drop files here or click to upload
        </p>
        <p className="text-xs text-muted-foreground">
          PDF, DOCX, TXT, CSV, PNG, JPG — up to 50MB
        </p>
      </div>
      <UploadList uploads={uploads} onDismiss={(f) => setUploads((prev) => prev.filter((u) => u.file !== f))} />
    </div>
  );
};

const UploadList = ({
  uploads,
  onDismiss,
}: {
  uploads: UploadingFile[];
  onDismiss: (file: File) => void;
}): React.ReactNode => {
  if (uploads.length === 0) return null;

  return (
    <div className="mt-2 space-y-1">
        {uploads.map((u, i) => (
          <div
            key={`${u.file.name}-${i}`}
            className="flex items-center gap-2 text-xs px-2 py-1.5 rounded bg-muted fm-stagger-item"
            style={{ animationDelay: `${i * 15}ms` }}
          >
            {u.status === "uploading" && (
              <Loader2 className="h-3 w-3 animate-spin text-muted-foreground shrink-0" />
            )}
            {u.status === "done" && (
              <FileText className="h-3 w-3 text-green-500 shrink-0" />
            )}
            {u.status === "error" && (
              <AlertCircle className="h-3 w-3 text-destructive shrink-0" />
            )}
            <span className="truncate flex-1">{u.file.name}</span>
            {u.status === "error" && (
              <>
                <span className="text-destructive truncate">{u.error}</span>
                <button onClick={() => onDismiss(u.file)}>
                  <X className="h-3 w-3" />
                </button>
              </>
            )}
          </div>
        ))}
    </div>
  );
};
