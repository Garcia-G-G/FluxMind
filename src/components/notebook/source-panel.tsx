"use client";

import {
  FileText,
  FileSpreadsheet,
  Image as ImageIcon,
  File,
  Loader2,
  CheckCircle,
  XCircle,
  Trash2,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { FileUploader } from "@/components/upload/file-uploader";
import { useSources, useDeleteSource } from "@/hooks/use-sources";

const typeIcons: Record<string, React.ElementType> = {
  pdf: FileText,
  docx: FileText,
  txt: File,
  csv: FileSpreadsheet,
  image: ImageIcon,
};

const StatusBadge = ({ status }: { status: string }): React.ReactNode => {
  switch (status) {
    case "pending":
    case "processing":
      return (
        <Badge variant="secondary" className="gap-1 text-xs px-1.5 py-0">
          <Loader2 className="h-3 w-3 animate-spin" />
          Processing
        </Badge>
      );
    case "ready":
      return (
        <Badge variant="secondary" className="gap-1 text-xs px-1.5 py-0 text-green-600 dark:text-green-400">
          <CheckCircle className="h-3 w-3" />
          Ready
        </Badge>
      );
    case "error":
      return (
        <Badge variant="destructive" className="gap-1 text-xs px-1.5 py-0">
          <XCircle className="h-3 w-3" />
          Failed
        </Badge>
      );
    default:
      return null;
  }
};

export const SourcePanel = ({
  notebookId,
}: {
  notebookId: string;
}): React.ReactNode => {
  const { data: sources, isLoading } = useSources(notebookId);
  const deleteSource = useDeleteSource();

  return (
    <div className="h-full flex flex-col">
      <div className="p-3 border-b border-border">
        <h2 className="text-sm font-medium mb-2">Sources</h2>
        <FileUploader notebookId={notebookId} compact />
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-3 space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-14 rounded-md" />
            ))}
          </div>
        ) : sources && sources.length > 0 ? (
          <div className="p-2">
            <AnimatePresence>
              {sources.map((source) => {
                const Icon = typeIcons[source.type] ?? File;
                return (
                  <motion.div
                    key={source.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, height: 0 }}
                    className="group flex items-start gap-2 p-2 rounded-md hover:bg-accent/50 transition-colors"
                  >
                    <Icon className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{source.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <StatusBadge status={source.status} />
                        {source.tokenCount && (
                          <span className="text-xs text-muted-foreground">
                            {source.tokenCount.toLocaleString()} tokens
                          </span>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                      onClick={() =>
                        deleteSource.mutate({ id: source.id, notebookId })
                      }
                    >
                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        ) : (
          <div className="p-6">
            <FileUploader notebookId={notebookId} />
          </div>
        )}
      </div>
    </div>
  );
};
