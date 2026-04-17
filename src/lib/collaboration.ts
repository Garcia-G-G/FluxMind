import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:1234";

export type CollaborationProvider = {
  doc: Y.Doc;
  provider: WebsocketProvider;
  awareness: WebsocketProvider["awareness"];
  destroy: () => void;
};

export const createCollaborationProvider = (
  notebookId: string,
  user: { id: string; name: string; color: string }
): CollaborationProvider => {
  const doc = new Y.Doc();
  const provider = new WebsocketProvider(
    WS_URL,
    `notebook-${notebookId}`,
    doc,
    { connect: true }
  );

  // Set user awareness (for presence/cursors)
  provider.awareness.setLocalStateField("user", {
    id: user.id,
    name: user.name,
    color: user.color,
  });

  return {
    doc,
    provider,
    awareness: provider.awareness,
    destroy: () => {
      provider.disconnect();
      provider.destroy();
      doc.destroy();
    },
  };
};

export type PresenceUser = {
  id: string;
  name: string;
  color: string;
  view?: string;
};

export const getPresenceUsers = (
  awareness: WebsocketProvider["awareness"],
  currentUserId: string
): PresenceUser[] => {
  const users: PresenceUser[] = [];
  const seen = new Set<string>();

  awareness.getStates().forEach((state) => {
    const user = state.user as PresenceUser | undefined;
    if (user && user.id !== currentUserId && !seen.has(user.id)) {
      seen.add(user.id);
      users.push(user);
    }
  });

  return users;
};

const PRESENCE_COLORS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e",
  "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899",
];

export const getPresenceColor = (userId: string): string => {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash << 5) - hash + userId.charCodeAt(i)) | 0;
  }
  return PRESENCE_COLORS[Math.abs(hash) % PRESENCE_COLORS.length];
};
