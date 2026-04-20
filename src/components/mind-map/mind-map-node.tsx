"use client";

import { memo } from "react";
import { Handle, Position } from "@xyflow/react";

export type MindMapNodeData = {
  label: string;
  description: string;
  level: number;
  color: string;
};

const levelStyles: Record<number, { minWidth: number; fontSize: number; descSize: number; padding: string }> = {
  0: { minWidth: 240, fontSize: 16, descSize: 12, padding: "16px 20px" },
  1: { minWidth: 180, fontSize: 14, descSize: 11, padding: "12px 16px" },
  2: { minWidth: 140, fontSize: 12, descSize: 10, padding: "10px 14px" },
};

export const MindMapNode = memo(({
  data,
}: {
  data: MindMapNodeData;
}): React.ReactNode => {
  const style = levelStyles[data.level] ?? levelStyles[2];

  return (
    <>
      <Handle type="target" position={Position.Top} style={{ opacity: 0, width: 1, height: 1 }} />
      <div
        className="relative overflow-hidden"
        style={{
          minWidth: style.minWidth,
          padding: style.padding,
          background: "var(--fm-glass-bg)",
          border: "1px solid var(--fm-glass-border)",
          borderRadius: 14,
          borderTop: `3px solid ${data.color}`,
          boxShadow: `0 2px 12px ${data.color}20`,
        }}
      >
        <div className="flex items-center gap-2">
          {/* Breathing dot */}
          <div
            className="shrink-0 rounded-full"
            style={{
              width: data.level === 0 ? 10 : 8,
              height: data.level === 0 ? 10 : 8,
              background: data.color,
            }}
          />
          <p
            className="font-semibold truncate"
            style={{
              fontSize: style.fontSize,
              color: "var(--fm-text)",
            }}
          >
            {data.label}
          </p>
        </div>
        {data.description && (
          <p
            className="mt-1 line-clamp-2"
            style={{
              fontSize: style.descSize,
              color: "var(--fm-text-secondary)",
              paddingLeft: data.level === 0 ? 0 : 18,
            }}
          >
            {data.description}
          </p>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0, width: 1, height: 1 }} />
    </>
  );
});

MindMapNode.displayName = "MindMapNode";
