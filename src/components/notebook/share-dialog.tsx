"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Share2, Loader2, X, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type Collaborator = {
  userId: string;
  role: string;
  name: string;
  email: string;
  image: string | null;
};

export const ShareDialog = ({
  notebookId,
}: {
  notebookId: string;
}): React.ReactNode => {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [copied, setCopied] = useState(false);
  const queryClient = useQueryClient();

  const { data: collaborators } = useQuery({
    queryKey: ["collaborators", notebookId],
    queryFn: async (): Promise<Collaborator[]> => {
      const res = await fetch(`/api/notebooks/${notebookId}/share`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: open,
  });

  const addCollaborator = useMutation({
    mutationFn: async (data: { email: string; role: string }) => {
      const res = await fetch(`/api/notebooks/${notebookId}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["collaborators", notebookId],
      });
      setEmail("");
    },
  });

  const removeCollaborator = useMutation({
    mutationFn: async (userId: string) => {
      await fetch(`/api/notebooks/${notebookId}/share`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["collaborators", notebookId],
      });
    },
  });

  const handleCopyLink = async (): Promise<void> => {
    const url = `${window.location.origin}/notebook/${notebookId}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-input text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors cursor-pointer">
        <Share2 className="h-4 w-4" />
        Share
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Share Notebook</DialogTitle>
          <DialogDescription>
            Invite collaborators by email or share a link.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Copy link */}
          <div className="flex gap-2">
            <Input
              value={`${typeof window !== "undefined" ? window.location.origin : ""}/notebook/${notebookId}`}
              readOnly
              className="text-xs"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyLink}
              className="shrink-0 gap-1"
            >
              {copied ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>

          {/* Add by email */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (email.trim()) {
                addCollaborator.mutate({ email, role: "editor" });
              }
            }}
          >
            <Label className="text-xs">Add by email</Label>
            <div className="flex gap-2 mt-1">
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="collaborator@example.com"
                className="text-sm"
              />
              <Button
                type="submit"
                size="sm"
                disabled={!email.trim() || addCollaborator.isPending}
              >
                {addCollaborator.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Invite"
                )}
              </Button>
            </div>
            {addCollaborator.error && (
              <p className="text-xs text-destructive mt-1">
                {addCollaborator.error.message}
              </p>
            )}
          </form>

          {/* Collaborator list */}
          {collaborators && collaborators.length > 0 && (
            <div>
              <Label className="text-xs">Collaborators</Label>
              <div className="mt-1 space-y-1">
                {collaborators.map((c) => (
                  <div
                    key={c.userId}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-md"
                  >
                    <Avatar className="h-6 w-6">
                      <AvatarFallback className="text-[10px]">
                        {c.name[0]?.toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{c.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {c.email}
                      </p>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {c.role}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => removeCollaborator.mutate(c.userId)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
