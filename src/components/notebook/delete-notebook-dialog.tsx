"use client";

import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Notebook } from "@/db/schema/notebooks";

export const DeleteNotebookDialog = ({
  notebook,
  open,
  onOpenChange,
  onConfirm,
  isDeleting,
}: {
  notebook: Notebook;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isDeleting: boolean;
}): React.ReactNode => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Notebook</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete &ldquo;{notebook.title}&rdquo;? This
            will permanently remove all sources, conversations, and outputs
            associated with this notebook. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2 pt-2">
          <Button
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
            variant="destructive"
            onClick={onConfirm}
            disabled={isDeleting}
            style={{
              borderRadius: 10,
              background: "var(--fm-error, #e11d48)",
              color: "white",
            }}
          >
            {isDeleting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Delete"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
