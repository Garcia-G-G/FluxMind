"use client";

import Link from "next/link";
import { MoreHorizontal, Pencil, Trash2, FileText } from "lucide-react";
import { motion } from "motion/react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import type { Notebook } from "@/db/schema/notebooks";

type NotebookWithCount = Notebook & { sourceCount: number };

const formatRelativeTime = (date: Date): string => {
  const now = new Date();
  const diff = now.getTime() - new Date(date).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(date).toLocaleDateString();
};

export const NotebookCard = ({
  notebook,
  index,
  onEdit,
  onDelete,
}: {
  notebook: NotebookWithCount;
  index: number;
  onEdit: (notebook: NotebookWithCount) => void;
  onDelete: (notebook: NotebookWithCount) => void;
}): React.ReactNode => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
    >
      <Link href={`/notebook/${notebook.id}`} className="block group">
        <div className="relative rounded-lg border border-border bg-card p-4 transition-all duration-200 hover:shadow-md hover:scale-[1.02] hover:border-border/80">
          <div
            className="absolute left-0 top-3 bottom-3 w-1 rounded-full"
            style={{ backgroundColor: notebook.color ?? "#6366f1" }}
          />

          <div className="pl-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-lg shrink-0">
                  {notebook.icon ?? "📓"}
                </span>
                <h3 className="font-medium text-sm truncate">
                  {notebook.title}
                </h3>
              </div>
              <div
                onClick={(e) => e.preventDefault()}
                className="opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <DropdownMenu>
                  <DropdownMenuTrigger className="h-7 w-7 inline-flex items-center justify-center rounded-md hover:bg-accent transition-colors cursor-pointer">
                    <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.preventDefault();
                        onEdit(notebook);
                      }}
                    >
                      <Pencil className="mr-2 h-3.5 w-3.5" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={(e) => {
                        e.preventDefault();
                        onDelete(notebook);
                      }}
                    >
                      <Trash2 className="mr-2 h-3.5 w-3.5" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {notebook.description && (
              <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">
                {notebook.description}
              </p>
            )}

            <div className="flex items-center gap-3 mt-3">
              <Badge variant="secondary" className="text-xs gap-1 px-1.5 py-0">
                <FileText className="h-3 w-3" />
                {notebook.sourceCount ?? 0}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {formatRelativeTime(notebook.updatedAt)}
              </span>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
};
