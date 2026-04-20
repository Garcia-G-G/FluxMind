"use client";

import Link from "next/link";
import { MoreHorizontal, Pencil, Trash2, FileText, BookOpen } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { GlassCard } from "@/components/shared/glass-card";
import { BreathingIcon } from "@/components/shared/breathing-icon";
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
  onEdit,
  onDelete,
}: {
  notebook: NotebookWithCount;
  index?: number;
  onEdit: (notebook: NotebookWithCount) => void;
  onDelete: (notebook: NotebookWithCount) => void;
}): React.ReactNode => {
  return (
    <Link href={`/notebook/${notebook.id}`} className="block group">
      <GlassCard hover padding="md" className="relative overflow-hidden">
        {/* Top accent line */}
        <div
          className="absolute top-0 left-0 right-0 h-[2px]"
          style={{ background: `linear-gradient(90deg, ${notebook.color ?? "var(--fm-accent-violet)"}, transparent)` }}
        />

        <div className="flex items-start gap-3 pt-1">
          <BreathingIcon icon={BookOpen} size={36} accent={notebook.color ?? "#7c3aed"} />

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between">
              <h3
                className="font-display text-lg font-normal truncate"
                style={{ color: "var(--fm-text)" }}
              >
                {notebook.title}
              </h3>
              <div
                onClick={(e) => e.preventDefault()}
                className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-2"
              >
                <DropdownMenu>
                  <DropdownMenuTrigger
                    className="h-7 w-7 inline-flex items-center justify-center rounded-lg transition-colors cursor-pointer"
                    style={{ color: "var(--fm-text-tertiary)" }}
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={(e) => { e.preventDefault(); onEdit(notebook); }}>
                      <Pencil className="mr-2 h-3.5 w-3.5" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive" onClick={(e) => { e.preventDefault(); onDelete(notebook); }}>
                      <Trash2 className="mr-2 h-3.5 w-3.5" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {notebook.description && (
              <p className="text-xs mt-1 line-clamp-2" style={{ color: "var(--fm-text-secondary)" }}>
                {notebook.description}
              </p>
            )}

            <div className="flex items-center gap-3 mt-3">
              <span className="flex items-center gap-1 text-xs" style={{ color: "var(--fm-text-secondary)" }}>
                <FileText className="h-3 w-3" />
                {notebook.sourceCount ?? 0} sources
              </span>
              <span className="text-xs" style={{ color: "var(--fm-text-tertiary)" }}>
                {formatRelativeTime(notebook.updatedAt)}
              </span>
            </div>
          </div>
        </div>
      </GlassCard>
    </Link>
  );
};
