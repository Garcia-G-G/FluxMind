"use client";

import { FileText } from "lucide-react";

export type CitationData = {
  sourceTitle: string;
  pageNumber: number | null;
  sourceId: string | null;
};

export const Citation = ({
  citation,
}: {
  citation: CitationData;
  index: number;
}): React.ReactNode => {
  const label = citation.pageNumber
    ? `${citation.sourceTitle} p.${citation.pageNumber}`
    : citation.sourceTitle;

  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium cursor-pointer transition-transform hover:scale-105"
      style={{
        background: "var(--fm-glow-orange)",
        color: "var(--fm-accent-orange)",
      }}
      title={label}
    >
      <FileText className="h-3 w-3 shrink-0" />
      <span className="truncate max-w-[150px]">{label}</span>
    </span>
  );
};
