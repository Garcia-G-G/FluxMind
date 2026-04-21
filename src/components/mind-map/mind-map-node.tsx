"use client";

import { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import { Plus, Minus } from "lucide-react";

export type MindMapNodeData = {
  label: string;
  description: string;
  level: number;
  color: string;
  id?: string;
  onToggle?: (id: string) => void;
  isExpanded?: boolean;
  hasChildren?: boolean;
};

const levelStyles: Record<
  number,
  { minWidth: number; fontSize: number; descSize: number; padding: string }
> = {
  0: { minWidth: 240, fontSize: 16, descSize: 12, padding: "16px 20px" },
  1: { minWidth: 200, fontSize: 15, descSize: 11, padding: "14px 18px" },
  2: { minWidth: 160, fontSize: 13, descSize: 10, padding: "12px 14px" },
};

// Convert a hex color like "#7c3aed" into an rgba string with the given alpha.
const hexToRgba = (hex: string, alpha: number): string => {
  const cleaned = hex.replace("#", "");
  if (cleaned.length !== 3 && cleaned.length !== 6) {
    return `rgba(124, 58, 237, ${alpha})`;
  }
  const full =
    cleaned.length === 3
      ? cleaned
          .split("")
          .map((c) => c + c)
          .join("")
      : cleaned;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) {
    return `rgba(124, 58, 237, ${alpha})`;
  }
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

export const MindMapNode = memo(
  ({ data }: { data: MindMapNodeData }): React.ReactNode => {
    const style = levelStyles[data.level] ?? levelStyles[2];

    // Tone down: ~15% tint laid over the surface, subtle accent border.
    const tint = hexToRgba(data.color, 0.15);
    const borderAccent = hexToRgba(data.color, 0.4);

    const showToggle =
      data.level === 1 && data.hasChildren === true && data.onToggle && data.id;

    const handleToggle = (e: React.MouseEvent): void => {
      e.stopPropagation();
      if (data.onToggle && data.id) {
        data.onToggle(data.id);
      }
    };

    return (
      <>
        <Handle
          type="target"
          position={Position.Left}
          style={{ opacity: 0, width: 1, height: 1 }}
        />
        <div
          className="relative overflow-hidden"
          style={{
            minWidth: style.minWidth,
            padding: style.padding,
            background: `linear-gradient(var(--fm-surface), var(--fm-surface)), ${tint}`,
            backgroundBlendMode: "normal",
            backgroundColor: "var(--fm-surface)",
            border: `1px solid ${borderAccent}`,
            borderLeft: `3px solid ${data.color}`,
            borderRadius: 14,
            boxShadow: "0 1px 2px rgba(0,0,0,0.12)",
          }}
        >
          <div className="flex items-center gap-2">
            <p
              className="font-semibold truncate flex-1"
              style={{
                fontSize: style.fontSize,
                color: "var(--fm-text)",
              }}
            >
              {data.label}
            </p>
            {showToggle ? (
              <button
                type="button"
                onClick={handleToggle}
                aria-label={data.isExpanded ? "Collapse" : "Expand"}
                className="shrink-0 inline-flex items-center justify-center rounded-md"
                style={{
                  width: 22,
                  height: 22,
                  background: "var(--fm-glass-bg)",
                  border: `1px solid ${borderAccent}`,
                  color: "var(--fm-text)",
                  cursor: "pointer",
                }}
              >
                {data.isExpanded ? (
                  <Minus size={14} />
                ) : (
                  <Plus size={14} />
                )}
              </button>
            ) : null}
          </div>
          {data.description ? (
            <p
              className="mt-1 line-clamp-2"
              style={{
                fontSize: style.descSize,
                color: "var(--fm-text-secondary)",
              }}
            >
              {data.description}
            </p>
          ) : null}
        </div>
        <Handle
          type="source"
          position={Position.Right}
          style={{ opacity: 0, width: 1, height: 1 }}
        />
      </>
    );
  }
);

MindMapNode.displayName = "MindMapNode";
