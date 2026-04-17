"use client";

import { Plus, MessageSquare, Trash2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useConversations,
  useDeleteConversation,
} from "@/hooks/use-conversations";

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
    <div
      className="w-56 flex flex-col h-full shrink-0 hidden lg:flex"
      style={{
        background: "var(--fm-sidebar-bg)",
        backdropFilter: "blur(20px)",
        borderRight: "1px solid var(--fm-sidebar-border)",
      }}
    >
      <div className="p-2" style={{ borderBottom: "1px solid var(--fm-sidebar-border)" }}>
        <button
          onClick={onNewChat}
          className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-medium text-white transition-transform hover:-translate-y-0.5"
          style={{ background: "var(--fm-accent-gradient)", borderRadius: 10 }}
        >
          <Plus className="h-3.5 w-3.5" />
          New Chat
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-10 rounded-lg" style={{ background: "var(--fm-surface)" }} />
          ))
        ) : conversations && conversations.length > 0 ? (
          conversations.map((convo) => {
            const isActive = activeConversationId === convo.id;
            return (
              <button
                key={convo.id}
                onClick={() => onSelectConversation(convo.id)}
                className="w-full flex items-start gap-2 px-2 py-1.5 text-left transition-colors group relative"
                style={{
                  borderRadius: 10,
                  background: isActive ? "var(--fm-surface-hover)" : undefined,
                  color: isActive ? "var(--fm-text)" : "var(--fm-text-secondary)",
                }}
              >
                {isActive && (
                  <div
                    className="absolute left-0 top-1 bottom-1 w-[2px] rounded-r"
                    style={{
                      background: "linear-gradient(180deg, var(--fm-accent-orange), var(--fm-accent-violet))",
                    }}
                  />
                )}
                <MessageSquare className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs truncate">{convo.title ?? "Untitled chat"}</p>
                  <p className="text-[10px]" style={{ color: "var(--fm-text-tertiary)" }}>
                    {formatRelativeTime(convo.updatedAt)}
                  </p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteConversation.mutate({ id: convo.id, notebookId });
                  }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 shrink-0"
                  style={{ color: "var(--fm-error)" }}
                  aria-label="Delete conversation"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </button>
            );
          })
        ) : (
          <p className="text-xs text-center py-4" style={{ color: "var(--fm-text-tertiary)" }}>
            No conversations yet
          </p>
        )}
      </div>
    </div>
  );
};
