"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  BookOpen,
  Brain,
  Beaker,
  Lightbulb,
  GraduationCap,
  Code,
  PenTool,
  Rocket,
  Globe,
  Briefcase,
  Palette,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useCreateNotebook } from "@/hooks/use-notebooks";
import { createNotebookSchema } from "@/lib/validations/notebook";

const ICON_OPTIONS = [
  { name: "BookOpen", icon: BookOpen },
  { name: "Brain", icon: Brain },
  { name: "Beaker", icon: Beaker },
  { name: "Lightbulb", icon: Lightbulb },
  { name: "GraduationCap", icon: GraduationCap },
  { name: "Code", icon: Code },
  { name: "PenTool", icon: PenTool },
  { name: "Rocket", icon: Rocket },
  { name: "Globe", icon: Globe },
  { name: "Briefcase", icon: Briefcase },
  { name: "Palette", icon: Palette },
  { name: "Zap", icon: Zap },
] as const;

const COLOR_OPTIONS = [
  "#ff6b35", "#e11d48", "#7c3aed", "#2563eb", "#22c55e", "#f59e0b",
];

export const CreateNotebookDialog = ({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}): React.ReactNode => {
  const router = useRouter();
  const createNotebook = useCreateNotebook();
  const [title, setTitle] = useState("");
  const [icon, setIcon] = useState("BookOpen");
  const [color, setColor] = useState("#ff6b35");
  const [error, setError] = useState<string | null>(null);

  const SelectedIcon = ICON_OPTIONS.find((i) => i.name === icon)?.icon ?? BookOpen;

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setError(null);

    const result = createNotebookSchema.safeParse({ title, icon, color });
    if (!result.success) {
      setError(result.error.errors[0].message);
      return;
    }

    try {
      const notebook = await createNotebook.mutateAsync(result.data);
      onOpenChange(false);
      setTitle("");
      setIcon("BookOpen");
      setColor("#ff6b35");
      router.push(`/notebook/${notebook.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create notebook");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="sm:!max-w-md">
        <DialogHeader>
          <DialogTitle>Create Notebook</DialogTitle>
          <DialogDescription>
            A new space for your sources and research.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Live preview */}
          <div
            className="flex items-center gap-3 p-3 rounded-xl"
            style={{
              background: "var(--fm-surface)",
              border: "1px solid var(--fm-surface-border)",
            }}
          >
            <div
              className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: `${color}20` }}
            >
              <SelectedIcon className="h-5 w-5" style={{ color }} />
            </div>
            <span
              className="text-sm font-medium truncate"
              style={{ color: "var(--fm-text)" }}
            >
              {title || "Untitled notebook"}
            </span>
          </div>

          {/* Title input */}
          <div>
            <Input
              placeholder="Notebook name..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
              style={{
                height: 42,
                fontSize: 14,
              }}
            />
          </div>

          {/* Icon grid */}
          <div className="flex flex-wrap gap-1.5">
            {ICON_OPTIONS.map((opt) => {
              const isSelected = icon === opt.name;
              return (
                <button
                  key={opt.name}
                  type="button"
                  onClick={() => setIcon(opt.name)}
                  className="flex items-center justify-center transition-all"
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    background: isSelected
                      ? `color-mix(in srgb, ${color} 15%, transparent)`
                      : "transparent",
                    color: isSelected ? color : "var(--fm-text-tertiary)",
                    border: isSelected
                      ? `1px solid color-mix(in srgb, ${color} 30%, transparent)`
                      : "1px solid transparent",
                  }}
                >
                  <opt.icon className="h-[18px] w-[18px]" />
                </button>
              );
            })}
          </div>

          {/* Color dots */}
          <div className="flex gap-2">
            {COLOR_OPTIONS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className="transition-transform"
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  backgroundColor: c,
                  transform: color === c ? "scale(1.1)" : undefined,
                  boxShadow: color === c ? `0 0 0 2px var(--fm-bg-secondary), 0 0 0 4px ${c}` : undefined,
                }}
              />
            ))}
          </div>

          {error && (
            <p className="text-sm" style={{ color: "var(--fm-error, #e11d48)" }}>
              {error}
            </p>
          )}

          {/* Buttons */}
          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              style={{
                borderRadius: 10,
                background: "transparent",
                border: "1px solid var(--fm-surface-border)",
                color: "var(--fm-text-secondary)",
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createNotebook.isPending}
              style={{
                borderRadius: 10,
                background: "var(--fm-accent-orange)",
                color: "white",
                fontWeight: 500,
              }}
            >
              {createNotebook.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Create"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
