"use client";

import { useState, useEffect, Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import {
  Plus,
  BookOpen,
  FileText,
  MessageSquare,
  Sparkles,
  ChevronRight,
  ArrowRight,
  Upload,
  Star,
  Users,
} from "lucide-react";
import { OrbitalIcon } from "@/components/shared/orbital-icon";
import { BreathingIcon } from "@/components/shared/breathing-icon";
import { AccentIcon } from "@/components/shared/accent-icon";
import { resolveIcon } from "@/lib/icon-resolver";
import { useSession } from "@/lib/auth-client";
import { useNotebooks, useDeleteNotebook } from "@/hooks/use-notebooks";
import { useStats } from "@/hooks/use-stats";
import { CreateNotebookDialog } from "@/components/notebook/create-notebook-dialog";
import { EditNotebookDialog } from "@/components/notebook/edit-notebook-dialog";
import { DeleteNotebookDialog } from "@/components/notebook/delete-notebook-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import type { Notebook } from "@/db/schema/notebooks";
import Link from "next/link";

type NotebookWithCount = Notebook & { sourceCount: number };

const getGreeting = (): string => {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
};

const statConfig = [
  { icon: BookOpen, label: "Active Notebooks", color: "#ff6b35" },
  { icon: FileText, label: "Sources Added", color: "#e11d48" },
  { icon: MessageSquare, label: "AI Conversations", color: "#7c3aed" },
  { icon: Sparkles, label: "Studio Outputs", color: "#2563eb" },
];

const CARD_COLORS = [
  "#ff6b35", "#e11d48", "#7c3aed", "#2563eb", "#f59e0b", "#22c55e",
];

const formatRelativeTime = (date: Date): string => {
  const now = new Date();
  const diff = now.getTime() - new Date(date).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `Updated ${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Updated ${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `Updated ${days}d ago`;
};

const VIEW_TITLES: Record<string, string> = {
  all: "All Notebooks",
  recent: "Recent",
  shared: "Shared with Me",
  starred: "Starred",
};

const DashboardContent = (): React.ReactNode => {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const currentView = searchParams.get("view");
  const [createOpen, setCreateOpen] = useState(false);
  const [editNotebook, setEditNotebook] = useState<NotebookWithCount | null>(null);
  const [deleteNotebook, setDeleteNotebook] = useState<NotebookWithCount | null>(null);

  const { data: notebooks, isLoading } = useNotebooks("", "updatedAt", "desc");
  const { data: stats } = useStats();
  const deleteNotebookMutation = useDeleteNotebook();

  useEffect(() => {
    const handler = (): void => setCreateOpen(true);
    window.addEventListener("fluxmind:create-notebook", handler);
    return () => window.removeEventListener("fluxmind:create-notebook", handler);
  }, []);

  const [today, setToday] = useState<string>("");
  const [greeting, setGreeting] = useState<string>("");
  useEffect(() => {
    setToday(
      new Date().toLocaleDateString("en-US", {
        weekday: "long",
        month: "short",
        day: "numeric",
      }),
    );
    setGreeting(getGreeting());
  }, []);

  const filteredNotebooks = useMemo(() => {
    if (!notebooks) return [];
    switch (currentView) {
      case "starred":
        return [];
      case "shared":
        return [];
      case "recent":
        return [...notebooks].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      case "all":
        return notebooks;
      default:
        return notebooks;
    }
  }, [notebooks, currentView]);

  const isFilteredView = currentView === "starred" || currentView === "shared";

  const lastName = session?.user?.name?.split(" ").pop() ?? "there";
  const notebookCount = notebooks?.length ?? 0;
  const statValues = [
    stats?.notebooks ?? 0,
    stats?.sources ?? 0,
    stats?.conversations ?? 0,
    stats?.outputs ?? 0,
  ];

  return (
    <div className="max-w-6xl mx-auto">
      {/* Greeting — CSS fade-in */}
      <div className="mb-8 fm-fade-in">
        <h1
          className="font-display text-4xl sm:text-5xl lg:text-[56px] font-normal tracking-tight leading-[1.1]"
          style={{
            backgroundImage: "linear-gradient(90deg, #ff6b35, #e11d48, #7c3aed, #2563eb, #ff6b35)",
            backgroundSize: "200% auto",
            backgroundClip: "text",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            display: "inline-block",
          }}
        >
          {greeting || "\u00A0"}{greeting && `, ${lastName}`}
        </h1>
        <p className="text-base mt-3" style={{ color: "var(--fm-text-secondary)" }}>
          {notebookCount} notebook{notebookCount === 1 ? "" : "s"}
          {today ? ` · ${today}` : ""}
        </p>
      </div>

      {/* Stats grid — v3 Liquid style */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-10">
        {statConfig.map((stat, i) => (
          <div
            key={stat.label}
            className="rounded-2xl p-5 fm-stagger-item fm-lift-card"
            style={{
              animationDelay: `${i * 60}ms`,
              background: "var(--fm-glass-bg)",
              border: "1px solid var(--fm-glass-border)",
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <OrbitalIcon icon={stat.icon} accent={stat.color} size={42} />
            </div>
            <p
              className="text-[28px] font-bold tracking-tight"
              style={{ color: "var(--fm-text)", letterSpacing: "-0.03em" }}
            >
              {statValues[i]}
            </p>
            <p className="text-[13px] font-light mt-1" style={{ color: "var(--fm-text-tertiary)" }}>
              {stat.label}
            </p>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-3 mb-10">
        <button
          onClick={() => setCreateOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white rounded-xl transition-transform hover:-translate-y-0.5"
          style={{ background: "var(--fm-accent-orange)" }}
        >
          <Plus className="h-4 w-4" />
          New Notebook
        </button>
        {notebooks && notebooks.length > 0 && (
          <Link
            href={`/notebook/${notebooks[0].id}`}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl transition-transform hover:-translate-y-0.5"
            style={{
              background: "var(--fm-surface)",
              border: "1px solid var(--fm-surface-border)",
              color: "var(--fm-text)",
            }}
          >
            <Upload className="h-4 w-4" />
            Upload Sources
          </Link>
        )}
      </div>

      {/* Notebooks section */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-2xl font-normal" style={{ color: "var(--fm-text)" }}>
          {currentView ? VIEW_TITLES[currentView] ?? "Your Notebooks" : "Your Notebooks"}
        </h2>
        {!currentView && (
          <Link
            href="/dashboard?view=all"
            className="flex items-center gap-1 text-sm transition-colors hover:opacity-80"
            style={{ color: "var(--fm-text-secondary)" }}
          >
            View all <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>

      {/* Filtered empty states */}
      {isFilteredView && filteredNotebooks.length === 0 ? (
        <div
          className="fm-fade-in rounded-2xl py-16 text-center"
          style={{ background: "var(--fm-glass-bg)", border: "1px solid var(--fm-glass-border)" }}
        >
          <AccentIcon
            icon={currentView === "starred" ? Star : Users}
            accent={currentView === "starred" ? "#f59e0b" : "#22c55e"}
            size={48}
            className="mx-auto"
          />
          <h3 className="font-display text-xl font-normal mt-5 mb-1" style={{ color: "var(--fm-text)" }}>
            {currentView === "starred" ? "No starred notebooks yet" : "No shared notebooks yet"}
          </h3>
          <p className="text-sm max-w-sm mx-auto" style={{ color: "var(--fm-text-tertiary)" }}>
            {currentView === "starred"
              ? "Star a notebook to find it quickly here."
              : "Notebooks shared with you will appear here."}
          </p>
        </div>
      ) : isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-2xl" style={{ background: "var(--fm-surface)" }} />
          ))}
        </div>
      ) : filteredNotebooks.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 fm-stagger-grid">
          {filteredNotebooks.map((notebook, i) => {
            const cardColor = notebook.color ?? CARD_COLORS[i % CARD_COLORS.length];
            const CardIcon = resolveIcon(notebook.icon ?? "BookOpen");
            return (
              <div key={notebook.id} className="fm-stagger-item" style={{ animationDelay: `${i * 60}ms` }}>
                <Link
                  href={`/notebook/${notebook.id}`}
                  className="block group"
                >
                  <div
                    className="relative overflow-hidden rounded-2xl p-5 transition-transform duration-300 hover:-translate-y-1"
                    style={{
                      background: "var(--fm-glass-bg)",
                      border: "1px solid var(--fm-glass-border)",
                    }}
                  >
                    {/* Top accent line */}
                    <div
                      className="absolute top-0 left-0 right-0 h-[2px]"
                      style={{ background: `linear-gradient(90deg, ${cardColor}, transparent)` }}
                    />

                    <div className="flex items-start gap-3">
                      <BreathingIcon icon={CardIcon} accent={cardColor} size={38} />
                      <div className="flex-1 min-w-0 pt-0.5">
                        <h3
                          className="font-semibold text-[15px] leading-snug tracking-[-0.01em]"
                          style={{ color: "var(--fm-text)" }}
                        >
                          {notebook.title}
                        </h3>
                        <p className="text-xs mt-1.5" style={{ color: "var(--fm-text-tertiary)" }}>
                          {notebook.sourceCount ?? 0} sources
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-5 pt-3" style={{ borderTop: "1px solid var(--fm-surface-border)" }}>
                      <span className="text-[11px]" style={{ color: "var(--fm-text-tertiary)" }}>
                        {formatRelativeTime(notebook.updatedAt)}
                      </span>
                      <ChevronRight
                        className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity"
                        style={{ color: "var(--fm-text-secondary)" }}
                      />
                    </div>
                  </div>
                </Link>
              </div>
            );
          })}
        </div>
      ) : (
        <div
          className="fm-fade-in rounded-2xl py-16 text-center"
          style={{ background: "var(--fm-glass-bg)", border: "1px solid var(--fm-glass-border)" }}
        >
          <AccentIcon icon={BookOpen} accent="#7c3aed" size={48} className="mx-auto" />
          <h3 className="font-display text-xl font-normal mt-5 mb-1" style={{ color: "var(--fm-text)" }}>
            Create your first notebook
          </h3>
          <p className="text-sm mb-6 max-w-sm mx-auto" style={{ color: "var(--fm-text-tertiary)" }}>
            Notebooks organize your sources, chat with AI, and create studio outputs.
          </p>
          <button
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 text-sm font-medium text-white rounded-xl transition-transform hover:-translate-y-0.5"
            style={{ background: "var(--fm-accent-orange)" }}
          >
            <Plus className="h-4 w-4" />
            New Notebook
          </button>
        </div>
      )}

      <CreateNotebookDialog open={createOpen} onOpenChange={setCreateOpen} />
      {editNotebook && (
        <EditNotebookDialog notebook={editNotebook} open={!!editNotebook} onOpenChange={(open) => { if (!open) setEditNotebook(null); }} />
      )}
      {deleteNotebook && (
        <DeleteNotebookDialog notebook={deleteNotebook} open={!!deleteNotebook} onOpenChange={(open) => { if (!open) setDeleteNotebook(null); }}
          onConfirm={() => { deleteNotebookMutation.mutate(deleteNotebook.id); setDeleteNotebook(null); }}
          isDeleting={deleteNotebookMutation.isPending} />
      )}
    </div>
  );
};

const DashboardPage = (): React.ReactNode => {
  return (
    <Suspense fallback={<div />}>
      <DashboardContent />
    </Suspense>
  );
};

export default DashboardPage;
