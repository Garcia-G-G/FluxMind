"use client";

import { use } from "react";
import dynamic from "next/dynamic";

// Dynamic import to avoid SSR issues with tldraw
const CanvasEditor = dynamic(
  () =>
    import("@/components/canvas/canvas-editor").then(
      (mod) => mod.CanvasEditor
    ),
  { ssr: false, loading: () => <CanvasLoading /> }
);

const CanvasLoading = (): React.ReactNode => (
  <div className="flex items-center justify-center h-full text-muted-foreground">
    <p className="text-sm">Loading canvas...</p>
  </div>
);

const CanvasPage = ({
  params,
}: {
  params: Promise<{ id: string }>;
}): React.ReactNode => {
  const { id: notebookId } = use(params);

  return (
    <div className="h-full -m-4 relative">
      <CanvasEditor notebookId={notebookId} />
    </div>
  );
};

export default CanvasPage;
