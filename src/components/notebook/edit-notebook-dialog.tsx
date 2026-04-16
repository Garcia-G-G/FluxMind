"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useUpdateNotebook } from "@/hooks/use-notebooks";
import { updateNotebookSchema } from "@/lib/validations/notebook";
import type { Notebook } from "@/db/schema/notebooks";

const EMOJI_OPTIONS = [
  "📓", "📚", "🧠", "💡", "🔬", "📊", "🎯", "🗂️",
  "✏️", "📝", "🔖", "🌟", "🚀", "💻", "🎨", "📐",
];

const COLOR_OPTIONS = [
  "#6366f1", "#ec4899", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6",
];

export const EditNotebookDialog = ({
  notebook,
  open,
  onOpenChange,
}: {
  notebook: Notebook;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}): React.ReactNode => {
  const updateNotebook = useUpdateNotebook();
  const [title, setTitle] = useState(notebook.title);
  const [description, setDescription] = useState(notebook.description ?? "");
  const [icon, setIcon] = useState(notebook.icon ?? "📓");
  const [color, setColor] = useState(notebook.color ?? "#6366f1");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setTitle(notebook.title);
    setDescription(notebook.description ?? "");
    setIcon(notebook.icon ?? "📓");
    setColor(notebook.color ?? "#6366f1");
  }, [notebook]);

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setError(null);

    const result = updateNotebookSchema.safeParse({
      title,
      description: description || null,
      icon,
      color,
    });
    if (!result.success) {
      setError(result.error.errors[0].message);
      return;
    }

    try {
      await updateNotebook.mutateAsync({ id: notebook.id, ...result.data });
      onOpenChange(false);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to update notebook"
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Notebook</DialogTitle>
          <DialogDescription>
            Update your notebook details.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-title">Title</Label>
            <Input
              id="edit-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-description">Description</Label>
            <Input
              id="edit-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Icon</Label>
            <div className="flex flex-wrap gap-1.5">
              {EMOJI_OPTIONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setIcon(emoji)}
                  className={`h-9 w-9 rounded-md flex items-center justify-center text-lg transition-colors ${
                    icon === emoji
                      ? "bg-accent ring-2 ring-primary"
                      : "hover:bg-accent/50"
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Color</Label>
            <div className="flex gap-2">
              {COLOR_OPTIONS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`h-8 w-8 rounded-full transition-transform ${
                    color === c
                      ? "ring-2 ring-primary ring-offset-2 ring-offset-background scale-110"
                      : "hover:scale-110"
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={updateNotebook.isPending}>
              {updateNotebook.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Save"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
