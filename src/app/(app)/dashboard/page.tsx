"use client";

import { useState, useEffect } from "react";
import {
  Plus,
  Search,
  LayoutGrid,
  List,
  ArrowUpDown,
  BookOpen,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "@/lib/auth-client";
import { useNotebooks, useDeleteNotebook } from "@/hooks/use-notebooks";
import { NotebookCard } from "@/components/notebook/notebook-card";
import { CreateNotebookDialog } from "@/components/notebook/create-notebook-dialog";
import { EditNotebookDialog } from "@/components/notebook/edit-notebook-dialog";
import { DeleteNotebookDialog } from "@/components/notebook/delete-notebook-dialog";
import type { Notebook } from "@/db/schema/notebooks";

type NotebookWithCount = Notebook & { sourceCount: number };

const getGreeting = (): string => {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
};

type SortOption = "updatedAt" | "createdAt" | "title";

const DashboardPage = (): React.ReactNode => {
  const { data: session } = useSession();
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortOption>("updatedAt");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [createOpen, setCreateOpen] = useState(false);
  const [editNotebook, setEditNotebook] = useState<NotebookWithCount | null>(null);
  const [deleteNotebook, setDeleteNotebook] = useState<NotebookWithCount | null>(null);

  const { data: notebooks, isLoading } = useNotebooks(search, sort, "desc");
  const deleteNotebookMutation = useDeleteNotebook();

  useEffect(() => {
    const stored = localStorage.getItem("fluxmind:view-mode");
    if (stored === "grid" || stored === "list") setViewMode(stored);
  }, []);

  useEffect(() => {
    localStorage.setItem("fluxmind:view-mode", viewMode);
  }, [viewMode]);

  useEffect(() => {
    const handler = (): void => setCreateOpen(true);
    window.addEventListener("fluxmind:create-notebook", handler);
    return () => window.removeEventListener("fluxmind:create-notebook", handler);
  }, []);

  const firstName = session?.user?.name?.split(" ")[0] ?? "there";

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {getGreeting()}, {firstName}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {notebooks?.length ?? 0} notebook{notebooks?.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" />
          New Notebook
        </Button>
      </div>

      <div className="flex items-center gap-2 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search notebooks..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger className="inline-flex items-center justify-center gap-1.5 rounded-md border border-input bg-background px-3 h-9 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors cursor-pointer">
            <ArrowUpDown className="h-3.5 w-3.5" />
            Sort
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setSort("updatedAt")}>
              Last Modified
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setSort("createdAt")}>
              Created Date
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setSort("title")}>
              Alphabetical
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="hidden sm:flex items-center border border-input rounded-md">
          <button
            onClick={() => setViewMode("grid")}
            className={`p-2 transition-colors ${viewMode === "grid" ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            onClick={() => setViewMode("list")}
            className={`p-2 transition-colors ${viewMode === "list" ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-lg" />
          ))}
        </div>
      ) : notebooks && notebooks.length > 0 ? (
        <AnimatePresence mode="popLayout">
          <div
            className={
              viewMode === "grid"
                ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3"
                : "flex flex-col gap-2"
            }
          >
            {notebooks.map((notebook, i) => (
              <NotebookCard
                key={notebook.id}
                notebook={notebook}
                index={i}
                onEdit={setEditNotebook}
                onDelete={setDeleteNotebook}
              />
            ))}
          </div>
        </AnimatePresence>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center py-20 text-center"
        >
          <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
            <BookOpen className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="font-medium text-lg mb-1">
            {search ? "No notebooks found" : "Create your first notebook"}
          </h3>
          <p className="text-sm text-muted-foreground mb-4 max-w-sm">
            {search
              ? "Try a different search term"
              : "Notebooks are where you organize your sources, chat with AI, and create studio outputs."}
          </p>
          {!search && (
            <Button onClick={() => setCreateOpen(true)} size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" />
              New Notebook
            </Button>
          )}
        </motion.div>
      )}

      <CreateNotebookDialog open={createOpen} onOpenChange={setCreateOpen} />

      {editNotebook && (
        <EditNotebookDialog
          notebook={editNotebook}
          open={!!editNotebook}
          onOpenChange={(open) => {
            if (!open) setEditNotebook(null);
          }}
        />
      )}

      {deleteNotebook && (
        <DeleteNotebookDialog
          notebook={deleteNotebook}
          open={!!deleteNotebook}
          onOpenChange={(open) => {
            if (!open) setDeleteNotebook(null);
          }}
          onConfirm={() => {
            deleteNotebookMutation.mutate(deleteNotebook.id);
            setDeleteNotebook(null);
          }}
          isDeleting={deleteNotebookMutation.isPending}
        />
      )}
    </div>
  );
};

export default DashboardPage;
