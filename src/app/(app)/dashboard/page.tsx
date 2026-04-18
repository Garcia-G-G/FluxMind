"use client";

import { useState, useEffect } from "react";
import {
  Plus,
  BookOpen,
  FileText,
  MessageSquare,
  Sparkles,
  MoreHorizontal,
  ChevronRight,
  ArrowRight,
} from "lucide-react";
import { motion } from "motion/react";
import { GlassCard } from "@/components/shared/glass-card";
import { useSession } from "@/lib/auth-client";
import { useNotebooks, useDeleteNotebook } from "@/hooks/use-notebooks";
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
  { icon: BookOpen, label: "Active Notebooks", color: "#ff6b35", bg: "rgba(255,107,53,0.12)" },
  { icon: FileText, label: "Sources Added", color: "#e11d48", bg: "rgba(225,29,72,0.12)" },
  { icon: MessageSquare, label: "AI Conversations", color: "#7c3aed", bg: "rgba(124,58,237,0.12)" },
  { icon: Sparkles, label: "Studio Outputs", color: "#2563eb", bg: "rgba(37,99,235,0.12)" },
];

// Notebook card icon colors matching the mockup
const CARD_COLORS = [
  "#ff6b35", "#e11d48", "#7c3aed", "#2563eb", "#f59e0b", "#22c55e",
];

const CARD_ICONS = [Sparkles, FileText, MessageSquare, BookOpen, Sparkles, ChevronRight];

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

const containerVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

const DashboardPage = (): React.ReactNode => {
  const { data: session } = useSession();
  const [createOpen, setCreateOpen] = useState(false);
  const [editNotebook, setEditNotebook] = useState<NotebookWithCount | null>(null);
  const [deleteNotebook, setDeleteNotebook] = useState<NotebookWithCount | null>(null);

  const { data: notebooks, isLoading } = useNotebooks("", "updatedAt", "desc");
  const deleteNotebookMutation = useDeleteNotebook();

  useEffect(() => {
    const handler = (): void => setCreateOpen(true);
    window.addEventListener("fluxmind:create-notebook", handler);
    return () => window.removeEventListener("fluxmind:create-notebook", handler);
  }, []);

  const lastName = session?.user?.name?.split(" ").pop() ?? "there";
  const notebookCount = notebooks?.length ?? 0;

  return (
    <div className="max-w-6xl mx-auto">
      {/* Greeting */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="mb-6"
      >
        <h1
          className="text-3xl sm:text-4xl font-bold tracking-tight"
          style={{
            background: "linear-gradient(90deg, var(--fm-accent-orange), var(--fm-accent-rose))",
            backgroundClip: "text",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          {getGreeting()}, {lastName}
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--fm-text-secondary)" }}>
          Your knowledge base is growing. {notebookCount > 0 ? `${notebookCount} notebooks updated today.` : "Create your first notebook to get started."}
        </p>
      </motion.div>

      {/* Stats grid — 4 cards */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-8"
      >
        {statConfig.map((stat, i) => (
          <motion.div key={stat.label} variants={itemVariants}>
            <GlassCard padding="md" hover>
              <div className="flex items-start justify-between mb-4">
                <div
                  className="h-10 w-10 rounded-xl flex items-center justify-center"
                  style={{ background: stat.bg }}
                >
                  <stat.icon className="h-5 w-5" style={{ color: stat.color }} />
                </div>
                <button style={{ color: "var(--fm-text-tertiary)" }}>
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </div>
              <p className="text-3xl font-bold" style={{ color: "var(--fm-text)" }}>
                {i === 0 ? notebookCount : i === 1 ? "0" : i === 2 ? "0" : "0"}
              </p>
              <p className="text-xs mt-0.5" style={{ color: "var(--fm-text-tertiary)" }}>
                {stat.label}
              </p>
            </GlassCard>
          </motion.div>
        ))}
      </motion.div>

      {/* Notebooks section */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold" style={{ color: "var(--fm-text)" }}>
          Your Notebooks
        </h2>
        <button
          className="flex items-center gap-1 text-sm transition-colors"
          style={{ color: "var(--fm-text-secondary)" }}
        >
          View all <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Notebook grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-2xl" style={{ background: "var(--fm-surface)" }} />
          ))}
        </div>
      ) : notebooks && notebooks.length > 0 ? (
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3"
        >
          {notebooks.map((notebook, i) => {
            const cardColor = notebook.color ?? CARD_COLORS[i % CARD_COLORS.length];
            const CardIcon = CARD_ICONS[i % CARD_ICONS.length];
            return (
              <motion.div key={notebook.id} variants={itemVariants}>
                <Link href={`/notebook/${notebook.id}`}>
                  <GlassCard hover padding="md" className="relative overflow-hidden cursor-pointer">
                    {/* Color top bar */}
                    <div
                      className="absolute top-0 left-0 right-0 h-[3px]"
                      style={{ background: cardColor }}
                    />

                    <div className="flex items-start gap-3 pt-2">
                      {/* Icon circle */}
                      <div
                        className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
                        style={{ background: `${cardColor}18` }}
                      >
                        <CardIcon className="h-5 w-5" style={{ color: cardColor }} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-base leading-tight" style={{ color: "var(--fm-text)" }}>
                          {notebook.title}
                        </h3>
                        <p className="text-xs mt-1" style={{ color: "var(--fm-text-secondary)" }}>
                          {notebook.sourceCount ?? 0} sources
                        </p>
                      </div>
                    </div>

                    {/* Bottom row */}
                    <div className="flex items-center justify-between mt-4 pt-3" style={{ borderTop: "1px solid var(--fm-surface-border)" }}>
                      <span className="text-xs" style={{ color: "var(--fm-text-tertiary)" }}>
                        {formatRelativeTime(notebook.updatedAt)}
                      </span>
                      <ChevronRight className="h-4 w-4" style={{ color: "var(--fm-text-tertiary)" }} />
                    </div>
                  </GlassCard>
                </Link>
              </motion.div>
            );
          })}
        </motion.div>
      ) : (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <GlassCard padding="lg">
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <BookOpen className="h-12 w-12 mb-4" style={{ color: "var(--fm-text-tertiary)" }} />
              <h3 className="text-lg font-medium mb-1" style={{ color: "var(--fm-text)" }}>
                Create your first notebook
              </h3>
              <p className="text-sm mb-4 max-w-sm" style={{ color: "var(--fm-text-secondary)" }}>
                Notebooks organize your sources, chat with AI, and create studio outputs.
              </p>
              <button
                onClick={() => setCreateOpen(true)}
                className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-white transition-transform hover:-translate-y-0.5"
                style={{ background: "var(--fm-accent-gradient)", borderRadius: 12 }}
              >
                <Plus className="h-4 w-4" />
                New Notebook
              </button>
            </div>
          </GlassCard>
        </motion.div>
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

export default DashboardPage;
