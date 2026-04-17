"use client";

import { useState, useEffect } from "react";
import {
  Plus,
  Search,
  LayoutGrid,
  List,
  ArrowUpDown,
  BookOpen,
  FileText,
  MessageSquare,
  Brain,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSession } from "@/lib/auth-client";
import { useNotebooks, useDeleteNotebook } from "@/hooks/use-notebooks";
import { NotebookCard } from "@/components/notebook/notebook-card";
import { CreateNotebookDialog } from "@/components/notebook/create-notebook-dialog";
import { EditNotebookDialog } from "@/components/notebook/edit-notebook-dialog";
import { DeleteNotebookDialog } from "@/components/notebook/delete-notebook-dialog";
import { GlassCard } from "@/components/shared/glass-card";
import { OrbitalIcon } from "@/components/shared/orbital-icon";
import type { Notebook } from "@/db/schema/notebooks";

type NotebookWithCount = Notebook & { sourceCount: number };

const getGreeting = (): string => {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
};

const statConfig = [
  { icon: BookOpen, label: "Total Notebooks", glowColor: "var(--fm-glow-orange)" },
  { icon: FileText, label: "Total Sources", glowColor: "var(--fm-glow-rose)" },
  { icon: MessageSquare, label: "Conversations", glowColor: "var(--fm-glow-violet)" },
  { icon: Brain, label: "Outputs Generated", glowColor: "var(--fm-glow-blue)" },
];

const containerVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

type SortOption = "updatedAt" | "createdAt" | "title";

