"use client";

import { Plus, StickyNote, ArrowRight, ImageIcon } from "lucide-react";
import { GlassCard } from "@/components/shared/glass-card";

export const CanvasToolbar = ({
  onAddCard,
  onAddNote,
}: {
  onAddCard: () => void;
  onAddNote: () => void;
}): React.ReactNode => {
  const buttons = [
    { icon: Plus, label: "Add Card", onClick: onAddCard },
    { icon: ArrowRight, label: "Connect", onClick: () => {} },
    { icon: ImageIcon, label: "Image", onClick: () => {} },
    { icon: StickyNote, label: "Note", onClick: onAddNote },
  ];

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20">
      <GlassCard padding="sm" className="flex items-center gap-1">
        {buttons.map((btn) => (
          <button
            key={btn.label}
            onClick={btn.onClick}
            title={btn.label}
            className="h-9 w-9 rounded-lg flex items-center justify-center transition-colors"
            style={{ color: "var(--fm-text-secondary)" }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--fm-surface-hover)";
              e.currentTarget.style.color = "var(--fm-text)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = "var(--fm-text-secondary)";
            }}
          >
            <btn.icon className="h-4 w-4" />
          </button>
        ))}
      </GlassCard>
    </div>
  );
};
