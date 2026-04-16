"use client";

import { Plus, MessageSquare, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useConversations,
  useDeleteConversation,
} from "@/hooks/use-conversations";
import { cn } from "@/lib/utils";

const formatRelativeTime = (date: string): string => {
  const now = new Date();
  const diff = now.getTime() - new Date(date).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(date).toLocaleDateString();
};

export const ConversationSidebar = ({
  notebookId,
  activeConversationId,
  onSelectConversation,
  onNewChat,
}: {
  notebookId: string;
  activeConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onNewChat: () => void;
}): React.ReactNode => {
  const { data: conversations, isLoading } = useConversations(notebookId);
  const deleteConversation = useDeleteConversation();

  return (
    <div className="w-56 border-r border-border bg-card/50 flex flex-col h-full shrink-0 hidden lg:flex">
      <div className="p-2 border-b border-border">
        <Button
          variant="outline"
          size="sm"
          className="w-full gap-1.5 text-xs"
          onClick={onNewChat}
        >
          <Plus className="h-3.5 w-3.5" />
          New Chat
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-10 rounded-md" />
          ))
        ) : conversations && conversations.length > 0 ? (
          conversations.map((convo) => (
            <button
              key={convo.id}
              onClick={() => onSelectConversation(convo.id)}
              className={cn(
                "w-full flex items-start gap-2 px-2 py-1.5 rounded-md text-left transition-colors group",
                activeConversationId === convo.id
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
              )}
            >
              <MessageSquare className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs truncate">
                  {convo.title ?? "Untitled chat"}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {formatRelativeTime(convo.updatedAt)}
                </p>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  deleteConversation.mutate({ id: convo.id, notebookId });
                }}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:text-destructive shrink-0"
                aria-label="Delete conversation"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </button>
          ))
        ) : (
          <p className="text-xs text-muted-foreground text-center py-4">
            No conversations yet
          </p>
        )}
      </div>
    </div>
  );
};
