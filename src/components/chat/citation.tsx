"use client";

import { FileText } from "lucide-react";

export type CitationData = {
  sourceTitle: string;
  pageNumber: number | null;
  sourceId: string | null;
};

const CITATION_COLORS = [
  "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300",
];

export const Citation = ({
  citation,
  index,
}: {
  citation: CitationData;
  index: number;
}): React.ReactNode => {
  const colorClass = CITATION_COLORS[index % CITATION_COLORS.length];
  const label = citation.pageNumber
    ? `${citation.sourceTitle} p.${citation.pageNumber}`
    : citation.sourceTitle;

  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium cursor-pointer hover:opacity-80 transition-opacity ${colorClass}`}
      title={label}
    >
      <FileText className="h-3 w-3 shrink-0" />
      <span className="truncate max-w-[150px]">{label}</span>
    </span>
  );
};
