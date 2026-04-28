"use client";

import { useState, useMemo, useEffect } from "react";
import {
  FileText,
  FileSpreadsheet,
  Image as ImageIcon,
  File,
  Loader2,
  AlertTriangle,
  Trash2,
  Link,
  PlayCircle,
  BookOpen,
  Check,
  Globe,
  ChevronDown,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { UnifiedSourceInput } from "@/components/upload/unified-source-input";
import { useSources, useDeleteSource } from "@/hooks/use-sources";

/* ── Type → icon + accent color ── */
const typeConfig: Record<string, { icon: React.ElementType; color: string }> = {
  pdf: { icon: FileText, color: "#ef4444" },
  docx: { icon: FileText, color: "#2563eb" },
  txt: { icon: File, color: "#8b5cf6" },
  csv: { icon: FileSpreadsheet, color: "#22c55e" },
  image: { icon: ImageIcon, color: "#f59e0b" },
  url: { icon: Link, color: "#3b82f6" },
  youtube: { icon: PlayCircle, color: "#ef4444" },
};
const fallbackCfg = { icon: File, color: "#6b7280" };

/* Special visual override for web-search sources: they live as type="txt" in
 * the DB (metadata.origin === "web-search") but should look like web-research
 * rather than a plain text file. */
const WEB_SEARCH_CFG = { icon: Globe, color: "#3b82f6" } as const;

type FoundUrl = {
  url: string;
  title: string;
  domain: string;
  favicon: string;
};

const isWebSearchSource = (meta: unknown): boolean => {
  if (typeof meta !== "object" || meta === null) return false;
  return (meta as { origin?: unknown }).origin === "web-search";
};

const getFoundUrls = (meta: unknown): FoundUrl[] => {
  if (typeof meta !== "object" || meta === null) return [];
  const raw = (meta as { foundUrls?: unknown }).foundUrls;
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (u): u is FoundUrl =>
      typeof u === "object" &&
      u !== null &&
      typeof (u as FoundUrl).url === "string" &&
      typeof (u as FoundUrl).title === "string" &&
      typeof (u as FoundUrl).domain === "string" &&
      typeof (u as FoundUrl).favicon === "string",
  );
};

/* ── Inline checkbox ── */
const SourceCheck = ({
  checked,
  color,
  onChange,
}: {
  checked: boolean;
  color: string;
  onChange: () => void;
}): React.ReactNode => (
  <button
    onClick={(e) => { e.stopPropagation(); onChange(); }}
    className="shrink-0 flex items-center justify-center rounded transition-colors"
    style={{
      width: 18,
      height: 18,
      background: checked ? color : "transparent",
      border: checked ? "none" : "1.5px solid var(--fm-surface-border)",
    }}
  >
    {checked && <Check className="h-3 w-3 text-white" strokeWidth={2.5} />}
  </button>
);

