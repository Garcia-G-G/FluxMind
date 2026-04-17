"use client";

import { useCallback, useEffect, useRef } from "react";
import {
  Tldraw,
  useEditor,
  getSnapshot,
  loadSnapshot,
} from "@tldraw/tldraw";
import "@tldraw/tldraw/tldraw.css";

const SAVE_DEBOUNCE_MS = 2000;

const CanvasPersistence = ({
  notebookId,
}: {
  notebookId: string;
}): React.ReactNode => {
  const editor = useEditor();
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialLoadDone = useRef(false);

  // Load canvas state on mount
  useEffect(() => {
    if (initialLoadDone.current) return;
    initialLoadDone.current = true;

    const loadCanvas = async (): Promise<void> => {
      try {
        const res = await fetch(
          `/api/canvas?notebookId=${notebookId}`
        );
        if (!res.ok) return;
        const data = await res.json();
        if (data.snapshot) {
          loadSnapshot(editor.store, data.snapshot);
        }
      } catch (error) {
        console.error("Failed to load canvas:", error);
      }
    };
    loadCanvas();
  }, [editor, notebookId]);

  // Auto-save on changes (debounced)
  const saveCanvas = useCallback(async (): Promise<void> => {
    try {
      const snapshot = getSnapshot(editor.store);
      await fetch("/api/canvas", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notebookId, snapshot }),
      });
    } catch (error) {
      console.error("Failed to save canvas:", error);
    }
  }, [editor, notebookId]);

  useEffect(() => {
    const cleanup = editor.store.listen(() => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(saveCanvas, SAVE_DEBOUNCE_MS);
    });

    return () => {
      cleanup();
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        // Final save on unmount
        saveCanvas();
      }
    };
  }, [editor, saveCanvas]);

  return null;
};

export const CanvasEditor = ({
  notebookId,
}: {
  notebookId: string;
}): React.ReactNode => {
  return (
    <div className="absolute inset-0">
      <Tldraw>
        <CanvasPersistence notebookId={notebookId} />
      </Tldraw>
    </div>
  );
};