const DashboardPage = (): React.ReactNode => {
  const { data: session } = useSession();
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortOption>("updatedAt");
  const [viewMode, setViewMode] = useState<"grid" | "list">(() => {
    if (typeof window === "undefined") return "grid";
    const stored = localStorage.getItem("fluxmind:view-mode");
    return stored === "list" ? "list" : "grid";
  });
  const [createOpen, setCreateOpen] = useState(false);
  const [editNotebook, setEditNotebook] = useState<NotebookWithCount | null>(null);
  const [deleteNotebook, setDeleteNotebook] = useState<NotebookWithCount | null>(null);

  const { data: notebooks, isLoading } = useNotebooks(search, sort, "desc");
  const deleteNotebookMutation = useDeleteNotebook();

  useEffect(() => {
    localStorage.setItem("fluxmind:view-mode", viewMode);
  }, [viewMode]);

  useEffect(() => {
    const handler = (): void => setCreateOpen(true);
    window.addEventListener("fluxmind:create-notebook", handler);
    return () => window.removeEventListener("fluxmind:create-notebook", handler);
  }, []);

  const firstName = session?.user?.name?.split(" ")[0] ?? "there";
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
          className="text-2xl sm:text-3xl font-bold tracking-tight"
          style={{
            background: "var(--fm-accent-gradient-text)",
            backgroundSize: "200% auto",
            backgroundClip: "text",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            animation: "gradientShift 3s linear infinite",
          }}
        >
          {getGreeting()}, {firstName}
        </h1>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="text-sm mt-1"
          style={{ color: "var(--fm-text-secondary)" }}
        >
          Here&apos;s what&apos;s happening across your notebooks.
        </motion.p>
      </motion.div>

      {/* Stats grid */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-8"
      >
        {statConfig.map((stat, i) => (
          <motion.div key={stat.label} variants={itemVariants}>
            <GlassCard hover padding="md">
              <div className="flex items-start gap-3">
                <OrbitalIcon
                  icon={stat.icon}
                  size={40}
                  glowColor={stat.glowColor}
                />
                <div>
                  <p className="text-2xl font-bold" style={{ color: "var(--fm-text)" }}>
                    {i === 0 ? notebookCount : 0}
                  </p>
                  <p className="text-xs" style={{ color: "var(--fm-text-secondary)" }}>
                    {stat.label}
                  </p>
                </div>
              </div>
            </GlassCard>
          </motion.div>
        ))}
      </motion.div>

      {/* Notebooks section header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold" style={{ color: "var(--fm-text)" }}>
          Your Notebooks
        </h2>
        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative max-w-[200px] hidden sm:block">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5" style={{ color: "var(--fm-text-tertiary)" }} />
            <input
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 h-8 text-xs"
              style={{
                background: "var(--fm-input-bg)",
                border: "1px solid var(--fm-input-border)",
                borderRadius: 10,
                color: "var(--fm-text)",
                outline: "none",
              }}
            />
          </div>

          {/* Sort */}
          <DropdownMenu>
            <DropdownMenuTrigger
              className="inline-flex items-center gap-1.5 px-2.5 h-8 text-xs cursor-pointer transition-colors"
              style={{
                background: "var(--fm-input-bg)",
                border: "1px solid var(--fm-input-border)",
                borderRadius: 10,
                color: "var(--fm-text-secondary)",
              }}
            >
              <ArrowUpDown className="h-3.5 w-3.5" />
              Sort
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setSort("updatedAt")}>Last Modified</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSort("createdAt")}>Created Date</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSort("title")}>Alphabetical</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* View toggle */}
          <div className="hidden sm:flex items-center" style={{ border: "1px solid var(--fm-input-border)", borderRadius: 10, overflow: "hidden" }}>
            <button
              onClick={() => setViewMode("grid")}
              className="p-1.5 transition-colors"
              style={{
                background: viewMode === "grid" ? "var(--fm-surface-hover)" : "transparent",
                color: viewMode === "grid" ? "var(--fm-text)" : "var(--fm-text-tertiary)",
              }}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className="p-1.5 transition-colors"
              style={{
                background: viewMode === "list" ? "var(--fm-surface-hover)" : "transparent",
                color: viewMode === "list" ? "var(--fm-text)" : "var(--fm-text-tertiary)",
              }}
            >
              <List className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* New Notebook button */}
          <button
            onClick={() => setCreateOpen(true)}
            className="flex items-center gap-1.5 px-3 h-8 text-xs font-medium text-white transition-transform hover:-translate-y-0.5"
            style={{ background: "var(--fm-accent-gradient)", borderRadius: 10 }}
          >
            <Plus className="h-3.5 w-3.5" />
            New
          </button>
        </div>
      </div>

      {/* Notebook grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-2xl" style={{ background: "var(--fm-surface)" }} />
          ))}
        </div>
      ) : notebooks && notebooks.length > 0 ? (
        <AnimatePresence mode="popLayout">
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className={
              viewMode === "grid"
                ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3"
                : "flex flex-col gap-2"
            }
          >
            {notebooks.map((notebook, i) => (
              <motion.div key={notebook.id} variants={itemVariants}>
                <NotebookCard
                  notebook={notebook}
                  index={i}
                  onEdit={setEditNotebook}
                  onDelete={setDeleteNotebook}
                />
              </motion.div>
            ))}
          </motion.div>
        </AnimatePresence>
      ) : (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <GlassCard padding="lg">
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <BookOpen className="h-12 w-12 mb-4" style={{ color: "var(--fm-text-tertiary)" }} />
              <h3 className="text-lg font-medium mb-1" style={{ color: "var(--fm-text)" }}>
                {search ? "No notebooks found" : "Create your first notebook"}
              </h3>
              <p className="text-sm mb-4 max-w-sm" style={{ color: "var(--fm-text-secondary)" }}>
                {search
                  ? "Try a different search term"
                  : "Notebooks are where you organize your sources, chat with AI, and create studio outputs."}
              </p>
              {!search && (
                <button
                  onClick={() => setCreateOpen(true)}
                  className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-white transition-transform hover:-translate-y-0.5"
                  style={{ background: "var(--fm-accent-gradient)", borderRadius: 12 }}
                >
                  <Plus className="h-4 w-4" />
                  New Notebook
                </button>
              )}
            </div>
          </GlassCard>
        </motion.div>
      )}

      <CreateNotebookDialog open={createOpen} onOpenChange={setCreateOpen} />

      {editNotebook && (
        <EditNotebookDialog
          notebook={editNotebook}
          open={!!editNotebook}
          onOpenChange={(open) => { if (!open) setEditNotebook(null); }}
        />
      )}

      {deleteNotebook && (
        <DeleteNotebookDialog
          notebook={deleteNotebook}
          open={!!deleteNotebook}
          onOpenChange={(open) => { if (!open) setDeleteNotebook(null); }}
          onConfirm={() => { deleteNotebookMutation.mutate(deleteNotebook.id); setDeleteNotebook(null); }}
          isDeleting={deleteNotebookMutation.isPending}
        />
      )}
    </div>
  );
};

export default DashboardPage;