export const SourcePanel = ({
  notebookId,
}: {
  notebookId: string;
}): React.ReactNode => {
  const { data: sources, isLoading } = useSources(notebookId);
  const deleteSource = useDeleteSource();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggleExpanded = (id: string): void => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const sourceCount = sources?.length ?? 0;
  const readySources = useMemo(
    () => sources?.filter((s) => s.status === "ready") ?? [],
    [sources],
  );

  /* Initialise selection to all ready sources */
  const allSelected = readySources.length > 0 && readySources.every((s) => selected.has(s.id));

  const toggleAll = (): void => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(readySources.map((s) => s.id)));
    }
  };

  const toggleOne = (id: string): void => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Auto-select new ready sources on first load
  useEffect(() => {
    if (readySources.length > 0 && selected.size === 0) {
      setSelected(new Set(readySources.map((s) => s.id)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readySources.length]);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: "1px solid var(--fm-surface-border)" }}
      >
        <h2 className="text-sm font-semibold" style={{ color: "var(--fm-text)" }}>
          Sources
        </h2>
        {sourceCount > 0 && (
          <span
            className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
            style={{ background: "var(--fm-surface)", color: "var(--fm-text-tertiary)" }}
          >
            {sourceCount}
          </span>
        )}
      </div>

      {/* Add sources button */}
      <div className="px-3 pt-3 pb-1">
        <UnifiedSourceInput notebookId={notebookId} />
      </div>

      {/* Select all toggle */}
      {sourceCount > 0 && (
        <div
          className="flex items-center justify-between px-4 py-2 mt-1"
          style={{ borderBottom: "1px solid var(--fm-surface-border)" }}
        >
          <button
            onClick={toggleAll}
            className="flex items-center gap-2 text-[12px] transition-colors"
            style={{ color: "var(--fm-text-secondary)" }}
          >
            <SourceCheck
              checked={allSelected}
              color="var(--fm-accent-violet)"
              onChange={toggleAll}
            />
            Select all sources
          </button>
          <span className="text-[10px]" style={{ color: "var(--fm-text-tertiary)" }}>
            {selected.size}/{sourceCount}
          </span>
        </div>
      )}

      {/* Source list */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="px-3 py-2 space-y-1">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton
                key={i}
                className="h-10 rounded-lg"
                style={{ background: "var(--fm-surface)" }}
              />
            ))}
          </div>
        ) : sourceCount > 0 ? (
          <div className="px-2 py-1">
            {sources!.map((source, i) => {
              const isWebSearch = isWebSearchSource(source.metadata);
              const cfg = isWebSearch
                ? WEB_SEARCH_CFG
                : (typeConfig[source.type] ?? fallbackCfg);
              const Icon = cfg.icon;
              const isReady = source.status === "ready";
              const isProcessing = source.status === "pending" || source.status === "processing";
              const isError = source.status === "error";
              const isChecked = selected.has(source.id);
              // Build the URL list to show under the source title. Priority:
              //   1. Web-search sources carry multiple URLs in metadata.foundUrls.
              //   2. URL / YouTube sources carry a single originalUrl column.
              //   3. File / pasted-text sources have neither — nothing to show.
              const foundUrls: FoundUrl[] = (() => {
                if (isWebSearch) return getFoundUrls(source.metadata);
                if (source.originalUrl) {
                  let hostname = source.originalUrl;
                  try {
                    hostname = new URL(source.originalUrl).hostname;
                  } catch {
                    /* leave hostname as the raw string */
                  }
                  return [
                    {
                      url: source.originalUrl,
                      title: source.title || hostname,
                      domain: hostname,
                      favicon: `https://www.google.com/s2/favicons?domain=${hostname}&sz=64`,
                    },
                  ];
                }
                return [];
              })();
              const isExpanded = expanded.has(source.id);
              const canExpand = foundUrls.length > 0;

              return (
                <div
                  key={source.id}
                  className="group fm-stagger-item"
                  style={{ animationDelay: `${i * 15}ms` }}
                >
                  <div className="flex items-center gap-2.5 px-2 py-2 rounded-lg transition-colors hover:bg-[var(--fm-surface-hover)]">
                  {/* Favicon-style icon */}
                  <div
                    className="shrink-0 flex items-center justify-center rounded-md"
                    style={{
                      width: 24,
                      height: 24,
                      background: `${cfg.color}18`,
                    }}
                  >
                    {isProcessing ? (
                      <Loader2
                        className="h-3.5 w-3.5 animate-spin"
                        style={{ color: cfg.color }}
                      />
                    ) : isError ? (
                      <AlertTriangle
                        className="h-3.5 w-3.5"
                        style={{ color: "var(--fm-error)" }}
                      />
                    ) : (
                      <Icon
                        className="h-3.5 w-3.5"
                        style={{ color: cfg.color }}
                        strokeWidth={1.8}
                      />
                    )}
                  </div>

                  {/* Title (click to expand for web-search) */}
                  {canExpand ? (
                    <button
                      type="button"
                      onClick={() => toggleExpanded(source.id)}
                      aria-expanded={isExpanded}
                      className="flex-1 min-w-0 flex items-center gap-1.5 text-left"
                    >
                      <span
                        className="min-w-0 text-[13px] truncate"
                        style={{
                          color: isError
                            ? "var(--fm-text-tertiary)"
                            : "var(--fm-text-secondary)",
                        }}
                      >
                        {source.title}
                      </span>
                      <span
                        className="shrink-0 text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                        style={{
                          background: `${cfg.color}18`,
                          color: cfg.color,
                        }}
                      >
                        {foundUrls.length}
                      </span>
                      <ChevronDown
                        className="shrink-0 h-3 w-3 transition-transform"
                        style={{
                          color: "var(--fm-text-tertiary)",
                          transform: isExpanded ? "rotate(180deg)" : "none",
                        }}
                      />
                    </button>
                  ) : (
                    <span
                      className="flex-1 min-w-0 text-[13px] truncate"
                      style={{
                        color: isError
                          ? "var(--fm-text-tertiary)"
                          : "var(--fm-text-secondary)",
                      }}
                    >
                      {source.title}
                    </span>
                  )}

                  {/* Right side: checkbox or delete */}
                  <div className="shrink-0 flex items-center">
                    {isReady && (
                      <SourceCheck
                        checked={isChecked}
                        color={cfg.color}
                        onChange={() => toggleOne(source.id)}
                      />
                    )}
                    <button
                      aria-label={`Delete source ${source.title}`}
                      className="ml-1 p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity text-[var(--fm-text-tertiary)] hover:text-[var(--fm-error)]"
                      onClick={() => {
                        // Native confirm keeps the surface minimal; a dialog
                        // can replace this later when we have a shared
                        // destructive-action component.
                        const ok = window.confirm(
                          `Delete "${source.title}"? This can't be undone.`,
                        );
                        if (ok) deleteSource.mutate({ id: source.id, notebookId });
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                  </div>

                  {/* Found URLs — only for web-search sources */}
                  {canExpand && isExpanded && (
                    <div className="ml-9 mr-2 mb-2 mt-1 flex flex-col gap-1 max-h-[220px] overflow-y-auto">
                      <span
                        className="text-[10px] font-semibold uppercase tracking-wider px-1"
                        style={{ color: "var(--fm-text-tertiary)" }}
                      >
                        Sources found ({foundUrls.length})
                      </span>
                      {foundUrls.map((found) => (
                        <a
                          key={found.url}
                          href={found.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors hover:bg-[var(--fm-surface-elevated)]"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={found.favicon}
                            alt=""
                            width={14}
                            height={14}
                            loading="lazy"
                            decoding="async"
                            className="shrink-0 rounded-sm"
                            style={{ objectFit: "contain" }}
                          />
                          <span
                            className="truncate flex-1 font-medium"
                            style={{ color: "var(--fm-text)" }}
                          >
                            {found.title}
                          </span>
                          <span
                            className="shrink-0 text-[10px]"
                            style={{ color: "var(--fm-text-tertiary)" }}
                          >
                            {found.domain}
                          </span>
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <div
              className="flex items-center justify-center rounded-xl mb-3"
              style={{ width: 44, height: 44, background: "var(--fm-surface)" }}
            >
              <BookOpen
                className="h-5 w-5"
                style={{ color: "var(--fm-text-tertiary)" }}
                strokeWidth={1.5}
              />
            </div>
            <p className="text-xs font-medium mb-1" style={{ color: "var(--fm-text-secondary)" }}>
              No sources yet
            </p>
            <p
              className="text-[11px] text-center leading-relaxed"
              style={{ color: "var(--fm-text-tertiary)" }}
            >
              Paste a URL, drop files, or search a topic to get started
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
